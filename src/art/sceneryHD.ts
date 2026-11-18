// High-resolution scenery: vegetation, rocks, the dock and canoe, village props,
// Sabapathi's shop, the gear stall, the fish bag, signs and small creatures.
// Every sheet keeps the size and ground point of the pixel version it replaces,
// so collision and placement are unchanged. Light comes from the upper-left.
import { hdCanvas, Ctx, softShadow } from './hd';
import { hash, rng } from './px';
import { PAL } from '../config/game';
import type { HDSheet } from './fxHD';

const LEAF = PAL.leaf; // dark -> light
const WOOD = PAL.wood;
const INK = 'rgba(43,27,46,0.9)';
const INK_LEAF = 'rgba(23,51,42,0.95)';

// ---------------------------------------------------------------- helpers
const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
const rr = (x: number, y: number, w: number, h: number, r: number) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
function lin(c: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const [o, s] of stops) g.addColorStop(o, s); return g; }
function rad(c: Ctx, x: number, y: number, r: number, stops: [number, string][]) { const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r * 1.15); for (const [o, s] of stops) g.addColorStop(o, s); return g; }
function ink(c: Ctx, p: Path2D, w = 0.5, col = INK) { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(p); }
function fill(c: Ctx, p: Path2D, f: string | CanvasGradient, w = 0.5, col = INK) { c.fillStyle = f; c.fill(p); if (w > 0) ink(c, p, w, col); }
function stroke(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, w: number) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
/** Sheet of n frames; each frame is drawn in its own world-unit space and clipped to it. */
function sheet(fw: number, fh: number, n: number, ox: number, oy: number, draw: (c: Ctx, i: number) => void): HDSheet {
  const [canvas, ctx] = hdCanvas(fw * n, fh);
  for (let i = 0; i < n; i++) { ctx.save(); ctx.translate(i * fw, 0); ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip(); draw(ctx, i); ctx.restore(); }
  return { canvas, fw, fh, ox, oy };
}
/** A plank: wood gradient, grain lines, end shading. */
function plank(c: Ctx, x: number, y: number, w: number, h: number, seed: number, vertical = false) {
  const t = hash(seed, 3, 9);
  const base = t < 0.33 ? '#b0814f' : t < 0.66 ? '#a8794a' : '#b98a56';
  c.fillStyle = vertical ? lin(c, x, 0, x + w, 0, [[0, '#d2a66e'], [0.3, base], [1, '#7d5632']]) : lin(c, 0, y, 0, y + h, [[0, '#d2a66e'], [0.3, base], [1, '#7d5632']]);
  c.fillRect(x, y, w, h);
  c.strokeStyle = 'rgba(90,58,30,0.45)'; c.lineWidth = 0.22;
  const R = rng(seed * 31 + 7);
  for (let k = 0; k < 3; k++) {
    c.beginPath();
    if (vertical) { const gx = x + 0.6 + R() * (w - 1.2); c.moveTo(gx, y + 0.5); c.bezierCurveTo(gx + 0.4, y + h * 0.3, gx - 0.4, y + h * 0.6, gx + 0.2, y + h - 0.5); }
    else { const gy = y + 0.6 + R() * (h - 1.2); c.moveTo(x + 0.5, gy); c.bezierCurveTo(x + w * 0.3, gy + 0.4, x + w * 0.6, gy - 0.4, x + w - 0.5, gy + 0.2); }
    c.stroke();
  }
}

// ---------------------------------------------------------------- foliage
type Blob = [number, number, number];
/** A leafy canopy: scalloped clumps, lit from the upper-left, with an inked silhouette. */
function foliage(c: Ctx, blobs: Blob[], seed: number, fruit?: string) {
  const R = rng(seed);
  const scallops = blobs.map(([x, y, r]) => {
    const n = Math.max(7, Math.round(r * 1.1));
    return Array.from({ length: n }, (_v, k): Blob => {
      const ang = (k / n) * Math.PI * 2 + R() * 0.3;
      return [x + Math.cos(ang) * r * 0.86, y + Math.sin(ang) * r * 0.8, r * (0.24 + R() * 0.1)];
    });
  });
  const all = (fn: (x: number, y: number, r: number) => void) => blobs.forEach((b, i) => { fn(...b); scallops[i].forEach((s) => fn(...s)); });
  // silhouette ink
  c.fillStyle = INK_LEAF; all((x, y, r) => { c.beginPath(); c.arc(x, y, r + 0.6, 0, Math.PI * 2); c.fill(); });
  // clumps back to front
  const order = blobs.map((b, i) => i).sort((a, b) => blobs[a][1] - blobs[b][1]);
  for (const i of order) {
    const [x, y, r] = blobs[i];
    const g = rad(c, x, y, r, [[0, LEAF[4]], [0.35, LEAF[3]], [0.72, LEAF[2]], [1, LEAF[1]]]);
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    for (const [sx, sy, sr] of scallops[i]) { c.beginPath(); c.arc(sx, sy, sr, 0, Math.PI * 2); c.fill(); }
    // a soft dark seam where this clump overlaps the one behind
    c.strokeStyle = 'rgba(20,50,30,0.25)'; c.lineWidth = 0.6; c.beginPath(); c.arc(x, y, r * 0.98, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  }
  // leaf texture: little curved strokes, sunlit up top, shaded below
  for (const [x, y, r] of blobs) for (let k = 0; k < r * 3; k++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 0.85, lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.9;
    const lit = (x - lx) / r * 0.5 + (y - ly) / r * 0.8;
    c.strokeStyle = lit > 0.25 ? 'rgba(200,236,120,0.55)' : lit < -0.35 ? 'rgba(20,60,34,0.4)' : 'rgba(120,180,80,0.35)';
    c.lineWidth = 0.4; c.beginPath(); c.arc(lx, ly, 0.9 + R() * 0.6, Math.PI * 1.1, Math.PI * 1.85); c.stroke();
  }
  if (fruit) for (let k = 0; k < 7; k++) {
    const [x, y, r] = blobs[Math.floor(R() * blobs.length)], a = R() * Math.PI * 2, d = R() * r * 0.7;
    const fx = x + Math.cos(a) * d, fy = y + Math.sin(a) * d;
    c.fillStyle = rad(c, fx, fy, 1.4, [[0, '#ffe08a'], [0.5, fruit], [1, '#b9661c']]); c.beginPath(); c.arc(fx, fy, 1.3, 0, Math.PI * 2); c.fill();
  }
}

// ---------------------------------------------------------------- trees
/** Coconut palm, 3 sway frames. `king` palms carry orange king coconuts (thambili). */
export function palmHD(king: boolean, seed: number): HDSheet {
  const FW = 76, FH = 92, lean = hash(seed, 1) < 0.5 ? -1 : 1;
  return sheet(FW, FH, 3, 38, FH - 3, (c, f) => {
    const sway = f - 1, bx = 38, by = FH - 3;
    const topX = bx + lean * 9 + sway * 0.6, topY = by - 58;
    const frond = (deg: number, len: number, back: boolean) => {
      const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      const tipX = topX + dx * len + sway * (1.4 + Math.abs(dx)), tipY = topY + dy * len + len * 0.42;
      const cx = topX + dx * len * 0.55 + sway * 0.6, cy = topY + dy * len * 0.55 - 7;
      const at = (t: number) => { const u = 1 - t; return [u * u * topX + 2 * u * t * cx + t * t * tipX, u * u * topY + 2 * u * t * cy + t * t * tipY]; };
      const cols = back ? [LEAF[0], LEAF[1]] : [LEAF[2], LEAF[4]];
      // leaflets fan out from the rib and droop
      const N = Math.round(len * 1.3);
      for (let i = 2; i <= N; i++) {
        const t = i / N, [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.02));
        const gx = x2 - x, gy = y2 - y, gl = Math.hypot(gx, gy) || 1, nx = -gy / gl, ny = gx / gl;
        const L = 1 + 5.6 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (1 - t * 0.3);
        for (const side of [-1, 1]) {
          const ex = x + nx * L * side + gx / gl * L * 0.6, ey = y + ny * L * side * 0.6 + L * 0.55;
          c.strokeStyle = side * ny < 0 ? cols[1] : cols[0]; c.lineWidth = 0.65; c.lineCap = 'round';
          c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo((x + ex) / 2, (y + ey) / 2 - 0.6, ex, ey); c.stroke();
        }
      }
      c.strokeStyle = back ? LEAF[1] : '#b4d86a'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(topX, topY); c.quadraticCurveTo(cx, cy, tipX, tipY); c.stroke();
    };
    frond(158, 20, true); frond(22, 20, true); frond(-178, 25, true); frond(-2, 25, true);
    // trunk: tapering, ringed, lit on the left
    const trunk = new Path2D(), pts: [number, number, number][] = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; pts.push([bx + lean * 9 * t * t + sway * 0.6 * t * t, by - t * 58, (i < 1 ? 3.6 : 2.6 - t * 0.9)]); }
    pts.forEach(([x, y, w], i) => (i ? trunk.lineTo(x - w, y) : trunk.moveTo(x - w - 0.8, y)));
    [...pts].reverse().forEach(([x, y, w]) => trunk.lineTo(x + w, y)); trunk.closePath();
    fill(c, trunk, lin(c, bx - 4, 0, bx + 4, 0, [[0, '#c9a77a'], [0.35, '#9a7650'], [1, '#5d432b']]), 0.5);
    c.strokeStyle = 'rgba(70,48,30,0.6)'; c.lineWidth = 0.35;
    for (let i = 1; i < 20; i += 1.3) { const t = i / 20, x = bx + lean * 9 * t * t + sway * 0.6 * t * t, y = by - t * 58, w = 2.6 - t * 0.9; c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + 0.8, x + w, y); c.stroke(); }
    for (const [d, l] of [[-150, 25], [-30, 25], [-118, 22], [-62, 22], [-90, 17]] as const) frond(d, l, false);
    // coconuts
    const nut = king ? ['#ffc45a', '#e8922e', '#b9661c'] : ['#a8c25a', '#6b8a3a', '#435f27'];
    for (const [nx, ny] of [[-3, 3], [2, 4], [-1, 7], [4, 1]] as const) {
      const p = ell(topX + nx, topY + ny, 2.1, 2.1);
      fill(c, p, rad(c, topX + nx, topY + ny, 2.1, [[0, nut[0]], [0.5, nut[1]], [1, nut[2]]]), 0.4);
    }
    fill(c, ell(topX, topY - 0.6, 2.2, 1.6), LEAF[1], 0);
  });
}

