import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { CROC, CROC_AI, CROC_TYPES, CrocType, ZoneId } from '../config/balance';
import { Layout, POND_C } from '../world/layout';
import { ORIGIN } from '../art/textures';
import { StateMachine } from '../systems/StateMachine';
import { Player } from './Player';
import { HD } from '../art/hd';
import { audio } from '../systems/Audio';
import { voice } from '../systems/Voice';

export type CState = 'surface' | 'patrol' | 'hunt' | 'telegraph' | 'lunge' | 'recover' | 'reposition' | 'stunned' | 'retreat' | 'gone';
/** Only one crocodile may wind up an attack at a time, so lunges can never stack. */
export interface AttackToken { holder: Crocodile | null; }

export class Crocodile {
  x: number; y: number;
  speed = 40;
  /** Below 1 only for the very first crocodile a new player meets: slower, with a longer warning. */
  ease = 1;
  readonly sprite: Phaser.GameObjects.Sprite;
  private alert: Phaser.GameObjects.Image;
  private stars: Phaser.GameObjects.Sprite[] = [];
  private dir = -1; // -1 faces left
  private aim = { x: 0, y: 0 };
  private way = { x: 0, y: 0 };
  private bit = false;
  private ended = false;
  private wakeT = 0;
  private last = { x: 0, y: 0 };
  fsm: StateMachine<Crocodile, CState>;

