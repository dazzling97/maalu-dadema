import Phaser from 'phaser';
import { DEPTH, WORLD } from '../config/game';
import { Layout, POND_C } from '../world/layout';
import { HD } from '../art/hd';
import { GLITTER } from '../art/water';

interface Fish { s: Phaser.GameObjects.Sprite; a: number; sp: number; x: number; y: number; turn: number; }
interface Flyer { s: Phaser.GameObjects.Sprite; hx: number; hy: number; t: number; k: number; x: number; y: number; tx: number; ty: number; wait: number; }

/** Everything that moves on its own: fish, butterflies, dragonflies, sparkles, drifting leaves. */
export class Ambient {
  private fish: Fish[] = [];
  private butterflies: Flyer[] = [];
  private dragonflies: Flyer[] = [];
  private sparkles: Phaser.GameObjects.Sprite[] = [];
  private rings: Phaser.GameObjects.Sprite[] = [];
  private leaves: { s: Phaser.GameObjects.Sprite; life: number; vx: number; ph: number }[] = [];
  private ringT = 1;
  private leafT = 2;

  constructor(private scene: Phaser.Scene, private L: Layout) {
    const R = Math.random;
    for (let i = 0; i < 20; i++) {
      const p = L.shorePoint(R() * Math.PI * 2, 30 + R() * 50);
      const gold = i % 5 === 0;
      const s = scene.add.sprite(p.x, p.y, 'fish').setScale(HD).setDepth(DEPTH.fish).setAlpha(gold ? 0.6 : 0.5).play(gold ? 'fish-gold' : 'fish-dark');
      s.anims.setProgress(R());
      this.fish.push({ s, a: R() * Math.PI * 2, sp: 7 + R() * 9, x: p.x, y: p.y, turn: 0 });
    }
    const homes = L.props.filter((p) => p.kind === 'bushFlower');
    for (let i = 0; i < 16; i++) {
      const h = homes[Math.floor(R() * homes.length)] ?? { x: 400, y: 460 };
      const s = scene.add.sprite(h.x, h.y - 10, 'butterfly').setScale(HD).setDepth(DEPTH.air).play(`butterfly${i % 4}`);
      this.butterflies.push({ s, hx: h.x, hy: h.y - 12, t: R() * 10, k: 0.6 + R() * 0.6, x: h.x, y: h.y, tx: 0, ty: 0, wait: 0 });
    }
    for (let i = 0; i < 7; i++) {
      const p = L.shorePoint(R() * Math.PI * 2, 10 + R() * 30);
      const s = scene.add.sprite(p.x, p.y, 'dragonfly').setScale(HD).setDepth(DEPTH.air).play('dragonfly');
      this.dragonflies.push({ s, hx: p.x, hy: p.y, t: 0, k: 1, x: p.x, y: p.y, tx: p.x, ty: p.y, wait: R() * 2 });
    }
    for (let i = 0; i < 36; i++) {
      const s = scene.add.sprite(0, 0, 'glint').setScale(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.waterFx + 1).setVisible(false);
      this.sparkles.push(s);
      scene.time.delayedCall(R() * 1800, () => this.twinkle(s));
    }
    for (let i = 0; i < 5; i++) this.rings.push(scene.add.sprite(0, 0, 'ring', 0).setScale(HD).setDepth(DEPTH.waterFx).setVisible(false));
    for (let i = 0; i < 8; i++) this.leaves.push({ s: scene.add.sprite(0, 0, 'leaf', 0).setScale(HD).setDepth(DEPTH.air - 1).setVisible(false).play('leaf'), life: 0, vx: 0, ph: 0 });
  }

  /** A visible fish close to this point, if any. */
  fishNear(x: number, y: number, r: number): { s: Phaser.GameObjects.Sprite } | null {
    let best: Fish | null = null, bd = r;
    for (const f of this.fish) { const d = Math.hypot(f.x - x, f.y - y); if (d < bd && f.s.visible) { bd = d; best = f; } }
    return best;
  }