export function treeHD(seed: number): HDSheet {
  const W = 84, H = 96, bx = 42, by = H - 3;
  return sheet(W, H, 1, bx, by, (c) => {
    // trunk with flared roots and two branches
    const t = new Path2D();
    t.moveTo(bx - 4, 52); t.lineTo(bx - 4.2, by - 6); t.quadraticCurveTo(bx - 6, by - 1, bx - 10, by + 0.4); t.lineTo(bx + 10, by + 0.4);
    t.quadraticCurveTo(bx + 6, by - 1, bx + 4.2, by - 6); t.lineTo(bx + 4, 52); t.closePath();
    fill(c, t, lin(c, bx - 6, 0, bx + 6, 0, [[0, '#a87a4c'], [0.4, '#7a5637'], [1, '#4a321f']]), 0.55);
    c.strokeStyle = 'rgba(50,32,20,0.5)'; c.lineWidth = 0.35;
    for (let k = 0; k < 6; k++) { const x = bx - 3 + k * 1.2; c.beginPath(); c.moveTo(x, 60 + k * 2); c.bezierCurveTo(x + 0.6, 70, x - 0.5, 80, x + 0.3, by - 3); c.stroke(); }
    for (const [x0, y0, x1, y1] of [[bx - 2, 62, bx - 11, 52], [bx + 2, 60, bx + 12, 50]] as const) { stroke(c, x0, y0, x1, y1, INK, 2.8); stroke(c, x0, y0, x1, y1, '#7a5637', 2); }
    const j = (n: number) => (hash(n, seed, 4) - 0.5) * 6;
    foliage(c, [[42 + j(1), 34, 24], [24 + j(2), 44 + j(3), 16], [60 + j(4), 44 + j(5), 16], [30, 24 + j(6), 15], [54, 22 + j(7), 15], [42, 52, 17], [16, 52, 10], [68, 52, 10]],
      seed, hash(seed, 8) < 0.5 ? '#f2b33d' : undefined);
  });
}

export function bushHD(flower: boolean, seed: number): HDSheet {
  const W = 34, H = 26;
  return sheet(W, H, 1, 17, H - 2, (c) => {
    foliage(c, [[17, 14, 10], [9, 17, 7], [25, 17, 7], [14, 10, 6], [22, 10, 6]], seed);
    if (!flower) return;
    const R = rng(seed), kind = R() < 0.5 ? ['#e8433f', '#ff9a80', '#ffe08a'] : ['#fff6e0', '#f6d24a', '#f2a63a'];
    for (let i = 0; i < 7; i++) {
      const x = 6 + R() * 22, y = 7 + R() * 13;
      c.fillStyle = kind[0]; for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2 + i; c.beginPath(); c.ellipse(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.8, 0.8, 0.55, a, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = kind[2]; c.beginPath(); c.arc(x, y, 0.45, 0, Math.PI * 2); c.fill();
    }
  });
}

export function bananaHD(seed: number): HDSheet {
  const W = 48, H = 56, bx = 24, by = H - 3, top = 26;
  return sheet(W, H, 1, bx, by, (c) => {
    const R = rng(seed);
    const leaf = (deg: number, len: number, wid: number, droop: number) => {
      const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
      const cx = bx + dx * len * 0.55, cy = top + dy * len * 0.75 - 3, tx = bx + dx * len, ty = top + dy * len * 0.55 + droop;
      const at = (t: number) => { const u = 1 - t; return [u * u * bx + 2 * u * t * cx + t * t * tx, u * u * top + 2 * u * t * cy + t * t * ty]; };
      const L: [number, number][] = [], Rr: [number, number][] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24, [x, y] = at(t), [x2, y2] = at(Math.min(1, t + 0.01));
        const gx = x2 - x, gy = y2 - y, gl = Math.hypot(gx, gy) || 1, nx = -gy / gl, ny = gx / gl;
        let w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.55);
        const torn = hash(i, 1, seed + deg) < 0.2 ? 0.55 : 1; // wind-torn edges
        L.push([x + nx * w * torn, y + ny * w * torn]);
        w *= hash(i, 2, seed + deg) < 0.2 ? 0.55 : 1;
        Rr.push([x - nx * w, y - ny * w]);
      }
      const p = new Path2D(); L.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); [...Rr].reverse().forEach(([x, y]) => p.lineTo(x, y)); p.closePath();
      fill(c, p, lin(c, bx, top - 10, tx, ty + 6, [[0, LEAF[4]], [0.5, LEAF[3]], [1, LEAF[2]]]), 0.45, INK_LEAF);
      c.strokeStyle = '#d4ea86'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(bx, top); c.quadraticCurveTo(cx, cy, tx, ty); c.stroke();
      c.strokeStyle = 'rgba(30,80,40,0.3)'; c.lineWidth = 0.25;
      for (let i = 3; i < 23; i += 2) { const [x, y] = at(i / 24); const [lx, ly] = L[i]; c.beginPath(); c.moveTo(x, y); c.lineTo(lx, ly); c.stroke(); }
    };
    leaf(-170, 19, 4.5, 16); leaf(-10, 19, 4.5, 16);
    // pseudo-stem
    const st = new Path2D(); st.moveTo(bx - 2, top); st.lineTo(bx - 3, by); st.lineTo(bx + 3, by); st.lineTo(bx + 2, top); st.closePath();
    fill(c, st, lin(c, bx - 3, 0, bx + 3, 0, [[0, '#c4dc72'], [0.4, '#8fae4a'], [1, '#5f7f36']]), 0.45, INK_LEAF);
    c.strokeStyle = 'rgba(110,90,50,0.6)'; c.lineWidth = 0.4; for (let y = top + 5; y < by; y += 6) { c.beginPath(); c.moveTo(bx - 2.5, y); c.quadraticCurveTo(bx, y + 1, bx + 2.5, y); c.stroke(); }
    leaf(-135, 20, 4.5, 6); leaf(-45, 20, 4.5, 6); leaf(-100, 21, 4, -6); leaf(-76, 17, 3.5, -4);
    // a hand of bananas and the purple flower
    for (let i = 0; i < 4; i++) { const p = ell(bx + 6 + (i % 2) * 0.8, 34 + i * 2, 2.6, 1, -0.2); fill(c, p, lin(c, 0, 33 + i * 2, 0, 36 + i * 2, [[0, '#f8ec8a'], [1, '#c9b02a']]), 0.35); }
    const fl = new Path2D(); fl.moveTo(bx + 5, 41); fl.quadraticCurveTo(bx + 8, 43, bx + 6, 46); fl.quadraticCurveTo(bx + 4, 43, bx + 5, 41); fill(c, fl, lin(c, 0, 41, 0, 46, [[0, '#b35a7a'], [1, '#6a2a48']]), 0.35);
    void R;
  });
}