  constructor(
    private scene: Phaser.Scene, private L: Layout, private player: Player, x: number, y: number,
    readonly type: CrocType, private token: AttackToken, private onBite: () => void, private onEnd: () => void,
  ) {
    this.x = x; this.y = y;
    this.sprite = scene.add.sprite(x, y, type.sheet, 0).setOrigin(ORIGIN.croc.x, ORIGIN.croc.y).setScale(HD).setAlpha(0);
    this.alert = scene.add.image(x, y, 'alert').setScale(HD).setOrigin(0.5, 1).setDepth(DEPTH.air + 5).setVisible(false);
    for (let i = 0; i < 2; i++) this.stars.push(scene.add.sprite(x, y, 'sparkle', 1).setScale(HD).setDepth(DEPTH.air + 4).setVisible(false));
    scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 500 });
    this.ripple();
    audio.play('crocEmerge');

    this.fsm = new StateMachine<Crocodile, CState>(this, {
      // eyes break the surface and watch: the player's warning
      surface: { update: (c) => { c.face(c.player.x); if (c.fsm.time > CROC.surfaceTime) c.fsm.go('patrol'); } },
      // cruise the water near the player's bank until they come close enough to tempt it
      patrol: {
        enter: (c) => c.pickWaypoint(),
        update: (c, dt) => {
          if (c.fsm.time > CROC_AI.patrolTime || !c.player.alive) return c.fsm.go('retreat');
          if (c.sees()) return c.fsm.go('hunt');
          if (Math.hypot(c.way.x - c.x, c.way.y - c.y) < 8) c.pickWaypoint();
          c.moveToward(c.way.x, c.way.y, c.speed * CROC_AI.patrolSpeed, dt);
        },
      },
      hunt: {
        update: (c, dt) => {
          const d = c.dist();
          if (!c.player.alive || c.fsm.time > CROC.giveUp) return c.fsm.go('retreat');
          if (d > CROC.leash || c.L.pondAt(c.player.x, c.player.y) > CROC_AI.shoreBand + 44) return c.fsm.go('patrol'); // lost interest
          const free = !c.token.holder || c.token.holder === c;
          if (d < CROC.strikeRange && free) { c.token.holder = c; return c.fsm.go('telegraph'); }
          // another crocodile is mid-attack: hang back instead of piling on
          if (!free && d < CROC.strikeRange + 26) { c.face(c.player.x); return; }
          c.moveToward(c.player.x, c.player.y - 2, c.speed, dt);
        },
      },
      // rear back, jaws open, a clear beat before the strike
      telegraph: {
        enter: (c) => { c.alert.setVisible(true); c.face(c.player.x); audio.play('crocWarn'); voice.say('croc_warn'); },
        update: (c) => {
          c.face(c.player.x);
          if (c.fsm.time > CROC.telegraph * (c.ease < 1 ? 2.4 : 1)) {
            const dx = c.player.x - c.x, dy = c.player.y - 2 - c.y, len = Math.hypot(dx, dy) || 1;
            c.aim = { x: dx / len, y: dy / len };
            c.fsm.go('lunge');
          }
        },
        exit: (c) => c.alert.setVisible(false),
      },
      lunge: {
        enter: (c) => { c.bit = false; if (c.inWater()) c.ripple(); audio.play('crocLunge'); },
        update: (c, dt) => {
          const v = CROC.lungeSpeed * c.type.lungeMul * dt;
          c.step(c.aim.x * v, c.aim.y * v);
          const hx = c.x + c.dir * 13, hy = c.y - 3;
          if (!c.bit && Math.hypot(c.player.x - hx, c.player.y - 4 - hy) < CROC.biteRadius + 4) {
            if (c.player.hurt(c.x, c.y)) { c.bit = true; c.onBite(); }
          }
          if (c.fsm.time > CROC.lungeTime) c.fsm.go('recover');
        },
      },
      recover: {
        update: (c) => { if (c.fsm.time > c.type.recover) c.fsm.go(c.bit ? 'retreat' : 'reposition'); },
        exit: (c) => c.release(),
      },
      // back off into the water after every lunge: the player always gets room to move
      reposition: {
        update: (c, dt) => {
          c.moveToward(POND_C.x, POND_C.y, c.speed * 1.2, dt);
          if (c.fsm.time > CROC_AI.repositionTime) c.fsm.go('patrol');
        },
      },
      stunned: {
        enter: (c) => { c.release(); c.stars.forEach((s) => s.setVisible(true)); c.end(); },
        update: (c) => { if (c.fsm.time > c.type.stun) c.fsm.go('retreat'); },
        exit: (c) => c.stars.forEach((s) => s.setVisible(false)),
      },
      // slink back to deep water and sink
      retreat: {
        enter: (c) => { c.release(); c.end(); },
        update: (c, dt) => {
          c.moveToward(POND_C.x, POND_C.y, c.speed * 1.5, dt);
          if (c.L.pondAt(c.x, c.y) < -22 || c.fsm.time > 9) {
            c.ripple();
            c.scene.tweens.add({ targets: c.sprite, alpha: 0, duration: 450, onComplete: () => c.destroy() });
            c.fsm.go('gone');
          }
        },
      },
      gone: {},
    }, 'surface');
  }

  get done() { return this.fsm.is('gone') && !this.sprite.active; }
  get hittable() { return !this.fsm.is('gone') && !this.fsm.is('stunned'); }
  get hunting() { return this.fsm.is('hunt') || this.fsm.is('telegraph') || this.fsm.is('lunge'); }
  private end() { if (!this.ended) { this.ended = true; this.onEnd(); } }
  private release() { if (this.token.holder === this) this.token.holder = null; }
  private dist() { return Math.hypot(this.player.x - this.x, this.player.y - this.y); }
  private sees() { return this.dist() < CROC_AI.detect && this.L.pondAt(this.player.x, this.player.y) < CROC_AI.shoreBand; }
  private inWater() { return this.L.pondAt(this.x, this.y) < -3 && !this.L.onDock(this.x, this.y, 0); }
  private face(tx: number) { if (Math.abs(tx - this.x) > 2) this.dir = tx < this.x ? -1 : 1; }
  private blocked(x: number, y: number) { return this.L.landBlocked(x, y) || this.L.onDock(x, y, 1); }
  private pickWaypoint() {
    // somewhere in the water on the player's side of the pond
    const a = Math.atan2(this.player.y - POND_C.y, this.player.x - POND_C.x) + (Math.random() - 0.5) * 1.6;
    this.way = this.L.shorePoint(a, 18 + Math.random() * 34);
  }
  private step(dx: number, dy: number) {
    if (!this.blocked(this.x + dx, this.y)) this.x += dx;
    if (!this.blocked(this.x, this.y + dy)) this.y += dy;
  }
  private moveToward(tx: number, ty: number, speed: number, dt: number) {
    const dx = tx - this.x, dy = ty - this.y, len = Math.hypot(dx, dy) || 1;
    const bx = this.x, by = this.y;
    this.step((dx / len) * speed * dt, (dy / len) * speed * 0.85 * dt);
    // nudge sideways around scenery instead of pushing into it forever
    if (Math.hypot(this.x - bx, this.y - by) < speed * dt * 0.3) this.step((-dy / len) * speed * dt, (dx / len) * speed * dt);
    this.face(tx);
  }
  private ripple() {
    const r = this.scene.add.sprite(this.x, this.y - 3, 'ring', 0).setScale(HD).setDepth(DEPTH.waterFx + 1).play('ring');
    r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy());
  }

  /** A stone landed here. Returns true if it bonked this crocodile. */
  bonk(): boolean {
    if (!this.hittable) return false;
    this.fsm.go('stunned');
    audio.play('stun');
    this.scene.cameras.main.shake(80, 0.003);
    return true;
  }

  private destroy() {
    this.release();
    this.sprite.destroy(); this.alert.destroy(); this.stars.forEach((s) => s.destroy());
  }

  update(dt: number, time: number) {
    if (!this.sprite.active) return;
    this.fsm.update(dt);
    if (!this.sprite.active) return;
    const s = this.sprite, water = this.inWater();
    const st = this.fsm.current;
    if (st === 'telegraph') { s.anims.stop(); s.setFrame(4); }
    else if (st === 'lunge') { s.anims.stop(); s.setFrame(5); }
    else if (st === 'stunned') { s.anims.stop(); s.setFrame(6); }
    else if (st === 'recover') { s.anims.stop(); s.setFrame(2); }
    else s.play(`${this.type.sheet}-${water ? 'swim' : 'walk'}`, true);
    // a V of wake trails a crocodile swimming through open water
    const moved = Math.hypot(this.x - this.last.x, this.y - this.last.y);
    this.last.x = this.x; this.last.y = this.y;
    this.wakeT -= dt;
    if (water && moved > 0.15 && this.wakeT <= 0 && this.L.pondAt(this.x, this.y) < -4) {
      this.wakeT = 0.14;
      const right = this.dir > 0;
      const w = this.scene.add.image(this.x + (right ? 17 : -17), this.y - 4, 'wake').setOrigin(0.06, 0.5).setFlipX(right)
        .setScale(HD * 0.7).setAlpha(0.85).setDepth(DEPTH.waterFx + 1);
      if (right) w.setOrigin(0.94, 0.5);
      this.scene.tweens.add({ targets: w, scale: HD * 1.7, alpha: 0, duration: 950, ease: 'Sine.out', onComplete: () => w.destroy() });
    }
    const jitter = st === 'telegraph' ? Math.round(Math.sin(time / 28)) : 0;
    s.setPosition(Math.round(this.x) + jitter, Math.round(this.y)).setFlipX(this.dir > 0);
    s.setDepth(water && st !== 'lunge' ? DEPTH.flat + 0.5 : DEPTH.sorted + this.y);
    this.alert.setPosition(s.x, s.y - 18 - Math.abs(Math.round(Math.sin(time / 70) * 2)));
    this.stars.forEach((star, i) => {
      const a = time / 160 + i * Math.PI;
      star.setPosition(Math.round(s.x + this.dir * 9 + Math.cos(a) * 7), Math.round(s.y - 14 + Math.sin(a) * 2));
    });
  }
}

