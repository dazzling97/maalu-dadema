import { describe, it, expect } from 'vitest';
import { Economy } from '../src/systems/Economy';
import { ZoneState } from '../src/systems/Zones';
import { bandAt, crocInterval, theftUrge, grabSize, SpawnClock } from '../src/systems/Director';
import { findPath } from '../src/systems/Pathfind';
import { pickEvent, EventClock } from '../src/systems/Events';
import { allowed, MIX } from '../src/systems/Audio';
import { freshGear, copyGear, sellFish, buyGear, equipGear, cycleGear, catchSize } from '../src/systems/Gear';
import { GEAR } from '../src/config/balance';
import { ZONES, RUN, BANDS, BAG_RAID, EVENTS, STAGES, CUR, BAND_SPAN, applyStage } from '../src/config/balance';

describe('carrying and the fish bag', () => {
  it('caps what the player can carry', () => {
    const e = new Economy();
    for (let i = 0; i < 8; i++) e.catchFish();
    expect(e.carried).toBe(RUN.carryMax);
    expect(e.caught).toBe(RUN.carryMax);
    expect(e.catchFish(3)).toBe(0);
  });
  it('deposits exactly once: carried fish move to the bag and cannot be deposited again', () => {
    const e = new Economy();
    e.catchFish(); e.catchFish();
    expect(e.deposit()).toBe(2);
    expect(e.stored).toBe(2);
    expect(e.carried).toBe(0);
    expect(e.deposit()).toBe(0);
    expect(e.stored).toBe(2);
  });
  it('wins on fish in the bag, not on fish ever caught', () => {
    const e = new Economy();
    e.stored = RUN.target - 1; e.caught = 99;
    expect(e.won).toBe(false);
    e.catchFish(); e.deposit();
    expect(e.won).toBe(true);
    e.steal(1);
    expect(e.won).toBe(false);
  });
});

describe('theft and recovery', () => {
  it('never takes more than the bag holds and never goes negative', () => {
    const e = new Economy();
    e.stored = 2;
    expect(e.steal(5)).toBe(2);
    expect(e.stored).toBe(0);
    expect(e.steal(3)).toBe(0);
    expect(e.stored).toBe(0);
  });
  it('conserves fish through steal, drop, recover and escape', () => {
    const e = new Economy();
    e.stored = 8;
    const sack = e.steal(grabSize(8));
    expect(sack).toBe(3);
    // stunned: three fish on the ground; the player recovers two, one expires
    expect(e.pickUp()).toBe(true);
    expect(e.pickUp()).toBe(true);
    e.deposit();
    expect(e.stored).toBe(7);
    // a later raid escapes
    const sack2 = e.steal(grabSize(e.stored));
    e.lose(sack2);
    expect(e.stored + e.stolen).toBe(7);
  });
  it('a bite drops everything carried, and full hands cannot pick up', () => {
    const e = new Economy();
    e.catchFish(RUN.carryMax);
    expect(e.pickUp()).toBe(false);
    expect(e.drop()).toBe(RUN.carryMax);
    expect(e.carried).toBe(0);
    expect(e.drop()).toBe(0);
  });
  it('grabs a small share of the bag', () => {
    expect(grabSize(0)).toBe(0);
    expect(grabSize(1)).toBe(1);
    expect(grabSize(4)).toBe(2);
    expect(grabSize(19)).toBe(BAG_RAID.maxTake);
  });
});

describe('Sabapathi urge', () => {
  const base = { stored: 6, playerDist: 40, fishing: false, sinceLastRaid: 999, elapsed: 120 };
  it('is zero in the opening, during cooldown, or for a near-empty bag', () => {
    expect(theftUrge({ ...base, elapsed: 5 })).toBe(0);
    expect(theftUrge({ ...base, sinceLastRaid: 3 })).toBe(0);
    expect(theftUrge({ ...base, stored: BAG_RAID.minStored - 1 })).toBe(0);
  });
  it('grows when the player is away, fishing, or close to winning', () => {
    const near = theftUrge(base);
    expect(theftUrge({ ...base, playerDist: 400 })).toBeGreaterThan(near);
    expect(theftUrge({ ...base, fishing: true })).toBeGreaterThan(near);
    expect(theftUrge({ ...base, stored: 18 })).toBeGreaterThan(near);
    expect(theftUrge({ ...base, stored: 18, playerDist: 400, fishing: true })).toBeLessThanOrEqual(1);
  });
});