export function reedsHD(): HDSheet {
  const FW = 20, FH = 28;
  return sheet(FW, FH, 2, 10, FH - 3, (c, f) => {
    c.strokeStyle = 'rgba(240,253,247,0.7)'; c.lineWidth = 0.4; c.stroke(ell(10, FH - 2.6, 7.5, 1.4));
    const stalks: [number, number, number, boolean][] = [[4, 17, -2, false], [7, 23, -1, true], [10, 19, 0, false], [13, 24, 1, true], [16, 15, 2, false]];
    for (const [x, h, tilt, head] of stalks) {
      const tip = tilt + (f ? 1 : 0), x1 = x + tip, y1 = FH - 3 - h;
      c.strokeStyle = INK_LEAF; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, FH - 3); c.quadraticCurveTo(x, FH - 3 - h * 0.6, x1, y1); c.stroke();
      c.strokeStyle = lin(c, 0, FH, 0, y1, [[0, LEAF[1]], [1, LEAF[3]]]); c.lineWidth = 0.75; c.beginPath(); c.moveTo(x, FH - 3); c.quadraticCurveTo(x, FH - 3 - h * 0.6, x1, y1); c.stroke();
      if (head) fill(c, rr(x1 - 0.95, y1 - 0.5, 1.9, 5.2, 0.95), lin(c, x1 - 1, 0, x1 + 1, 0, [[0, '#a8703f'], [1, '#5a3520']]), 0.4);
    }
    // a couple of blade leaves
    for (const [x, d] of [[6, -1], [14, 1]] as const) {
      const p = new Path2D(); p.moveTo(x, FH - 3); p.quadraticCurveTo(x + d * 2, FH - 12, x + d * (4 + f), FH - 15); p.quadraticCurveTo(x + d * 1.2, FH - 10, x + 0.8 * d, FH - 3); p.closePath();
      fill(c, p, LEAF[2], 0.35, INK_LEAF);
    }
  });
}

/** Frames: 0 pad, 1 pad + blue water lily (nil manel), 2 pad + pink lotus. */
export function lilyHD(): HDSheet {
  return sheet(16, 14, 3, 8, 9, (c, f) => {
    softShadow(c, 8.6, 9.6, 6.4, 2.6, 0.3, '10,40,60');
    const pad = new Path2D(); pad.ellipse(8, 9, 6, 3.4, 0, 0.32, Math.PI * 2 - 0.05); pad.lineTo(8, 9); pad.closePath();
    fill(c, pad, rad(c, 8, 9, 6, [[0, '#8fd06a'], [0.5, '#4fa04a'], [1, '#2f7a3d']]), 0.4, INK_LEAF);
    c.strokeStyle = 'rgba(30,90,50,0.4)'; c.lineWidth = 0.2;
    for (let k = 0; k < 7; k++) { const a = 0.5 + (k / 7) * Math.PI * 1.8; c.beginPath(); c.moveTo(8, 9); c.lineTo(8 + Math.cos(a) * 5.4, 9 + Math.sin(a) * 3); c.stroke(); }
    if (f === 0) return;
    const p = f === 1 ? ['#5d48c0', '#9d89ee', '#e6defd'] : ['#c24e80', '#f08bb0', '#ffe0ec'];
    for (let layer = 0; layer < 3; layer++) for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + (k - 2.5) * (0.42 - layer * 0.06), len = 3.6 - layer * 0.8;
      const x = 8 + Math.cos(a) * len * 0.5, y = 6.4 + Math.sin(a) * len * 0.5 - layer * 0.3;
      c.fillStyle = lin(c, 0, y - 2, 0, y + 2, [[0, p[2]], [1, p[layer]]]); c.beginPath(); c.ellipse(x, y, 0.9, len * 0.55, a + Math.PI / 2, 0, Math.PI * 2); c.fill();
    }
    c.fillStyle = '#f6d24a'; c.beginPath(); c.arc(8, 6.3, 0.7, 0, Math.PI * 2); c.fill();
  });
}

// ---------------------------------------------------------------- rocks and small props
export function rockHD(size: 0 | 1 | 2, seed: number): HDSheet {
  const [w, h] = [[11, 8], [16, 12], [24, 17]][size];
  const fw = w + 2, fh = h + 2, cx = w / 2 + 1, cy = h / 2 + 1;
  return sheet(fw, fh, 1, Math.round(cx), h, (c) => {
    const R = rng(seed), p = new Path2D(), n = 14;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2, k = 0.82 + R() * 0.18;
      const x = cx + Math.cos(a) * (w / 2) * k, y = Math.min(h - 0.2, cy + Math.sin(a) * (h / 2) * k);
      if (i) p.lineTo(x, y); else p.moveTo(x, y);
    }
    p.closePath();
    fill(c, p, rad(c, cx, cy, Math.max(w, h) * 0.55, [[0, '#ddd6c4'], [0.4, '#aaa394'], [0.8, '#837c72'], [1, '#625c58']]), 0.5, 'rgba(52,46,56,0.95)');
    c.save(); c.clip(p);
    c.strokeStyle = 'rgba(60,54,60,0.35)'; c.lineWidth = 0.3;
    for (let k = 0; k < size + 2; k++) { const x = cx - w * 0.3 + R() * w * 0.6, y = cy - h * 0.2 + R() * h * 0.3; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 1.5 + R() * 2, y + 0.8 + R()); c.stroke(); }
    if (size > 0) { c.fillStyle = 'rgba(98,173,72,0.65)'; for (let k = 0; k < 3 + size * 2; k++) { c.beginPath(); c.arc(cx - w * 0.3 + R() * w * 0.4, cy - h * 0.35 + R() * h * 0.2, 0.5 + R() * 0.8, 0, Math.PI * 2); c.fill(); } }
    c.restore();
  });
}

