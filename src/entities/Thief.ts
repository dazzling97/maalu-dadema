import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { BAG_RAID, CUR } from '../config/balance';
import { Layout, SHOP, SHOP_DOOR, BAG_POS } from '../world/layout';
import { ORIGIN } from '../art/textures';
import { Dir } from '../art/characters';
import { StateMachine } from '../systems/StateMachine';
import { findPath, Pt } from '../systems/Pathfind';
import { theftUrge, grabSize, bandAt } from '../systems/Director';
import { Economy } from '../systems/Economy';
import { Player } from './Player';
import { Loot } from './Loot';
import { HD } from '../art/hd';
import { audio } from '../systems/Audio';

export type TState = 'waiting' | 'approaching' | 'sneaking' | 'stealing' | 'escaping' | 'stunned' | 'retreating' | 'inside';
export interface RivalContext { elapsed: number; fishing: boolean; }

/**
 * Sabapathi Thuma. He watches from his shop and sets out for the stationary
 * fish bag when it is worth raiding and the player is busy or far away. One
 * state machine, one raid at a time; he path-finds over the collision grid so
 * he can always reach the bag and always get home.
 */
export class Thief {
  x: number; y: number;
  loot = 0; // fish in his sack
  raids = 0;
  /** Below 1 only during a new player's first theft, to give them time to learn the chase. */
  ease = 1;
  chaseTime = 0; // seconds spent escaping (playtest metric)
  readonly sprite: Phaser.GameObjects.Sprite;
  private shadow: Phaser.GameObjects.Image;
  private sack: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Sprite[] = [];
  private home: Pt;
  private stand: Pt = { x: BAG_POS.x + 16, y: BAG_POS.y + 4 }; // where he stands to rifle the bag
  private path: Pt[] = [];
  private pi = 0;
  private facing: Dir = 'down';
  private moving = false;
  private sinceRaid = 999;
  private checkT = 0;
  private peekT = 1.4;
  private puffT = 0;
  private speed = 42;
  private rushing = false;
  private ctx: RivalContext = { elapsed: 0, fishing: false };
  fsm: StateMachine<Thief, TState>;