describe('difficulty bands', () => {
  it('cover the whole run and only ever get harder, within caps', () => {
    expect(bandAt(0)).toBe(BANDS[0]);
    expect(bandAt(RUN.duration + 50)).toBe(BANDS[BANDS.length - 1]);
    expect(BANDS[BANDS.length - 1].until).toBe(BAND_SPAN);
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i].crocMax).toBeGreaterThanOrEqual(BANDS[i - 1].crocMax);
      expect(BANDS[i].crocInterval).toBeLessThan(BANDS[i - 1].crocInterval);
      expect(BANDS[i].crocMax).toBeLessThanOrEqual(3);
    }
    expect(BANDS[0].crocMax).toBe(1);
  });
  it('riskier water brings crocodiles sooner', () => {
    expect(crocInterval(BANDS[1], 'C')).toBeLessThan(crocInterval(BANDS[1], 'A'));
  });
  it('spawn clock honours the opening peace, the cap and the breather', () => {
    const c = new SpawnClock(16, 7);
    expect(c.tick(100, 5, 10, 3, 0)).toBe(false); // too early
    expect(c.tick(100, 60, 10, 3, 3)).toBe(false); // at the cap
    expect(c.tick(0.1, 60, 10, 3, 0)).toBe(true);
    expect(c.tick(11, 190, 10, 3, 3)).toBe(false);
    c.breather();
    expect(c.tick(1, 191, 10, 3, 0)).toBe(false); // due and room, but still in the breather
    expect(c.tick(7, 198, 10, 3, 0)).toBe(true);
  });
});

describe('zone depletion', () => {
  it('drains with catches, slows bites, and recovers when left alone', () => {
    const z = new ZoneState();
    const w0 = z.waitMul('A');
    for (let i = 0; i < ZONES.A.popMax; i++) z.take('A');
    expect(z.available('A')).toBe(false);
    expect(z.waitMul('A')).toBeGreaterThan(w0);
    z.update(5, 'A');
    expect(z.pop.A).toBe(0);
    z.update(30, null);
    expect(z.available('A')).toBe(true);
  });
  it('never leaves every zone empty', () => {
    const z = new ZoneState();
    z.pop = { A: 0, B: 0, C: 0 };
    z.update(0.016, 'A');
    expect(z.available('B') || z.available('C')).toBe(true);
  });
});

describe('events', () => {
  it('only picks eligible events, by weight', () => {
    expect(pickEvent([], 0.5)).toBeNull();
    expect(pickEvent(['rush'], 0.99)).toBe('rush');
    expect(pickEvent(['golden', 'frenzy'], 0)).toBe('golden');
  });
  it('never overlaps events and leaves a gap between them', () => {
    const c = new EventClock(), all = ['golden', 'frenzy', 'rush', 'bonanza'] as const;
    expect(c.tick(1, 10, [...all])).toBeNull();
    const start = c.tick(1, EVENTS.firstAt, [...all], () => 0)!;
    expect(start.type).toBe('start');
    expect(c.tick(1, EVENTS.firstAt + 1, [...all])).toBeNull();
    const end = c.tick(EVENTS.defs[start.id].duration, EVENTS.firstAt + 20, [...all], () => 0)!;
    expect(end).toEqual({ type: 'end', id: start.id });
    expect(c.tick(1, EVENTS.firstAt + 21, [...all])).toBeNull();
  });
});

