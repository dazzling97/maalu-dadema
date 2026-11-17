// Bot playtests: scripted player types play the real five-minute challenge in a headless browser.
// Usage: npm run build && node tests/playtest.cjs
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const PERSONAS = {
  beginner: { plan: ['A'], react: 480, miss: 0.35, skill: 0.2, dodge: false, flee: false, guard: false },
  average: { plan: ['A', 'B'], react: 280, miss: 0.12, skill: 0.55, dodge: true, flee: false, guard: true },
  skilled: { plan: ['A', 'B', 'C'], react: 190, miss: 0.04, skill: 0.9, dodge: true, flee: false, guard: true },
  noDefence: { plan: ['A', 'B'], react: 260, miss: 0.1, skill: 0, dodge: true, flee: false, guard: false },
  avoider: { plan: ['A', 'B'], react: 260, miss: 0.1, skill: 0, dodge: true, flee: true, guard: false },
  rodOnly: { plan: ['A', 'B'], react: 190, miss: 0.04, skill: 0.9, dodge: true, flee: false, guard: true, buys: false },
  dockCamper: { plan: ['A'], react: 200, miss: 0.05, skill: 0.6, dodge: true, flee: false, guard: false },
};

function installBot(cfg) {
  const g = window.__game, w = g.scene.getScene('world'), L = w.L, pl = w.player, inp = w.input2;
  const bot = { mx: 0, my: 0, act: false, use: false, zi: 0, biteAt: 0, decided: false, path: null, pathT: 0, pi: 1, dodgeT: 0, spawns: 0, firstDecision: -1 };
  Object.defineProperty(inp, 'moveX', { get: () => bot.mx });
  Object.defineProperty(inp, 'moveY', { get: () => bot.my });
  Object.defineProperty(inp, 'dashPressed', { get: () => false });
  Object.defineProperty(inp, 'actionPressed', { get: () => { const a = bot.act; bot.act = false; return a; } });
  Object.defineProperty(inp, 'interactPressed', { get: () => { const a = bot.use; bot.use = false; return a; } });
  let aim = { x: 0, y: 0 };
  w.input.activePointer.positionToCamera = () => aim;
  const sp = w.crocs.spawn.bind(w.crocs); w.crocs.spawn = (z) => { const ok = sp(z); if (ok) bot.spawns++; return ok; };
  const spots = {
    A: { stand: { x: 561, y: 516 }, aim: { x: 524, y: 498 } },
    B: { stand: { x: 881, y: 552 }, aim: { x: 846, y: 530 } },
    C: { stand: L.shorePoint(-2.75, -12), aim: L.shorePoint(-2.75, 40) },
  };
  const bag = { x: 646, y: 686 };
  const fat = new Uint8Array(L.solid.length);
  for (let y = 0; y < L.gh; y++) for (let x = 0; x < L.gw; x++) {
    let v = 0;
    for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= L.gw || ny >= L.gh || L.solid[ny * L.gw + nx]) { v = 1; break; } }
    fat[y * L.gw + x] = v;
  }
  const G = { gw: L.gw, gh: L.gh, cell: L.cell, solid: fat };
  const goTo = (t, now, tol = 7) => {
    if (!bot.path || now > bot.pathT) { bot.path = window.__mh.findPath(G, { x: pl.x, y: pl.y }, t); bot.pathT = now + 400; bot.pi = 1; }
    const p = bot.path;
    if (Math.hypot(t.x - pl.x, t.y - pl.y) < tol) { bot.mx = bot.my = 0; return true; }
    if (!p || !p.length) { bot.mx = bot.my = 0; return false; }
    while (bot.pi < p.length - 1 && Math.hypot(p[bot.pi].x - pl.x, p[bot.pi].y - pl.y) < 5) bot.pi++;
    const q = p[Math.min(bot.pi, p.length - 1)], dx = q.x - pl.x, dy = q.y - pl.y;
    bot.mx = Math.abs(dx) > 1.5 ? Math.sign(dx) : 0; bot.my = Math.abs(dy) > 1.5 ? Math.sign(dy) : 0;
    return false;
  };
  const timer = setInterval(() => {
    const now = performance.now(), f = w.fishing, eco = w.eco, th = w.sabapathi;
    if (!pl.alive || w.over) { bot.mx = bot.my = 0; return; }
    const crocs = w.crocs.list.filter((c) => c.hittable);
    const near = crocs.map((c) => ({ c, d: Math.hypot(c.x - pl.x, c.y - pl.y) })).sort((a, b) => a.d - b.d)[0];
    const thiefD = Math.hypot(th.x - pl.x, th.y - pl.y);
    // throw
    if (cfg.skill > 0 && w.stones.ammo > 0 && Math.random() < 0.25) {
      let tgt = null;
      if (near && near.c.hunting && near.d < 100) tgt = near.c;
      else if ((th.incoming || th.loot > 0) && thiefD < 135) tgt = th;
      if (tgt && Math.random() < cfg.skill) { const n = (1 - cfg.skill) * 26; w.stones.throwAt(tgt.x + (Math.random() - 0.5) * n, tgt.y - 4 + (Math.random() - 0.5) * n); }
    }
    // dodge
    const danger = near && ((cfg.dodge && near.c.fsm.current === 'telegraph' && near.d < 60) || (cfg.flee && near.c.hunting && near.d < 90));
    if (danger) bot.dodgeT = now + 700;
    if (now < bot.dodgeT && near) {
      const dx = pl.x - near.c.x, dy = pl.y - near.c.y;
      bot.mx = cfg.flee ? (Math.sign(dx) || 1) : (Math.sign(-dy) || 1); bot.my = L.pondAt(pl.x, pl.y + 6) > L.pondAt(pl.x, pl.y - 6) ? 1 : -1;
      bot.path = null; return;
    }
    if (f.state !== 'none') { // line out
      // a guard reels in and runs back when Sabapathi is on his way
      if (cfg.guard && (th.incoming || th.loot > 0) && f.state === 'wait') { bot.mx = 1; return; }
      bot.mx = bot.my = 0;
      if (f.state === 'bite' && !bot.decided) { bot.decided = true; bot.biteAt = Math.random() < cfg.miss ? Infinity : now + cfg.react; }
      if (f.state === 'bite' && now >= bot.biteAt) bot.act = true;
      return;
    }
    bot.decided = false;
    // chase the thief when guarding
    if (cfg.guard && (th.incoming || th.loot > 0) && w.stones.ammo > 0) { goTo({ x: th.x, y: th.y }, now, 60); return; }
    // dropped fish
    if (w.loot.count && eco.room > 0) { const d = w.loot.positions[0]; goTo(d, now, 3); return; }
    // out of rocks: fetch one
    if (cfg.skill > 0 && w.stones.ammo === 0) {
      const r = w.stones.rocks.filter((k) => k.back <= 0).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y))[0];
      if (r) { goTo({ x: r.x, y: r.y + 2 }, now, 3); return; }
    }
    // gear: once the bag can pay for the best unlocked net, walk to the stall, sell and buy
    if (cfg.buys !== false) {
      const M = window.__mh, g = w.gear, stage = M.CUR.index;
      const want = stage >= 2 && !g.owned.includes('advnet') ? 'advnet' : stage >= 1 && !g.owned.includes('net') ? 'net' : null;
      if (want && eco.carried === 0 && eco.stored + g.coins >= M.GEAR[want].cost) {
        if (goTo({ x: 476, y: 690 }, now, 10)) { M.sellFish(g, eco, M.GEAR[want].cost - g.coins); M.buyGear(g, want, stage); w.bagChanged(); w.emitGear(); bot.bought = (bot.bought || '') + want + '@' + Math.round(w.elapsed) + ' '; }
        return;
      }
    }
    // hands full, or carrying near the end: bank
    if (eco.room <= 0 || (eco.carried > 0 && (eco.stored + eco.carried >= window.__mh.RUN.target || w.elapsed > window.__mh.RUN.duration - 15))) {
      if (bot.firstDecision < 0) bot.firstDecision = w.elapsed;
      if (goTo(bag, now, 9)) bot.use = true;
      return;
    }
    // fish, moving on when a spot runs dry
    let z = cfg.plan[bot.zi % cfg.plan.length];
    if (!w.zones.available(z) && cfg.plan.length > 1) { bot.zi++; z = cfg.plan[bot.zi % cfg.plan.length]; }
    const s = spots[z];
    if (goTo(s.stand, now)) { aim = s.aim; if (pl.canAct && w.zones.available(z)) bot.act = true; }
  }, 50);
  if (window.__mh.CUR.index === 2 && cfg.buys !== false) { w.gear.owned.push('net'); w.gear.equipped = 'net'; w.emitGear(); } // as if bought in Stage 2
  window.__bot = bot; window.__botStop = () => clearInterval(timer);
}