export function fenceHD(): HDSheet {
  return sheet(34, 20, 1, 17, 18, (c) => {
    for (const y of [8, 13]) { const p = rr(1, y, 32, 2, 0.6); c.save(); c.clip(p); plank(c, 1, y, 32, 2, y); c.restore(); ink(c, p, 0.45); }
    for (const x of [2, 15, 28]) { const p = rr(x, 2.5, 4, 15.5, 1); c.save(); c.clip(p); plank(c, x, 2.5, 4, 15.5, x, true); c.restore(); ink(c, p, 0.45); }
  });
}

/** Flat walkway into the pond; `waterRows` is how far the deck runs over water (for its shadow). */
export function dockHD(waterRows: number): HDSheet {
  const W = 40, H = 112, x0 = 7, pw = 26;
  return sheet(W, H, 1, x0, 4, (c) => {
    c.fillStyle = 'rgba(12,44,74,0.32)'; c.beginPath(); c.roundRect(x0 + 2.5, 5, pw + 2, waterRows + 1, 2); c.fill();
    const deck = rr(x0, 3, pw, H - 7, 1);
    c.save(); c.clip(deck);
    for (let y = 3, i = 0; y < H - 4; y += 5, i++) {
      plank(c, x0, y, pw, 4.7, i);
      c.fillStyle = 'rgba(60,36,20,0.6)'; c.fillRect(x0, y + 4.7, pw, 0.3);
      for (const nx of [x0 + 2, x0 + pw - 2]) { c.fillStyle = '#5a3d27'; c.beginPath(); c.arc(nx, y + 2.4, 0.35, 0, Math.PI * 2); c.fill(); }
    }
    c.restore(); ink(c, deck, 0.55);
    for (const y of [2, 34, 66]) for (const x of [x0 - 4, x0 + pw]) {
      const p = rr(x, y, 4, 11, 1.2);
      fill(c, p, lin(c, x, 0, x + 4, 0, [[0, '#a8744a'], [0.4, WOOD[1]], [1, WOOD[0]]]), 0.45);
      fill(c, ell(x + 2, y + 0.8, 2, 0.8), '#c69862', 0.35);
      c.strokeStyle = 'rgba(240,253,247,0.75)'; c.lineWidth = 0.4; c.stroke(ell(x + 2, y + 11, 2.8, 0.7));
    }
    // coiled rope on the first post
    for (let k = 0; k < 3; k++) { c.strokeStyle = k % 2 ? '#b9a878' : '#e0d2a8'; c.lineWidth = 0.7; c.stroke(ell(x0 - 2, 7, 3 - k * 0.6, 1.2 - k * 0.2)); }
  });
}

export function basketHD(): HDSheet {
  return sheet(16, 15, 1, 8, 13, (c) => {
    const p = new Path2D(); p.moveTo(2, 4.4); p.lineTo(14, 4.4); p.quadraticCurveTo(14.4, 11, 12, 13); p.lineTo(4, 13); p.quadraticCurveTo(1.6, 11, 2, 4.4); p.closePath();
    c.save(); c.clip(p); c.fillStyle = lin(c, 2, 0, 14, 0, [[0, '#e0b56a'], [0.5, '#c99a52'], [1, '#8a6232']]); c.fillRect(0, 0, 16, 15);
    c.strokeStyle = 'rgba(110,70,30,0.6)'; c.lineWidth = 0.3;
    for (let y = 5.5; y < 13; y += 1.4) { c.beginPath(); for (let x = 2; x < 14; x += 1.4) { c.moveTo(x, y + ((x * 0.7) % 1.4 > 0.7 ? 0.5 : 0)); c.lineTo(x + 0.7, y + 0.5); } c.stroke(); }
    c.restore(); ink(c, p, 0.45);
    fill(c, ell(8, 4.4, 6.2, 1.5), '#e0b56a', 0.45); fill(c, ell(8, 4.4, 5, 1), '#5a3d27', 0);
    const fish = ell(7, 3.3, 2.2, 0.9, -0.3); fill(c, fish, lin(c, 0, 2.4, 0, 4.2, [[0, '#cfdbe3'], [1, '#7f8c9a']]), 0.35);
  });
}
export function crateHD(): HDSheet {
  return sheet(16, 16, 1, 8, 14, (c) => {
    const top = new Path2D(); top.moveTo(2, 6.4); top.lineTo(4, 2); top.lineTo(14, 2); top.lineTo(14, 6.4); top.closePath();
    fill(c, top, lin(c, 0, 2, 0, 6.4, [[0, '#d8ad74'], [1, '#b18452']]), 0.45);
    const front = rr(2, 6.4, 12, 7.6, 0.4); c.save(); c.clip(front); for (let i = 0; i < 3; i++) plank(c, 2, 6.4 + i * 2.55, 12, 2.5, i + 40); c.restore(); ink(c, front, 0.45);
    stroke(c, 3, 7, 13, 13.4, 'rgba(90,58,30,0.7)', 0.6);
    for (let k = 0; k < 3; k++) { c.strokeStyle = k % 2 ? '#b9a878' : '#e0d2a8'; c.lineWidth = 0.65; c.stroke(ell(8.6, 3.9, 3 - k * 0.7, 1.2 - k * 0.25)); }
  });
}
export function benchHD(): HDSheet {
  return sheet(28, 12, 1, 14, 11, (c) => {
    for (const x of [3, 22]) fill(c, rr(x, 5, 3, 6, 0.6), lin(c, x, 0, x + 3, 0, [[0, WOOD[2]], [1, WOOD[0]]]), 0.45);
    const seat = rr(1, 2, 26, 4, 1); c.save(); c.clip(seat); plank(c, 1, 2, 26, 4, 77); c.restore(); ink(c, seat, 0.5);
  });
}
export function potHD(): HDSheet {
  return sheet(12, 13, 1, 6, 12, (c) => {
    const p = new Path2D(); p.moveTo(4, 2.2); p.lineTo(8, 2.2); p.quadraticCurveTo(7.6, 3.6, 9.6, 5.6); p.quadraticCurveTo(12, 9.6, 8.6, 12); p.lineTo(3.4, 12); p.quadraticCurveTo(0, 9.6, 2.4, 5.6); p.quadraticCurveTo(4.4, 3.6, 4, 2.2); p.closePath();
    fill(c, p, rad(c, 5.6, 7.4, 5, [[0, '#f0a37a'], [0.45, '#c9653f'], [1, '#7a3220']]), 0.5);
    fill(c, ell(6, 2.2, 2.6, 0.9), '#d9774f', 0.4); fill(c, ell(6, 2.2, 1.8, 0.5), '#4a1e14', 0);
    c.strokeStyle = 'rgba(255,220,180,0.45)'; c.lineWidth = 0.35; c.beginPath(); c.ellipse(6, 7.6, 4.6, 1.2, 0, 0.2, Math.PI - 0.2); c.stroke();
  });
}
export function thambiliHD(): HDSheet {
  return sheet(20, 16, 1, 10, 15, (c) => {
    softShadow(c, 10.5, 14.4, 8.5, 1.6, 0.3);
    for (const [x, y] of [[8, 7], [13, 7], [5, 11], [11, 11], [15, 12]] as const) {
      fill(c, ell(x, y, 3, 3.1), rad(c, x, y, 3, [[0, '#ffd27a'], [0.45, '#e8922e'], [1, '#a8561a']]), 0.45);
      fill(c, ell(x + 0.2, y - 2.9, 0.9, 0.5), '#6b8a3a', 0.3);
    }
  });
}
function sackShape(c: Ctx, cx: number, cy: number, rx: number, ry: number, neckY: number) {
  const p = new Path2D();
  p.moveTo(cx - 1.6, neckY); p.quadraticCurveTo(cx - rx * 1.05, cy - ry * 0.2, cx - rx * 0.8, cy + ry * 0.75); p.quadraticCurveTo(cx, cy + ry * 1.1, cx + rx * 0.8, cy + ry * 0.75);
  p.quadraticCurveTo(cx + rx * 1.05, cy - ry * 0.2, cx + 1.6, neckY); p.closePath();
  c.save(); c.clip(p); c.fillStyle = rad(c, cx, cy, Math.max(rx, ry), [[0, '#ecdcae'], [0.45, '#c9b07a'], [1, '#8f7748']]); c.fillRect(cx - rx - 2, neckY - 2, rx * 2 + 4, ry * 3);
  c.strokeStyle = 'rgba(120,96,56,0.4)'; c.lineWidth = 0.22;
  for (let y = neckY; y < cy + ry * 1.2; y += 0.9) { c.beginPath(); c.moveTo(cx - rx - 1, y); c.lineTo(cx + rx + 1, y); c.stroke(); }
  c.restore(); ink(c, p, 0.5);
  fill(c, ell(cx, neckY + 0.4, 1.9, 0.7), '#8a6a3a', 0.35);
}
export function sackHD(): HDSheet { return sheet(14, 15, 1, 7, 14, (c) => sackShape(c, 7, 9, 5, 4.6, 3)); }
/** Sabapathi's sack of stolen fish, a tail poking out. */
export function lootHD(): HTMLCanvasElement {
  const [cv, c] = hdCanvas(13, 14);
  const tail = new Path2D(); tail.moveTo(8.4, 3.6); tail.lineTo(8.8, 1.2); tail.lineTo(10.6, 0.3); tail.lineTo(9.8, 2); tail.lineTo(10.4, 3.8); tail.closePath();
  fill(c, tail, lin(c, 8, 0, 11, 4, [[0, '#ffd08a'], [1, '#e8862e']]), 0.35);
  sackShape(c, 6.4, 9, 5, 4.4, 4);
  return cv;
}