  private twinkle(s: Phaser.GameObjects.Sprite) {
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random());
      const x = Math.round(GLITTER.x + Math.cos(a) * GLITTER.rx * r), y = Math.round(GLITTER.y + Math.sin(a) * GLITTER.ry * r);
      if (this.L.pondAt(x, y) < -8) { s.setPosition(x, y); break; }
    }
    // a sun glint: swells, turns a little, fades
    const peak = HD * (0.6 + Math.random() * 0.6);
    s.setVisible(true).setScale(0).setAlpha(1).setAngle(Math.random() * 20 - 10);
    this.scene.tweens.add({
      targets: s, scale: peak, angle: s.angle + 25, duration: 260 + Math.random() * 200, yoyo: true, ease: 'Sine.inOut',
      onComplete: () => { s.setVisible(false); this.scene.time.delayedCall(150 + Math.random() * 1300, () => this.twinkle(s)); },
    });
  }

  update(dt: number, time: number) {
    // fish: wander, steering back toward open water near the shore
    for (const f of this.fish) {
      const nx = f.x + Math.cos(f.a) * f.sp * dt, ny = f.y + Math.sin(f.a) * f.sp * 0.6 * dt;
      if (this.L.pondAt(nx + Math.cos(f.a) * 14, ny + Math.sin(f.a) * 10) > -14 || this.L.onDock(nx, ny, 10)) {
        const home = Math.atan2(POND_C.y - f.y, POND_C.x - f.x);
        f.a += Phaser.Math.Angle.Wrap(home - f.a) * Math.min(1, dt * 2.5);
      } else {
        f.turn += (Math.random() - 0.5) * dt * 3;
        f.turn *= 0.98;
        f.a += f.turn * dt;
        f.x = nx; f.y = ny;
      }
      if (this.L.pondAt(nx, ny) < -10) { f.x = nx; f.y = ny; }
      f.s.setPosition(Math.round(f.x), Math.round(f.y)).setFlipX(Math.cos(f.a) > 0);
    }
    this.ringT -= dt;
    if (this.ringT <= 0) {
      this.ringT = 0.9 + Math.random() * 1.6;
      const f = this.fish[Math.floor(Math.random() * this.fish.length)];
      const r = this.rings.find((s) => !s.visible);
      if (r) {
        r.setPosition(f.s.x, f.s.y).setVisible(true).play('ring');
        r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.setVisible(false));
      }
    }
    // butterflies: lazy figure-eights around flowering bushes
    for (const b of this.butterflies) {
      b.t += dt * b.k;
      const x = b.hx + Math.sin(b.t * 0.9) * 26 + Math.sin(b.t * 2.3) * 6;
      const y = b.hy + Math.sin(b.t * 1.7) * 9 + Math.cos(b.t * 3.1) * 3;
      b.s.setPosition(Math.round(x), Math.round(y));
    }
    // dragonflies: hover, then dart
    for (const d of this.dragonflies) {
      d.wait -= dt;
      if (d.wait <= 0) {
        const p = this.L.shorePoint(Math.random() * Math.PI * 2, 6 + Math.random() * 40);
        d.tx = p.x; d.ty = p.y - 6; d.wait = 1.2 + Math.random() * 2.5;
      }
      d.x += (d.tx - d.x) * Math.min(1, dt * 5);
      d.y += (d.ty - d.y) * Math.min(1, dt * 5);
      d.s.setPosition(Math.round(d.x), Math.round(d.y + Math.sin(time / 90) * 0.6)).setFlipX(d.tx > d.x);
    }
    // a leaf lets go now and then
    this.leafT -= dt;
    if (this.leafT <= 0) {
      this.leafT = 0.7 + Math.random() * 1.4;
      const l = this.leaves.find((v) => v.life <= 0);
      const cam = this.scene.cameras.main;
      if (l) {
        l.s.setPosition(cam.worldView.x + Math.random() * cam.worldView.width, cam.worldView.y - 4 + Math.random() * cam.worldView.height * 0.6).setVisible(true).setAlpha(1);
        l.life = 3 + Math.random() * 2; l.vx = 8 + Math.random() * 10; l.ph = Math.random() * 6;
      }
    }
    for (const l of this.leaves) {
      if (l.life <= 0) continue;
      l.life -= dt;
      l.s.x += (l.vx + Math.sin(time / 300 + l.ph) * 10) * dt;
      l.s.y += 11 * dt;
      l.s.setAlpha(Math.min(1, l.life));
      if (l.life <= 0 || l.s.y > WORLD.h) { l.life = 0; l.s.setVisible(false); }
    }
  }
}
