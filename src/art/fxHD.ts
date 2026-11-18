// High-resolution crocodiles and world effects: ripples, splashes, dust, glints,
// the bobber and nets, rocks, fish under the surface and fish in the hand.
// Same light (upper-left), same ink, same density as the villagers.
import { hdCanvas, Ctx, softShadow } from './hd';

/** A sheet in world units; the canvas is ART times denser. */
export interface HDSheet { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number; }

const INK = 'rgba(30,34,30,0.9)';
const lighten = (h: string, t: number) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).map((v) => Math.round(v + (255 - v) * t)); return `rgb(${c})`; };
const darken = (h: string, t: number) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).map((v) => Math.round(v * (1 - t))); return `rgb(${c})`; };
function grad(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = c.createLinearGradient(x0, y0, x1, y1);
  for (const [o, col] of stops) g.addColorStop(o, col);
  return g;
}
const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
function ink(c: Ctx, p: Path2D, w = 0.45, col = INK) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.stroke(p); }

/** Lay out `n` frames side by side; `draw(ctx, i)` paints frame i in its own world-unit space. */
function sheet(fw: number, fh: number, n: number, ox: number, oy: number, draw: (c: Ctx, i: number) => void): HDSheet {
  const [canvas, ctx] = hdCanvas(fw * n, fh);
  for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(i * fw, 0); ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip(); draw(ctx, i); ctx.restore(); }
  return { canvas, fw, fh, ox, oy };
}

// ---------------------------------------------------------------- crocodile
type CrocMode = 'walk' | 'open' | 'lunge' | 'stun';
export const CROC_HD = { fw: 42, fh: 20, ox: 21, oy: 16 } as const;