export function canoeHD(): HDSheet {
  const W = 70, H = 26;
  return sheet(W, H, 1, 35, 18, (c) => {
    softShadow(c, 36, 22.6, 30, 2.6, 0.35, '10,40,70');
    // outrigger float and its booms
    for (const x of [24, 45]) { stroke(c, x, 3.4, x - 1, 13, INK, 1.4); stroke(c, x, 3.4, x - 1, 13, WOOD[1], 0.8); }
    fill(c, rr(15, 1.6, 40, 2.6, 1.3), lin(c, 0, 1.6, 0, 4.2, [[0, '#d8ad74'], [1, WOOD[1]]]), 0.45);
    // hull
    const hull = new Path2D(); hull.moveTo(2, 11.6); hull.lineTo(W - 2, 11.6); hull.quadraticCurveTo(W - 6, 21, W / 2, 22); hull.quadraticCurveTo(6, 21, 2, 11.6); hull.closePath();
    fill(c, hull, lin(c, 0, 11.6, 0, 22, [[0, '#b98a56'], [0.3, '#8b5e3c'], [1, '#3f281b']]), 0.55);
    c.save(); c.clip(hull); c.fillStyle = '#c0432f'; c.fillRect(0, 17.4, W, 1.1); c.fillStyle = 'rgba(255,240,200,0.5)'; c.fillRect(0, 12.2, W, 0.5); c.restore();
    fill(c, rr(9, 13.2, W - 18, 3.2, 1.4), '#3a2418', 0.35);
    for (const x of [20, 34, 48]) fill(c, rr(x, 13, 3, 3.6, 0.5), '#8b5e3c', 0.3);
    // paddle
    stroke(c, 28, 15.2, 42, 12, INK, 1.2); stroke(c, 28, 15.2, 42, 12, '#c69862', 0.6);
    fill(c, ell(44, 11.6, 2.4, 1.3, -0.2), lin(c, 42, 0, 46, 0, [[0, '#e0b983'], [1, '#a8744a']]), 0.4);
    c.strokeStyle = 'rgba(240,253,247,0.7)'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(6, 20.6); c.quadraticCurveTo(35, 23.4, W - 6, 20.6); c.stroke();
  });
}

