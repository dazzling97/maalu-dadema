import Phaser from 'phaser';
import { DEPTH, PAL } from '../config/game';
import { FISHING, FISH, FISH_SIZES, FishDef, ZONES, ZoneId, EVENTS, RUN, CUR, GEAR, GearDef } from '../config/balance';
import { catchSize } from '../systems/Gear';
import { Layout, waterZone } from '../world/layout';
import { Economy } from '../systems/Economy';
import { ZoneState } from '../systems/Zones';
import { ORIGIN } from '../art/textures';
import { textCanvas } from '../art/font';
import { Player } from './Player';
import { Input } from '../systems/Input';
import { Ambient } from './Ambient';
import { audio } from '../systems/Audio';
import { uiText } from '../scenes/UiScene';

type FState = 'none' | 'cast' | 'wait' | 'bite' | 'reel' | 'end';
interface Pt { x: number; y: number; }

/**
 * The whole cast -> wait -> bite -> reel loop. Owns the bobber, the line, the
 * bite indicator and the bucket tally; the player is simply locked while it runs.
 */
export class Fishing {
  state: FState = 'none';
  /** Zone the current cast landed in. */
  zone: ZoneId = 'A';
  misses = 0;
  /** Event hooks, set by the scene. */
  golden: Pt | null = null;
  bonanza: ZoneId | null = null;
  onGolden: () => void = () => {};
  private hookedGolden = false;
  /** Reaction-window multiplier from the current difficulty band. */
  windowMul = 1;
  /** The equipment in hand. Set by the scene. */
  gear: () => GearDef = () => GEAR.rod;
  private g: GearDef = GEAR.rod; // equipment this cast was made with
  /** Set true by the scene once the run has ended. */
  locked = false;
  private t = 0;
  private target: Pt = { x: 0, y: 0 };
  private bobPos: Pt = { x: 0, y: 0 };
  private biteAt = 0;
  private nibbles: number[] = [];
  private dip = 0;
  private kind: FishDef = FISH[0];
  private sizeIdx = 0;
  private taut = false;
  private gfx: Phaser.GameObjects.Graphics;
  private bob: Phaser.GameObjects.Image;
  private bang: Phaser.GameObjects.Image;
  private prompt: Phaser.GameObjects.Image;
  private lurker: Phaser.GameObjects.Sprite;
  private texN = 0;
  /** World position of the cursor, set by the scene every frame. */
  aim: Pt = { x: 0, y: 0 };

  private marker: Phaser.GameObjects.Sprite;
  private hooked: Phaser.GameObjects.Sprite | null = null;

  constructor(private scene: Phaser.Scene, private L: Layout, private player: Player, private input: Input, private ambient: Ambient, readonly eco: Economy, readonly zones: ZoneState) {
    this.gfx = scene.add.graphics();
    this.bob = scene.add.image(0, 0, 'bobber', 0).setOrigin(ORIGIN.bobber.x, ORIGIN.bobber.y).setVisible(false);
    this.bang = scene.add.image(0, 0, 'bang').setOrigin(0.5, 1).setDepth(DEPTH.air + 5).setVisible(false);
    this.prompt = scene.add.image(0, 0, 'key-space').setOrigin(0.5, 1).setDepth(DEPTH.air + 4).setVisible(false);
    this.marker = scene.add.sprite(0, 0, 'ring', 1).setDepth(DEPTH.waterFx + 2).setVisible(false);
    this.lurker = scene.add.sprite(0, 0, 'fish', 0).setDepth(DEPTH.fish).setAlpha(0).play('fish-dark');
  }

  /** Zone currently being drained by the player's line, if any. */
  get fishingZone(): ZoneId | null { return this.state === 'wait' || this.state === 'bite' ? this.zone : null; }
  get busy() { return this.state !== 'none'; }
  emit() {
    const e = this.eco;
    this.scene.game.events.emit('tally', { carried: e.carried, stored: e.stored });
  }

