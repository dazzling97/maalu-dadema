import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { HD, hdScale } from '../art/hd';
import { touchButtonHD, stickBaseHD, stickKnobHD, touchIconHD } from '../art/uiHD';
import { touch, touchMode, TouchKey } from '../systems/Touch';
import { fitUi, uiText } from './UiScene';
import type { WorldScene } from './WorldScene';

type BtnId = 'fish' | 'rock' | 'use' | 'dash' | 'gear' | 'pause';
interface Btn {
  id: BtnId; x: number; y: number; r: number; hit: number;
  c: Phaser.GameObjects.Container; faces: Phaser.GameObjects.Image[];
  icon: Phaser.GameObjects.Image; label?: Phaser.GameObjects.Text; badge?: Phaser.GameObjects.Text;
  held: number | null; show: boolean; state: 0 | 2; home: string;
}
interface Stick { base: Phaser.GameObjects.Image; knob: Phaser.GameObjects.Image; rx: number; ry: number; x: number; y: number; r: number; id: number | null; }

/** Thumb-sized sizes in CSS pixels; converted to world units for the current screen. */
const PHONE = { stick: 52, big: 32, small: 24, pause: 17, margin: 16, bottom: 8 };
const TABLET = { stick: 62, big: 38, small: 29, pause: 20, margin: 26, bottom: 0 };

/**
 * On-screen controls for phones and tablets, drawn over the HUD during play:
 * a floating joystick on the left, FISH / ROCK / USE / DASH / GEAR on the right,
 * and pause in the top-right corner. Every control remembers which finger holds
 * it, so moving with one thumb and pressing with the other never interfere, and
 * every way a touch can end (lift, cancel, leaving the page, rotating, pausing)
 * lets go of everything.
 */
export class TouchScene extends Phaser.Scene {
  private root!: Phaser.GameObjects.Container;
  private btns: Btn[] = [];
  private stick!: Stick;
  private keys: string[] = [];
  private n = 0;
  private on = false;
  private sig = '';

  constructor() { super('touch'); }