describe('pathfinding', () => {
  const gw = 8, gh = 6, solid = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++) if (y !== 4) solid[y * gw + 4] = 1;
  const g = { gw, gh, cell: 4, solid };
  it('routes through the gap and never through walls', () => {
    const p = findPath(g, { x: 2, y: 2 }, { x: 30, y: 2 })!;
    for (const q of p) expect(solid[Math.floor(q.y / 4) * gw + Math.floor(q.x / 4)]).toBe(0);
    expect(p.some((q) => Math.floor(q.x / 4) === 4 && Math.floor(q.y / 4) === 4)).toBe(true);
  });
  it('returns null when sealed off', () => {
    const sealed = { ...g, solid: Uint8Array.from(solid) };
    sealed.solid[4 * gw + 4] = 1;
    expect(findPath(sealed, { x: 2, y: 2 }, { x: 30, y: 2 })).toBeNull();
  });
});

describe('three fixed stages', () => {
  it('have the required targets and time limits', () => {
    expect(STAGES.map((s) => [s.target, s.duration])).toEqual([[20, 180], [30, 210], [50, 240]]);
  });
  it('applying a stage sets the rules every system reads', () => {
    applyStage(2);
    expect([RUN.target, RUN.duration, CUR.index]).toEqual([50, 240, 2]);
    const e = new Economy();
    e.stored = 49; expect(e.won).toBe(false);
    e.stored = 50; expect(e.won).toBe(true);
    expect(bandAt(239)).toBe(BANDS[BANDS.length - 1]); // the bands are fitted to the stage length
    expect(bandAt(40)).toBe(BANDS[0]);
    applyStage(0);
    expect([RUN.target, RUN.duration, CUR.index]).toEqual([20, 180, 0]);
    expect(bandAt(40)).toBe(BANDS[1]);
  });
  it('each stage is harder than the last, within fair limits', () => {
    for (let i = 1; i < STAGES.length; i++) {
      const a = STAGES[i - 1], b = STAGES[i];
      expect(b.crocSpeedMul).toBeGreaterThan(a.crocSpeedMul);
      expect(b.crocIntervalMul).toBeLessThan(a.crocIntervalMul);
      expect(b.thiefCooldownMul).toBeLessThan(a.thiefCooldownMul);
      expect(b.windowMul).toBeLessThan(a.windowMul);
      expect(b.rockShare).toBeLessThanOrEqual(a.rockShare);
    }
    const hard = STAGES[2];
    expect(hard.rockShare).toBeGreaterThanOrEqual(0.7); // rocks stay available
    expect(hard.windowMul).toBeGreaterThanOrEqual(0.75); // bites stay catchable
    applyStage(1);
    expect(theftUrge({ stored: 6, playerDist: 40, fishing: false, sinceLastRaid: 30, elapsed: 50 })).toBeGreaterThan(0);
    applyStage(0);
    expect(theftUrge({ stored: 6, playerDist: 40, fishing: false, sinceLastRaid: 30, elapsed: 50 })).toBe(0); // same moment, stage 1: still cooling down
  });
});

describe('audio mix', () => {
  it('blocks repeats inside the cooldown and lets them through after', () => {
    expect(allowed(undefined, 5, 0.2, 0, 'low')).toBe(true);
    expect(allowed(5, 5.1, 0.2, 0, 'low')).toBe(false);
    expect(allowed(5, 5.3, 0.2, 0, 'low')).toBe(true);
  });
  it('drops low-priority sounds first when it gets busy, never the warnings', () => {
    expect(allowed(undefined, 1, 0, 8, 'low')).toBe(false);
    expect(allowed(undefined, 1, 0, 8, 'medium')).toBe(true);
    expect(allowed(undefined, 1, 0, 50, 'high')).toBe(true);
  });
  it('warnings and stage results sit above routine sounds', () => {
    for (const k of ['stolen', 'crocWarn', 'prowl', 'stage1', 'victory'] as const) {
      expect(MIX[k].pri).toBe('high');
      expect(MIX[k].vol).toBeGreaterThan(MIX.pickup.vol);
      expect(MIX[k].vol).toBeGreaterThan(MIX.catch.vol);
    }
    expect(MIX.pickup.pri).toBe('low');
    expect(MIX.step.vol).toBeLessThan(0.2);
  });
});