// ---------------------------------------------------------------- Sabapathi's kade
export function shopHD(): HDSheet {
  const W = 128, H = 116;
  return sheet(W, H, 1, 64, 112, (c) => {
    // wall: lime plaster, warm and a little weathered
    const wall = rr(10, 54, 108, 54, 0.5);
    c.save(); c.clip(wall);
    c.fillStyle = lin(c, 10, 0, 118, 0, [[0, '#f6eed6'], [0.55, '#eadfbf'], [1, '#cdbf98']]); c.fillRect(10, 54, 108, 54);
    const R = rng(51);
    for (let k = 0; k < 40; k++) { c.fillStyle = `rgba(150,120,80,${0.04 + R() * 0.06})`; c.beginPath(); c.ellipse(12 + R() * 104, 60 + R() * 40, 2 + R() * 6, 1 + R() * 3, 0, 0, Math.PI * 2); c.fill(); }
    c.fillStyle = lin(c, 0, 92, 0, 100, [[0, 'rgba(140,110,70,0)'], [1, 'rgba(140,110,70,0.35)']]); c.fillRect(10, 92, 108, 8); // rain splash at the foot
    c.fillStyle = lin(c, 0, 54, 0, 62, [[0, 'rgba(60,40,40,0.45)'], [1, 'rgba(60,40,40,0)']]); c.fillRect(10, 54, 108, 8); // eave shadow
    c.restore(); ink(c, wall, 0.55);
    // red-oxide plinth
    fill(c, rr(10, 100, 108, 8, 0.5), lin(c, 0, 100, 0, 108, [[0, '#d0654a'], [0.3, '#b24a35'], [1, '#7a2e20']]), 0.5);

    // counter opening with shelves of tins
    fill(c, rr(15, 62, 62, 30, 0.6), lin(c, 0, 62, 0, 92, [[0, '#1d1418'], [1, '#3a2a30']]), 0.5);
    const tins = ['#e8433f', '#f6d24a', '#3aa5a5', '#f08bb0', '#62ad48', '#f2a65a', '#7a9be0', '#fff3d6'];
    for (const sy of [66, 76]) {
      fill(c, rr(17, sy + 6, 58, 1.2, 0.3), '#7a5637', 0.3);
      for (let x = 18; x < 73; x += 4) {
        const h = 3 + Math.floor(hash(x, sy, 2) * 3), col = tins[Math.floor(hash(x, sy, 3) * tins.length)];
        const p = rr(x, sy + 6 - h, 3, h, 0.5);
        fill(c, p, lin(c, x, 0, x + 3, 0, [[0, '#ffffff'], [0.25, col], [1, 'rgba(0,0,0,0.45)']]), 0.25);
      }
    }
    // hanging bananas and king coconuts
    stroke(c, 23.5, 62, 23.5, 65.5, '#6b8a3a', 0.5);
    for (let i = 0; i < 5; i++) fill(c, ell(23.5 + (i % 2) * 0.8, 66 + i * 1.9, 3.4, 1, 0.1), lin(c, 0, 65 + i * 2, 0, 67 + i * 2, [[0, '#fbf0a0'], [1, '#c9a52a']]), 0.3);
    stroke(c, 68.5, 62, 68.5, 65, '#6b8a3a', 0.5);
    for (const [x, y] of [[66, 67], [71, 67], [68.5, 71]] as const) fill(c, ell(x, y, 2.4, 2.4), rad(c, x, y, 2.4, [[0, '#ffd27a'], [0.5, '#e8922e'], [1, '#a8561a']]), 0.35);
    // counter top, front and sweet jars
    fill(c, rr(13, 88, 66, 4, 0.8), lin(c, 0, 88, 0, 92, [[0, '#e8c290'], [1, '#a8744a']]), 0.45);
    const front = rr(14, 92, 64, 8, 0.4); c.save(); c.clip(front); for (let x = 14, i = 0; x < 78; x += 8, i++) plank(c, x, 92, 8, 8, 60 + i, true); c.restore(); ink(c, front, 0.45);
    for (const x of [20, 30, 62]) {
      const jar = rr(x, 80, 7, 8, 1.4);
      fill(c, jar, lin(c, x, 0, x + 7, 0, [[0, 'rgba(255,255,255,0.95)'], [0.3, 'rgba(207,238,240,0.85)'], [1, 'rgba(140,190,200,0.85)']]), 0.4);
      for (let k = 0; k < 7; k++) { c.fillStyle = tins[(x + k) % tins.length]; c.beginPath(); c.arc(x + 1.4 + (k % 4) * 1.4, 83.5 + Math.floor(k / 4) * 1.6 + (k % 2) * 0.5, 0.6, 0, Math.PI * 2); c.fill(); }
      fill(c, rr(x - 0.3, 78, 7.6, 2.2, 0.8), lin(c, 0, 78, 0, 80.2, [[0, '#ff8a70'], [1, '#b3261e']]), 0.35);
    }
    fill(c, rr(44, 84.6, 12, 3.4, 1), lin(c, 0, 84.6, 0, 88, [[0, '#a8dc6a'], [1, '#3f7f30']]), 0.35); // betel leaves
    // striped awning with a scalloped edge
    for (let i = 0; i < 14; i++) {
      const x = 11 + i * 5, red = i % 2 === 0;
      const p = new Path2D(); p.moveTo(x, 55); p.lineTo(x + 5, 55); p.lineTo(x + 5, 60.5); p.quadraticCurveTo(x + 2.5, 63.2, x, 60.5); p.closePath();
      fill(c, p, lin(c, 0, 55, 0, 62, red ? [[0, '#f0705f'], [1, '#a82d2a']] : [[0, '#ffffff'], [1, '#d8c8a6']]), 0.35);
    }
    // the door: teal, with a lantern above
    fill(c, rr(86, 62, 26, 46, 0.6), WOOD[0], 0.5);
    fill(c, rr(88, 64, 22, 44, 0.4), lin(c, 0, 64, 0, 108, [[0, '#1d1418'], [1, '#4a3830']]), 0);
    const leafDoor = rr(88, 64, 7.4, 44, 0.4);
    fill(c, leafDoor, lin(c, 88, 0, 95.4, 0, [[0, '#58c4b8'], [0.3, '#2f9a94'], [1, '#1f6f70']]), 0.4);
    for (const [y, h] of [[68, 12], [84, 14]] as const) fill(c, rr(89.6, y, 4, h, 0.5), '#258580', 0.3);
    fill(c, ell(93.4, 86, 0.6, 0.6), '#f6d24a', 0);
    softShadow(c, 100, 61.5, 6, 4.5, 0.55, '255,214,106');
    fill(c, rr(98, 59.6, 4, 4.4, 1), lin(c, 0, 59.6, 0, 64, [[0, '#fff6c8'], [1, '#e6a53a']]), 0.4);
    fill(c, rr(84, 108, 30, 4, 0.6), lin(c, 0, 108, 0, 112, [[0, '#d8d2c0'], [1, '#7d766c']]), 0.45); // step
    // little poster
    fill(c, rr(79, 68, 6, 9, 0.4), '#f6d24a', 0.35); fill(c, rr(80, 69, 4, 3, 0.3), '#e8433f', 0);
    stroke(c, 80, 73.6, 84, 73.6, '#3a2418', 0.5); stroke(c, 80, 75.4, 83, 75.4, '#3a2418', 0.5);

    // clay-tiled roof (ulu): rows of half-round tiles
    const roof = new Path2D(); roof.moveTo(20, 6); roof.lineTo(108, 6); roof.lineTo(126, 54); roof.lineTo(2, 54); roof.closePath();
    c.save(); c.clip(roof);
    c.fillStyle = lin(c, 0, 6, 0, 54, [[0, '#d0654a'], [1, '#8f3524']]); c.fillRect(0, 0, W, 56);
    for (let row = 0; row < 10; row++) {
      const y = 6 + row * 4.8, off = (row % 2) * 3;
      for (let x = -6 + off; x < W + 6; x += 6) {
        const shade = hash(Math.floor(x / 6), row, 4) < 0.14 ? 0.82 : 1, sun = x < 60 ? 1.06 : 0.94;
        const k = shade * sun;
        c.fillStyle = lin(c, 0, y, 0, y + 4.8, [[0, `rgb(${Math.min(255, 238 * k)},${Math.min(255, 135 * k)},${Math.min(255, 96 * k)})`], [0.5, `rgb(${201 * k},${87 * k},${58 * k})`], [1, `rgb(${120 * k},${40 * k},${28 * k})`]]);
        c.beginPath(); c.roundRect(x + 0.2, y, 5.6, 4.9, [2.6, 2.6, 0.6, 0.6]); c.fill();
      }
    }
    c.fillStyle = lin(c, 100, 0, 126, 0, [[0, 'rgba(60,20,20,0)'], [1, 'rgba(60,20,20,0.45)']]); c.fillRect(100, 0, 28, 56); // the shaded east slope
    c.restore(); ink(c, roof, 0.6);
    fill(c, rr(18, 2.6, 92, 3.6, 1.6), lin(c, 0, 2.6, 0, 6.2, [[0, '#f6c39a'], [1, '#b84a31']]), 0.5); // ridge
    fill(c, rr(2, 52.8, 124, 2.2, 0.6), '#6d2619', 0.4); // eave board
    // the sign board
    const label = 'SABAPATHI STORES';
    c.font = '800 7px Nunito, "Segoe UI", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
    const sw = c.measureText(label).width + 12, sx = 64 - sw / 2;
    fill(c, rr(sx, 37.6, sw, 13.4, 1.6), '#1f6f70', 0.55);
    fill(c, rr(sx + 1.2, 38.8, sw - 2.4, 11, 1), lin(c, 0, 38.8, 0, 49.8, [[0, '#fff3a0'], [0.5, '#f6d24a'], [1, '#d9a92a']]), 0);
    c.fillStyle = '#7a1c14'; c.fillText(label, 64.4, 44.8); c.fillStyle = '#c0302a'; c.fillText(label, 64, 44.3);
    for (const x of [sx + 3, sx + sw - 3]) fill(c, ell(x, 44.3, 0.8, 0.8), '#e8433f', 0);
  });
}

