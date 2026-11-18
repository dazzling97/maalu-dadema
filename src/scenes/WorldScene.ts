import Phaser from 'phaser';
import { DEPTH, WORLD, PAL, VIEW, ZOOM, CAM_LEAD } from '../config/game';
import { characterById, RUN, THREAT, ZoneId, ZONES, EVENTS, EventId, CUR, STAGES, GEAR, SHOP_OPENS_STAGE, STONE } from '../config/balance';
import { GearState, freshGear, cycleGear } from '../systems/Gear';
import { ShopApi } from './ShopScene';
import { Layout, DOCKS, SPAWN, POND_C, BAG_POS, SHOP, SHOP_DOOR, GEAR_POS } from '../world/layout';
import { ORIGIN } from '../art/textures';
import { WATER_BOX } from '../art/water';
import { HD, hdScale } from '../art/hd';
import { GROUND_TILE, GROUND_COLS, GROUND_ROWS } from '../art/groundHD';
import { Player } from '../entities/Player';
import { Thief } from '../entities/Thief';
import { Ambient } from '../entities/Ambient';
import { Fishing } from '../entities/Fishing';
import { Crocs, Crocodile } from '../entities/Crocodile';
import { Stones } from '../entities/Stones';
import { Loot } from '../entities/Loot';
import { Input } from '../systems/Input';
import { Economy } from '../systems/Economy';
import { ZoneState } from '../systems/Zones';
import { bandAt, crocInterval, SpawnClock } from '../systems/Director';
import { EventClock } from '../systems/Events';
import { findPath } from '../systems/Pathfind';
import { load, save, submitScore } from '../systems/Storage';
import { RunResult } from './ResultScene';
import { Totals } from './flow';
import { audio } from '../systems/Audio';
import { Tutor } from '../entities/Tutor';
import { uiText } from './UiScene';
import { touch, touchMode } from '../systems/Touch';

export class WorldScene extends Phaser.Scene {
  private L!: Layout;
  private player!: Player;
  private sabapathi!: Thief;
  private ambient!: Ambient;
  private fishing!: Fishing;
  private crocs!: Crocs;
  private stones!: Stones;
  private loot!: Loot;
  private eco!: Economy;
  private zones!: ZoneState;
  private clock!: SpawnClock;
  private events2!: EventClock;
  private input2!: Input;
  private bag!: Phaser.GameObjects.Sprite;
  private bagLabel!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Image;
  private gear: GearState = freshGear();
  private stallOpen = false;
  private shopSign?: Phaser.GameObjects.Sprite;
  private promptLabel!: Phaser.GameObjects.Text;
  private tipQueue: { id: string; title: string; sub?: string; icon?: string; frame?: number; ms?: number }[] = [];
  private goldenSprite?: Phaser.GameObjects.Sprite;
  private zone = '';
  private zoneT = 0;
  private elapsed = 0;
  private sinceHit = 999;
  private lastSecond = -1;
  private bandLabel = '';
  private over = false;
  private started = false;
  private floatN = 0;
  private attract = false;
  private depositing = false;
  private tutor!: Tutor;
  private keyEsc!: Phaser.Input.Keyboard.Key;
  /** Touch play: on-screen controls instead of keyboard and mouse. */
  private touchOn = false;
  private touchUse: '' | 'deposit' | 'shop' = '';
  private aimGfx!: Phaser.GameObjects.Graphics;
  private aimMarks: Phaser.GameObjects.Image[] = [];
  /** Counters read by the automated playtests. */
  stats = { damage: 0, deposits: 0, firstDepositAt: -1, idle: 0, hearts: 3, outcome: '' };
  eventLog: string[] = [];

  constructor() { super('world'); }

