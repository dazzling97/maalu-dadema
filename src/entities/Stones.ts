import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { STONE, RUN } from '../config/balance';
import { Layout } from '../world/layout';
import { Player } from './Player';
import { HD } from '../art/hd';
import { audio } from '../systems/Audio';

interface Shot { img: Phaser.GameObjects.Image; shadow: Phaser.GameObjects.Image; x: number; y: number; vx: number; vy: number; t: number; life: number; }
interface Rock { img: Phaser.GameObjects.Image; x: number; y: number; back: number; }
export interface StoneTarget { x: number; y: number; bonk(): boolean; }

/** Rocks: picked up by walking over them, limited in the pocket, lobbed at the cursor. */
export class Stones {
  private shots: Shot[] = [];
  private cd = 0;
  ammo = RUN.startRocks;
  readonly rocks: Rock[] = [];

  constructor(
    private scene: Phaser.Scene, private L: Layout, private player: Player, spots: { x: number; y: number }[],
    private targets: () => StoneTarget[], private onBonk: (t: StoneTarget) => void,
    private say: (x: number, y: number, text: string, color: string) => void,
  ) {
    for (const p of spots) {
      const img = scene.add.image(p.x, p.y, 'stones').setOrigin(0.5, 0.9).setDepth(DEPTH.sorted + p.y);
      this.rocks.push({ img, x: p.x, y: p.y, back: 0 });
    }
    this.emit();
  }
  /** Nearest rock lying on the ground right now. */
  nearest(x: number, y: number): { x: number; y: number } | null {
    let best: Rock | null = null, bd = Infinity;
    for (const r of this.rocks) { if (r.back > 0) continue; const d = Math.hypot(r.x - x, r.y - y); if (d < bd) { bd = d; best = r; } }
    return best ? { x: best.x, y: best.y } : null;
  }
  /** Make sure a rock is lying within `within` px: if not, the closest spot gets its rock back now. Spots are always reachable. */
  ensureNear(x: number, y: number, within: number) {
    const have = this.nearest(x, y);
    if (have && Math.hypot(have.x - x, have.y - y) <= within) return;
    let best: Rock | null = null, bd = Infinity;
    for (const r of this.rocks) { const d = Math.hypot(r.x - x, r.y - y); if (r.back > 0 && d > RUN.rockPickupRadius * 2 && d < bd) { bd = d; best = r; } }
    if (!best || (have && Math.hypot(have.x - x, have.y - y) <= bd)) return;
    best.back = 0;
    best.img.setVisible(true).setAlpha(0).setY(best.y);
    this.scene.tweens.add({ targets: best.img, alpha: 1, duration: 300 });
  }
  private emit() { this.scene.game.events.emit('stones', this.ammo); }

  /** Walking onto a rock pockets it. With full pockets it simply stays on the ground. */
  private autoCollect() {
    if (this.ammo >= RUN.maxRocks || !this.player.alive) return;
    for (const r of this.rocks) {
      if (r.back > 0 || Math.hypot(this.player.x - r.x, (this.player.y - r.y) * 1.2) > RUN.rockPickupRadius) continue;
      this.ammo++;
      r.back = RUN.rockRespawn;
      // the rock hops up into the pocket
      const img = r.img;
      this.scene.tweens.add({ targets: img, y: r.y - 12, alpha: 0, duration: 200, ease: 'Quad.out', onComplete: () => img.setVisible(false).setY(r.y) });
      const fx = this.scene.add.sprite(r.x, r.y - 6, 'sparkle', 0).setDepth(DEPTH.air + 4).play('sparkle');
      fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
      this.say(r.x, r.y - 14, '+1 ROCK', '#f6e7c1');
      audio.play('pickup');
      this.emit();
      if (this.ammo >= RUN.maxRocks) return;
    }
  }

  throwAt(tx: number, ty: number): boolean {
    if (this.cd > 0 || !this.player.alive) return false;
    this.cd = STONE.cooldown;
    if (this.ammo <= 0) {
      this.say(this.player.x, this.player.y - 40, 'NO ROCKS! WALK OVER ONE TO GRAB IT', '#ffb0a0');
      this.scene.game.events.emit('norocks');
      audio.play('deny');
      return false;
    }
    this.ammo--;
    audio.play('throw');
    this.emit();
    const p = this.player;
    p.throwAt(tx, ty);
    const sx = p.x, sy = p.y - 4;
    const dx = tx - sx, dy = ty - sy, len = Math.hypot(dx, dy) || 1;
    const dist = Math.min(STONE.range, Math.max(24, len));
    const img = this.scene.add.image(sx, sy, 'stone');
    const shadow = this.scene.add.image(sx, sy, 'shadow').setScale(0.4 * HD).setDepth(DEPTH.flat + 2);
    this.shots.push({ img, shadow, x: sx, y: sy, vx: (dx / len) * STONE.speed, vy: (dy / len) * STONE.speed, t: 0, life: dist / STONE.speed });
    return true;
  }

  private impact(x: number, y: number, hit: boolean) {
    const water = !hit && this.L.pondAt(x, y) < 0 && !this.L.onDock(x, y, 0);
    const key = water ? 'ring' : 'puff';
    const fx = this.scene.add.sprite(Math.round(x), Math.round(y), key, 0).setDepth(water ? DEPTH.waterFx + 1 : DEPTH.sorted + y + 5).play(key);
    fx.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => fx.destroy());
    if (hit) for (let i = 0; i < 4; i++) { // chips fly off
      const chip = this.scene.add.image(x, y - 6, 'drop').setDepth(DEPTH.air + 2);
      const a = Math.random() * Math.PI * 2;
      this.scene.tweens.add({ targets: chip, x: x + Math.cos(a) * 12, y: y - 6 + Math.sin(a) * 9, alpha: 0, duration: 280, onComplete: () => chip.destroy() });
    }
  }

  update(dt: number) {
    this.cd -= dt;
    this.autoCollect();
    for (const r of this.rocks) {
      if (r.back <= 0) continue;
      r.back -= dt;
      if (r.back <= 0) { r.img.setVisible(true).setAlpha(0); this.scene.tweens.add({ targets: r.img, alpha: 1, duration: 400 }); }
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt;
      const u = Math.min(1, s.t / s.life);
      const h = Math.sin(Math.PI * u) * 12 + 8 * (1 - u); // leaves the hand at shoulder height
      s.img.setPosition(Math.round(s.x), Math.round(s.y - h)).setDepth(DEPTH.sorted + s.y + 4);
      s.shadow.setPosition(Math.round(s.x), Math.round(s.y));
      const hit = this.targets().find((t) => Math.hypot(t.x - s.x, (t.y - 4 - s.y) * 1.3) < STONE.hitRadius);
      if (hit && hit.bonk()) { this.impact(hit.x, hit.y, true); this.onBonk(hit); }
      else if (u < 1) continue;
      else { this.impact(s.x, s.y, false); audio.play(this.L.pondAt(s.x, s.y) < 0 ? 'splash' : 'thud'); }
      s.img.destroy(); s.shadow.destroy();
      this.shots.splice(i, 1);
    }
  }
}
