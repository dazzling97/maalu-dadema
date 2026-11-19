import Phaser from 'phaser';
import { PAL, VIEW, ZOOM, UI_FONT } from '../config/game';
import { audio } from '../systems/Audio';
import { load, save } from '../systems/Storage';
import { makeCanvas, rect } from '../art/px';
import { touchMode } from '../systems/Touch';
import { HD } from '../art/hd';
import { panelHD, buttonHD } from '../art/uiHD';

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
/** Quiet dark panel that sits behind interface text without hiding the world (HD: show at HD scale). */
export function darkPanel(w: number, h: number, edge = 'rgba(246,231,193,0.28)'): HTMLCanvasElement {
  return panelHD(w, h, edge, { radius: Math.min(4, h / 2 - 1), alpha: 0.8 });
}
/** Headings: a heavy rounded display face with a dark rim, the in-world counterpart of the logo. */
export function displayText(scene: Phaser.Scene, x: number, y: number, str: string, color = '#ffe9a8', scale = 2, center = false): Phaser.GameObjects.Text {
  const size = 5 + scale * 4.2;
  const t = scene.add.text(x, y, str.toUpperCase(), {
    fontFamily: UI_FONT, fontSize: `${size}px`, fontStyle: '900', color,
    stroke: '#1a1220', strokeThickness: Math.max(2, size * 0.2), resolution: ZOOM,
    shadow: { offsetX: 0, offsetY: size * 0.08, color: 'rgba(0,0,0,0.55)', blur: size * 0.15, stroke: true, fill: true },
  }).setLetterSpacing(scale * 0.6);
  if (center) t.setOrigin(0.5, 0);
  return t;
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
    this.cursor = this.add.image(0, 0, 'reticle').setScale(HD).setDepth(1000).setVisible(!touchMode()); // fingers need no cursor
    this.btns = []; this.keys = []; this.sel = 0;
  }
  protected tx(c: HTMLCanvasElement): string {
    const key = `${this.scene.key}-${this.n++}`;
    this.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.keys.push(key);
    return key;
  }
  protected clearUi() {
    this.root.removeAll(true);
    this.keys.forEach((k) => this.textures.remove(k));
    this.keys = []; this.btns = []; this.sel = 0;
  }
  /** Show a canvas drawn at ART density (see hd.ts) at its world size. */
  protected hd(x: number, y: number, c: HTMLCanvasElement) {
    const img = this.add.image(x, y, this.tx(c)).setOrigin(0).setScale(HD);
    this.root.add(img);
    return img;
  }
  protected text(x: number, y: number, s: string, color: string = PAL.cream, scale = 1, center = false) {
    const t = displayText(this, x, y - scale * 0.6, s, color, scale, center);
    this.root.add(t);
    return t;
  }
  protected sans(x: number, y: number, s: string, size = 8, color = '#f6e7c1', bold = false, center = false) {
    const t = uiText(this, x, y, s, size, color, bold);
    if (center) t.setOrigin(0.5, 0);
    this.root.add(t);
    return t;
  }
  /** The one modal surface used by every overlay: dark, quiet, thin border (gold for good news / focus). */
  protected panel(x: number, y: number, w: number, h: number, gold = false) {
    return this.hd(x, y, panelHD(w, h, gold ? 'rgba(246,210,74,0.95)' : 'rgba(246,231,193,0.38)'));
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
    const dis = !!opts.disabled && style !== 'link';
    const off = this.add.image(0, 0, this.tx(buttonHD(w, h, style, false, dis))).setOrigin(0).setScale(HD);
    const on = this.add.image(0, 0, this.tx(buttonHD(w, h, style, true, dis))).setOrigin(0).setScale(HD).setVisible(false);
    const dark = style === 'primary' && !dis;
    const rest = dis ? '#8d8496' : style === 'link' ? '#c9d4b8' : '#f6e7c1', lit = dis ? '#cfc4ad' : '#fff3a0';
    const t = uiText(this, w / 2, Math.round(h / 2) - (dark ? 1 : 0), label, style === 'primary' ? 9 : style === 'link' ? 7.5 : 8, dark ? '#2b1b2e' : rest, true).setOrigin(0.5, 0.5);
    if (dark) t.setStroke('#2b1b2e', 0);
    c.add([off, on, t]);
    if (opts.disabled && !dis) t.setAlpha(0.55);
    this.root.add(c);
    const y0 = y;
    const b: Btn = {
      c, act, adjust: opts.adjust,
      select: (v) => { on.setVisible(v); off.setVisible(!v); if (!dark) t.setColor(v ? lit : rest); c.y = v && style !== 'link' ? y0 - 1 : y0; },
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
    const slider = (label: string, key: 'master' | 'music' | 'sfx' | 'voice') => {
      const row = i++;
      this.button(cx, y, W, `‹   ${label}   ${pct(s[key])}   ›`, () => undefined, {
        adjust: (d) => { audio.set({ [key]: Math.max(0, Math.min(1, Math.round((load()[key] + d * 0.1) * 10) / 10)) }); audio.play(key === 'music' ? 'uiMove' : 'catch'); rebuild(row); },
      });
      y += 19;
    };
    slider('Master volume', 'master');
    slider('Music volume', 'music');
    slider('Effects volume', 'sfx');
    slider('Voice volume', 'voice');
    // sound, the Sinhala voice lines and their subtitles share one row
    {
      const row = i, left = cx - W / 2, tw = (W - 8) / 3;
      const third = (k: number, label: string, on: boolean, flip: () => void) => { const r = row + k; i++; this.button(left + tw / 2 + k * (tw + 4), y, tw, `${label}:  ${on ? 'On' : 'Off'}`, () => { flip(); rebuild(r); }); };
      third(0, 'Sound', !s.muted, () => audio.set({ muted: !load().muted }));
      third(1, 'Voices', s.voices, () => audio.set({ voices: !load().voices }));
      third(2, 'Subtitles', s.subtitles, () => save({ subtitles: !load().subtitles }));
      y += 19;
    }
    // screen shake and the touch controls share a row: Auto shows them on phones and tablets only
    {
      const row = i++, left = cx - W / 2, hw = (W - 4) / 2;
      this.button(left + hw / 2, y, hw, `Shake:  ${s.shake ? 'On' : 'Off'}`, () => { save({ shake: !load().shake }); rebuild(row); });
      const next = { auto: 'on', on: 'off', off: 'auto' } as const;
      this.button(left + hw + 4 + hw / 2, y, hw, `Touch:  ${s.touch === 'auto' ? 'Auto' : s.touch === 'on' ? 'On' : 'Off'}`, () => { save({ touch: next[load().touch] }); this.cursor.setVisible(!touchMode()); rebuild(row + 1); });
      y += 19;
    }
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