(async () => {
  const srv = spawn('npx', ['vite', 'preview', '--port', '4175', '--strictPort'], { cwd: __dirname + '/..', stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  const run = async (name, cfg, stage) => {
    const p = await b.newPage({ viewport: { width: 480, height: 270 } });
    const errs = []; p.on('pageerror', (e) => errs.push(e.message));
    await p.goto(`http://localhost:4175/?zoom=1&stage=${stage}`); await p.waitForTimeout(4000);
    await p.keyboard.press('Enter'); await p.waitForTimeout(4500);
    await p.evaluate(installBot, cfg);
    let m = null;
    for (;;) {
      await p.waitForTimeout(2000);
      m = await p.evaluate(() => { const w = window.__game.scene.getScene('world'), e = w.eco, t = w.sabapathi, b = window.__bot; return { t: w.elapsed, over: w.over, outcome: w.stats.outcome, caught: e.caught, stored: e.stored, stolen: e.stolen, stunned: e.stunned, raids: t.raids, chase: t.chaseTime, dmg: w.stats.damage, deposits: w.stats.deposits, firstDeposit: w.stats.firstDepositAt, idle: w.stats.idle, misses: w.fishing.misses, spawns: b.spawns, hearts: w.stats.hearts, events: w.eventLog.join(','), bought: b.bought || '', sold: e.sold, fps: Math.round(window.__game.loop.actualFps) }; });
      if (m.over) break;
    }
    await p.close();
    const min = m.t / 60;
    return { persona: name, stage, outcome: m.outcome, time: Math.round(m.t), inBag: m.stored, caught: m.caught, fishPerMin: +(m.caught / min).toFixed(1), firstDeposit: Math.round(m.firstDeposit), deposits: m.deposits, misses: m.misses, crocs: m.spawns, stunned: m.stunned, bites: m.dmg, hearts: m.hearts, raids: m.raids, stolen: m.stolen, avgChase: m.raids ? +(m.chase / m.raids).toFixed(1) : 0, bought: m.bought, sold: m.sold, idlePct: Math.round((m.idle / m.t) * 100), events: m.events, fps: m.fps, errors: errs.length };
  };
  const only = process.argv[2] ? process.argv[2].split(',') : null; // e.g. "average:2,skilled:3"
  const jobs = only ? only.map((j) => j.split(':')) : Object.keys(PERSONAS).map((n) => [n, '1']);
  const out = await Promise.all(jobs.map(([n, st]) => run(n, PERSONAS[n], Number(st))));
  console.table(out.map(({ events, ...r }) => r));
  console.log(JSON.stringify(out));
  await b.close(); srv.kill(); process.exit(0);
})();