// ---------------------------------------------------------------- the gear stall, the fish bag, signs
/** The fishing-gear stall (maalu lella) beside the main dock. */
export function lellaHD(): HDSheet {
  const W = 46, H = 42;
  return sheet(W, H, 1, 23, 39, (c) => {
    for (const x of [4, 39]) fill(c, rr(x, 11, 3, 28, 0.8), lin(c, x, 0, x + 3, 0, [[0, WOOD[3]], [1, WOOD[0]]]), 0.45);
    // table and front
    fill(c, rr(5, 26, 36, 4, 0.8), lin(c, 0, 26, 0, 30, [[0, '#e8c290'], [1, '#a8744a']]), 0.45);
    const front = rr(6, 30, 34, 9, 0.4); c.save(); c.clip(front); for (let x = 6, i = 0; x < 40; x += 7, i++) plank(c, x, 30, 7, 9, 20 + i, true); c.restore(); ink(c, front, 0.45);
    // ice box of fish
    fill(c, rr(9, 19, 16, 7, 1), lin(c, 9, 0, 25, 0, [[0, '#ffffff'], [0.4, '#e9f6f8'], [1, '#9cc9cf']]), 0.45);
    for (const [x, col] of [[12, '#7f8c9a'], [17, '#f2a65a'], [21.5, '#c9a23a']] as const) fill(c, ell(x, 21.6, 2.3, 0.9, -0.2), lin(c, 0, 20.6, 0, 22.6, [[0, '#ffffff'], [0.4, col], [1, col]]), 0.3);
    // scales
    stroke(c, 33.5, 18.6, 33.5, 25.6, '#4d5a66', 0.6); stroke(c, 30, 21.8, 37, 21.8, '#4d5a66', 0.6);
    for (const x of [30.5, 36.5]) fill(c, ell(x, 23.8, 1.8, 0.8), lin(c, 0, 23, 0, 24.6, [[0, '#ffffff'], [1, '#9fb0bd']]), 0.3);
    // striped awning, blue and cream, scalloped
    for (let i = 0; i < 9; i++) {
      const x = 1 + i * 5, blue = i % 2 === 0;
      const p = new Path2D(); p.moveTo(x, 3); p.lineTo(x + 5, 3); p.lineTo(x + 5, 11); p.quadraticCurveTo(x + 2.5, 13.6, x, 11); p.closePath();
      fill(c, p, lin(c, 0, 3, 0, 13, blue ? [[0, '#6fb7f0'], [1, '#215a8a']] : [[0, '#ffffff'], [1, '#d8c8a6']]), 0.35);
    }
    // a fish-shaped sign
    fill(c, rr(17, 13, 12, 6, 1.2), lin(c, 0, 13, 0, 19, [[0, '#fff3a0'], [1, '#e0b02a']]), 0.4);
    const f = new Path2D(); f.ellipse(22, 16, 3, 1.4, 0, 0, Math.PI * 2); f.moveTo(24.6, 16); f.lineTo(26.6, 14.4); f.lineTo(26.6, 17.6); f.closePath(); fill(c, f, '#b3261e', 0);
  });
}

/** The fish bag on its pallet. Frames: empty, some fish, bulging. */
export function bagHD(): HDSheet {
  return sheet(30, 30, 3, 15, 27, (c, f) => {
    // pallet
    fill(c, rr(2, 24, 26, 3, 0.6), lin(c, 0, 24, 0, 27, [[0, '#d8ad74'], [1, WOOD[1]]]), 0.45);
    for (const x of [4, 23]) fill(c, rr(x, 26.6, 3, 2.2, 0.4), WOOD[0], 0.35);
    const top = f === 0 ? 14 : f === 1 ? 10 : 7, rx = f === 0 ? 9 : f === 1 ? 10 : 11;
    // tails peeking out of a full bag
    const tail = (x: number, col: string, rot: number) => {
      c.save(); c.translate(x, top + 0.5); c.rotate(rot);
      const p = new Path2D(); p.moveTo(-1, 1); p.lineTo(-1, -2.6); p.lineTo(-2.4, -4.6); p.lineTo(0, -3.4); p.lineTo(2.4, -4.6); p.lineTo(1, -2.6); p.lineTo(1, 1); p.closePath();
      fill(c, p, lin(c, 0, -4.6, 0, 1, [[0, '#ffffff'], [0.3, col], [1, col]]), 0.35); c.restore();
    };
    if (f > 0) tail(12.6, '#7f8c9a', -0.25);
    if (f > 1) { tail(17.6, '#f2a65a', 0.3); tail(15, '#c9a23a', 0.05); }
    // the sack
    const p = new Path2D();
    p.moveTo(15 - rx * 0.55, top); p.quadraticCurveTo(15 - rx * 1.2, top + (24 - top) * 0.55, 15 - rx * 0.92, 24.4); p.lineTo(15 + rx * 0.92, 24.4);
    p.quadraticCurveTo(15 + rx * 1.2, top + (24 - top) * 0.55, 15 + rx * 0.55, top); p.closePath();
    c.save(); c.clip(p);
    c.fillStyle = rad(c, 15, (top + 24) / 2, rx * 1.1, [[0, '#ecdcae'], [0.5, '#c9b07a'], [1, '#8a7046']]); c.fillRect(0, top - 1, 30, 26);
    c.strokeStyle = 'rgba(120,96,56,0.35)'; c.lineWidth = 0.2; for (let y = top; y < 25; y += 0.9) { c.beginPath(); c.moveTo(0, y); c.lineTo(30, y); c.stroke(); }
    // stencilled fish on the front
    fill(c, rr(11, 16.6, 8, 5.4, 1), 'rgba(47,127,184,0.85)', 0);
    const sf = new Path2D(); sf.ellipse(14.4, 19.3, 2, 1, 0, 0, Math.PI * 2); sf.moveTo(16.2, 19.3); sf.lineTo(17.6, 18.2); sf.lineTo(17.6, 20.4); sf.closePath(); fill(c, sf, '#f6ead0', 0);
    c.restore(); ink(c, p, 0.55);
    fill(c, ell(15, top, rx * 0.62, 1.4), lin(c, 0, top - 1.4, 0, top + 1.4, [[0, '#f4e6be'], [1, '#c9b07a']]), 0.4);
    fill(c, ell(15, top + 0.2, rx * 0.42, 0.7), '#4a3a2c', 0);
  });
}