  constructor(
    private scene: Phaser.Scene, private L: Layout, private player: Player,
    private eco: Economy, private drops: Loot,
    private say: (x: number, y: number, text: string, color: string) => void,
    private changed: () => void,
  ) {
    this.home = { x: SHOP.x - 6, y: SHOP.y + 12 };
    this.x = this.home.x; this.y = this.home.y;
    this.shadow = scene.add.image(this.x, this.y, 'shadow').setScale(HD).setDepth(DEPTH.flat + 2);
    this.sprite = scene.add.sprite(this.x, this.y, 'sabapathi', 0).setOrigin(ORIGIN.sabapathi.x, ORIGIN.sabapathi.y);
    this.sack = scene.add.image(this.x, this.y, 'loot').setOrigin(0.5, 1).setVisible(false);
    for (let k = 0; k < 2; k++) this.stars.push(scene.add.sprite(0, 0, 'sparkle', 1).setDepth(DEPTH.air + 4).setVisible(false));

    this.fsm = new StateMachine<Thief, TState>(this, {
      // at the shop, glancing about, weighing up the bag
      waiting: {
        enter: (t) => { t.moving = false; t.facing = 'down'; t.checkT = BAG_RAID.checkEvery; },
        update: (t, dt) => {
          const beat = t.fsm.time % 4;
          t.facing = beat > 3.3 ? 'right' : beat > 2.6 ? 'left' : 'down';
          t.checkT -= dt;
          if (t.checkT > 0) return;
          t.checkT = BAG_RAID.checkEvery;
          const urge = theftUrge({ stored: t.eco.stored, playerDist: t.playerFromBag(), fishing: t.ctx.fishing, sinceLastRaid: t.sinceRaid, elapsed: t.ctx.elapsed });
          if (t.player.alive && Math.random() < urge) t.setOut();
        },
      },
      approaching: {
        enter: (t) => { if (!t.plan(t.stand)) { t.scene.game.events.emit('heist', null); t.fsm.go('retreating'); } },
        update: (t, dt) => {
          t.follow(t.speed, dt);
          if (t.distTo(BAG_POS) < BAG_RAID.sneakRadius) t.fsm.go('sneaking');
        },
      },
      // tiptoe the last stretch, stopping to check nobody is watching
      sneaking: {
        enter: () => audio.play('sneak'),
        update: (t, dt) => {
          if (t.eco.stored <= 0) { t.say(t.x, t.y - 40, 'EMPTY?! HMPH', '#f6e7c1'); t.scene.game.events.emit('heist', null); return t.fsm.go('retreating'); }
          t.peekT -= dt;
          if (t.peekT < 0) { // a quick look around
            t.moving = false; t.facing = t.peekT > -0.25 ? 'left' : 'right';
            if (t.peekT < -0.5) t.peekT = 1.2 + Math.random() * 0.8;
            return;
          }
          if (t.follow(t.speed * BAG_RAID.sneakMul, dt)) t.fsm.go('stealing');
        },
      },
      // elbow-deep in the bag: a full second in which a rock stops him cold
      stealing: {
        enter: (t) => { t.moving = false; t.facing = 'left'; },
        update: (t) => {
          if (t.fsm.time < BAG_RAID.stealTime * CUR.stealTimeMul) return;
          t.loot = t.eco.steal(grabSize(t.eco.stored));
          if (!t.loot) { t.say(t.x, t.y - 40, 'EMPTY?! HMPH', '#f6e7c1'); t.scene.game.events.emit('heist', null); return t.fsm.go('retreating'); }
          t.say(t.x, t.y - 40, 'HEH HEH HEH!', '#ffe36a');
          audio.play('stolen');
          t.scene.cameras.main.shake(120, 0.003);
          t.scene.game.events.emit('heist', { n: t.loot, status: 'stolen' });
          t.changed();
          t.fsm.go('escaping');
        },
      },
      // sack over the shoulder, sprinting for the shop door
      escaping: {
        enter: (t) => { t.plan(SHOP_DOOR); },
        update: (t, dt) => {
          t.chaseTime += dt;
          t.dust(dt);
          if (t.follow(t.speed * BAG_RAID.fleeMul * t.ease, dt)) {
            t.eco.lose(t.loot);
            t.say(t.x, t.y - 40, `-${t.loot} FISH`, '#ffb0a0');
            audio.play('lost');
            t.scene.game.events.emit('heist', { n: t.loot, status: 'escaped' });
            t.loot = 0;
            t.fsm.go('inside');
          }
        },
      },
      stunned: {
        enter: (t) => { t.moving = false; t.facing = 'down'; t.stars.forEach((s) => s.setVisible(true)); },
        update: (t) => { if (t.fsm.time > BAG_RAID.stun) t.fsm.go('retreating'); },
        exit: (t) => t.stars.forEach((s) => s.setVisible(false)),
      },
      // scurries home empty-handed, knees high
      retreating: {
        enter: (t) => { t.plan(t.home); },
        update: (t, dt) => { t.dust(dt); if (t.follow(t.speed * 1.5, dt)) t.endRaid(); },
      },
      // vanished through the door with the loot; reappears at the counter looking innocent
      inside: {
        enter: (t) => { t.moving = false; t.scene.tweens.add({ targets: [t.sprite, t.shadow], alpha: 0, duration: 250 }); },
        update: (t) => {
          if (t.fsm.time > 2.5) {
            t.scene.tweens.add({ targets: [t.sprite, t.shadow], alpha: 1, duration: 400 });
            t.endRaid();
          }
        },
      },
    }, 'waiting');
  }

  get onRaid() { return !this.fsm.is('waiting') && !this.fsm.is('inside'); }
  /** Heading for the bag (not yet caught or fleeing). */
  get incoming() { return this.fsm.is('approaching') || this.fsm.is('sneaking') || this.fsm.is('stealing'); }
  private playerFromBag() { return Math.hypot(this.player.x - BAG_POS.x, this.player.y - BAG_POS.y); }
  /** Sabapathi Rush event: he sets out at once, and faster. False if he is already busy. */
  rush(): boolean {
    if (!this.fsm.is('waiting') || !this.player.alive || this.eco.stored <= 0) return false;
    this.rushing = true;
    this.setOut();
    return true;
  }
  private setOut() {
    this.raids++;
    this.scene.game.events.emit('prowl');
    audio.play('prowl'); // his theme: you always hear him set out
    this.fsm.go('approaching');
  }
  private endRaid() { this.rushing = false; this.sinceRaid = 0; this.x = this.home.x; this.y = this.home.y; this.fsm.go('waiting'); }
  private distTo(p: Pt) { return Math.hypot(p.x - this.x, p.y - this.y); }

