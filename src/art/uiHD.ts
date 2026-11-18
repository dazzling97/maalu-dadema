// High-resolution interface art: panels, buttons, keycaps, HUD icons and the logo.
// Same light (upper-left) and ink as the world, so the UI belongs to the game
// rather than floating over it like a web page.
import { hdCanvas, Ctx } from './hd';
import { PAL } from '../config/game';

const INK = 'rgba(26,18,32,0.95)';
const UI = 'Nunito, "Noto Sans Sinhala", system-ui, sans-serif';
const rr = (x: number, y: number, w: number, h: number, r: number) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
const ell = (x: number, y: number, rx: number, ry: number) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); return p; };
function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, s] of stops) g.addColorStop(o, s); return g; }
function ink(c: Ctx, p: Path2D, w = 0.5, col = INK) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(p); }

// ---------------------------------------------------------------- surfaces
/**
 * The one panel used everywhere: deep plum glass with a soft drop shadow, a faint
 * sheen along the top, and a thin edge (gold for focus and good news).
 */
export function panelHD(w: number, h: number, edge = 'rgba(246,231,193,0.38)', opts: { radius?: number; alpha?: number } = {}): HTMLCanvasElement {
  const r = opts.radius ?? 3.2, a = opts.alpha ?? 0.94;
  const [c, x] = hdCanvas(w, h + 3);
  x.save(); x.shadowColor = 'rgba(6,4,12,0.55)'; x.shadowBlur = 6; x.shadowOffsetY = 1.6;
  x.fillStyle = `rgba(24,18,34,${a})`; x.fill(rr(0.5, 0.5, w - 1, h - 1, r)); x.restore();
  const body = rr(0.5, 0.5, w - 1, h - 1, r);
  x.fillStyle = lin(x, 0, 0, 0, h, [[0, `rgba(48,38,62,${a})`], [0.45, `rgba(30,23,42,${a})`], [1, `rgba(20,15,28,${a})`]]); x.fill(body);
  x.save(); x.clip(body); x.fillStyle = lin(x, 0, 0, 0, Math.min(10, h * 0.5), [[0, 'rgba(255,255,255,0.09)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, w, h); x.restore();
  x.strokeStyle = edge; x.lineWidth = 0.6; x.stroke(rr(0.8, 0.8, w - 1.6, h - 1.6, r - 0.3));
  return c;
}
/**
 * A little stage behind characters and props on menu cards: a sunlit lawn, open
 * water, or a shore (lawn on the left `split` units, water beyond), with soft
 * inner shading so it sits inside the panel rather than on top of it.
 */
export function stageHD(w: number, h: number, kind: 'grass' | 'water' | 'shore', opts: { split?: number; dim?: boolean } = {}): HTMLCanvasElement {
  const [c, x] = hdCanvas(w, h), r = 2.4, body = rr(0, 0, w, h, r);
  x.save(); x.clip(body);
  const grass = () => lin(x, 0, 0, 0, h, [[0, '#7fbf55'], [0.55, '#5f9e3f'], [1, '#467c32']]);
  const water = () => lin(x, 0, 0, 0, h, [[0, '#3aa0b4'], [0.6, '#22788f'], [1, '#195d74']]);
  x.fillStyle = kind === 'water' ? water() : grass(); x.fillRect(0, 0, w, h);
  if (kind !== 'grass') {
    const s = kind === 'water' ? 0 : (opts.split ?? w * 0.35);
    if (s > 0) {
      const shore = new Path2D(); shore.moveTo(s, 0); shore.bezierCurveTo(s + 6, h * 0.35, s - 6, h * 0.65, s + 2, h); shore.lineTo(w, h); shore.lineTo(w, 0); shore.closePath();
      x.fillStyle = 'rgba(232,206,150,0.9)'; x.save(); x.translate(-1.6, 0); x.fill(shore); x.restore(); // wet sand
      x.fillStyle = water(); x.fill(shore);
      x.strokeStyle = 'rgba(255,255,255,0.5)'; x.lineWidth = 0.5; x.save(); x.translate(1.2, 0); x.stroke(shore); x.restore(); // foam line
    }
    x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 0.45; x.lineCap = 'round';
    for (let i = 0; i < 14; i++) { const px = s + 6 + ((i * 37) % Math.max(1, w - s - 12)), py = 4 + ((i * 23) % Math.max(1, h - 8)); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 2.5, py - 1, px + 5, py); x.stroke(); }
  }
  if (kind !== 'water') {
    const lim = kind === 'shore' ? (opts.split ?? w * 0.35) - 2 : w;
    x.strokeStyle = 'rgba(40,80,28,0.55)'; x.lineWidth = 0.4; x.lineCap = 'round';
    for (let i = 0; i < Math.round(lim * h / 60); i++) { const px = 2 + ((i * 53) % Math.max(1, lim - 4)), py = 3 + ((i * 29) % (h - 5)); x.beginPath(); x.moveTo(px - 0.8, py + 1.4); x.lineTo(px, py); x.moveTo(px + 0.8, py + 1.4); x.lineTo(px + 0.3, py - 0.2); x.stroke(); }
    x.fillStyle = lin(x, 0, h * 0.55, 0, h, [[0, 'rgba(255,240,180,0)'], [1, 'rgba(30,50,20,0.25)']]); x.fillRect(0, 0, lim, h);
  }
  const vg = x.createRadialGradient(w * 0.4, h * 0.3, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.7);
  vg.addColorStop(0, 'rgba(255,248,214,0.16)'); vg.addColorStop(1, 'rgba(10,8,18,0.38)'); x.fillStyle = vg; x.fillRect(0, 0, w, h);
  if (opts.dim) { x.fillStyle = 'rgba(18,14,26,0.4)'; x.fillRect(0, 0, w, h); }
  x.restore();
  x.strokeStyle = 'rgba(10,8,18,0.6)'; x.lineWidth = 0.6; x.stroke(rr(0.3, 0.3, w - 0.6, h - 0.6, r));
  return c;
}
/** Button faces. `on` = focused / hovered. */
export function buttonHD(w: number, h: number, style: 'primary' | 'secondary' | 'link', on: boolean, disabled = false): HTMLCanvasElement {
  const [c, x] = hdCanvas(w, h + 2);
  if (style === 'link') {
    if (on) { x.fillStyle = lin(x, w / 2 - 16, 0, w / 2 + 16, 0, [[0, 'rgba(246,210,74,0)'], [0.5, '#f6d24a'], [1, 'rgba(246,210,74,0)']]); x.fillRect(w / 2 - 16, h - 1.6, 32, 0.7); }
    return c;
  }
  const r = Math.min(4, h / 2 - 1), body = rr(0.6, 0.6, w - 1.2, h - 1.2, r);
  x.save(); x.shadowColor = 'rgba(6,4,12,0.55)'; x.shadowBlur = on ? 5 : 3; x.shadowOffsetY = 1.4; x.fillStyle = '#000'; x.fill(body); x.restore();
  if (disabled) {
    // recessed slate: no gloss, no gold, so it reads as "not yet" at a glance
    x.fillStyle = lin(x, 0, 0, 0, h, [[0, 'rgba(22,18,30,0.96)'], [1, 'rgba(38,33,46,0.96)']]); x.fill(body);
    x.save(); x.clip(body); x.fillStyle = lin(x, 0, 0, 0, 3, [[0, 'rgba(0,0,0,0.35)'], [1, 'rgba(0,0,0,0)']]); x.fillRect(0, 0, w, 3); x.restore();
    x.strokeStyle = on ? 'rgba(246,231,193,0.6)' : 'rgba(246,231,193,0.2)'; x.lineWidth = 0.55; x.setLineDash(on ? [] : [1.6, 1.2]); x.stroke(rr(0.9, 0.9, w - 1.8, h - 1.8, r - 0.3)); x.setLineDash([]);
  } else if (style === 'primary') {
    if (on) { x.save(); x.shadowColor = 'rgba(255,214,90,0.75)'; x.shadowBlur = 7; x.fillStyle = '#f6d24a'; x.fill(body); x.restore(); }
    x.fillStyle = lin(x, 0, 0, 0, h, on ? [[0, '#fff3b0'], [0.45, '#ffd85a'], [1, '#e09a24']] : [[0, '#fbe68a'], [0.45, '#f6c93e'], [1, '#c98a1c']]); x.fill(body);
    x.save(); x.clip(body); x.fillStyle = 'rgba(255,255,255,0.45)'; x.fill(rr(2, 1.4, w - 4, h * 0.32, r * 0.8)); x.restore();
    ink(x, body, 0.6, 'rgba(60,32,20,0.95)');
  } else {
    x.fillStyle = lin(x, 0, 0, 0, h, on ? [[0, 'rgba(84,66,104,0.98)'], [1, 'rgba(46,36,62,0.98)']] : [[0, 'rgba(46,36,60,0.94)'], [1, 'rgba(26,20,36,0.94)']]); x.fill(body);
    x.save(); x.clip(body); x.fillStyle = 'rgba(255,255,255,0.07)'; x.fill(rr(1.6, 1.2, w - 3.2, h * 0.36, r * 0.8)); x.restore();
    x.strokeStyle = on ? '#f6d24a' : 'rgba(246,231,193,0.42)'; x.lineWidth = on ? 0.75 : 0.55; x.stroke(rr(0.9, 0.9, w - 1.8, h - 1.8, r - 0.3));
  }
  return c;
}
/** A keyboard key with its label. Height 11; width fits the label. */
export function keycapHD(label: string): HTMLCanvasElement {
  const [m, mx] = hdCanvas(1, 1); void m;
  mx.font = `800 6.4px ${UI}`;
  const w = Math.max(11, Math.ceil(mx.measureText(label).width) + 6);
  const [c, x] = hdCanvas(w, 11.5);
  const top = rr(0.5, 0.4, w - 1, 9.6, 2), base = rr(0.5, 1.6, w - 1, 9.6, 2);
  x.fillStyle = '#6e6250'; x.fill(base); ink(x, base, 0.5);
  x.fillStyle = lin(x, 0, 0.4, 0, 9, [[0, '#ffffff'], [0.5, '#f6ead0'], [1, '#d8c8a4']]); x.fill(top); ink(x, top, 0.5);
  x.font = `800 6.4px ${UI}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = PAL.ink; x.fillText(label, w / 2, 5.4);
  return c;
}

// ---------------------------------------------------------------- icons
export function clockHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(9, 9);
  const face = ell(4.5, 4.5, 3.8, 3.8);
  x.fillStyle = lin(x, 0, 0, 9, 9, [[0, '#ffffff'], [1, '#e6d9b4']]); x.fill(face); ink(x, face, 0.7);
  x.strokeStyle = PAL.ink; x.lineWidth = 0.6; x.lineCap = 'round';
  x.beginPath(); x.moveTo(4.5, 4.5); x.lineTo(4.5, 2.2); x.moveTo(4.5, 4.5); x.lineTo(6.2, 4.9); x.stroke();
  x.fillStyle = '#e8433f'; x.beginPath(); x.arc(4.5, 4.5, 0.55, 0, Math.PI * 2); x.fill();
  return c;
}
export function warnHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(11, 10);
  const t = new Path2D(); t.moveTo(5.5, 0.7); t.lineTo(10.4, 9.2); t.lineTo(0.6, 9.2); t.closePath();
  x.fillStyle = lin(x, 0, 0, 0, 10, [[0, '#fff3a0'], [0.5, '#f6d24a'], [1, '#d9a92a']]); x.fill(t); ink(x, t, 0.6);
  x.fillStyle = PAL.ink; x.beginPath(); x.roundRect(4.9, 3.3, 1.2, 3.4, 0.6); x.fill(); x.beginPath(); x.arc(5.5, 7.8, 0.65, 0, Math.PI * 2); x.fill();
  return c;
}
export function coinHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(7, 7);
  const g = x.createRadialGradient(2.6, 2.4, 0, 3.5, 3.5, 3.6); g.addColorStop(0, '#fff3a0'); g.addColorStop(0.55, '#f6c93e'); g.addColorStop(1, '#b97a14');
  const p = ell(3.5, 3.5, 3, 3); x.fillStyle = g; x.fill(p); ink(x, p, 0.5);
  x.strokeStyle = 'rgba(150,96,20,0.7)'; x.lineWidth = 0.35; x.stroke(ell(3.5, 3.5, 2, 2));
  return c;
}
/** Frame 0 a full heart, frame 1 an empty one. */
export function heartsHD(): { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number } {
  const [c, x] = hdCanvas(22, 10);
  for (let f = 0; f < 2; f++) {
    x.save(); x.translate(f * 11, 0);
    const p = new Path2D(); p.moveTo(5.5, 9); p.bezierCurveTo(-0.6, 4.6, 1, 0.2, 5.5, 2.6); p.bezierCurveTo(10, 0.2, 11.6, 4.6, 5.5, 9); p.closePath();
    x.fillStyle = f === 0 ? lin(x, 0, 1, 0, 9, [[0, '#ff8a7a'], [0.5, '#e8433f'], [1, '#a82a26']]) : lin(x, 0, 1, 0, 9, [[0, '#6e4a52'], [1, '#3e2a34']]); x.fill(p); ink(x, p, 0.55);
    if (f === 0) { x.fillStyle = 'rgba(255,255,255,0.7)'; x.beginPath(); x.ellipse(3.4, 3.6, 1.2, 0.8, -0.6, 0, Math.PI * 2); x.fill(); }
    x.restore();
  }
  return { canvas: c, fw: 11, fh: 10, ox: 0, oy: 0 };
}
export function reticleHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(9, 9);
  x.lineCap = 'round';
  for (const [w, col] of [[1.6, INK], [0.8, '#fff6c8']] as const) {
    x.strokeStyle = col; x.lineWidth = w; x.beginPath();
    x.moveTo(4.5, 0.8); x.lineTo(4.5, 3); x.moveTo(4.5, 6); x.lineTo(4.5, 8.2); x.moveTo(0.8, 4.5); x.lineTo(3, 4.5); x.moveTo(6, 4.5); x.lineTo(8.2, 4.5); x.stroke();
  }
  x.fillStyle = '#e8433f'; x.beginPath(); x.arc(4.5, 4.5, 0.6, 0, Math.PI * 2); x.fill();
  return c;
}
/** A pointer arrow, pointing right (rotate to aim). */
export function arrowHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(9, 9);
  const p = new Path2D(); p.moveTo(1.4, 1); p.lineTo(8, 4.5); p.lineTo(1.4, 8); p.quadraticCurveTo(2.8, 4.5, 1.4, 1); p.closePath();
  x.fillStyle = lin(x, 0, 1, 0, 8, [[0, '#ff9a80'], [0.5, '#e8433f'], [1, '#a82a26']]); x.fill(p); ink(x, p, 0.6);
  return c;
}
/** Equipment icons: rod, net, advanced net (18 x 18 each). */
export function gearIconsHD(): { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number } {
  const F = 18, [c, x] = hdCanvas(F * 3, F);
  const stick = (x0: number, y0: number, x1: number, y1: number) => {
    x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 1.6; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.strokeStyle = lin(x, x0, y0, x1, y1, [[0, '#6e4628'], [1, '#c69862']]); x.lineWidth = 0.9; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
  };
  // rod with line and bobber
  stick(3, 15.5, 13.6, 2);
  x.strokeStyle = 'rgba(246,241,224,0.9)'; x.lineWidth = 0.35; x.beginPath(); x.moveTo(13.6, 2); x.quadraticCurveTo(15, 6, 14.4, 10); x.stroke();
  const b = ell(14.4, 11.4, 1.5, 1.5); x.fillStyle = lin(x, 0, 10, 0, 13, [[0, '#ff8a70'], [0.5, '#e8433f'], [0.51, '#fff8ea'], [1, '#d9d2c0']]); x.fill(b); ink(x, b, 0.4);
  x.fillStyle = '#5a3d27'; x.beginPath(); x.roundRect(2, 13.4, 3, 3, 0.8); x.fill();
  // nets: hoop, mesh, handle
  const net = (o: number, r: number, rim: string) => {
    stick(o + 10 - r * 0.7, 7 + r * 0.7, o + 2.4, 16);
    const hoop = ell(o + 10, 7, r, r - 1);
    x.save(); x.clip(hoop); x.fillStyle = 'rgba(30,80,100,0.25)'; x.fillRect(o, 0, F, F);
    x.strokeStyle = 'rgba(240,232,208,0.85)'; x.lineWidth = 0.3;
    for (let k = -14; k < 18; k += 1.6) { x.beginPath(); x.moveTo(o + k, 0); x.lineTo(o + k + 9, F); x.stroke(); x.beginPath(); x.moveTo(o + k + 9, 0); x.lineTo(o + k, F); x.stroke(); }
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 1.5; x.stroke(hoop); x.strokeStyle = rim; x.lineWidth = 0.8; x.stroke(hoop);
  };
  net(F, 5, '#c69862');
  net(F * 2, 7, '#f6d24a');
  const fl = ell(F * 2 + 15.5, 14.4, 1.5, 1.5); x.fillStyle = '#e8433f'; x.fill(fl); ink(x, fl, 0.4);
  return { canvas: c, fw: F, fh: F, ox: 9, oy: 9 };
}

// ---------------------------------------------------------------- the logo
/**
 * MALU DADAYAMA in chunky, warm, carved letters: a gold-to-orange face, a dark rim,
 * a soft drop shadow; the Sinhala name underneath when its font is available.
 * Returned at world size (w x h) for HD display.
 */
export function logoHD(sinhala: boolean): { canvas: HTMLCanvasElement; w: number; h: number } {
  const title = 'MALU DADAYAMA', size = 34;
  const [m, mx] = hdCanvas(1, 1); void m;
  mx.font = `900 ${size}px ${UI}`;
  const ink0 = mx.measureText(title).width + 2 * (title.length - 1); // drawn width with 2px letter spacing
  const tw = Math.ceil(ink0) + 8; // and room for the rim
  const w = tw + 24, h = size + (sinhala ? 26 : 10);
  const [c, x] = hdCanvas(w, h);
  x.font = `900 ${size}px ${UI}`; x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  if ('letterSpacing' in x) (x as Ctx & { letterSpacing: string }).letterSpacing = '2px';
  const tx = (w - ink0) / 2, ty = size * 0.86 + 4; // optically centred, so the Sinhala and tagline line up under it
  // drop shadow and the dark rim
  x.save(); x.shadowColor = 'rgba(8,4,12,0.6)'; x.shadowBlur = 6; x.shadowOffsetY = 3; x.lineJoin = 'round'; x.strokeStyle = '#2b1b2e'; x.lineWidth = 7; x.strokeText(title, tx, ty); x.restore();
  x.lineJoin = 'round'; x.strokeStyle = '#4a2418'; x.lineWidth = 4; x.strokeText(title, tx, ty);
  // the carved face: bright at the top, burnt orange below, a highlight band
  x.fillStyle = lin(x, 0, ty - size * 0.75, 0, ty, [[0, '#fff6c0'], [0.3, '#ffd24a'], [0.65, '#f2a63a'], [1, '#d9692a']]);
  x.fillText(title, tx, ty);
  x.save(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(255,255,255,0.35)'; x.fillRect(0, ty - size * 0.72, w, size * 0.16); x.restore();
  if (sinhala) {
    x.font = `700 15px "Noto Sans Sinhala", ${UI}`; x.textAlign = 'center';
    if ('letterSpacing' in x) (x as Ctx & { letterSpacing: string }).letterSpacing = '0px';
    const sy = ty + 18;
    x.lineJoin = 'round'; x.strokeStyle = '#2b1b2e'; x.lineWidth = 3.4; x.strokeText('මාළු දඩයම', w / 2, sy);
    x.fillStyle = lin(x, 0, sy - 12, 0, sy, [[0, '#fff3d0'], [1, '#ffd98a']]); x.fillText('මාළු දඩයම', w / 2, sy);
  }
  return { canvas: c, w, h };
}

// ---------------------------------------------------------------- touch controls
/**
 * A round touch button: smoked plum glass the world shows through, a soft drop
 * shadow and a rim. `state`: 0 resting, 1 held down, 2 ready / active (gold rim and glow).
 * `r` is the radius in world units; the canvas is padded for the shadow and glow.
 */
export function touchButtonHD(r: number, state: 0 | 1 | 2): HTMLCanvasElement {
  const pad = 4, d = 2 * (r + pad), [c, x] = hdCanvas(d, d), cx = r + pad, cy = r + pad;
  const disc = ell(cx, cy, r, r);
  x.save(); x.shadowColor = state === 2 ? 'rgba(255,214,90,0.7)' : 'rgba(6,4,12,0.5)'; x.shadowBlur = state === 2 ? 6 : 4; x.shadowOffsetY = state === 2 ? 0 : 1.2;
  x.fillStyle = 'rgba(20,14,28,0.5)'; x.fill(disc); x.restore();
  const g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r);
  if (state === 1) { g.addColorStop(0, 'rgba(110,90,132,0.82)'); g.addColorStop(1, 'rgba(52,40,70,0.86)'); }
  else { g.addColorStop(0, 'rgba(70,56,92,0.62)'); g.addColorStop(1, 'rgba(22,16,32,0.72)'); }
  x.fillStyle = g; x.fill(disc);
  // a glassy sheen across the top half
  x.save(); x.clip(disc); x.fillStyle = lin(x, 0, cy - r, 0, cy, [[0, `rgba(255,255,255,${state === 1 ? 0.08 : 0.16})`], [1, 'rgba(255,255,255,0)']]); x.fill(ell(cx, cy - r * 0.45, r * 0.82, r * 0.5)); x.restore();
  x.strokeStyle = state === 2 ? '#f6d24a' : state === 1 ? 'rgba(255,243,176,0.85)' : 'rgba(246,231,193,0.55)';
  x.lineWidth = state === 2 ? 0.9 : 0.6; x.stroke(ell(cx, cy, r - 0.4, r - 0.4));
  return c;
}
/** The joystick: a shallow ring with direction notches (`r` = travel radius), and the thumb knob. */
export function stickBaseHD(r: number): HTMLCanvasElement {
  const pad = 3, d = 2 * (r + pad), [c, x] = hdCanvas(d, d), cx = r + pad, cy = r + pad;
  const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
  g.addColorStop(0, 'rgba(20,14,28,0.18)'); g.addColorStop(0.75, 'rgba(20,14,28,0.36)'); g.addColorStop(1, 'rgba(20,14,28,0.5)');
  x.fillStyle = g; x.fill(ell(cx, cy, r, r));
  x.strokeStyle = 'rgba(246,231,193,0.5)'; x.lineWidth = 0.7; x.stroke(ell(cx, cy, r - 0.4, r - 0.4));
  x.strokeStyle = 'rgba(246,231,193,0.16)'; x.lineWidth = 0.5; x.stroke(ell(cx, cy, r * 0.55, r * 0.55));
  x.fillStyle = 'rgba(246,231,193,0.55)';
  for (let i = 0; i < 4; i++) { // small chevrons at the four compass points
    const a = (i * Math.PI) / 2, px = cx + Math.cos(a) * (r - 4), py = cy + Math.sin(a) * (r - 4), s = Math.max(1.6, r * 0.07);
    const p = new Path2D(); p.moveTo(px + Math.cos(a) * s, py + Math.sin(a) * s);
    p.lineTo(px + Math.cos(a + 2.3) * s, py + Math.sin(a + 2.3) * s); p.lineTo(px + Math.cos(a - 2.3) * s, py + Math.sin(a - 2.3) * s); p.closePath(); x.fill(p);
  }
  return c;
}
export function stickKnobHD(r: number): HTMLCanvasElement {
  const pad = 3, d = 2 * (r + pad), [c, x] = hdCanvas(d, d), cx = r + pad, cy = r + pad, disc = ell(cx, cy, r, r);
  x.save(); x.shadowColor = 'rgba(6,4,12,0.55)'; x.shadowBlur = 4; x.shadowOffsetY = 1.4; x.fillStyle = '#000'; x.fill(disc); x.restore();
  const g = x.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, 'rgba(255,246,214,0.95)'); g.addColorStop(0.5, 'rgba(232,206,150,0.92)'); g.addColorStop(1, 'rgba(176,138,86,0.95)');
  x.fillStyle = g; x.fill(disc);
  ink(x, disc, 0.6, 'rgba(60,32,20,0.9)');
  x.strokeStyle = 'rgba(120,88,52,0.45)'; x.lineWidth = 0.5; x.stroke(ell(cx, cy, r * 0.55, r * 0.55)); // a dished grip
  return c;
}
/** Icons drawn for the touch buttons that have no game sprite: dash chevrons, pause bars, a coin-stall for the shop. */
export function touchIconHD(kind: 'dash' | 'pause' | 'use', s: number): HTMLCanvasElement {
  const [c, x] = hdCanvas(s, s);
  x.lineJoin = 'round'; x.lineCap = 'round';
  if (kind === 'pause') {
    const w = s * 0.2, h = s * 0.62, y = (s - h) / 2;
    for (const px of [s * 0.27, s * 0.53]) { const b = rr(px, y, w, h, w * 0.4); x.fillStyle = '#fff3d6'; x.fill(b); ink(x, b, 0.5); }
  } else if (kind === 'dash') {
    x.strokeStyle = 'rgba(26,18,32,0.95)'; x.lineWidth = s * 0.2;
    const chev = (ox: number) => { x.beginPath(); x.moveTo(ox, s * 0.22); x.lineTo(ox + s * 0.24, s * 0.5); x.lineTo(ox, s * 0.78); x.stroke(); };
    chev(s * 0.2); chev(s * 0.5);
    x.strokeStyle = '#fff3d6'; x.lineWidth = s * 0.11; chev(s * 0.2); chev(s * 0.5);
  } else {
    // an open hand: "do the thing here"
    const p = new Path2D();
    p.moveTo(s * 0.3, s * 0.9); p.lineTo(s * 0.24, s * 0.5); p.quadraticCurveTo(s * 0.2, s * 0.4, s * 0.28, s * 0.4);
    p.lineTo(s * 0.34, s * 0.52); p.lineTo(s * 0.34, s * 0.2); p.quadraticCurveTo(s * 0.4, s * 0.12, s * 0.45, s * 0.2);
    p.lineTo(s * 0.46, s * 0.44); p.lineTo(s * 0.48, s * 0.14); p.quadraticCurveTo(s * 0.54, s * 0.07, s * 0.59, s * 0.15);
    p.lineTo(s * 0.59, s * 0.44); p.lineTo(s * 0.62, s * 0.2); p.quadraticCurveTo(s * 0.68, s * 0.13, s * 0.72, s * 0.22);
    p.lineTo(s * 0.71, s * 0.48); p.lineTo(s * 0.74, s * 0.33); p.quadraticCurveTo(s * 0.8, s * 0.28, s * 0.82, s * 0.37);
    p.lineTo(s * 0.78, s * 0.66); p.quadraticCurveTo(s * 0.74, s * 0.84, s * 0.66, s * 0.9); p.closePath();
    x.fillStyle = lin(x, 0, 0, 0, s, [[0, '#fff3d6'], [1, '#e7cfa0']]); x.fill(p); ink(x, p, Math.max(0.5, s * 0.05));
  }
  return c;
}