  create() {
    this.L = this.registry.get('layout') as Layout;
    const L = this.L;
    const pick = (n: number) => Math.floor(n * 7919) % 3;

    for (let r = 0, i = 0; r < GROUND_ROWS; r++) for (let c = 0; c < GROUND_COLS; c++, i++) {
      this.add.image(c * GROUND_TILE.w, r * GROUND_TILE.h, `ground${i}`).setOrigin(0).setScale(HD).setDepth(DEPTH.ground);
    }
    this.buildWater();
    DOCKS.forEach((D, i) => this.add.image(D.x, D.y, `dock${i}`).setOrigin(ORIGIN[`dock${i}`].x, ORIGIN[`dock${i}`].y).setScale(hdScale(`dock${i}`)).setDepth(DEPTH.flat + 1));

    // lily pads bob gently, each on its own beat
    for (const l of L.lilies) {
      const s = this.add.image(l.x, l.y, 'lily', l.flower).setOrigin(ORIGIN.lily.x, ORIGIN.lily.y).setScale(hdScale('lily')).setDepth(DEPTH.flat);
      this.tweens.add({ targets: s, y: l.y + 1, duration: 1100 + ((l.x * 13) % 900), yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    const cp = L.shorePoint(2.2, 26);
    const canoe = this.add.image(cp.x, cp.y, 'canoe').setOrigin(ORIGIN.canoe.x, ORIGIN.canoe.y).setScale(hdScale('canoe')).setDepth(DEPTH.flat + 1);
    this.tweens.add({ targets: canoe, y: cp.y + 1, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // zone dressing: dead stumps in the swamp, rocks in the river bend
    for (const d of L.waterDecor()) {
      const key = d.kind === 'stump' ? 'stump' : `rockM${pick(d.x)}`;
      this.add.image(d.x, d.y, key).setOrigin(ORIGIN[key].x, ORIGIN[key].y).setScale(hdScale(key)).setDepth(DEPTH.flat + 0.8);
    }

    // y-sorted props
    for (const p of L.props) {
      const variant = pick(p.x + p.y);
      const multi = ['palm', 'palmKing', 'tree', 'bush', 'bushFlower', 'banana', 'rockS', 'rockM', 'rockL'].includes(p.kind);
      const isSign = p.kind.startsWith('sign');
      const key = isSign ? 'sign' : multi ? `${p.kind}${variant}` : p.kind === 'bag' ? 'bagHD' : p.kind;
      const s = this.add.sprite(p.x, p.y, key, isSign ? 'ABC'.indexOf(p.kind[4]) : 0).setOrigin(ORIGIN[key].x, ORIGIN[key].y).setScale(hdScale(key)).setDepth(DEPTH.sorted + p.y);
      if (p.kind === 'bag') this.bag = s;
      if (p.kind === 'lella') {
        // the gear stall exists only from Stage 2 (and never on the title screen)
        this.stallOpen = CUR.index >= SHOP_OPENS_STAGE && this.registry.get('attract') !== true;
        L.setStall(this.stallOpen);
        s.setVisible(this.stallOpen);
        if (this.stallOpen) {
          this.add.image(p.x + 4, p.y + 1, 'shadow').setScale(HD * 3, HD * 1.4).setAlpha(0.8).setDepth(DEPTH.flat + 2); // soft shadow under the stall
          this.shopSign = this.add.sprite(p.x, p.y - 39, 'shopSign', 0).setOrigin(ORIGIN.shopSign.x, ORIGIN.shopSign.y).setScale(hdScale('shopSign')).setDepth(DEPTH.sorted + p.y + 1);
        } else this.shopSign = undefined;
      }
      if (p.kind === 'palm' || p.kind === 'palmKing') { s.play(`${key}-sway`); s.anims.setProgress(((p.x * 7) % 10) / 10); if ((p.x & 1) === 0) s.setFlipX(true); }
      else if (p.kind === 'reeds') { s.play('reeds'); s.anims.setProgress(((p.x * 3) % 10) / 10); }
      else if (p.kind === 'egret') s.play('egret');
      else if (p.kind === 'tree' || p.kind === 'banana') {
        if ((p.x & 1) === 0) s.setFlipX(true);
        this.tweens.add({ targets: s, x: p.x + 1, duration: 1800 + ((p.y * 17) % 1200), yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [1], delay: (p.x * 31) % 2000 });
      }
    }

    // ---- systems and actors
    const input = new Input(this);
    this.input2 = input;
    this.eco = new Economy();
    this.zones = new ZoneState();
    this.clock = new SpawnClock(THREAT.firstSpawn, THREAT.graceAfterEncounter);
    this.events2 = new EventClock();
    this.eventLog = []; this.goldenSprite = undefined;
    this.elapsed = 0; this.sinceHit = 999; this.lastSecond = -1; this.bandLabel = ''; this.over = false; this.started = false; this.zone = ''; this.depositing = false;
    this.stats = { damage: 0, deposits: 0, firstDepositAt: -1, idle: 0, hearts: RUN.hearts, outcome: '' };
    const say = (x: number, y: number, text: string, color: string) => this.float(x, y, text, color);

    this.player = new Player(this, L, input, characterById(load().charId), SPAWN.x, SPAWN.y);
    this.ambient = new Ambient(this, L);
    this.fishing = new Fishing(this, L, this.player, input, this.ambient, this.eco, this.zones);
    this.gear = (this.registry.get('gear') as GearState) ?? freshGear();
    this.fishing.gear = () => GEAR[this.gear.equipped];
    this.fishing.onGolden = () => { const e = this.events2.stop(this.elapsed); if (e) this.endEvent(e.id); };
    this.loot = new Loot(this, this.player, this.eco, say, () => this.fishing.emit());
    this.crocs = new Crocs(this, L, this.player, () => this.onBite(), () => this.clock.breather());
    this.sabapathi = new Thief(this, L, this.player, this.eco, this.loot, say, () => this.bagChanged());
    // rocks only where the player can actually walk to
    const reach = (x: number, y: number) => !!findPath(L, SPAWN, { x, y });
    const allRocks = L.rockSpots(reach);
    const rocks = allRocks.filter((_r, i) => Math.floor((i + 1) * CUR.rockShare) > Math.floor(i * CUR.rockShare)); // later stages leave some spots empty
    this.stones = new Stones(this, L, this.player, rocks, () => [...this.crocs.list, this.sabapathi], (t) => {
      if (t instanceof Crocodile) { this.eco.stunned++; this.clock.breather(); }
      this.float(t.x, t.y - 22, 'BONK!', '#ffe36a');
      const praise = this.tutor.onBonk(t);
      if (praise) this.game.events.emit('coachNote', { text: praise, kind: 'good' });
    }, say);
    this.tutor = new Tutor({
      scene: this, player: this.player, eco: this.eco, stones: this.stones, crocs: this.crocs, thief: this.sabapathi, loot: this.loot,
      gear: () => this.gear, stallOpen: this.stallOpen, nearStall: () => this.nearStall, deposits: () => this.stats.deposits,
    });
    // Sabapathi's raids, as the tutorial needs to hear about them
    const ev = this.game.events;
    const onHeist = (h: { n: number; status: 'stolen' | 'dropped' | 'escaped' } | null) => {
      if (this.attract || !this.tutor) return;
      const note = this.tutor.onHeist(h);
      if (note) this.time.delayedCall(2400, () => { if (!this.over) ev.emit('coachNote', { text: note, kind: 'info' }); });
    };
    const onProwl = () => { if (!this.attract) this.tutor.onProwl(); };
    ev.on('heist', onHeist); ev.on('prowl', onProwl);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { ev.off('heist', onHeist); ev.off('prowl', onProwl); });

    this.bagLabel = uiText(this, BAG_POS.x, BAG_POS.y - 36, '', 8, '#ffe9a8', true).setOrigin(0.5).setDepth(DEPTH.air + 1);
    this.touchOn = touchMode();
    touch.reset();
    this.touchUse = '';
    this.aimGfx = this.add.graphics().setDepth(DEPTH.air + 2);
    this.aimMarks = [];
    this.prompt = this.add.image(0, 0, this.touchOn ? 'key-use' : 'key-e').setScale(HD).setOrigin(0.5, 1).setDepth(DEPTH.air + 4).setVisible(false);
    this.promptLabel = uiText(this, 0, 0, 'Shop', 7, '#fff6d8', true).setOrigin(0, 0.5).setDepth(DEPTH.air + 4).setVisible(false);
    this.tipQueue = [];
    this.bagChanged();

    this.input.setDefaultCursor('none');
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.attract || this.over) return;
      // touch: a tap on the world only matters while ROCK is aiming (the joystick and buttons keep their own touches)
      if (this.touchOn) { if (touch.aiming && !touch.claimed.has(ptr.id)) this.tapThrow(ptr); return; }
      if (!ptr.leftButtonDown()) return;
      const w = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
      // throwing never drops the line: you can defend yourself mid-cast
      if (this.player.canAct || this.fishing.busy) this.tutor.onThrow(this.stones.throwAt(w.x, w.y));
    });
    this.game.events.emit('hearts', this.player.hearts);
    this.game.events.emit('heist', null);
    this.game.events.emit('clock', RUN.duration);
    this.emitGear();

    // light: shafts through the trees, then a warm grade and soft vignette on the lens
    const shafts: [number, number][] = [[380, 660], [960, 700], [200, 340], [1140, 420], [700, 760], [450, 180], [1300, 560], [820, 200]];
    shafts.forEach(([x, y], i) => {
      const r = this.add.image(x, y, 'rays').setScale(HD).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.light).setAlpha(0.22);
      this.tweens.add({ targets: r, alpha: 0.5, duration: 2600 + i * 400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    // screen-fixed overlays: placed so the zoomed camera maps them onto the whole view
    const ox = (VIEW.w * (ZOOM - 1)) / 2, oy = (VIEW.h * (ZOOM - 1)) / 2;
    this.add.image(ox, oy, 'grade').setScale(HD).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.light + 1);
    this.add.image(ox, oy, 'vignette').setScale(HD).setOrigin(0).setScrollFactor(0).setDepth(DEPTH.light + 2);

    const cam = this.cameras.main;
    cam.setZoom(ZOOM);
    cam.setBounds(0, 0, WORLD.w, WORLD.h);
    cam.setRoundPixels(true);
    this.attract = this.registry.get('attract') === true;
    this.keyEsc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    // read the setting on every shake, so turning it off in the pause menu applies at once
    const shake = cam.shake.bind(cam);
    cam.shake = ((...args: Parameters<typeof cam.shake>) => (load().shake ? shake(...args) : cam)) as typeof cam.shake;
    this.events.off('resume');
    this.events.on('resume', () => { this.touchOn = touchMode(); this.prompt.setTexture(this.touchOn ? 'key-use' : 'key-e'); this.keyEsc.reset(); this.input2.reset(); this.bagChanged(); this.emitGear(); this.tutor.sync(); }); // also after the gear stall closes
    if (this.attract) {
      // menu backdrop: nobody on stage, the camera drifts slowly around the pond
      this.player.sprite.setVisible(false); this.player.shadow.setVisible(false);
      this.bagLabel.setVisible(false);
      const drift = { a: 0 };
      cam.centerOn(POND_C.x, POND_C.y + 60);
      this.tweens.add({ targets: drift, a: Math.PI * 2, duration: 80000, repeat: -1, onUpdate: () => cam.centerOn(Math.round(POND_C.x + 40 + Math.cos(drift.a) * 260), Math.round(POND_C.y + 120 + Math.sin(drift.a) * 110)) });
      cam.fadeIn(500, 22, 38, 29);
      return;
    }
    // stage intro card; the clock and all gameplay wait until it clears
    this.time.delayedCall(2700, () => { this.started = true; this.stageTips(); this.tutor.begin(); });
    // camera: opens wide on the pond, then eases down to the player
    cam.centerOn(POND_C.x, POND_C.y + 40);
    cam.fadeIn(700, 22, 38, 29);
    this.time.delayedCall(500, () => {
      cam.pan(SPAWN.x, SPAWN.y - CAM_LEAD, 1500, 'Sine.easeInOut', false, (_c, t) => {
        if (t === 1) cam.startFollow(this.player.sprite, true, 0.1, 0.1, 0, CAM_LEAD);
      });
    });
  }

  // ---------------------------------------------------------------- water
  /**
   * Moving water over the painted pond bed: sunlit crests and cool troughs drifting
   * in different directions over open water, and foam lapping along the shore.
   * Needs WebGL masks; the Canvas renderer keeps the still (but fully painted) pond.
   */
  private buildWater() {
    if (this.renderer.type !== Phaser.WEBGL) return;
    const B = WATER_BOX;
    const mask = (key: string) => this.make.image({ x: B.x, y: B.y, key, add: false }).setOrigin(0).createBitmapMask();
    const open = mask('waterOpen'), shore = mask('waterShore');
    const layer = (key: string, alpha: number, blend = Phaser.BlendModes.NORMAL) =>
      this.add.tileSprite(B.x, B.y, B.w, B.h, key).setOrigin(0).setTileScale(HD).setAlpha(alpha).setBlendMode(blend);
    // open water: one mask for all four layers (each mask costs extra full-screen passes)
    const swell = layer('swell', 1);
    const dark = layer('rippleDark', 0.55);
    const light = layer('rippleLight', 0.7, Phaser.BlendModes.ADD);
    const light2 = layer('rippleLight', 0.35, Phaser.BlendModes.ADD).setTileScale(HD * 1.4);
    this.add.container(0, 0, [swell, dark, light, light2]).setDepth(DEPTH.waterFx).setMask(open);
    const foam = layer('foam', 0.8).setDepth(DEPTH.waterFx).setMask(shore);
    this.tweens.add({ targets: foam, alpha: 0.4, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    // tile offsets are in texture pixels; drift a few world pixels per second
    const drift = (_t: number, dt: number) => {
      const k = dt / 1000;
      swell.tilePositionX += 4 * k; swell.tilePositionY -= 1.5 * k;
      dark.tilePositionX -= 9 * k; dark.tilePositionY += 4 * k;
      light.tilePositionX += 12 * k; light.tilePositionY += 3 * k;
      light2.tilePositionX -= 7 * k; light2.tilePositionY -= 2 * k;
      foam.tilePositionX += 5 * k; foam.tilePositionY = Math.sin(this.time.now / 900) * 6;
    };
    this.events.on('update', drift);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('update', drift));
  }

  // ---------------------------------------------------------------- fish bag
  private bagChanged() {
    this.fishing.emit();
    const n = this.eco.stored;
    this.bag.setFrame(n === 0 ? 0 : n < RUN.target / 2 ? 1 : 2);
    this.bagLabel.setText(`${n} / ${RUN.target}`).setColor(n >= RUN.target ? '#9ff08a' : '#ffe9a8');
  }
  private get nearBag() { return Math.hypot(this.player.x - BAG_POS.x, (this.player.y - BAG_POS.y) * 1.2) < RUN.interactRadius + 8; }

  /** Press E at the bag: carried fish go in, once. */
  private deposit() {
    const n = this.eco.deposit(); // the fish leave the player's hands in one step: nothing can be deposited twice
    if (!n) return;
    this.depositing = true;
    this.stats.deposits++;
    if (this.stats.firstDepositAt < 0) this.stats.firstDepositAt = this.elapsed;
    const px = this.player.x, py = this.player.y - 14;
    for (let i = 0; i < n; i++) {
      this.time.delayedCall(i * 90 + 240, () => audio.play('deposit', 1 + i * 0.12)); // each fish lands a little higher
      const img = this.add.image(px, py, 'catchHD', i % 3).setScale(HD).setDepth(DEPTH.air + 3).setVisible(false);
      this.tweens.add({
        targets: img, x: BAG_POS.x, y: BAG_POS.y - 20, duration: 260, delay: i * 90, ease: 'Quad.in',
        onStart: () => img.setVisible(true),
        onComplete: () => { img.destroy(); this.tweens.add({ targets: this.bag, y: BAG_POS.y - 2, duration: 60, yoyo: true }); },
      });
    }
    this.float(BAG_POS.x, BAG_POS.y - 46, `+${n} IN THE BAG`, '#9ff08a');
    this.bagChanged();
    this.game.events.emit('deposited', n);
    this.time.delayedCall(n * 90 + 260, () => { this.depositing = false; });
    if (this.eco.won) this.end('win');
  }

  private emitGear() { this.game.events.emit('gear', { coins: this.gear.coins, equipped: this.gear.equipped, owned: this.gear.owned.length }); }
  private get nearStall() { return this.stallOpen && Math.hypot(this.player.x - GEAR_POS.x, (this.player.y - (GEAR_POS.y + 10)) * 1.2) < RUN.interactRadius + 10; }
  /** For the gear stall interface. */
  shopApi(): ShopApi { return { eco: this.eco, gear: this.gear }; }

  /** E stores carried fish at the bag, or opens the gear stall. (Rocks need no key: walking over them picks them up.) */
  private interact(pressed: boolean) {
    const canBag = this.nearBag && this.eco.carried > 0 && !this.depositing;
    const atStall = !canBag && this.nearStall;
    this.touchUse = canBag ? 'deposit' : atStall ? 'shop' : '';
    this.prompt.setVisible((canBag || atStall) && !this.fishing.busy);
    const bob = Math.round(Math.sin(this.time.now / 260));
    if (canBag) this.prompt.setPosition(BAG_POS.x, BAG_POS.y - 44 + bob);
    else if (atStall) this.prompt.setPosition(GEAR_POS.x - 9, GEAR_POS.y - 62 + bob);
    // "E Shop" marker, and the sign lights up while you are in range
    this.promptLabel.setVisible(atStall && !this.fishing.busy).setPosition(GEAR_POS.x - 1, GEAR_POS.y - 68 + bob);
    this.shopSign?.setFrame(atStall ? 1 : 0);
    if (!pressed || this.fishing.busy) return;
    if (canBag) this.deposit();
    else if (atStall) this.openShop();
    else if (this.nearBag) this.float(BAG_POS.x, BAG_POS.y - 46, 'NOTHING TO STORE', '#f6e7c1');
  }
  private openShop() {
    // not while hurt, dashing or otherwise mid-action
    if (!this.player.canAct || this.player.invuln > 0) return;
    audio.play('shopOpen');
    this.scene.launch('shop', this.shopApi());
    this.scene.pause();
  }
  // ---------------------------------------------------------------- contextual tips
  /** Queue a tip. Each id is shown once per game; it waits until the player is safe and nothing else is on screen. */
  private tip(id: string, t: { title: string; sub?: string; icon?: string; frame?: number; ms?: number }) {
    const seen = (this.registry.get('tipsSeen') as string[]) ?? [];
    if (seen.includes(id) || this.tipQueue.some((q) => q.id === id)) return;
    this.tipQueue.push({ id, ...t });
  }
  private runTips() {
    if (!this.tipQueue.length) return;
    const safe = !this.crocs.hunting && !this.sabapathi.onRaid && this.sinceHit > 3 && !this.fishing.busy;
    if (!safe || this.registry.get('hudBusy') === true) return; // urgent warnings always go first
    const t = this.tipQueue.shift()!;
    this.registry.set('tipsSeen', [...((this.registry.get('tipsSeen') as string[]) ?? []), t.id]);
    this.game.events.emit('tip', t);
  }
  /** When a stage brings something new, say so once and draw the eye to it. */
  private stageTips() {
    if (CUR.index === SHOP_OPENS_STAGE) {
      const first = this.tutor.introducingShop; // the tutorial card says what the shop is
      if (first && this.shopSign) { // a few sparkles and a bobbing sign for the first seconds
        const sign = this.shopSign, y = sign.y;
        this.tweens.add({ targets: sign, y: y - 3, duration: 260, yoyo: true, repeat: 7, ease: 'Sine.inOut', onComplete: () => sign.setY(y) });
        for (let i = 0; i < 10; i++) this.time.delayedCall(2800 + i * 380, () => {
          const sp = this.add.sprite(GEAR_POS.x + Phaser.Math.Between(-24, 24), GEAR_POS.y - 20 - Phaser.Math.Between(0, 44), 'sparkle', 0).setScale(HD).setDepth(DEPTH.air + 4).play('sparkle');
          sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
        });
      }
    }
    if (CUR.index === GEAR.advnet.stage) this.tip('advnet-open', { title: 'Advanced Net Unlocked!', sub: 'Catch up to 5 fish at once.', icon: 'gear', frame: 2, ms: 3600 });
  }

  /** Q: switch to the next owned piece of equipment. */
  private swapGear() {
    if (this.fishing.busy || this.gear.owned.length < 2 || !this.player.canAct) return;
    const id = cycleGear(this.gear);
    audio.play('equip');
    this.float(this.player.x, this.player.y - 40, GEAR[id].name.toUpperCase(), '#ffe9a8');
    this.emitGear();
  }

  // ---------------------------------------------------------------- touch controls
  /** Esc, or the touch pause button. */
  pauseGame() {
    if (this.attract || this.over || !this.started) return;
    this.scene.launch('pause');
    this.scene.pause();
  }
  /** What the on-screen controls need to show. */
  touchInfo() {
    return {
      playing: this.started && !this.over && !this.attract,
      fish: this.fishing.touchState,
      use: this.touchUse,
      gearOwned: this.gear.owned.length,
      gearFrame: GEAR[this.gear.equipped].frame,
      rocks: this.stones.ammo,
    };
  }
  /** ROCK: start aiming (the next tap on a crocodile or Sabapathi throws), or cancel without spending a rock. */
  touchRock() {
    if (this.attract || this.over || !this.started) return;
    if (touch.aiming) { touch.aiming = false; audio.play('uiMove'); return; }
    if (this.stones.ammo <= 0) { this.stones.noRocks(); return; }
    touch.aiming = true;
    audio.play('uiSelect');
    this.float(this.player.x, this.player.y - 40, this.tapTargets().length ? 'TAP A TARGET' : 'TAP A CROCODILE OR SABAPATHI', '#ffe9a8');
  }
  /** Crocodiles and a raiding Sabapathi that can be seen, so can be tapped. */
  private tapTargets(): (Crocodile | Thief)[] {
    const crocs = this.crocs.list.filter((c) => c.sprite.active && c.sprite.alpha > 0.15); // still surfacing counts: it can be seen
    const t = this.sabapathi;
    return t.onRaid && t.sprite.visible && t.sprite.alpha > 0.3 ? [...crocs, t] : crocs;
  }
  /** A tap while aiming: throw at the target's position right now (a moving target can still be missed). */
  private tapThrow(ptr: Phaser.Input.Pointer) {
    const w = ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2, p = this.player;
    let best: Crocodile | Thief | null = null, bd = 30; // generous: a fingertip covers a lot of pond
    for (const t of this.tapTargets()) { const d = Math.hypot(t.x - w.x, t.y - 8 - w.y); if (d < bd) { bd = d; best = t; } }
    if (!best) { touch.aiming = false; this.float(w.x, w.y - 6, 'AIM CANCELLED', '#c9d4b8'); return; } // nothing there: no rock spent
    if (Math.hypot(best.x - p.x, best.y - p.y) > STONE.range) { this.float(best.x, best.y - 30, 'TOO FAR! GET CLOSER', '#ffb0a0'); audio.play('deny'); return; }
    if (!(p.canAct || this.fishing.busy) || this.stones.cooldown > 0) return; // still aiming; tap again in a moment
    const ok = this.stones.throwAt(best.x, best.y - 4, true);
    if (ok || this.stones.ammo <= 0) touch.aiming = false;
    this.tutor.onThrow(ok);
  }
  /** While aiming: the throwing range around the fisherman, and a reticle on everything that can be hit. */
  private drawAim(time: number) {
    const g = this.aimGfx;
    g.clear();
    if (touch.aiming && (this.stones.ammo <= 0 || !this.player.alive)) touch.aiming = false;
    const targets = touch.aiming ? this.tapTargets() : [];
    this.aimMarks.forEach((m, i) => m.setVisible(i < targets.length));
    if (!touch.aiming) return;
    const p = this.player, R = STONE.range, pulse = Math.sin(time / 180);
    // dashed throwing range: a dark underlay so it reads over bright water and grass alike
    const dash = (w: number, col: number, al: number) => {
      g.lineStyle(w, col, al);
      for (let i = 0; i < 48; i += 2) { const a0 = (i / 48) * Math.PI * 2 + time / 4000, a1 = a0 + (Math.PI * 2) / 48; g.beginPath(); g.arc(p.x, p.y - 4, R, a0, a1); g.strokePath(); }
    };
    dash(2.6, 0x1a1220, 0.35); dash(1.3, 0xffe9a8, 0.75 + 0.15 * pulse);
    targets.forEach((t, i) => {
      const m = this.aimMarks[i] ?? (this.aimMarks[i] = this.add.image(0, 0, 'reticle').setDepth(DEPTH.air + 5));
      const near = Math.hypot(t.x - p.x, t.y - p.y) <= R;
      m.setPosition(Math.round(t.x), Math.round(t.y - 8)).setScale(HD * (1.3 + 0.12 * pulse)).setTint(near ? 0xffe36a : 0xa89fb4).setAlpha(near ? 1 : 0.55).setVisible(true);
    });
  }

  /** Bitten: lose a heart and drop whatever you were carrying. */
  private onBite() {
    this.fishing.cancel();
    this.sinceHit = 0;
    this.stats.damage++;
    const n = this.eco.drop();
    if (n) { this.loot.scatter(this.player.x, this.player.y, n); this.float(this.player.x, this.player.y - 50, `DROPPED ${n} FISH`, '#ffb0a0'); }
    this.fishing.emit();
    this.game.events.emit('hearts', this.player.hearts);
    this.float(this.player.x, this.player.y - 40, 'OUCH!', '#ffb0a0');
    audio.play('hurt');
    if (this.player.hearts <= 0) this.end('dead');
  }

  /** The stage is over: freeze everything, then show Stage Complete, Stage Failed, or the ending. */
  private end(outcome: RunResult['outcome']) {
    if (this.over) return;
    this.over = true; // from here update() runs nothing but ambience: no timer, attacks, thefts or movement
    this.stats.outcome = outcome;
    this.fishing.cancel();
    this.fishing.locked = true;
    this.prompt.setVisible(false); this.promptLabel.setVisible(false);
    this.tutor.hide();
    this.game.events.emit('ended', outcome);
    const left = Math.max(0, RUN.duration - this.elapsed);
    const win = outcome === 'win', last = CUR.index === STAGES.length - 1;
    const totals = { ...((this.registry.get('totals') as Totals) ?? { fish: 0, stolen: 0, stunned: 0, left: 0, done: 0 }) };
    if (win) { totals.fish += this.eco.stored; totals.stolen += this.eco.stolen; totals.stunned += this.eco.stunned; totals.left += Math.ceil(left); totals.done = CUR.index + 1; this.registry.set('totals', totals); }
    const s = load(), name = (s.name || this.player.def.name).toUpperCase().slice(0, 10);
    // an attempt is recorded when it ends: on a failure, or on beating the last stage
    const best = !win ? submitScore({ name, stages: CUR.index, won: false, fish: this.eco.stored, left: 0 })
      : last ? submitScore({ name, stages: STAGES.length, won: true, fish: totals.fish, left: totals.left }) : false;
    const result: RunResult = { mode: !win ? 'fail' : last ? 'final' : 'stage', outcome, stored: this.eco.stored, stolen: this.eco.stolen, stunned: this.eco.stunned, left, totals, best };
    audio.intensity = 0;
    audio.play(!win ? 'fail' : last ? 'victory' : CUR.index === 0 ? 'stage1' : 'stage2');
    const cam = this.cameras.main;
    if (!win) { cam.shake(220, 0.006); this.time.delayedCall(1100, () => this.scene.launch('result', result)); return; }
    cam.flash(300, 255, 240, 180);
    if (!last) { cam.pan(BAG_POS.x, BAG_POS.y - 10, 700, 'Sine.easeInOut'); this.time.delayedCall(1100, () => this.scene.launch('result', result)); return; }
    this.time.delayedCall(900, () => this.playEnding(result));
  }

  /** After Stage 3: the fisherman strolls up to Sabapathi's shop to gloat. Space skips. */
  private playEnding(result: RunResult) {
    const cam = this.cameras.main, hero = this.player, id = hero.def.id, thief = this.sabapathi.sprite;
    const name = (load().name || hero.def.name).toUpperCase();
    this.game.events.emit('cutscene');
    let done = false;
    const finish = () => { if (done) return; done = true; this.scene.launch('result', result); };
    this.input.keyboard!.once('keydown-SPACE', finish);
    if (this.touchOn) this.input.once('pointerdown', finish); // a tap skips on touch screens
    const at = (ms: number, fn: () => void) => this.time.delayedCall(ms, () => { if (!done) fn(); });
    cam.fadeOut(350, 22, 38, 29);
    at(400, () => {
      // set the stage outside the shop
      this.crocs.list.forEach((c) => c.sprite.setVisible(false));
      this.tweens.killTweensOf(thief);
      const sx = SHOP.x - 6, sy = SHOP.y + 12;
      thief.setPosition(sx, sy).setAlpha(1).setDepth(DEPTH.sorted + sy).play('sabapathi-idle-down');
      hero.sprite.setAngle(0).setAlpha(1).setPosition(SHOP.x - 140, SHOP.y + 40).play(`${id}-walk-right`);
      hero.shadow.setPosition(hero.sprite.x, hero.sprite.y);
      cam.stopFollow(); cam.centerOn(SHOP.x - 30, SHOP.y - 6);
      cam.fadeIn(450, 22, 38, 29);
      // 1. the fisherman approaches
      this.tweens.add({
        targets: [hero.sprite, hero.shadow], x: SHOP.x - 46, y: SHOP.y + 24, duration: 2300,
        onUpdate: () => hero.sprite.setDepth(DEPTH.sorted + hero.sprite.y),
        onComplete: () => { if (!done) hero.sprite.play(`${id}-idle-right`); },
      });
    });
    // 2. Sabapathi notices
    at(2500, () => {
      thief.play('sabapathi-idle-left');
      const bang = this.add.image(thief.x, thief.y - 36, 'alert').setScale(HD).setOrigin(0.5, 1).setDepth(DEPTH.air + 5);
      this.tweens.add({ targets: thief, y: thief.y - 6, duration: 110, yoyo: true });
      this.tweens.add({ targets: bang, y: bang.y - 4, duration: 140, yoyo: true, repeat: 3, onComplete: () => bang.destroy() });
      this.float(thief.x, thief.y - 52, 'AIYO?!', '#ffe36a');
      audio.play('bonk');
    });
    // 3. the fisherman gloats and celebrates
    at(3500, () => {
      hero.sprite.play(`${id}-idle-down`);
      this.float(hero.sprite.x, hero.sprite.y - 44, `${name}: ALL THE FISH, SABAPATHI!`, '#9ff08a');
      this.tweens.add({ targets: hero.sprite, y: hero.sprite.y - 7, duration: 150, yoyo: true, repeat: 5, ease: 'Quad.out' });
      for (let i = 0; i < 14; i++) at(i * 110, () => {
        const f = this.add.image(hero.sprite.x, hero.sprite.y - 22, 'catchHD', i % 5).setScale(HD).setDepth(DEPTH.air + 3);
        const dx = (Math.random() - 0.5) * 90;
        this.tweens.add({ targets: f, x: f.x + dx, duration: 900 });
        this.tweens.add({ targets: f, y: f.y - 30 - Math.random() * 24, duration: 450, ease: 'Quad.out', yoyo: true, onComplete: () => f.destroy() });
        const sp = this.add.sprite(hero.sprite.x + dx * 0.5, hero.sprite.y - 40 - Math.random() * 20, 'sparkle', 0).setScale(HD).setDepth(DEPTH.air + 6).play('sparkle');
        sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
      });
      cam.shake(120, 0.002);
      audio.play('victory');
    });
    // 4. Sabapathi sulks off into his shop
    at(5300, () => {
      this.float(thief.x, thief.y - 44, 'HMPH! NEXT SEASON...', '#f6e7c1');
      audio.play('lost');
      this.tweens.add({ targets: thief, x: thief.x + 1, duration: 50, yoyo: true, repeat: 7 });
    });
    at(6300, () => {
      thief.play('sabapathi-walk-right');
      this.tweens.add({ targets: thief, x: SHOP_DOOR.x, y: SHOP_DOOR.y - 4, duration: 900 });
      this.tweens.add({ targets: thief, alpha: 0, duration: 250, delay: 800 });
    });
    at(7600, finish);
  }

  update(time: number, delta: number) {
    const dt = Math.min(0.05, delta / 1000);
    this.ambient.update(dt, time);
    if (this.attract) { this.sabapathi.update(dt, time, { elapsed: 0, fishing: false }); return; }
    if (this.over || !this.started) return; // frozen: stage intro, stage-complete and result screens
    if (Phaser.Input.Keyboard.JustDown(this.keyEsc)) { this.pauseGame(); return; }

    // ---- the clock
    this.elapsed += dt; this.sinceHit += dt;
    const left = RUN.duration - this.elapsed;
    const sec = Math.ceil(left);
    if (sec !== this.lastSecond) { this.lastSecond = sec; this.game.events.emit('clock', Math.max(0, sec)); if (sec <= 10 && sec > 0) audio.play('tick'); }
    if (left <= 0) { this.end('time'); return; }

    const interactPressed = this.input2.interactPressed;
    if (this.input2.swapPressed) this.swapGear();
    this.player.update(dt);
    if (this.touchOn) this.fishing.aim = this.fishing.autoAim(); // no cursor: cast where he faces
    else { const aim = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2; this.fishing.aim = { x: aim.x, y: aim.y }; }
    this.fishing.update(dt, time);
    this.zones.update(dt, this.fishing.fishingZone);
    this.interact(interactPressed);
    if (this.over) return;

    // ---- difficulty director: the band sets the pace, caps and speeds
    const band = bandAt(this.elapsed);
    if (band.label !== this.bandLabel) { if (this.bandLabel) this.game.events.emit('event', band.label === 'Final push' ? 'Final push! Everything is bolder' : `${band.label} waters: the crocodiles are bolder`); this.bandLabel = band.label; }
    this.fishing.windowMul = band.windowMul;
    const crocMax = Math.min(THREAT.maxCrocs, band.crocMax + CUR.crocMaxAdd);
    const zone: ZoneId | null = this.fishing.busy ? this.fishing.zone : this.L.zoneNear(this.player.x, this.player.y);
    const frenzy = this.events2.active === 'frenzy';
    const calm = this.sinceHit < THREAT.reliefAfterHit; // ease off after a bite
    const interval = crocInterval(band, zone) * (frenzy ? EVENTS.frenzyPace : 1) * (calm ? 1.6 : 1);
    if (this.clock.tick(dt, this.elapsed, interval, crocMax, this.crocs.list.length)) this.crocs.spawn(zone);
    this.crocs.update(dt, time, band.crocSpeed * CUR.crocSpeedMul);
    this.stones.update(dt);
    if (this.touchOn) this.drawAim(time);
    this.loot.update(dt);
    this.sabapathi.update(dt, time, { elapsed: this.elapsed, fishing: this.fishing.busy });
    this.runEvents(dt, time);
    this.tutor.update(dt, time);
    this.runTips();
    if (!this.fishing.busy && Math.abs(this.player.vx) + Math.abs(this.player.vy) < 2) this.stats.idle += dt;
    this.stats.hearts = this.player.hearts;
    // the music tightens in the final stretch, during a theft, and while a crocodile is on you
    audio.intensity = left <= RUN.finalStretch || this.sabapathi.loot > 0 || this.crocs.hunting ? 1 : this.sabapathi.incoming ? 0.6 : 0;

    this.zoneT -= dt;
    if (this.zoneT <= 0) {
      this.zoneT = 0.3;
      const z = this.L.zoneAt(this.player.x, this.player.y);
      if (z !== this.zone) {
        this.zone = z;
        const zid = this.L.zoneNear(this.player.x, this.player.y);
        if (z) this.game.events.emit('zone', zid && z !== "SABAPATHI'S KADE" ? (!this.zones.available(zid) ? `${ZONES[zid].title}: fished out for now` : this.zones.thin(zid) ? `${ZONES[zid].title}: the fish are thinning` : ZONES[zid].title) : "Sabapathi's shop");
      }
    }
  }

  // ---- timed events: one at a time, announced, and never stacked on an existing emergency
  private runEvents(dt: number, time: number) {
    const raid = this.sabapathi.onRaid, hunted = this.crocs.hunting;
    const eligible: EventId[] = ['golden', 'bonanza'];
    if (!raid && this.sinceHit > 10 && this.player.hearts > 1) eligible.push('frenzy');
    if (!raid && !hunted && this.eco.stored >= 3) eligible.push('rush');
    const e = this.events2.tick(dt, this.elapsed, eligible);
    if (e?.type === 'start') this.startEvent(e.id);
    else if (e?.type === 'end') this.endEvent(e.id);
    if (this.goldenSprite) this.goldenSprite.setAlpha(0.75 + Math.sin(time / 120) * 0.25);
  }
  private startEvent(id: EventId) {
    this.eventLog.push(id);
    const here = this.L.zoneNear(this.player.x, this.player.y);
    const say = (text: string) => this.game.events.emit('event', text);
    this.cameras.main.shake(90, 0.002);
    audio.play('event');
    if (id === 'golden' || id === 'bonanza') {
      const zs = (['A', 'B', 'C'] as ZoneId[]).filter((z) => z !== here);
      const z = zs[Math.floor(Math.random() * zs.length)];
      const name = ZONES[z].title;
      if (id === 'bonanza') { this.fishing.bonanza = z; say(`Fishing bonanza in the ${name}!`); return; }
      const spot = this.L.shorePoint(z === 'A' ? 1.9 : z === 'B' ? 0.3 : -2.75, 36);
      this.fishing.golden = spot;
      this.goldenSprite = this.add.sprite(spot.x, spot.y, 'fish', 2).setScale(2 * HD).setDepth(DEPTH.waterFx + 1).play('fish-gold');
      say(`A golden fish in the ${name}! Worth ${RUN.goldenFish}`);
    } else if (id === 'frenzy') say('Crocodile frenzy! Watch the water');
    else if (id === 'rush') { if (this.sabapathi.rush()) say('Sabapathi rush! He is running for the bag'); else this.events2.stop(this.elapsed); }
  }
  private endEvent(id: EventId) {
    if (id === 'golden') { this.fishing.golden = null; this.goldenSprite?.destroy(); this.goldenSprite = undefined; }
    if (id === 'bonanza') this.fishing.bonanza = null;
  }

  private float(x: number, y: number, text: string, color: string) {
    const t = uiText(this, Math.round(x), Math.round(y), text, 7.5, color, true).setOrigin(0.5).setDepth(DEPTH.air + 6);
    this.tweens.add({ targets: t, y: y - 16, duration: 1000, ease: 'Cubic.out', onComplete: () => t.destroy() });
    this.tweens.add({ targets: t, alpha: 0, duration: 250, delay: 750 });
  }
}