/** Zone signposts: frame 0 green (one fish), 1 amber (two), 2 red (three). */
export function signHD(): HDSheet {
  const band = ['#62ad48', '#f2a63a', '#e8433f'];
  return sheet(20, 22, 3, 10, 20, (c, f) => {
    softShadow(c, 11, 20, 4, 1.2, 0.3);
    fill(c, rr(9, 9, 2, 11.4, 0.6), lin(c, 9, 0, 11, 0, [[0, WOOD[3]], [1, WOOD[0]]]), 0.4);
    const board = rr(2, 2, 16, 9, 1.4); c.save(); c.clip(board); plank(c, 2, 2, 16, 9, 90 + f); c.fillStyle = band[f]; c.fillRect(2, 2, 16, 2.4); c.restore(); ink(c, board, 0.5);
    for (let k = 0; k <= f; k++) {
      const x = 4 + k * 5 - (f === 0 ? -5 : f === 1 ? -2 : 0) + 1.4;
      const p = new Path2D(); p.ellipse(x, 7, 1.6, 0.9, 0, 0, Math.PI * 2); p.moveTo(x + 1.3, 7); p.lineTo(x + 2.6, 6); p.lineTo(x + 2.6, 8); p.closePath(); fill(c, p, '#3a2418', 0);
    }
  });
}
/** A dead stump standing in the swamp. */
export function stumpHD(): HDSheet {
  return sheet(14, 18, 1, 7, 14, (c) => {
    c.strokeStyle = 'rgba(240,253,247,0.6)'; c.lineWidth = 0.4; c.stroke(ell(7, 14.4, 6, 1.1)); c.strokeStyle = 'rgba(240,253,247,0.3)'; c.stroke(ell(7, 15.6, 4.6, 0.8));
    const p = new Path2D(); p.moveTo(3, 14); p.lineTo(4, 3); p.lineTo(5.4, 1.8); p.lineTo(6, 3.4); p.lineTo(8, 0.8); p.lineTo(9.6, 3); p.lineTo(10, 14); p.closePath();
    fill(c, p, lin(c, 3, 0, 10, 0, [[0, '#8a6e52'], [0.4, '#5a4636'], [1, '#2e241e']]), 0.5, 'rgba(25,22,30,0.95)');
    stroke(c, 9, 6, 12.4, 2.6, 'rgba(25,22,30,0.95)', 1.5); stroke(c, 9, 6, 12.4, 2.6, '#5a4636', 0.8);
    for (const [x, y] of [[5, 8], [6, 9.4]] as const) fill(c, ell(x, y, 0.8, 0.6), '#62ad48', 0);
  });
}
/** The SHOP board above the gear stall. Frame 1 is lit (the player is in range). */
export function shopSignHD(): HDSheet {
  return sheet(50, 22, 2, 25, 20, (c, f) => {
    const lit = f === 1;
    for (const x of [9, 39]) fill(c, rr(x, 14, 2, 6, 0.4), WOOD[1], 0.35);
    if (lit) softShadow(c, 25, 9, 26, 10, 0.45, '255,236,150');
    fill(c, rr(2, 2, 46, 14, 2.4), lit ? '#fff3a0' : '#f6ead0', 0.55);
    fill(c, rr(3.4, 3.4, 43.2, 11.2, 1.6), lin(c, 0, 3.4, 0, 14.6, lit ? [[0, '#9fd4f5'], [0.4, '#3a93cf'], [1, '#215a8a']] : [[0, '#6fb7f0'], [0.4, '#2f7fb8'], [1, '#1a4a72']]), 0);
    // a cast net
    c.strokeStyle = '#f6d24a'; c.lineWidth = 0.6; c.stroke(ell(10, 8.4, 3.4, 3));
    c.strokeStyle = 'rgba(246,234,208,0.8)'; c.lineWidth = 0.25; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(10 + k * 1.3 - 2, 5.6); c.lineTo(10 + k * 1.3 + 2, 11.2); c.stroke(); c.beginPath(); c.moveTo(10 + k * 1.3 + 2, 5.6); c.lineTo(10 + k * 1.3 - 2, 11.2); c.stroke(); }
    stroke(c, 7.4, 11, 5.4, 13, '#f6d24a', 0.6);
    c.font = '900 8.5px Nunito, "Segoe UI", sans-serif'; c.textBaseline = 'middle'; c.textAlign = 'center';
    c.fillStyle = '#12324d'; c.fillText('SHOP', 30.6, 9.6); c.fillStyle = lit ? '#ffffff' : '#fff3d6'; c.fillText('SHOP', 30, 9);
  });
}

// ---------------------------------------------------------------- small creatures
/** A white egret standing in the shallows; frame 1 has its head up. */
export function egretHD(): HDSheet {
  return sheet(16, 22, 2, 9, 19, (c, f) => {
    c.strokeStyle = 'rgba(240,253,247,0.7)'; c.lineWidth = 0.4; c.stroke(ell(9, 19.6, 4, 0.8));
    for (const x of [8, 10]) stroke(c, x, 13.4, x, 19.4, '#3a3340', 0.5);
    const body = new Path2D(); body.moveTo(5.4, 11); body.quadraticCurveTo(7, 7.6, 11, 9.2); body.quadraticCurveTo(15.6, 11, 15, 12.6); body.quadraticCurveTo(10, 14.8, 6.4, 13); body.closePath();
    fill(c, body, lin(c, 0, 8, 0, 14, [[0, '#ffffff'], [0.6, '#f2efe4'], [1, '#c9c6ba']]), 0.45);
    const n = f;
    const neck = new Path2D(); neck.moveTo(6.4, 11); neck.bezierCurveTo(4.2, 9, 6.8, 7, 5.6, 4.6 + n); neck.lineTo(6.8, 4.4 + n); neck.bezierCurveTo(8, 7, 5.8, 9, 7.6, 10.6); neck.closePath();
    fill(c, neck, '#f7f4ea', 0.4);
    fill(c, ell(6.4, 3.8 + n, 1.6, 1.2), '#ffffff', 0.4);
    const beak = new Path2D(); beak.moveTo(5, 3.6 + n); beak.lineTo(1.6, 4.4 + n); beak.lineTo(5, 4.4 + n); beak.closePath(); fill(c, beak, '#f2a93a', 0.3);
    fill(c, ell(6.6, 3.5 + n, 0.35, 0.35), '#2b1b2e', 0);
  });
}
/** Four colours of butterfly, two wing frames each (rows = colours). */
export function butterflyHD(): HDSheet {
  const FW = 8, FH = 6, cols = [['#f6d24a', '#fff3a0'], ['#fff8ea', '#d8e8ff'], ['#6fb7f0', '#bfe3ff'], ['#f2843a', '#ffc27a']];
  const [canvas, c] = hdCanvas(FW * 2, FH * 4);
  cols.forEach(([a, b], r) => {
    for (let f = 0; f < 2; f++) {
      const ox = f * FW, oy = r * FH, sq = f ? 0.35 : 1;
      c.save(); c.translate(ox + 4, oy + 3);
      for (const s of [-1, 1]) {
        const w = new Path2D(); w.ellipse(s * 1.9 * sq, -0.6, 1.8 * sq, 1.5, 0, 0, Math.PI * 2); w.ellipse(s * 1.4 * sq, 1, 1.2 * sq, 1, 0, 0, Math.PI * 2);
        c.fillStyle = lin(c, 0, -2, 0, 2, [[0, b], [1, a]]); c.fill(w);
      }
      fill(c, ell(0, 0.2, 0.4, 1.6), '#2b1b2e', 0);
      c.restore();
    }
  });
  return { canvas, fw: FW, fh: FH, ox: 4, oy: 3 };
}
export function dragonflyHD(): HDSheet {
  return sheet(10, 5, 2, 5, 2, (c, f) => {
    c.fillStyle = 'rgba(230,248,255,0.7)';
    const sp = f ? 0.5 : 1.6;
    for (const x of [3.6, 5.6]) { c.beginPath(); c.ellipse(x, 2.5 - sp * 0.6, 1, sp * 0.6, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.ellipse(x, 2.5 + sp * 0.6, 1, sp * 0.6, 0, 0, Math.PI * 2); c.fill(); }
    stroke(c, 1.6, 2.5, 9, 2.5, '#e8433f', 0.7);
    fill(c, ell(1.6, 2.5, 0.8, 0.7), '#2b1b2e', 0);
  });
}
export function leafHD(): HDSheet {
  return sheet(4, 3, 2, 2, 1.5, (c, f) => {
    c.save(); c.translate(2, 1.5); c.rotate(f ? 1.2 : 0.2);
    fill(c, ell(0, 0, 1.6, 0.7), lin(c, 0, -0.7, 0, 0.7, [[0, '#e0a84c'], [1, '#a85f2a']]), 0);
    stroke(c, -1.3, 0, 1.3, 0, 'rgba(255,220,150,0.6)', 0.18);
    c.restore();
  });
}
