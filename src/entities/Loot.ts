import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { THIEF } from '../config/balance';
import { Player } from './Player';
import { Economy } from '../systems/Economy';
import { HD } from '../art/hd';
import { audio } from '../systems/Audio';

interface Drop { img: Phaser.GameObjects.Image; x: number; y: number; life: number; }

/** Fish lying on the ground (dropped after a bite, or spilled by Sabapathi). Walk over them to pick them up. */
export class Loot {
  private drops: Drop[] = [];
  private fullT = 0;
  /** Fish picked back up off the ground so far. */
  picked = 0;
  constructor(private scene: Phaser.Scene, private player: Player, private eco: Economy, private say: (x: number, y: number, t: string, c: string) => void, private changed: () => void) {}

  get count() { return this.drops.length; }
  get positions() { return this.drops.map((d) => ({ x: d.x, y: d.y })); }

  scatter(fromX: number, fromY: number, n: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = 10 + Math.random() * 12;
      const x = fromX + Math.cos(a) * r, y = fromY + Math.sin(a) * r * 0.6;
      const img = this.scene.add.image(Math.round(fromX), Math.round(fromY - 14), 'catchHD', Math.floor(Math.random() * 3)).setScale(HD).setDepth(DEPTH.sorted + y);
      this.scene.tweens.add({ targets: img, x: Math.round(x), duration: 320 });
      this.scene.tweens.add({ targets: img, y: Math.round(y), duration: 320, ease: 'Bounce.out' });
      this.drops.push({ img, x, y, life: THIEF.dropExpire });
    }
  }

  update(dt: number) {
    this.fullT -= dt;
    for (let k = this.drops.length - 1; k >= 0; k--) {
      const d = this.drops[k];
      d.life -= dt;
      const near = this.player.alive && d.life < THIEF.dropExpire - 0.5 && Math.hypot(this.player.x - d.x, (this.player.y - d.y) * 1.3) < 13;
      let taken = false;
      if (near) {
        taken = this.eco.pickUp();
        if (taken) { this.picked++; this.say(d.x, d.y - 12, '+1 FISH', '#9ff08a'); audio.play('recover'); this.changed(); }
        else if (this.fullT <= 0) { this.fullT = 1.5; this.say(d.x, d.y - 12, 'HANDS FULL', '#ffb0a0'); }
      }
      if (d.life < 6) d.img.setAlpha(Math.floor(d.life * 6) % 2 ? 0.4 : 1);
      if (taken || d.life <= 0) { d.img.destroy(); this.drops.splice(k, 1); }
    }
  }
}
