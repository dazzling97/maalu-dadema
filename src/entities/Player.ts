import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { PLAYER, CharacterDef } from '../config/balance';
import { Layout } from '../world/layout';
import { ORIGIN } from '../art/textures';
import { Dir } from '../art/characters';
import { StateMachine } from '../systems/StateMachine';
import { Input } from '../systems/Input';

type PState = 'idle' | 'walk' | 'dash' | 'fishing' | 'hurt' | 'down';

export class Player {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly shadow: Phaser.GameObjects.Image;
  x: number; y: number;
  vx = 0; vy = 0;
  facing: Dir = 'down';
  fsm: StateMachine<Player, PState>;
  hearts = PLAYER.hearts;
  invuln = 0;
  private throwT = 0;
  private dashCd = 0;
  private dashDir = { x: 0, y: 1 };
  private stepT = 0;
  private ghostT = 0;
  private puffs: Phaser.GameObjects.Sprite[] = [];

  constructor(private scene: Phaser.Scene, private L: Layout, private input: Input, readonly def: CharacterDef, x: number, y: number) {
    this.x = x; this.y = y;
    this.shadow = scene.add.image(x, y, 'shadow').setDepth(DEPTH.flat + 2);
    this.sprite = scene.add.sprite(x, y, def.id, 0).setOrigin(ORIGIN[def.id].x, ORIGIN[def.id].y);
    for (let i = 0; i < 8; i++) this.puffs.push(scene.add.sprite(0, 0, 'puff', 0).setVisible(false).setOrigin(0.5, 0.7));

    this.fsm = new StateMachine<Player, PState>(this, {
      idle: {
        update: (p, dt) => { p.steer(dt); if (Math.hypot(p.vx, p.vy) > 6) p.fsm.go('walk'); p.tryDash(); },
      },
      walk: {
        update: (p, dt) => {
          p.steer(dt);
          if (Math.hypot(p.vx, p.vy) < 4 && !p.input.moveX && !p.input.moveY) p.fsm.go('idle');
          p.stepT -= dt;
          if (p.stepT <= 0) { p.stepT = 0.24; if (!p.L.onDock(p.x, p.y)) p.puff(p.x - p.vx * 0.05, p.y - 1); }
          p.tryDash();
        },
      },
      dash: {
        enter: (p) => {
          const ix = p.input.moveX, iy = p.input.moveY;
          const fd = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] }[p.facing];
          const len = Math.hypot(ix, iy) || 1;
          p.dashDir = ix || iy ? { x: ix / len, y: iy / len } : { x: fd[0], y: fd[1] };
          p.dashCd = PLAYER.dashCooldown;
          p.puff(p.x, p.y); p.puff(p.x - p.dashDir.x * 6, p.y - p.dashDir.y * 4);
          p.scene.cameras.main.shake(70, 0.0016);
        },
        update: (p, dt) => {
          p.vx = p.dashDir.x * PLAYER.dashSpeed; p.vy = p.dashDir.y * PLAYER.dashSpeed;
          p.ghostT -= dt;
          if (p.ghostT <= 0) { p.ghostT = 0.035; p.ghost(); }
          if (p.fsm.time > PLAYER.dashTime) { p.vx *= 0.35; p.vy *= 0.35; p.fsm.go('walk'); }
        },
      },
      fishing: { enter: (p) => { p.vx = 0; p.vy = 0; } },
      hurt: {
        update: (p, dt) => {
          p.vx = approach(p.vx, 0, 520 * dt); p.vy = approach(p.vy, 0, 520 * dt);
          if (p.fsm.time > 0.28) p.fsm.go('idle');
        },
      },
      down: { enter: (p) => { p.vx = 0; p.vy = 0; p.sprite.setAngle(90); }, exit: (p) => p.sprite.setAngle(0) },
    }, 'idle');
  }

  get canAct() { return this.fsm.is('idle') || this.fsm.is('walk'); }
  lock() { this.fsm.go('fishing'); }
  faceToward(tx: number, ty: number) {
    const dx = tx - this.x, dy = ty - this.y;
    this.facing = Math.abs(dx) > Math.abs(dy) * 1.2 ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
  }
  unlock() { if (this.fsm.is('fishing')) this.fsm.go('idle'); }
  get dashing() { return this.fsm.is('dash'); }
  get alive() { return !this.fsm.is('down'); }

  /** Take a bite. Returns false if it was dodged (dashing or still flashing from the last one). */
  hurt(fromX: number, fromY: number): boolean {
    if (this.invuln > 0 || this.dashing || !this.alive) return false;
    this.hearts--;
    this.invuln = PLAYER.invuln;
    const dx = this.x - fromX, dy = this.y - fromY, len = Math.hypot(dx, dy) || 1;
    this.vx = (dx / len) * PLAYER.knockback; this.vy = (dy / len) * PLAYER.knockback;
    this.scene.cameras.main.shake(160, 0.006);
    this.puff(this.x, this.y);
    this.fsm.go(this.hearts <= 0 ? 'down' : 'hurt');
    return true;
  }
  /** Face a throw target and hold the arm-out pose for a beat. */
  throwAt(tx: number, ty: number) {
    if (this.fsm.is('fishing')) return; // keep holding the rod
    const dx = tx - this.x, dy = ty - this.y;
    this.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    this.throwT = 0.18;
  }

  private steer(dt: number) {
    let ix = this.input.moveX, iy = this.input.moveY;
    const len = Math.hypot(ix, iy);
    const max = PLAYER.speed * this.def.speedMul;
    if (len > 0) {
      ix /= len; iy /= len;
      this.vx = approach(this.vx, ix * max, PLAYER.accel * dt);
      this.vy = approach(this.vy, iy * max * 0.86, PLAYER.accel * dt); // slight vertical squash sells the camera angle
      if (Math.abs(ix) > Math.abs(iy)) this.facing = ix < 0 ? 'left' : 'right';
      else this.facing = iy < 0 ? 'up' : 'down';
    } else {
      this.vx = approach(this.vx, 0, PLAYER.friction * dt);
      this.vy = approach(this.vy, 0, PLAYER.friction * dt);
    }
  }
  private tryDash() {
    if (this.dashCd <= 0 && this.input.dashPressed) this.fsm.go('dash');
  }

  private puff(x: number, y: number) {
    const s = this.puffs.find((p) => !p.visible);
    if (!s) return;
    s.setPosition(Math.round(x), Math.round(y)).setVisible(true).setDepth(DEPTH.sorted + y - 1);
    s.play('puff');
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.setVisible(false));
  }
  private ghost() {
    const g = this.scene.add.image(this.sprite.x, this.sprite.y, this.def.id, this.sprite.frame.name)
      .setOrigin(this.sprite.originX, this.sprite.originY).setDepth(this.sprite.depth - 1).setAlpha(0.5).setTintFill(0xfff0b8);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 180, onComplete: () => g.destroy() });
  }

  update(dt: number) {
    this.dashCd -= dt;
    this.throwT -= dt;
    this.invuln -= dt;
    this.fsm.update(dt);
    // axis-separated movement against the collision grid: slides along shores and walls
    const nx = this.x + this.vx * dt;
    if (this.L.canStand(nx, this.y)) this.x = nx; else this.vx = 0;
    const ny = this.y + this.vy * dt;
    if (this.L.canStand(this.x, ny)) this.y = ny; else this.vy = 0;

    const moving = this.fsm.is('walk') || this.fsm.is('dash');
    this.sprite.play(`${this.def.id}-${this.fsm.is('fishing') || this.throwT > 0 ? 'fish' : moving ? 'walk' : 'idle'}-${this.facing}`, true);
    this.sprite.setPosition(Math.round(this.x), Math.round(this.y));
    this.sprite.setDepth(DEPTH.sorted + this.y);
    this.shadow.setPosition(this.sprite.x, this.sprite.y);
    // flicker while invulnerable
    this.sprite.setAlpha(this.invuln > 0 && this.alive && Math.floor(this.invuln * 14) % 2 === 0 ? 0.35 : 1);
  }
}

function approach(v: number, target: number, step: number) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}
