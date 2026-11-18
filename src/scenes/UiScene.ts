import Phaser from 'phaser';
import { PAL, VIEW, ZOOM, UI_FONT } from '../config/game';
import { textCanvas, textWidth } from '../art/font';
import { audio } from '../systems/Audio';
import { load, save } from '../systems/Storage';
import { makeCanvas, rect } from '../art/px';

/** Point a scene's camera at the 480 x 270 layout space on the high-resolution canvas. */
export function fitUi(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(ZOOM).centerOn(VIEW.w / 2, VIEW.h / 2);
}
/** Sharp sans-serif text for anything small: drawn at full screen resolution. */
export function uiText(scene: Phaser.Scene, x: number, y: number, str: string, size = 8, color = '#f6e7c1', bold = false): Phaser.GameObjects.Text {
  return scene.add.text(x, y, str, {
    fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: bold ? 'bold' : 'normal', color,
    stroke: '#1a1220', strokeThickness: size >= 10 ? 1.4 : 1, resolution: ZOOM,
  });
}
/** Quiet dark panel that sits behind interface text without hiding the world. */
export function darkPanel(w: number, h: number, edge = 'rgba(246,231,193,0.28)'): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h);
  rect(ctx, 1, 0, w - 2, h, 'rgba(22,16,28,0.74)'); rect(ctx, 0, 1, w, h - 2, 'rgba(22,16,28,0.74)');
  rect(ctx, 2, 0, w - 4, 1, edge); rect(ctx, 2, h - 1, w - 4, 1, edge); rect(ctx, 0, 2, 1, h - 4, edge); rect(ctx, w - 1, 2, 1, h - 4, edge);
  return c;
}

export type BtnStyle = 'primary' | 'secondary' | 'link';
export interface BtnOpts { style?: BtnStyle; h?: number; adjust?: (dir: -1 | 1) => void; /** Drawn faded; still focusable and pressable, so it can say why it is unavailable. */ disabled?: boolean; }
export interface Btn { c: Phaser.GameObjects.Container; act: () => void; select(on: boolean): void; adjust?: (dir: -1 | 1) => void; }

/** Shared kit for menu-style scenes: pixel text, wooden buttons, keyboard + mouse focus. */
export class UiScene extends Phaser.Scene {
  protected root!: Phaser.GameObjects.Container;
  protected btns: Btn[] = [];
  protected sel = 0;
  private keys: string[] = [];
  private n = 0;
  private cursor!: Phaser.GameObjects.Image;