  private plan(to: Pt): boolean {
    const p = findPath(this.L, { x: this.x, y: this.y }, to);
    this.path = p ?? []; this.pi = 0;
    return !!p;
  }
  /** Walk the planned path. True on arrival. */
  private follow(speed: number, dt: number): boolean {
    let budget = speed * dt;
    this.moving = true;
    while (budget > 0) {
      if (this.pi >= this.path.length) { this.moving = false; return true; }
      const p = this.path[this.pi];
      const dx = p.x - this.x, dy = p.y - this.y, d = Math.hypot(dx, dy);
      if (d > 0.5) this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
      if (d <= budget) { this.x = p.x; this.y = p.y; this.pi++; budget -= d; }
      else { this.x += (dx / d) * budget; this.y += (dy / d) * budget; budget = 0; }
    }
    return false;
  }
  private dust(dt: number) {
    this.puffT -= dt;
    if (this.puffT > 0) return;
    this.puffT = 0.16;
    audio.play('step');
    const p = this.scene.add.sprite(Math.round(this.x), Math.round(this.y - 1), 'puff', 0).setOrigin(0.5, 0.7).setDepth(DEPTH.sorted + this.y - 1).play('puff');
    p.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => p.destroy());
  }

  /** Rock hit. Stops him at any point of a raid; whatever he carries spills on the ground. */
  bonk(): boolean {
    if (!['approaching', 'sneaking', 'stealing', 'escaping'].includes(this.fsm.current)) return false;
    if (this.loot) {
      this.drops.scatter(this.x, this.y, this.loot);
      this.scene.game.events.emit('heist', { n: this.loot, status: 'dropped' });
      this.loot = 0;
    } else this.scene.game.events.emit('heist', null);
    this.say(this.x, this.y - 42, 'AIYO!', '#ffe36a');
    audio.play('bonk');
    this.fsm.go('stunned');
    return true;
  }

  update(dt: number, time: number, ctx: RivalContext) {
    this.ctx = ctx;
    this.sinceRaid += dt;
    this.speed = bandAt(ctx.elapsed).thiefSpeed * CUR.thiefSpeedMul * (this.rushing ? 1.3 : 1);
    this.fsm.update(dt);

    const st = this.fsm.current, s = this.sprite;
    const sneaking = st === 'sneaking';
    const anim = st === 'stealing' ? 'fish' : this.moving ? 'walk' : 'idle';
    s.play(`sabapathi-${anim}-${this.facing}`, true);
    s.anims.timeScale = sneaking ? 0.55 : st === 'escaping' ? 1.5 : st === 'retreating' ? 2 : 1;
    const tiptoe = sneaking && this.moving ? -Math.abs(Math.round(Math.sin(time / 110))) : 0;
    const hop = st === 'retreating' ? -Math.abs(Math.round(Math.sin(time / 60) * 2)) : 0; // embarrassed high-knees run
    const wobble = st === 'stunned' ? Math.round(Math.sin(time / 40)) : 0;
    s.setPosition(Math.round(this.x) + wobble, Math.round(this.y) + tiptoe + hop).setDepth(DEPTH.sorted + this.y);
    this.shadow.setPosition(Math.round(this.x), Math.round(this.y));
    const back = this.facing === 'left' ? 7 : this.facing === 'right' ? -7 : 6;
    this.sack.setVisible(this.loot > 0).setPosition(s.x + back, s.y - 12 + (Math.floor(time / 90) % 2)).setDepth(DEPTH.sorted + this.y + (this.facing === 'up' ? 1 : -0.5));
    this.stars.forEach((star, k) => {
      const a = time / 150 + k * Math.PI;
      star.setPosition(Math.round(s.x + Math.cos(a) * 8), Math.round(s.y - 33 + Math.sin(a) * 2));
    });
    this.scene.registry.set('thief', { x: this.x, y: this.y - 14, hot: this.loot > 0, prowl: this.incoming });
  }
}