describe('fish coins and equipment', () => {
  it('matches the worked example: 12 in the bag, sell 5, buy the net', () => {
    applyStage(1);
    const e = new Economy(), g = freshGear();
    e.stored = 12;
    expect(sellFish(g, e, 5)).toBe(5);
    expect([e.stored, g.coins]).toEqual([7, 5]);
    expect(buyGear(g, 'net', 1)).toBe('ok');
    expect([g.coins, g.equipped, g.owned]).toEqual([0, 'net', ['rod', 'net']]);
    applyStage(0);
  });
  it('never sells more than the bag holds and never goes negative', () => {
    const e = new Economy(), g = freshGear();
    e.stored = 3;
    expect(sellFish(g, e, 5)).toBe(3);
    expect([e.stored, g.coins]).toEqual([0, 3]);
    expect(sellFish(g, e, 1)).toBe(0);
    expect([e.stored, g.coins, e.sold]).toEqual([0, 3, 3]);
  });
  it('refuses purchases that are locked, unaffordable or already owned, without charging', () => {
    const g = freshGear();
    g.coins = 20;
    expect(buyGear(g, 'net', 0)).toBe('locked'); // Stage 1
    expect(buyGear(g, 'advnet', 1)).toBe('locked'); // Stage 2
    expect(g.coins).toBe(20);
    g.coins = 4;
    expect(buyGear(g, 'net', 1)).toBe('poor');
    expect([g.coins, g.owned.length]).toEqual([4, 1]);
    g.coins = 5;
    expect(buyGear(g, 'net', 1)).toBe('ok');
    g.coins = 50;
    expect(buyGear(g, 'net', 1)).toBe('owned');
    expect(g.coins).toBe(50);
    expect(buyGear(g, 'advnet', 2)).toBe('ok');
    expect(g.coins).toBe(50 - GEAR.advnet.cost);
  });
  it('switches only between owned equipment', () => {
    const g = freshGear();
    expect(cycleGear(g)).toBe('rod');
    expect(equipGear(g, 'net')).toBe(false);
    g.owned.push('net', 'advnet');
    expect([cycleGear(g), cycleGear(g), cycleGear(g)]).toEqual(['net', 'advnet', 'rod']);
  });
  it('a catch respects the equipment, free hands and fish left in the spot', () => {
    expect([GEAR.rod.catch, GEAR.net.catch, GEAR.advnet.catch]).toEqual([1, 3, 5]);
    expect([GEAR.net.cost, GEAR.advnet.cost]).toEqual([5, 12]);
    expect(catchSize(1, 5, 9)).toBe(1);
    expect(catchSize(3, 5, 9)).toBe(3);
    expect(catchSize(5, 5, 9)).toBe(5);
    expect(catchSize(5, 2, 9)).toBe(2); // only two free hands
    expect(catchSize(5, 5, 2.7)).toBe(2); // only two fish left here
    expect(catchSize(3, 0, 9)).toBe(0);
    const e = new Economy();
    e.catchFish(3); e.catchFish(catchSize(5, e.room, 9));
    expect(e.carried).toBe(5);
    expect(e.deposit()).toBe(5);
    expect(e.stored).toBe(5);
  });
  it('a retry restores the stage-start snapshot, not the spent state', () => {
    const start = freshGear(); start.coins = 2;
    const live = copyGear(start);
    live.coins += 5; buyGear(live, 'net', 1);
    expect([start.coins, start.owned]).toEqual([2, ['rod']]);
    const retry = copyGear(start);
    expect(retry).toEqual({ coins: 2, owned: ['rod'], equipped: 'rod' });
  });
});