  protected initUi() {
    fitUi(this);
    this.root = this.add.container(0, 0);
    this.cursor = this.add.image(0, 0, 'reticle').setDepth(1000);
    this.btns = []; this.keys = []; this.sel = 0;
  }
  protected tx(c: HTMLCanvasElement): string {
    const key = `${this.scene.key}-${this.n++}`;
    this.textures.addCanvas(key, c);
    this.keys.push(key);
    return key;
  }
  protected clearUi() {
    this.root.removeAll(true);
    this.keys.forEach((k) => this.textures.remove(k));
    this.keys = []; this.btns = []; this.sel = 0;
  }
  protected text(x: number, y: number, s: string, color: string = PAL.cream, scale = 1, center = false) {
    const img = this.add.image(center ? Math.round(x - textWidth(s, scale) / 2) : x, y, this.tx(textCanvas(s, color, PAL.ink, scale))).setOrigin(0);
    this.root.add(img);
    return img;
  }
  protected sans(x: number, y: number, s: string, size = 8, color = '#f6e7c1', bold = false, center = false) {
    const t = uiText(this, x, y, s, size, color, bold);
    if (center) t.setOrigin(0.5, 0);
    this.root.add(t);
    return t;
  }
  /** The one modal surface used by every overlay: dark, quiet, thin border (gold for good news / focus). */
  protected panel(x: number, y: number, w: number, h: number, gold = false) {
    const [c, ctx] = makeCanvas(w, h + 3);
    rect(ctx, 2, 3, w - 4, h, 'rgba(8,6,14,0.45)'); // soft drop shadow
    rect(ctx, 1, 0, w - 2, h, 'rgba(26,20,36,0.95)'); rect(ctx, 0, 1, w, h - 2, 'rgba(26,20,36,0.95)');
    const edge = gold ? 'rgba(246,210,74,0.95)' : 'rgba(246,231,193,0.38)';
    rect(ctx, 2, 0, w - 4, 1, edge); rect(ctx, 2, h - 1, w - 4, 1, edge); rect(ctx, 0, 2, 1, h - 4, edge); rect(ctx, w - 1, 2, 1, h - 4, edge);
    rect(ctx, 2, 1, w - 4, 1, 'rgba(255,255,255,0.05)');
    const img = this.add.image(x, y, this.tx(c)).setOrigin(0);
    this.root.add(img);
    return img;
  }
  /** Even scrim behind a modal: the world stays visible but recedes. */
  protected dim(alpha = 0.6) {
    const [c, ctx] = makeCanvas(4, 4);
    rect(ctx, 0, 0, 4, 4, `rgba(12,10,20,${alpha})`);
    const img = this.add.image(0, 0, this.tx(c)).setOrigin(0).setScale(120, 68);
    this.root.add(img);
  }
  /** Title-screen scrim: darker behind the title and the menu, lighter where the pond shows through. */
  protected gradient() {
    const [c, ctx] = makeCanvas(2, 270);
    for (let y = 0; y < 270; y++) {
      const t = y / 269;
      const a = t < 0.3 ? 0.66 - t * 0.5 : t < 0.72 ? 0.51 : t < 0.86 ? 0.51 - (t - 0.72) * 1.6 : 0.29 + (t - 0.86) * 2.2;
      rect(ctx, 0, y, 2, 1, `rgba(12,10,20,${a.toFixed(3)})`);
    }
    const img = this.add.image(0, 0, this.tx(c)).setOrigin(0).setScale(240, 1);
    this.root.add(img);
  }
  /**
   * Button with keyboard focus, hover and press states. `primary` is the one
   * gold call to action on a screen, `secondary` the quiet default, `link` bare text.
   */
  protected button(cx: number, y: number, w: number, label: string, act: () => void, opts: BtnOpts = {}): Btn {
    const style = opts.style ?? 'secondary', h = opts.h ?? (style === 'primary' ? 20 : 16);
    const c = this.add.container(Math.round(cx - w / 2), y);
    const face = (on: boolean) => {
      const [k, ctx] = makeCanvas(w, h + 2);
      if (style === 'link') { if (on) rect(ctx, Math.round(w / 2 - 14), h - 2, 28, 1, '#f6d24a'); return k; }
      const fill = style === 'primary' ? (on ? '#ffe98a' : '#f6d24a') : on ? 'rgba(58,46,74,0.96)' : 'rgba(26,20,36,0.9)';
      const edge = style === 'primary' ? '#2b1b2e' : on ? '#f6d24a' : 'rgba(246,231,193,0.4)';
      rect(ctx, 1, 2, w - 2, h, 'rgba(8,6,14,0.5)');
      rect(ctx, 1, 0, w - 2, h, edge); rect(ctx, 0, 1, w, h - 2, edge);
      rect(ctx, 1, 1, w - 2, h - 2, fill);
      if (style === 'primary') { rect(ctx, 1, 1, w - 2, 1, '#fffbe0'); rect(ctx, 1, h - 3, w - 2, 2, on ? '#e0a92e' : '#c98a1c'); }
      return k;
    };
    const off = this.add.image(0, 0, this.tx(face(false))).setOrigin(0);
    const on = this.add.image(0, 0, this.tx(face(true))).setOrigin(0).setVisible(false);
    const dark = style === 'primary';
    const t = uiText(this, w / 2, Math.round(h / 2) - (dark ? 1 : 0), label, style === 'primary' ? 9 : style === 'link' ? 7.5 : 8, dark ? '#2b1b2e' : style === 'link' ? '#c9d4b8' : '#f6e7c1', true).setOrigin(0.5, 0.5);
    if (dark) t.setStroke('#2b1b2e', 0);
    c.add([off, on, t]);
    if (opts.disabled) { off.setAlpha(0.45); on.setAlpha(0.6); t.setAlpha(0.55); }
    this.root.add(c);
    const y0 = y;
    const b: Btn = {
      c, act, adjust: opts.adjust,
      select: (v) => { on.setVisible(v); off.setVisible(!v); if (!dark) t.setColor(v ? '#fff3a0' : style === 'link' ? '#c9d4b8' : '#f6e7c1'); c.y = v && style !== 'link' ? y0 - 1 : y0; },
    };
    const i = this.btns.length;
    const hit = this.add.zone(0, 0, w, h).setOrigin(0).setInteractive({ useHandCursor: false });
    c.add(hit);
    hit.on('pointerover', () => this.focus(i));
    hit.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.focus(i);
      c.y = y0 + 1; // pressed
      this.time.delayedCall(70, () => { c.y = y0 - (style === 'link' ? 0 : 1); });
      if (opts.adjust) { const local = (ptr.positionToCamera(this.cameras.main) as Phaser.Math.Vector2).x - c.x; audio.play('uiSelect'); opts.adjust(local < w / 2 ? -1 : 1); }
      else this.press(b);
    });
    this.btns.push(b);
    if (i === 0) b.select(true);
    return b;
  }
  /**
   * The sound and comfort settings, shared by the main menu and the pause menu.
   * `rebuild(row)` redraws the screen with that row focused. Returns the y below the last row.
   */
  protected settingsRows(cx: number, y: number, W: number, rebuild: (row: number) => void): number {
    const s = load();
    let i = this.btns.length;
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    const slider = (label: string, key: 'master' | 'music' | 'sfx') => {
      const row = i++;
      this.button(cx, y, W, `‹   ${label}   ${pct(s[key])}   ›`, () => undefined, {
        adjust: (d) => { audio.set({ [key]: Math.max(0, Math.min(1, Math.round((load()[key] + d * 0.1) * 10) / 10)) }); audio.play(key === 'music' ? 'uiMove' : 'catch'); rebuild(row); },
      });
      y += 19;
    };
    const toggle = (label: string, on: boolean, flip: () => void) => { const row = i++; this.button(cx, y, W, `${label}:  ${on ? 'On' : 'Off'}`, () => { flip(); rebuild(row); }); y += 19; };
    slider('Master volume', 'master');
    slider('Music volume', 'music');
    slider('Effects volume', 'sfx');
    toggle('Sound', !s.muted, () => audio.set({ muted: !load().muted }));
    toggle('Screen shake', s.shake, () => save({ shake: !load().shake }));
    // tutorials: on/off, and a reset that brings every first-time lesson back
    const row = i++;
    const left = cx - W / 2, rw = 84, tw = W - rw - 4;
    this.button(left + tw / 2, y, tw, `Tutorials:  ${s.hints ? 'On' : 'Off'}`, () => { save({ hints: !load().hints }); rebuild(row); });
    const fresh = s.tutorials.length === 0 && s.eased.length === 0 && !s.howSeen;
    this.button(left + tw + 4 + rw / 2, y, rw, fresh ? 'Reset  ✓' : 'Reset tutorials', () => { save({ tutorials: [], eased: [], hints: true, howSeen: false }); rebuild(row + 1); });
    y += 19;
    return y;
  }
  /** One line saying truthfully whether sound can be heard right now. */
  protected soundState(cx: number, y: number) {
    const s = load();
    const state = !audio.supported ? 'Sound is not available in this browser.' : s.muted ? 'Sound is muted.' : audio.available ? 'Sound is on.' : 'Sound starts after your first click or key press.';
    this.sans(cx, y, state, 7, audio.available && !s.muted ? '#9ff08a' : '#ffb0a0', false, true);
  }
  /** Activate a button (mouse or keyboard) with its click sound. */
  protected press(b?: Btn) {
    if (!b) return;
    audio.play('uiSelect');
    b.act();
  }
  protected focus(i: number) {
    if (!this.btns.length) return;
    const next = (i + this.btns.length) % this.btns.length;
    if (next !== this.sel) audio.play('uiMove');
    this.sel = next;
    this.btns.forEach((b, k) => b.select(k === this.sel));
  }
  update() {
    const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.cursor.setPosition(Math.round(p.x), Math.round(p.y));
  }
}