/** Owns the crocodiles. The threat director decides when one arrives; the zone decides what kind. */
export class Crocs {
  readonly list: Crocodile[] = [];
  private token: AttackToken = { holder: null };
  bites = 0;

  constructor(private scene: Phaser.Scene, private L: Layout, private player: Player, private onBite: () => void, private onEnd: () => void) {}

  get hunting() { return this.list.some((c) => c.hunting); }

  spawn(zone: ZoneId | null): boolean {
    const r = Math.random();
    const type = zone === 'C' ? (r < 0.45 ? CROC_TYPES.brute : r < 0.75 ? CROC_TYPES.sprinter : CROC_TYPES.lurker)
      : zone === 'B' ? (r < 0.4 ? CROC_TYPES.sprinter : CROC_TYPES.lurker) : CROC_TYPES.lurker;
    for (let tries = 0; tries < 30; tries++) {
      const p = this.L.shorePoint(Math.random() * Math.PI * 2, 26 + Math.random() * 30);
      const d = Math.hypot(p.x - this.player.x, p.y - this.player.y);
      if (d < 90 || d > 240 || this.L.onDock(p.x, p.y, 12)) continue; // never on top of the player
      this.list.push(new Crocodile(this.scene, this.L, this.player, p.x, p.y, type, this.token, () => { this.bites++; this.onBite(); }, this.onEnd));
      return true;
    }
    return false;
  }

  update(dt: number, time: number, speed: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i];
      c.speed = speed * c.type.speedMul * c.ease;
      c.update(dt, time);
      if (c.done) this.list.splice(i, 1);
    }
  }
}