  // ------------------------------------------------------------------ geometry
  private dirVec(): Pt {
    return { down: { x: 0, y: 1 }, up: { x: 0, y: -1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[this.player.facing];
  }
  /** Where the bobber would land: the cursor, if it is over open water within reach. */
  private findTarget(): Pt | null {
    const p = this.player;
    const ok = (x: number, y: number) => this.L.pondAt(x, y) < -5 && !this.L.onDock(x, y, 3);
    let dx = this.aim.x - p.x, dy = this.aim.y - (p.y - 4);
    const len = Math.hypot(dx, dy);
    if (len < 12) return null;
    // beyond reach: pull the cast back along the same line
    if (len > FISHING.reach) { dx *= FISHING.reach / len; dy *= FISHING.reach / len; }
    const x = Math.round(p.x + dx), y = Math.round(p.y - 4 + dy);
    return ok(x, y) ? { x, y } : null;
  }
  private rod(): { hand: Pt; tip: Pt } {
    const s = this.player.sprite, x = s.x, y = s.y;
    const lift = this.taut ? -3 : 0;
    switch (this.player.facing) {
      case 'left': return { hand: { x: x - 8, y: y - 13 }, tip: { x: x - 18 - lift, y: y - 23 + lift } };
      case 'right': return { hand: { x: x + 8, y: y - 13 }, tip: { x: x + 18 + lift, y: y - 23 + lift } };
      case 'up': return { hand: { x: x + 6, y: y - 17 }, tip: { x: x + 8, y: y - 32 + lift } };
      default: return { hand: { x: x + 6, y: y - 16 }, tip: { x: x + 10, y: y - 3 - lift } };
    }
  }

  // ------------------------------------------------------------------ effects
  private draw() {
    this.gfx.clear();
    if (this.state === 'none') return;
    const { hand, tip } = this.rod();
    const depth = DEPTH.sorted + Math.max(this.player.y, this.bobPos.y) + 2;
    this.gfx.setDepth(depth);
    // the rod: a dark edge under a lighter core, smooth at any angle
    this.gfx.lineStyle(1.05, 0x5e3c22, 1).lineBetween(hand.x, hand.y, tip.x, tip.y);
    this.gfx.lineStyle(0.5, 0xa8744a, 1).lineBetween(hand.x, hand.y, tip.x, tip.y);
    this.gfx.fillStyle(0xf4f1e6, 1).fillCircle(tip.x, tip.y, 0.45);
    if (this.state === 'end') return;
    // fishing line: sags while waiting, snaps taut on a bite
    const sag = this.taut ? 0 : 7;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const u = i / 16, v = 1 - u;
      pts.push(new Phaser.Math.Vector2(v * tip.x + u * this.bobPos.x, v * tip.y + u * (this.bobPos.y - 3) + Math.sin(Math.PI * u) * sag));
    }
    this.gfx.lineStyle(0.4, 0xf6f1e0, 0.9).strokePoints(pts, false, false);
  }
  private splash(p: Pt, n: number, power: number) {
    for (let i = 0; i < n; i++) {
      const d = this.scene.add.image(p.x, p.y, 'drop').setDepth(DEPTH.sorted + p.y + 3);
      const a = -Math.PI * (0.15 + 0.7 * Math.random()), sp = power * (0.5 + Math.random() * 0.6);
      this.scene.tweens.add({ targets: d, x: p.x + Math.cos(a) * sp, duration: 420, ease: 'Linear' });
      this.scene.tweens.add({ targets: d, y: p.y + Math.sin(a) * sp, duration: 210, ease: 'Quad.out', yoyo: true, onComplete: () => d.destroy() });
    }
    this.ring(p);
  }
  private ring(p: Pt) {
    const r = this.scene.add.sprite(p.x, p.y, 'ring', 0).setDepth(DEPTH.waterFx + 1).play('ring');
    r.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => r.destroy());
  }
  private floatText(x: number, y: number, text: string, color: string, scale = 1) {
    const t = uiText(this.scene, Math.round(x), Math.round(y), text, scale > 1 ? 10 : 7.5, color, true).setOrigin(0.5).setDepth(DEPTH.air + 6);
    this.scene.tweens.add({ targets: t, y: y - 18, duration: 1100, ease: 'Cubic.out', onComplete: () => t.destroy() });
    this.scene.tweens.add({ targets: t, alpha: 0, duration: 300, delay: 800 });
  }