  create() {
    fitUi(this);
    this.on = false; this.sig = ''; this.btns = []; this.keys = [];
    this.root = this.add.container(0, 0).setVisible(false);
    this.input.on('pointerdown', this.down, this);
    this.input.on('pointermove', this.move, this);
    this.input.on('pointerup', this.up, this);
    this.input.on('pointerupoutside', this.up, this);
    const lose = () => this.releaseAll();
    const hidden = () => { if (document.hidden) lose(); };
    window.addEventListener('blur', lose);
    window.addEventListener('pagehide', lose);
    window.addEventListener('orientationchange', lose);
    document.addEventListener('visibilitychange', hidden);
    this.game.events.on(Phaser.Core.Events.BLUR, lose);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('blur', lose); window.removeEventListener('pagehide', lose); window.removeEventListener('orientationchange', lose);
      document.removeEventListener('visibilitychange', hidden);
      this.game.events.off(Phaser.Core.Events.BLUR, lose);
      this.releaseAll(); this.dropTextures();
    });
  }

  // ---------------------------------------------------------------- layout
  private tex(c: HTMLCanvasElement): string {
    const key = `touch-${this.n++}`;
    this.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.keys.push(key);
    return key;
  }
  private dropTextures() { this.keys.forEach((k) => this.textures.exists(k) && this.textures.remove(k)); this.keys = []; }

  /** Size and place everything for the current screen (called again on resize and rotation). */
  private layout() {
    this.root.removeAll(true);
    this.dropTextures();
    this.btns = [];
    const canvas = this.game.canvas.getBoundingClientRect();
    const k = Math.max(0.3, canvas.width / VIEW.w); // CSS pixels per world unit
    const S = Math.min(window.innerWidth, window.innerHeight) >= 600 ? TABLET : PHONE;
    const u = (css: number, lo: number, hi: number) => Phaser.Math.Clamp(css / k, lo, hi);
    // keep clear of notches, rounded corners and the home indicator
    const safe = safeInsets();
    const sl = Math.max(0, safe.left - canvas.left) / k, sr = Math.max(0, canvas.right - (window.innerWidth - safe.right)) / k;
    const sb = Math.max(0, canvas.bottom - (window.innerHeight - safe.bottom)) / k;
    const m = u(S.margin, 6, 16), mb = m + u(S.bottom, 0, 6);
    const R = u(S.stick, 22, 44), rB = u(S.big, 14, 26), rS = u(S.small, 11, 19), rP = u(S.pause, 8, 12);
    const minHit = 22 / k; // never smaller than a fingertip

    // joystick: rests bottom-left, follows the thumb to wherever it lands on the left half
    const rx = m + sl + R, ry = VIEW.h - mb - sb - R;
    const base = this.add.image(rx, ry, this.tex(stickBaseHD(R))).setScale(HD).setAlpha(0.5);
    const knob = this.add.image(rx, ry, this.tex(stickKnobHD(R * 0.44))).setScale(HD).setAlpha(0.7);
    this.root.add([base, knob]);
    this.stick = { base, knob, rx, ry, x: rx, y: ry, r: R, id: null };

    // action buttons: FISH in the corner under the thumb, the others in an arc around it
    const fx = VIEW.w - m - sr - rB, fy = VIEW.h - mb - sb - rB, gap = u(9, 3, 6);
    const d1 = rB + rS + gap, d2 = d1 + 2 * rS + gap;
    const at = (deg: number, d: number) => ({ x: fx + Math.cos((deg * Math.PI) / 180) * d, y: fy + Math.sin((deg * Math.PI) / 180) * d });
    this.button('fish', fx, fy, rB, Math.max(rB * 1.15, minHit), 'catch', 'FISH');
    const rock = at(180, d1), dash = at(225, d1), use = at(270, d1), gear = at(247.5, d2);
    this.button('rock', rock.x, rock.y, rS, Math.max(rS * 1.15, minHit), 'stones', 'ROCK');
    this.button('dash', dash.x, dash.y, rS, Math.max(rS * 1.1, minHit), '', 'DASH', touchIconHD('dash', rS));
    this.button('use', use.x, use.y, rS, Math.max(rS * 1.15, minHit), '', 'USE', touchIconHD('use', rS));
    this.button('gear', gear.x, gear.y, rS, Math.max(rS * 1.1, minHit), 'gear', 'GEAR');
    // pause: top-right, in the space the HUD leaves for it
    this.button('pause', VIEW.w - 6 - sr - rP, 4 + rP, rP, Math.max(rP * 1.5, minHit), '', '', touchIconHD('pause', rP * 1.1));
    const rb = this.btns.find((b) => b.id === 'rock')!;
    // rocks left: a small gold counter on the outer edge, clear of the neighbouring buttons
    const bx = -rb.r * 0.74, by = -rb.r * 0.74, br = Math.max(4.5, rb.r * 0.3);
    rb.c.add(this.add.circle(bx, by, br, 0x2b1b2e, 0.92).setStrokeStyle(0.6, 0xf6d24a));
    rb.badge = uiText(this, bx, by, '', Math.max(5.5, br * 1.2), '#fff3d6', true).setOrigin(0.5);
    rb.c.add(rb.badge);
  }

  private button(id: BtnId, x: number, y: number, r: number, hit: number, iconKey: string, label: string, iconCanvas?: HTMLCanvasElement) {
    const c = this.add.container(x, y);
    const faces = ([0, 1, 2] as const).map((s) => this.add.image(0, 0, this.tex(touchButtonHD(r, s))).setScale(HD).setVisible(s === 0));
    c.add(faces);
    const iy = label ? -r * 0.16 : 0;
    const icon = iconCanvas ? this.add.image(0, iy, this.tex(iconCanvas)).setScale(HD) : this.add.image(0, iy, iconKey, 0);
    if (!iconCanvas) { icon.setScale(hdScale(iconKey)); icon.setScale(icon.scaleX * ((r * (iconKey === 'stones' ? 1.25 : 1)) / Math.max(icon.displayWidth, icon.displayHeight))); }
    c.add(icon);
    let text: Phaser.GameObjects.Text | undefined;
    if (label) { text = uiText(this, 0, r * 0.52, label, Math.max(5.2, r * 0.3), '#fff3d6', true).setOrigin(0.5); c.add(text); }
    this.root.add(c);
    this.btns.push({ id, x, y, r, hit, c, faces, icon, label: text, held: null, show: true, state: 0, home: icon.texture.key });
  }

  // ---------------------------------------------------------------- touches
  private view(p: Phaser.Input.Pointer) { return p.positionToCamera(this.cameras.main) as Phaser.Math.Vector2; }

  private down(p: Phaser.Input.Pointer) {
    if (!this.on) return;
    const v = this.view(p);
    // buttons first: the nearest one under the finger
    let best: Btn | null = null, bd = Infinity;
    for (const b of this.btns) {
      if (!b.show || b.held !== null) continue;
      const d = Math.hypot(v.x - b.x, v.y - b.y);
      if (d <= b.hit && d < bd) { bd = d; best = b; }
    }
    if (best) { this.hold(best, p.id); return; }
    // the joystick takes the left half below the HUD. While aiming a rock, taps there go to the
    // world (the target may be on the left), unless they land on the joystick itself.
    const s = this.stick;
    if (s.id !== null) return;
    const nearRest = Math.hypot(v.x - s.rx, v.y - s.ry) < s.r * 1.4;
    if ((v.x < VIEW.w * 0.5 && v.y > VIEW.h * 0.3 && !touch.aiming) || nearRest) { // below the HUD, notices and tutorial card
      touch.claimed.add(p.id);
      s.id = p.id;
      this.tweens.killTweensOf([s.base, s.knob]);
      s.x = Phaser.Math.Clamp(v.x, s.r + 4, VIEW.w * 0.5); s.y = Phaser.Math.Clamp(v.y, 30 + s.r * 0.5, VIEW.h - s.r - 2);
      s.base.setPosition(s.x, s.y).setAlpha(0.95);
      s.knob.setAlpha(1);
      this.steer(v.x, v.y);
    }
  }
  private move(p: Phaser.Input.Pointer) {
    if (this.stick?.id === p.id) { const v = this.view(p); this.steer(v.x, v.y); }
  }
  private up(p: Phaser.Input.Pointer) {
    if (this.stick?.id === p.id) this.releaseStick();
    for (const b of this.btns) if (b.held === p.id) this.letGo(b);
    touch.claimed.delete(p.id);
  }

  /** Thumb at (x, y): full speed in any of 360 directions beyond a small dead zone (same speed as the keyboard). */
  private steer(x: number, y: number) {
    const s = this.stick, dx = x - s.x, dy = y - s.y, len = Math.hypot(dx, dy);
    const k = len > s.r ? s.r / len : 1;
    s.knob.setPosition(s.x + dx * k, s.y + dy * k);
    if (len < s.r * 0.2) { touch.mx = 0; touch.my = 0; }
    else { touch.mx = dx / len; touch.my = dy / len; }
  }
  private releaseStick() {
    const s = this.stick;
    if (!s) return;
    if (s.id !== null) touch.claimed.delete(s.id);
    s.id = null; touch.mx = 0; touch.my = 0;
    this.tweens.killTweensOf([s.base, s.knob]);
    this.tweens.add({ targets: s.knob, x: s.rx, y: s.ry, alpha: 0.7, duration: 140, ease: 'Back.out' });
    this.tweens.add({ targets: s.base, x: s.rx, y: s.ry, alpha: 0.5, duration: 160, ease: 'Cubic.out' });
    s.x = s.rx; s.y = s.ry;
  }

  private hold(b: Btn, id: number) {
    touch.claimed.add(id);
    b.held = id;
    this.face(b);
    b.c.setScale(0.92);
    try { if ((navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive !== false) navigator.vibrate?.(8); } catch { /* not supported */ } // a tiny tick on Android
    const w = this.scene.get('world') as WorldScene;
    if (b.id === 'rock') w.touchRock();
    else if (b.id === 'pause') { this.releaseAll(); w.pauseGame(); }
    else touch.press(b.id as TouchKey);
  }
  private letGo(b: Btn) {
    if (b.held !== null) touch.claimed.delete(b.held);
    b.held = null;
    this.face(b);
    this.tweens.add({ targets: b.c, scale: 1, duration: 120, ease: 'Back.out' });
  }
  private face(b: Btn) { const s = b.held !== null ? 1 : b.state; b.faces.forEach((f, i) => f.setVisible(i === s)); }
  /** Lift every finger at once. */
  private releaseAll() {
    this.releaseStick();
    for (const b of this.btns) if (b.held !== null) this.letGo(b);
    touch.reset();
  }

  // ---------------------------------------------------------------- every frame
  update(time: number) {
    const world = this.scene.get('world') as WorldScene;
    const live = world.sys.isActive() && !world.sys.isPaused();
    const info = live ? world.touchInfo() : null;
    const show = touchMode() && !!info?.playing;
    // re-fit after a resize or rotation
    const r = this.game.canvas.getBoundingClientRect();
    const sig = `${Math.round(r.width)}x${Math.round(r.height)}@${window.innerWidth}x${window.innerHeight}`;
    if (show && sig !== this.sig) { this.releaseAll(); this.sig = sig; this.layout(); }
    if (show !== this.on) { this.on = show; this.root.setVisible(show); if (!show) this.releaseAll(); }
    if (!show || !info) return;
    // a finger the browser forgot to report lifting still counts as lifted
    const ptrs = this.input.manager.pointers;
    const isDown = (id: number) => ptrs.some((p) => p.id === id && p.isDown);
    if (this.stick.id !== null && !isDown(this.stick.id)) this.releaseStick();
    for (const b of this.btns) if (b.held !== null && !isDown(b.held)) this.letGo(b);

    for (const b of this.btns) {
      let state: 0 | 2 = 0, alpha = 1, label = b.label?.text ?? '';
      if (b.id === 'fish') {
        state = info.fish === 'ready' || info.fish === 'bite' ? 2 : 0;
        alpha = info.fish === 'none' || info.fish === 'full' ? 0.6 : 1;
        label = info.fish === 'bite' ? 'REEL!' : info.fish === 'full' ? 'FULL' : 'FISH';
        const pop = info.fish === 'bite' ? 1 + 0.08 * Math.abs(Math.sin(time / 90)) : 1;
        if (b.held === null) b.c.setScale(pop);
      } else if (b.id === 'rock') {
        state = touch.aiming ? 2 : 0;
        alpha = info.rocks > 0 ? 1 : 0.55;
        b.badge?.setText(String(info.rocks)).setColor(info.rocks > 0 ? '#fff3d6' : '#ffb0a0');
        label = touch.aiming ? 'CANCEL' : 'ROCK';
      } else if (b.id === 'use') {
        state = info.use ? 2 : 0;
        alpha = info.use ? 1 : 0.6;
        label = info.use === 'deposit' ? 'Deposit' : info.use === 'shop' ? 'Shop' : 'USE';
        const key = info.use === 'deposit' ? 'bag' : info.use === 'shop' ? 'coin' : '';
        if (key && b.icon.texture.key !== key) { b.icon.setTexture(key, 0).setScale(hdScale(key)); b.icon.setScale(b.icon.scaleX * (b.r / Math.max(b.icon.displayWidth, b.icon.displayHeight))); }
        if (!key && b.icon.texture.key !== b.home) b.icon.setTexture(b.home).setScale(HD);
      } else if (b.id === 'gear') {
        b.show = info.gearOwned >= 2; // only once there is something to switch to
        b.icon.setFrame(info.gearFrame);
      }
      if (b.label && b.label.text !== label) b.label.setText(label);
      if (state !== b.state) { b.state = state; this.face(b); }
      b.c.setVisible(b.show).setAlpha(alpha);
    }
  }
}

/** The CSS safe-area insets (notches, rounded corners, home indicator), in CSS pixels. */
function safeInsets(): { left: number; right: number; top: number; bottom: number } {
  try {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    const out = { left: parseFloat(cs.paddingLeft) || 0, right: parseFloat(cs.paddingRight) || 0, top: parseFloat(cs.paddingTop) || 0, bottom: parseFloat(cs.paddingBottom) || 0 };
    d.remove();
    return out;
  } catch { return { left: 0, right: 0, top: 0, bottom: 0 }; }
}