/** Faces left. Frames: 0-1 swim, 2-3 walk, 4 jaws open (warning), 5 lunge, 6 stunned. */
export function crocSheetHD(G: string[] = ['#3c5f2a', '#567f36', '#6f9a42', '#8fb857'], BELLY = '#cfd29a'): HDSheet {
  const body = (c: Ctx, mode: CrocMode, leg: number, legs: boolean) => {
    const sx = mode === 'lunge' ? -2.2 : 0, cy = 11.6;
    const wave = (u: number) => (mode === 'lunge' ? 0 : Math.sin(u * 3 + leg * Math.PI) * 1.1 * u);
    // far legs (darker), behind the body
    const legAt = (x: number, ph: number, far: boolean) => {
      const o = mode === 'lunge' ? 2 : (leg + ph) % 2 === 0 ? -1.4 : 1.4;
      const p = new Path2D(); p.moveTo(x - 1.6, cy + 1); p.quadraticCurveTo(x + o - 2, cy + 3.6, x + o - 2.4, cy + 4.8); p.lineTo(x + o + 0.6, cy + 4.8); p.quadraticCurveTo(x + 1, cy + 3, x + 1.8, cy + 1); p.closePath();
      c.fillStyle = far ? darken(G[1], 0.25) : G[1]; c.fill(p); ink(c, p);
      for (let k = 0; k < 3; k++) { c.fillStyle = '#e8e2c4'; c.beginPath(); c.arc(x + o - 2.2 + k * 0.9, cy + 4.9, 0.28, 0, Math.PI * 2); c.fill(); }
    };
    if (legs) { legAt(17 + sx, 1, true); legAt(29, 0, true); }
    // tail: tapers and sways
    const tail = new Path2D();
    tail.moveTo(27, cy - 3.4);
    for (let i = 1; i <= 10; i++) { const u = i / 10; tail.lineTo(27 + u * 14, cy - 3.4 * (1 - u) + wave(u) - 0.2); }
    for (let i = 10; i >= 0; i--) { const u = i / 10; tail.lineTo(27 + u * 14, cy + 3.2 * (1 - u) + wave(u) + 0.2); }
    tail.closePath();
    c.fillStyle = grad(c, 0, cy - 4, 0, cy + 4, [[0, G[3]], [0.45, G[2]], [1, G[0]]]); c.fill(tail); ink(c, tail);
    for (let i = 0; i < 6; i++) { const u = 0.08 + i * 0.14, x = 27 + u * 14, y = cy - 3.4 * (1 - u) + wave(u); c.fillStyle = G[0]; c.beginPath(); c.moveTo(x - 0.8, y + 0.3); c.lineTo(x, y - 1.1 * (1 - u * 0.6)); c.lineTo(x + 0.8, y + 0.3); c.fill(); }
    // trunk with a pale belly and armoured back
    const trunk = ell(20.5 + sx, cy, 9.6, 4.5);
    c.fillStyle = grad(c, 0, cy - 4.5, 0, cy + 4.5, [[0, G[3]], [0.4, G[2]], [0.75, G[1]], [1, G[0]]]); c.fill(trunk);
    c.save(); c.clip(trunk); c.fillStyle = grad(c, 0, cy + 1.2, 0, cy + 4.5, [[0, BELLY], [1, darken(BELLY, 0.25)]]); c.fillRect(8, cy + 1.6, 26, 4);
    c.strokeStyle = darken(BELLY, 0.3); c.lineWidth = 0.25; for (let x = 13; x < 30; x += 1.6) { c.beginPath(); c.moveTo(x + sx, cy + 1.7); c.lineTo(x + sx, cy + 4.4); c.stroke(); }
    c.restore(); ink(c, trunk);
    for (let i = 0; i < 8; i++) { const x = 13.6 + i * 2 + sx, y = cy - 3.6 + Math.abs(i - 3.5) * 0.12; const s = ell(x, y, 0.95, 0.65); c.fillStyle = G[1]; c.fill(s); c.fillStyle = 'rgba(255,255,220,0.35)'; c.beginPath(); c.arc(x - 0.3, y - 0.25, 0.3, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < 7; i++) { c.fillStyle = 'rgba(30,50,20,0.35)'; c.beginPath(); c.arc(15 + i * 2.3 + sx, cy - 1 + (i % 2) * 0.8, 0.45, 0, Math.PI * 2); c.fill(); }
    if (legs) { legAt(15.5 + sx, 0, false); legAt(27.5, 1, false); }

    // head: long snout, eye bump on top, teeth along the jaw
    const hx = 13.5 + sx, open = mode === 'open' || mode === 'lunge', jaw = mode === 'open' ? 0.42 : mode === 'lunge' ? 0.55 : mode === 'stun' ? 0.08 : 0;
    const lower = new Path2D(); lower.moveTo(hx, cy + 0.6); lower.lineTo(hx, cy + 3); lower.quadraticCurveTo(hx - 6, cy + 3, 2.4 + sx, cy + 2.2); lower.quadraticCurveTo(1.6 + sx, cy + 1.2, 2.6 + sx, cy + 0.9); lower.closePath();
    c.fillStyle = grad(c, 0, cy, 0, cy + 3, [[0, G[2]], [1, BELLY]]); c.fill(lower); ink(c, lower);
    if (open) { // the mouth, pink and toothy
      const dx = 2.8 + sx - hx, ux = hx + dx * Math.cos(jaw), uy = cy + 0.8 + dx * Math.sin(jaw); // where the raised upper jaw's tip ends up
      const m = new Path2D(); m.moveTo(hx, cy + 0.8); m.lineTo(2.8 + sx, cy + 1); m.quadraticCurveTo(1.8 + sx, (cy + uy) / 2, ux, uy + 0.6); m.closePath();
      c.fillStyle = grad(c, hx, cy, 3, cy - 2, [[0, '#7a1c1c'], [1, '#e8635a']]); c.fill(m);
      c.fillStyle = '#fffaf0'; for (let x = 4; x < hx - 1; x += 1.7) { c.beginPath(); c.moveTo(x + sx * 0, cy + 1); c.lineTo(x + 0.45, cy + 0.1); c.lineTo(x + 0.9, cy + 1); c.fill(); }
    }
    c.save(); c.translate(hx, cy + 0.8); c.rotate(jaw); c.translate(-hx, -cy - 0.8); // lift the snout
    const upper = new Path2D(); upper.moveTo(hx + 1, cy - 3.4); upper.quadraticCurveTo(hx - 4, cy - 2.6, 2.2 + sx, cy - 0.6); upper.quadraticCurveTo(1.2 + sx, cy + 0.4, 2.2 + sx, cy + 0.9); upper.lineTo(hx + 1, cy + 0.9); upper.closePath();
    c.fillStyle = grad(c, 0, cy - 3.4, 0, cy + 1, [[0, G[3]], [0.5, G[2]], [1, G[1]]]); c.fill(upper); ink(c, upper);
    c.fillStyle = '#fffaf0'; for (let x = 3.6; x < hx - 1; x += 1.9) { c.beginPath(); c.moveTo(x, cy + 0.8); c.lineTo(x + 0.45, cy + 1.7); c.lineTo(x + 0.9, cy + 0.8); c.fill(); }
    c.fillStyle = G[0]; c.beginPath(); c.arc(3 + sx, cy - 0.8, 0.35, 0, Math.PI * 2); c.fill(); // nostril
    // eye on its bump
    const eb = ell(hx - 1.4, cy - 3.2, 1.7, 1.25); c.fillStyle = G[2]; c.fill(eb); ink(c, eb);
    if (mode === 'stun') { c.strokeStyle = '#2b1b2e'; c.lineWidth = 0.35; c.beginPath(); c.arc(hx - 1.4, cy - 3.3, 0.7, 0, Math.PI * 1.6); c.stroke(); c.beginPath(); c.arc(hx - 1.4, cy - 3.3, 0.3, 0, Math.PI * 1.6); c.stroke(); }
    else { c.fillStyle = '#f6d24a'; c.beginPath(); c.ellipse(hx - 1.5, cy - 3.3, 0.85, 0.75, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#1d1a14'; c.beginPath(); c.ellipse(hx - 1.5, cy - 3.3, 0.22, 0.65, 0, 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(hx - 1.8, cy - 3.6, 0.18, 0, Math.PI * 2); c.fill(); }
    c.restore();
    if (mode === 'stun') { c.fillStyle = '#e8635a'; c.beginPath(); c.ellipse(4.6 + sx, cy + 2.6, 1.3, 0.55, 0.3, 0, Math.PI * 2); c.fill(); } // tongue lolls out
  };
  return sheet(CROC_HD.fw, CROC_HD.fh, 7, CROC_HD.ox, CROC_HD.oy, (c, i) => {
    if (i >= 2) {
      softShadow(c, 21, 16.3, 17, 2.6, 0.35);
      const mode: CrocMode = i === 4 ? 'open' : i === 5 ? 'lunge' : i === 6 ? 'stun' : 'walk';
      body(c, mode, i === 3 ? 1 : 0, true);
      return;
    }
    // swimming: only the eyes, snout and ridge break the surface; the rest is a shadow under the water
    const [t, tc] = hdCanvas(CROC_HD.fw, CROC_HD.fh);
    body(tc, 'walk', i, false);
    c.save(); c.globalAlpha = 0.28; c.drawImage(t, 0, 0, CROC_HD.fw, CROC_HD.fh); c.restore();
    c.save(); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(16,62,84,0.55)'; c.fillRect(0, 0, CROC_HD.fw, CROC_HD.fh); c.restore();
    c.save(); c.beginPath(); c.rect(0, 0, CROC_HD.fw, 9.8); c.clip(); c.drawImage(t, 0, 0, CROC_HD.fw, CROC_HD.fh); c.restore();
    c.strokeStyle = 'rgba(233,251,241,0.85)'; c.lineCap = 'round'; c.lineWidth = 0.45;
    for (const [x0, x1] of [[1.5 + i, 14.5], [15 - i, 31], [31 + i, 39]] as const) { c.beginPath(); c.moveTo(x0, 9.9); c.quadraticCurveTo((x0 + x1) / 2, 10.9, x1, 9.9); c.stroke(); }
  });
}

/** A V of wake left behind a swimming crocodile (points left, like the croc). */
export function wakeCanvas(): HTMLCanvasElement {
  const [c, x] = hdCanvas(16, 9);
  x.strokeStyle = 'rgba(233,251,241,0.85)'; x.lineCap = 'round'; x.lineWidth = 0.5;
  x.beginPath(); x.moveTo(1, 4.5); x.quadraticCurveTo(7, 2.2, 15, 0.8); x.stroke();
  x.beginPath(); x.moveTo(1, 4.5); x.quadraticCurveTo(7, 6.8, 15, 8.2); x.stroke();
  x.strokeStyle = 'rgba(233,251,241,0.4)'; x.lineWidth = 0.35;
  x.beginPath(); x.moveTo(4, 4.5); x.quadraticCurveTo(9, 3.4, 14, 2.8); x.stroke();
  x.beginPath(); x.moveTo(4, 4.5); x.quadraticCurveTo(9, 5.6, 14, 6.2); x.stroke();
  return c;
}

// ---------------------------------------------------------------- water and dust effects
/** Expanding ripple: a bright ring with a soft inner echo. Frame 1 doubles as the aim marker. */
export function ringSheetHD(): HDSheet {
  return sheet(24, 12, 4, 12, 6, (c, f) => {
    const rx = 3.6 + f * 2.7, ry = rx * 0.46, a = 0.95 - f * 0.2;
    c.strokeStyle = `rgba(240,253,247,${a})`; c.lineWidth = 0.55 - f * 0.06; c.stroke(ell(12, 6, rx, ry));
    c.strokeStyle = `rgba(240,253,247,${a * 0.45})`; c.lineWidth = 0.35; c.stroke(ell(12, 6, rx * 0.62, ry * 0.62));
    c.strokeStyle = `rgba(20,70,100,${a * 0.25})`; c.lineWidth = 0.4; c.stroke(ell(12, 6.4, rx, ry));
  });
}
/** Dust kicked up by feet and falling rocks: soft warm clumps that swell and fade. */
export function puffSheetHD(): HDSheet {
  return sheet(10, 10, 4, 5, 7, (c, f) => {
    const a = 0.75 - f * 0.17, s = 1 + f * 0.35;
    for (const [dx, dy, r] of [[-1.6, 0.2, 1.6], [1.4, 0.4, 1.5], [0, -1, 1.9]] as const) softShadow(c, 5 + dx * s, 7 + dy * s - f * 0.6, r * s, r * s * 0.85, a, '232,214,176');
  });
}
/** Four-point star: small, medium, large. */
export function sparkleSheetHD(): HDSheet {
  return sheet(5, 5, 3, 2.5, 2.5, (c, f) => {
    const r = 1.1 + f * 0.7;
    softShadow(c, 2.5, 2.5, r * 0.9, r * 0.9, 0.55, '255,240,170');
    c.fillStyle = '#fffbe6'; c.beginPath();
    c.moveTo(2.5, 2.5 - r); c.quadraticCurveTo(2.75, 2.25, 2.5 + r, 2.5); c.quadraticCurveTo(2.75, 2.75, 2.5, 2.5 + r);
    c.quadraticCurveTo(2.25, 2.75, 2.5 - r, 2.5); c.quadraticCurveTo(2.25, 2.25, 2.5, 2.5 - r); c.fill();
  });
}
/** A water droplet. */
export function dropHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(3, 3);
  x.fillStyle = 'rgba(214,246,240,0.95)'; x.beginPath(); x.moveTo(1.5, 0.2); x.quadraticCurveTo(2.6, 1.8, 1.5, 2.7); x.quadraticCurveTo(0.4, 1.8, 1.5, 0.2); x.fill();
  x.fillStyle = '#ffffff'; x.beginPath(); x.arc(1.25, 1.6, 0.3, 0, Math.PI * 2); x.fill();
  return c;
}

// ---------------------------------------------------------------- fishing gear
/** Frame 0 floating, frame 1 pulled under. */
export function bobberSheetHD(): HDSheet {
  return sheet(7, 8, 2, 3.5, 5, (c, f) => {
    const y = f === 1 ? 2.2 : 0;
    if (f === 0) {
      c.fillStyle = '#5e3c22'; c.fillRect(3.3, 0.2, 0.4, 1.6); // quill
      const top = new Path2D(); top.arc(3.5, 3.2, 1.7, Math.PI, 0); top.closePath();
      c.fillStyle = grad(c, 2, 1.5, 5, 3.2, [[0, '#ff8a70'], [0.5, '#e8433f'], [1, '#a82a26']]); c.fill(top);
      const bot = new Path2D(); bot.arc(3.5, 3.2, 1.7, 0, Math.PI); bot.closePath();
      c.fillStyle = grad(c, 2, 3.2, 5, 5, [[0, '#ffffff'], [1, '#d9d2c0']]); c.fill(bot);
      ink(c, ell(3.5, 3.2, 1.7, 1.7), 0.35);
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.arc(2.8, 2.3, 0.4, 0, Math.PI * 2); c.fill();
    } else {
      const tip = new Path2D(); tip.ellipse(3.5, 4.1, 1.5, 0.6, 0, Math.PI, 0); tip.closePath(); c.fillStyle = '#e8433f'; c.fill(tip);
    }
    c.strokeStyle = 'rgba(240,253,247,0.9)'; c.lineWidth = 0.4; c.stroke(ell(3.5, 5 - y * 0.1, 3 + f * 0.3, 0.9));
  });
}
/** The cast net on the water: frames 0/2 small net, 1/3 big gold-rimmed net (2-3 drawn tighter). */
export function netSheetHD(): HDSheet {
  return sheet(30, 18, 4, 15, 9, (c, f) => {
    const big = f % 2 === 1, tight = f > 1;
    const rx = (big ? 12 : 8) - (tight ? 2 : 0), ry = (big ? 6 : 4) - (tight ? 1 : 0), rim = big ? '#f6d24a' : '#c69862';
    c.save(); c.beginPath(); c.ellipse(15, 9, rx, ry, 0, 0, Math.PI * 2); c.clip();
    c.fillStyle = 'rgba(30,80,100,0.18)'; c.fillRect(0, 0, 30, 18);
    c.strokeStyle = 'rgba(244,236,212,0.8)'; c.lineWidth = 0.25;
    for (let k = -24; k < 30; k += 1.6) { c.beginPath(); c.moveTo(k, 0); c.lineTo(k + 9, 18); c.stroke(); c.beginPath(); c.moveTo(k + 9, 0); c.lineTo(k, 18); c.stroke(); }
    c.restore();
    c.strokeStyle = rim; c.lineWidth = 0.7; c.stroke(ell(15, 9, rx, ry));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2, x = 15 + Math.cos(a) * rx, y = 9 + Math.sin(a) * ry; c.fillStyle = k % 2 ? '#e8433f' : '#fff8ea'; c.beginPath(); c.arc(x, y, 0.65, 0, Math.PI * 2); c.fill(); }
    if (tight) { c.strokeStyle = 'rgba(240,253,247,0.8)'; c.lineWidth = 0.4; c.stroke(ell(15, 9.6, rx + 1.4, ry + 0.8)); }
  });
}
/** The "!" that pops when a fish bites. */
export function bubbleHD(fill: string, light: string, mark: string): HTMLCanvasElement {
  const [c, x] = hdCanvas(11, 15);
  const b = new Path2D(); b.roundRect(1, 0.6, 9, 11, 3.6); b.moveTo(4.2, 11.4); b.lineTo(5.5, 13.9); b.lineTo(6.8, 11.4);
  x.fillStyle = grad(x, 0, 0, 0, 12, [[0, light], [0.45, fill], [1, darken(fill, 0.2)]]); x.fill(b); ink(x, b, 0.55, 'rgba(43,27,46,0.95)');
  x.fillStyle = mark; x.beginPath(); x.roundRect(4.6, 2.4, 1.8, 5.4, 0.9); x.fill(); x.beginPath(); x.arc(5.5, 9.4, 1, 0, Math.PI * 2); x.fill();
  x.fillStyle = 'rgba(255,255,255,0.55)'; x.beginPath(); x.ellipse(3.2, 2.6, 1.1, 0.6, -0.5, 0, Math.PI * 2); x.fill();
  return c;
}

// ---------------------------------------------------------------- rocks
function pebble(c: Ctx, x: number, y: number, rx: number, ry: number, tone: number) {
  const p = ell(x, y, rx, ry);
  const g = c.createRadialGradient(x - rx * 0.4, y - ry * 0.5, 0, x, y, rx * 1.2);
  g.addColorStop(0, `rgb(${tone + 46},${tone + 42},${tone + 34})`); g.addColorStop(0.6, `rgb(${tone},${tone - 4},${tone - 12})`); g.addColorStop(1, `rgb(${tone - 52},${tone - 56},${tone - 62})`);
  c.fillStyle = g; c.fill(p); ink(c, p, 0.35, 'rgba(40,36,40,0.8)');
}
/** A throwing rock (6 x 6). */
export function stoneHD(): HTMLCanvasElement {
  const [c, x] = hdCanvas(6, 6);
  pebble(x, 3, 3, 2.4, 2, 168);
  return c;
}
/** A little pile of throwing rocks lying on the ground. */
export function stonesHD(): HDSheet {
  return sheet(20, 12, 1, 10, 11, (c) => {
    softShadow(c, 11, 10.6, 8.5, 1.8, 0.35);
    pebble(c, 6.5, 8.6, 2.8, 2, 150); pebble(c, 13.5, 8.8, 3, 2.1, 160); pebble(c, 10, 6.4, 3.1, 2.3, 178); pebble(c, 15.4, 6.6, 1.8, 1.4, 140);
  });
}

// ---------------------------------------------------------------- fish
/** Fish seen under the surface: frames 0-1 dark, 2-3 golden, tail swinging. */
export function fishSheetHD(): HDSheet {
  return sheet(16, 8, 4, 8, 4, (c, f) => {
    const gold = f >= 2, sw = f % 2 ? 1 : -1;
    const col = gold ? '255,206,80' : '12,40,58';
    softShadow(c, 7, 4, 5.4, 2, gold ? 0.75 : 0.6, col);
    const t = new Path2D(); t.moveTo(11, 4); t.lineTo(15, 4 - 2.2 + sw * 0.8); t.lineTo(14.2, 4 + sw * 0.6); t.lineTo(15, 4 + 2.2 + sw * 0.8); t.closePath();
    c.fillStyle = `rgba(${col},${gold ? 0.75 : 0.55})`; c.fill(t);
    if (gold) { c.fillStyle = 'rgba(255,250,210,0.8)'; c.beginPath(); c.ellipse(5.6, 3.4, 2, 0.7, 0, 0, Math.PI * 2); c.fill(); }
  });
}
/** A fish in the hand, one frame per species: [back, belly, fin] colours. */
export function catchSheetHD(kinds: { colors: [string, string, string] }[]): HDSheet {
  return sheet(16, 11, kinds.length, 8, 5, (c, i) => {
    const [back, belly, fin] = kinds[i].colors;
    const tail = new Path2D(); tail.moveTo(12.4, 5.4); tail.lineTo(15.6, 2.2); tail.quadraticCurveTo(14.6, 5.4, 15.6, 8.6); tail.closePath();
    c.fillStyle = grad(c, 12, 2, 16, 9, [[0, lighten(fin, 0.2)], [1, fin]]); c.fill(tail); ink(c, tail, 0.4);
    const dors = new Path2D(); dors.moveTo(4.6, 2.9); dors.quadraticCurveTo(7.4, 0.4, 10.4, 2.8); dors.closePath(); c.fillStyle = fin; c.fill(dors); ink(c, dors, 0.35);
    const b = new Path2D(); b.moveTo(1.2, 5.4); b.bezierCurveTo(3, 1.8, 10.4, 1.8, 12.8, 5.4); b.bezierCurveTo(10.4, 9, 3, 9, 1.2, 5.4); b.closePath();
    c.fillStyle = grad(c, 0, 2.4, 0, 8.4, [[0, darken(back, 0.1)], [0.35, back], [0.62, belly], [1, lighten(belly, 0.25)]]); c.fill(b);
    c.save(); c.clip(b); c.strokeStyle = 'rgba(255,255,255,0.22)'; c.lineWidth = 0.25;
    for (let x = 5; x < 12; x += 1.4) { c.beginPath(); c.arc(x, 4.6, 1.1, -0.9, 0.9); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.beginPath(); c.ellipse(6, 3.6, 3, 0.55, -0.05, 0, Math.PI * 2); c.fill();
    c.restore(); ink(c, b, 0.45);
    c.strokeStyle = darken(back, 0.3); c.lineWidth = 0.3; c.beginPath(); c.arc(4.4, 5.4, 1.6, -1, 1); c.stroke(); // gill
    c.fillStyle = '#fffaf0'; c.beginPath(); c.arc(3, 4.7, 0.75, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#1d1a14'; c.beginPath(); c.arc(2.85, 4.75, 0.42, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(2.7, 4.55, 0.15, 0, Math.PI * 2); c.fill();
  });
}