  // ------------------------------------------------------------------ flow
  private pickFish() {
    const luck = this.player.def.luckMul;
    const weights = FISH.map((f) => f.weight * (f.rare ? luck * ZONES[this.zone].rareBoost : 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    this.kind = FISH[0];
    for (let i = 0; i < FISH.length; i++) { r -= weights[i]; if (r <= 0) { this.kind = FISH[i]; break; } }
    let s = Math.random();
    this.sizeIdx = 0;
    for (let i = 0; i < FISH_SIZES.length; i++) { s -= FISH_SIZES[i].odds; if (s <= 0) { this.sizeIdx = i; break; } }
  }

  private start(target: Pt) {
    this.player.faceToward(target.x, target.y);
    this.player.lock();
    this.target = target;
    this.marker.setVisible(false);
    this.g = this.gear();
    const isNet = this.g.catch > 1;
    this.bob.setTexture(isNet ? 'net' : 'bobber', isNet ? (this.g.catch > 3 ? 1 : 0) : 0).setOrigin(0.5, isNet ? 0.5 : ORIGIN.bobber.y);
    audio.play(isNet ? 'netCast' : 'cast');
    this.state = 'cast'; this.t = 0; this.taut = false; this.dip = 0;
    this.prompt.setVisible(false);
    this.bob.setVisible(true);
  }
  private land() {
    audio.play('splash');
    this.zone = waterZone(this.target.x, this.target.y);
    if (!this.zones.available(this.zone)) {
      this.splash(this.target, 3, 6);
      this.floatText(this.player.sprite.x, this.player.sprite.y - 40, 'FISHED OUT! TRY ANOTHER SPOT', '#ffb0a0');
      this.finish(0.35);
      return;
    }
    if (this.zones.thin(this.zone)) this.floatText(this.target.x, this.target.y - 12, 'FISH ARE THINNING HERE', '#f6e7c1');
    this.state = 'wait'; this.t = 0;
    this.pickFish();
    this.splash(this.target, 5, 9);
    this.hookedGolden = !!this.golden && Math.hypot(this.golden.x - this.target.x, this.golden.y - this.target.y) < EVENTS.goldenSnap;
    if (this.hookedGolden) { this.kind = FISH[FISH.length - 1]; this.sizeIdx = 0; }
    const near = this.hookedGolden ? null : this.ambient.fishNear(this.target.x, this.target.y, FISHING.fishSnap);
    let sx: number, sy: number;
    if (near) {
      // dropped right on a fish: it takes the bait almost at once
      this.biteAt = Phaser.Math.FloatBetween(0.6, 1.2) * Math.sqrt(this.zones.waitMul(this.zone));
      this.nibbles = [];
      this.hooked = near.s;
      near.s.setVisible(false);
      sx = near.s.x; sy = near.s.y;
    } else {
      this.biteAt = this.hookedGolden ? 0.9 : Phaser.Math.FloatBetween(FISHING.waitMin, FISHING.waitMax) * CUR.waitMul * this.g.waitMul * this.zones.waitMul(this.zone) * (this.bonanza === this.zone ? EVENTS.bonanzaWait : 1);
      if (this.hookedGolden) this.nibbles = [];
      if (!this.hookedGolden) this.nibbles = [this.biteAt - 1.7, this.biteAt - 0.9].filter((n) => n > 0.5 && Math.random() < 0.7);
      const a = Math.random() * Math.PI * 2;
      sx = this.target.x + Math.cos(a) * 38; sy = this.target.y + Math.sin(a) * 22;
      if (this.L.pondAt(sx, sy) > -8) { sx = this.target.x; sy = this.target.y - 4; }
    }
    this.lurker.setPosition(sx, sy).setAlpha(near ? 0.55 : 0).setFlipX(sx < this.target.x);
    this.scene.tweens.add({ targets: this.lurker, x: this.target.x + (sx < this.target.x ? -7 : 7), y: this.target.y + 2, alpha: 0.6, duration: near ? 500 : 1300, delay: near ? 0 : Math.max(0, (this.biteAt - 1.4) * 1000), ease: 'Sine.out' });
  }
  private finish(delay: number) {
    this.state = 'end'; this.t = -delay;
    if (this.hooked) { this.hooked.setVisible(true); this.hooked = null; }
    this.bang.setVisible(false);
    this.bob.setVisible(false);
    this.scene.tweens.killTweensOf(this.lurker);
    this.scene.tweens.add({ targets: this.lurker, alpha: 0, x: this.lurker.x + (this.lurker.flipX ? -30 : 30), duration: 350 });
  }
  private fail(msg: string) {
    this.misses++;
    audio.play('miss');
    this.floatText(this.player.sprite.x, this.player.sprite.y - 40, msg, '#ffb0a0');
    this.ring(this.target);
    this.finish(0.45);
  }
  private hook() {
    this.state = 'reel'; this.t = 0; this.taut = true;
    audio.play('splash');
    this.bang.setVisible(false);
    this.bob.setVisible(false);
    this.lurker.setAlpha(0);
    this.splash(this.target, 9, 15);
    this.scene.cameras.main.shake(90, this.kind.rare ? 0.004 : 0.002);
    const s = this.player.sprite;
    const fish = this.scene.add.image(this.target.x, this.target.y, 'catch', FISH.indexOf(this.kind)).setDepth(DEPTH.air + 3);
    if (this.sizeIdx > 0) fish.setScale(this.sizeIdx === 1 ? 1 : 2); // huge fish read as huge
    const head = { x: s.x, y: s.y - 44 };
    const reel = this.g.reelTime * 1000; // nets take longer to haul in
    this.scene.tweens.add({ targets: fish, x: head.x, duration: reel, ease: 'Sine.inOut' });
    this.scene.tweens.add({
      targets: fish, y: head.y, duration: reel, ease: 'Back.out',
      onComplete: () => this.caught(fish),
    });
  }
  private caught(fish: Phaser.GameObjects.Image) {
    const golden = this.hookedGolden;
    // how many come up: limited by the equipment, free hands and the fish left in this spot
    const want = catchSize(this.g.catch, this.eco.room, this.zones.pop[this.zone]);
    const got = this.eco.catchFish(golden ? Math.max(RUN.goldenFish, want) : want);
    audio.play(got > 1 ? 'catchMulti' : 'catch');
    if (golden) { this.hookedGolden = false; this.onGolden(); } else if (this.bonanza !== this.zone) for (let i = 0; i < got; i++) this.zones.take(this.zone);
    for (let i = 1; i < got; i++) { // the rest of the haul tumbles in after the first
      const extra = this.scene.add.image(this.target.x, this.target.y, 'catch', i % 5).setDepth(DEPTH.air + 3);
      this.scene.tweens.add({ targets: extra, x: this.player.sprite.x + (i - got / 2) * 7, y: this.player.sprite.y - 40 - (i % 2) * 6, duration: 260, delay: i * 50, ease: 'Quad.out' });
      this.scene.tweens.add({ targets: extra, alpha: 0, y: this.player.sprite.y - 16, duration: 260, delay: 420 + i * 40, onComplete: () => extra.destroy() });
    }
    const size = FISH_SIZES[this.sizeIdx];
    const s = this.player.sprite;
    this.floatText(s.x, s.y - 62, golden ? 'THE GOLDEN FISH!' : `${size.label}${this.kind.name}`, this.kind.rare ? '#ffe36a' : PAL.cream);
    this.floatText(s.x, s.y - 71, `+${got} FISH`, '#9ff08a', golden || got > 1 ? 2 : 1);
    this.scene.tweens.add({ targets: s, y: s.y - 5, duration: 110, yoyo: true, ease: 'Quad.out' }); // little hop of triumph
    if (this.kind.rare || golden) for (let i = 0; i < 6; i++) {
      const sp = this.scene.add.sprite(s.x + Phaser.Math.Between(-14, 14), s.y - 40 + Phaser.Math.Between(-10, 10), 'sparkle', 0).setDepth(DEPTH.air + 6);
      this.scene.time.delayedCall(i * 60, () => sp.play('sparkle'));
      sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
    }
    // tucked under the arm
    this.scene.tweens.add({ targets: fish, x: s.x, y: s.y - 16, alpha: 0, duration: 300, delay: 380, onComplete: () => fish.destroy() });
    this.emit();
    this.scene.game.events.emit('caught');
    this.finish(0.5);
  }

  /** Drop the line at once (bitten, or the player started a throw). */
  cancel() {
    if (this.state === 'cast' || this.state === 'wait' || this.state === 'bite') { this.finish(0); this.t = 0; }
  }
  update(dt: number, time: number) {
    this.t += dt;
    const pressed = this.input.actionPressed;
    const p = this.player;
    if (this.state !== 'none') this.marker.setVisible(false);
    switch (this.state) {
      case 'none': {
        const target = p.canAct && !this.locked ? this.findTarget() : null;
        this.marker.setVisible(!!target);
        if (target) this.marker.setPosition(target.x, target.y).setFrame(1 + (Math.floor(time / 220) % 2));
        this.prompt.setVisible(!!target).setPosition(p.sprite.x, p.sprite.y - 36 + Math.round(Math.sin(time / 260)));
        if (pressed && p.canAct && !this.locked) {
          if (target && this.eco.room <= 0) { this.floatText(p.sprite.x, p.sprite.y - 38, 'HANDS FULL! TAKE THEM TO THE BAG', '#ffb0a0'); audio.play('deny'); }
          else if (target) this.start(target);
          else this.floatText(p.sprite.x, p.sprite.y - 38, 'POINT AT THE WATER', PAL.cream);
        }
        break;
      }
      case 'cast': {
        const u = Math.min(1, this.t / FISHING.castTime), tip = this.rod().tip;
        this.bobPos = { x: tip.x + (this.target.x - tip.x) * u, y: tip.y + (this.target.y - tip.y) * u - Math.sin(Math.PI * u) * 20 };
        if (u >= 1) this.land();
        break;
      }
      case 'wait': {
        if (this.input.moveX || this.input.moveY) { this.finish(0); this.t = 0; break; } // walk away to cancel
        if (this.nibbles.length && this.t >= this.nibbles[0]) { this.nibbles.shift(); this.dip = 0.16; this.ring(this.target); }
        this.dip -= dt;
        this.bobPos = { x: this.target.x, y: this.target.y + Math.round(Math.sin(time / 320)) + (this.dip > 0 ? 1 : 0) };
        if (this.t >= this.biteAt) {
          this.state = 'bite'; this.t = 0; this.taut = true;
          this.bob.setFrame(this.g.catch > 1 ? (this.g.catch > 3 ? 3 : 2) : 1);
          this.bobPos = { x: this.target.x, y: this.target.y + 2 };
          this.splash(this.target, 4, 7);
          this.bang.setVisible(true);
          audio.play('bite');
        }
        break;
      }
      case 'bite': {
        this.bang.setPosition(p.sprite.x, p.sprite.y - 36 - Math.abs(Math.round(Math.sin(time / 60) * 2)));
        this.bobPos = { x: this.target.x + Math.round(Math.sin(time / 40)), y: this.target.y + 2 };
        if (pressed) this.hook();
        else if (this.t > this.kind.window * FISHING.windowMul * ZONES[this.zone].windowMul * this.windowMul * CUR.windowMul * this.g.windowMul) this.fail('IT GOT AWAY...');
        break;
      }
      case 'reel': break;
      default: break;
      case 'end': {
        if (this.t >= 0 || !p.alive) { this.state = 'none'; this.taut = false; p.unlock(); }
        break;
      }
    }
    this.bob.setPosition(Math.round(this.bobPos.x), Math.round(this.bobPos.y)).setDepth(DEPTH.sorted + this.bobPos.y + 1);
    this.draw();
  }
}
