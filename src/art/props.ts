import { PAL } from '../config/game';
import { Ctx, makeCanvas, rect, px, ellipse, line, hash, vnoise, bayer, outline, rng } from './px';
import { drawText, textWidth } from './font';

const OL = PAL.outline;
const OL_LEAF = '#17332a';
const LEAF = PAL.leaf;
const WOOD = PAL.wood;

export interface Sheet { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number; }
// ox / oy = origin (the point that sits on the ground) inside one frame.

// ---------------------------------------------------------------- foliage helpers
/** Lobed, lit foliage mass built from overlapping circles. */
function foliage(ctx: Ctx, blobs: [number, number, number][], seed: number, fruit?: string) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [cx, cy, r] of blobs) { x0 = Math.min(x0, cx - r); y0 = Math.min(y0, cy - r); x1 = Math.max(x1, cx + r); y1 = Math.max(y1, cy + r); }
  for (let y = Math.floor(y0); y <= y1; y++) {
    for (let x = Math.floor(x0); x <= x1; x++) {
      let best = -1, bi = -1;
      for (let i = 0; i < blobs.length; i++) {
        const [cx, cy, r] = blobs[i];
        const v = 1 - Math.hypot(x - cx, (y - cy) * 1.08) / r;
        if (v > best) { best = v; bi = i; }
      }
      if (best < 0 || (best < 0.07 && hash(x, y, seed) < 0.4)) continue;
      const [cx, cy, r] = blobs[bi];
      const n = ((cx - x) * 0.62 + (cy - y) * 0.86) / r; // light from the upper-left
      let v = 0.48 + n * 0.5 + (vnoise(x, y, 4, seed) - 0.5) * 0.42 + (bayer(x, y) - 0.5) * 0.14;
      if (best < 0.16) v -= 0.2;
      const tone = v < 0.26 ? 0 : v < 0.46 ? 1 : v < 0.68 ? 2 : v < 0.9 ? 3 : 4;
      px(ctx, x, y, LEAF[tone]);
      if (fruit && best > 0.25 && n < 0.1 && hash(x, y, seed + 9) < 0.012) { rect(ctx, x, y, 2, 2, fruit); px(ctx, x, y, '#ffe08a'); }
    }
  }
}

// ---------------------------------------------------------------- trees
export function palmSheet(king: boolean, seed: number): Sheet {
  const FW = 76, FH = 92;
  const [c, ctx] = makeCanvas(FW * 3, FH);
  const lean = hash(seed, 1) < 0.5 ? -1 : 1;
  for (let f = 0; f < 3; f++) {
    const sway = f - 1;
    const bx = f * FW + 38, by = FH - 3;
    const topX = bx + lean * 9 + sway * 0.6, topY = by - 58;
    // fronds behind the trunk first
    const fronds: [number, number][] = [[-178, 27], [-2, 27], [-150, 25], [-30, 25], [-118, 22], [-62, 22], [-90, 17], [158, 20], [22, 20]];
    const drawFrond = (deg: number, len: number, back: boolean) => {
      const a = (deg * Math.PI) / 180;
      const dx = Math.cos(a), dy = Math.sin(a);
      const tipX = topX + dx * len + sway * (1.4 + Math.abs(dx)), tipY = topY + dy * len + len * 0.42;
      const cxp = topX + dx * len * 0.55 + sway * 0.6, cyp = topY + dy * len * 0.55 - 7;
      const steps = Math.ceil(len * 1.6);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        const x = u * u * topX + 2 * u * t * cxp + t * t * tipX;
        const y = u * u * topY + 2 * u * t * cyp + t * t * tipY;
        const L = Math.round(1 + 5.5 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35));
        for (let k = 1; k <= L; k++) {
          const col = back ? (k < 3 ? LEAF[1] : LEAF[0]) : k === 1 ? LEAF[3] : k < 4 ? LEAF[2] : LEAF[1];
          if ((Math.round(x) + k) % 3 !== 0 || k < 3) px(ctx, x + (dx > 0 ? 0.3 : -0.3) * k, y + k, col);
        }
        px(ctx, x, y - 1, back ? LEAF[2] : LEAF[4]);
        px(ctx, x, y, back ? LEAF[1] : LEAF[3]);
      }
    };
    drawFrond(fronds[7][0], fronds[7][1], true);
    drawFrond(fronds[8][0], fronds[8][1], true);
    // trunk
    for (let i = 0; i <= 58; i++) {
      const t = i / 58;
      const x = bx + lean * 9 * t * t + sway * 0.6 * t * t;
      const y = by - i;
      const w = i < 3 ? 6 : t < 0.5 ? 4 : 3;
      const xl = Math.round(x - w / 2);
      rect(ctx, xl, y, w, 1, i % 4 === 0 ? '#6f5238' : '#9a7650');
      px(ctx, xl, y, i % 4 === 0 ? '#8a6a48' : '#bb986c');
      px(ctx, xl + w - 1, y, '#65492f');
    }
    for (let i = 0; i < 7; i++) drawFrond(fronds[i][0], fronds[i][1], false);
    // nuts
    const nut = king ? ['#e8922e', '#ffc45a', '#b9661c'] : ['#6b8a3a', '#9fb84e', '#4a6a2c'];
    for (const [nx, ny] of [[-3, 3], [2, 4], [-1, 7], [4, 1]] as const) {
      ellipse(ctx, topX + nx, topY + ny, 2, 2, nut[0]);
      px(ctx, topX + nx - 1, topY + ny - 1, nut[1]); px(ctx, topX + nx + 1, topY + ny + 1, nut[2]);
    }
    rect(ctx, topX - 2, topY - 2, 4, 3, LEAF[1]);
  }
  outline(c, OL_LEAF);
  return { canvas: c, fw: FW, fh: FH, ox: 38, oy: FH - 3 };
}

export function treeSheet(seed: number): Sheet {
  const W = 84, H = 96;
  const [c, ctx] = makeCanvas(W, H);
  const bx = 42, by = H - 3;
  // trunk with roots
  for (let y = 56; y <= by; y++) {
    const flare = y > by - 5 ? by - 5 - y : 0;
    const xl = bx - 4 + flare, w = 8 - flare * 2;
    rect(ctx, xl, y, w, 1, '#7a5637');
    rect(ctx, xl, y, 2, 1, '#9a7148'); rect(ctx, xl + w - 3, y, 3, 1, '#5a3d27');
    if (hash(3, y, seed) < 0.3) px(ctx, bx, y, '#5a3d27');
  }
  line(ctx, bx - 3, 62, bx - 10, 54, '#7a5637'); line(ctx, bx + 3, 60, bx + 11, 52, '#5a3d27');
  const j = (n: number) => (hash(n, seed, 4) - 0.5) * 6;
  foliage(ctx, [
    [42 + j(1), 34, 24], [24 + j(2), 44 + j(3), 16], [60 + j(4), 44 + j(5), 16], [30, 24 + j(6), 15],
    [54, 22 + j(7), 15], [42, 52, 17], [16, 52, 10], [68, 52, 10],
  ], seed, hash(seed, 8) < 0.5 ? '#f2b33d' : undefined);
  outline(c, OL_LEAF);
  return { canvas: c, fw: W, fh: H, ox: bx, oy: by };
}

export function bushSheet(flower: boolean, seed: number): Sheet {
  const W = 34, H = 26;
  const [c, ctx] = makeCanvas(W, H);
  foliage(ctx, [[17, 14, 10], [9, 17, 7], [25, 17, 7], [14, 10, 6], [22, 10, 6]], seed);
  if (flower) {
    const R = rng(seed);
    const kind = R() < 0.5 ? ['#e8433f', '#ff8a70'] : ['#fff3d6', '#f6d24a'];
    for (let i = 0; i < 6; i++) {
      const x = 6 + Math.floor(R() * 22), y = 7 + Math.floor(R() * 13);
      rect(ctx, x - 1, y, 3, 1, kind[0]); rect(ctx, x, y - 1, 1, 3, kind[0]); px(ctx, x, y, kind[1]);
    }
  }
  outline(c, OL_LEAF);
  return { canvas: c, fw: W, fh: H, ox: 17, oy: H - 2 };
}

export function bananaSheet(seed: number): Sheet {
  const W = 48, H = 56;
  const [c, ctx] = makeCanvas(W, H);
  const bx = 24, by = H - 3, top = 26;
  const leaf = (deg: number, len: number, wid: number, droop: number) => {
    const a = (deg * Math.PI) / 180, dx = Math.cos(a), dy = Math.sin(a);
    const cxp = bx + dx * len * 0.55, cyp = top + dy * len * 0.75 - 3;
    const tx = bx + dx * len, ty = top + dy * len * 0.55 + droop;
    let lx = bx, ly = top;
    const N = len * 3;
    for (let i = 1; i <= N; i++) {
      const t = i / N, u = 1 - t;
      const x = u * u * bx + 2 * u * t * cxp + t * t * tx, y = u * u * top + 2 * u * t * cyp + t * t * ty;
      const gx = x - lx, gy = y - ly, gl = Math.hypot(gx, gy) || 1;
      const nx = -gy / gl, ny = gx / gl;
      lx = x; ly = y;
      const w = wid * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.55);
      for (let k = -w; k <= w; k += 0.5) {
        if (Math.abs(k) > w * 0.5 && hash(Math.round(t * 7), k > 0 ? 1 : 0, seed + deg) < 0.16) continue; // wind-torn edges
        const up = k * ny < 0 || (Math.abs(ny) < 0.3 && k * nx < 0);
        px(ctx, x + nx * k, y + ny * k, Math.abs(k) > w - 0.8 ? LEAF[1] : up ? LEAF[3] : LEAF[2]);
      }
      px(ctx, x, y, '#c5e06a');
    }
  };
  leaf(-170, 19, 4.5, 16); leaf(-10, 19, 4.5, 16);
  for (let y = top; y <= by; y++) {
    const w = y > by - 4 ? 6 : 4;
    rect(ctx, bx - w / 2, y, w, 1, '#8fae4a'); px(ctx, bx - w / 2, y, '#b4cf63'); px(ctx, bx + w / 2 - 1, y, '#5f7f36');
    if (y % 6 === 0) rect(ctx, bx - w / 2, y, w, 1, '#7a6a3a');
  }
  leaf(-135, 20, 4.5, 6); leaf(-45, 20, 4.5, 6); leaf(-100, 21, 4, -6); leaf(-76, 17, 3.5, -4);
  // banana comb
  for (let i = 0; i < 4; i++) { rect(ctx, bx + 4 + (i % 2), 33 + i * 2, 4, 2, '#e6cf4a'); px(ctx, bx + 4 + (i % 2), 33 + i * 2, '#f8ec8a'); }
  rect(ctx, bx + 5, 41, 2, 3, '#8a3a5a');
  outline(c, OL_LEAF);
  return { canvas: c, fw: W, fh: H, ox: bx, oy: by };
}

export function reedsSheet(): Sheet {
  const FW = 20, FH = 28;
  const [c, ctx] = makeCanvas(FW * 2, FH);
  for (let f = 0; f < 2; f++) {
    const o = f * FW;
    const stalks: [number, number, number, boolean][] = [[4, 17, -2, false], [7, 23, -1, true], [10, 19, 0, false], [13, 24, 1, true], [16, 15, 2, false]];
    for (const [x, h, tilt, head] of stalks) {
      const tip = tilt + (f ? 1 : 0);
      for (let i = 0; i < h; i++) {
        const t = i / h;
        px(ctx, o + x + tip * t * t, FH - 3 - i, i % 5 === 4 ? LEAF[3] : LEAF[2]);
      }
      if (head) { rect(ctx, o + x + tip - (tip > 0 ? 0 : 0), FH - 3 - h, 2, 5, '#6b4226'); px(ctx, o + x + tip, FH - 3 - h, '#8f5d34'); }
      else { px(ctx, o + x + tip + 1, FH - 2 - h, LEAF[3]); }
    }
    rect(ctx, o + 3, FH - 3, 5, 1, 'rgba(233,251,241,0.7)'); rect(ctx, o + 11, FH - 2, 6, 1, 'rgba(233,251,241,0.5)');
  }
  outline(c, OL_LEAF);
  return { canvas: c, fw: FW, fh: FH, ox: 10, oy: FH - 3 };
}

export function lilySheet(): Sheet {
  // frames: 0 pad, 1 pad + nil manel (blue water lily), 2 pad + pink lotus
  const FW = 16, FH = 14;
  const [c, ctx] = makeCanvas(FW * 3, FH);
  for (let f = 0; f < 3; f++) {
    const o = f * FW;
    ellipse(ctx, o + 8, 9, 6, 3.4, '#2f7a3d');
    ellipse(ctx, o + 8, 8.6, 5, 2.6, '#4fa04a');
    rect(ctx, o + 4, 7, 4, 1, '#7cc65a'); px(ctx, o + 5, 8, '#7cc65a');
    ctx.clearRect(o + 11, 9, 4, 1); ctx.clearRect(o + 12, 8, 3, 1); // notch
    if (f > 0) {
      const p = f === 1 ? ['#7a63d6', '#b9a8f5', '#e6defd'] : ['#d85f92', '#f59ac0', '#ffd9e8'];
      rect(ctx, o + 5, 5, 7, 2, p[0]); rect(ctx, o + 6, 3, 5, 3, p[1]); rect(ctx, o + 7, 2, 3, 2, p[2]);
      px(ctx, o + 4, 4, p[1]); px(ctx, o + 12, 4, p[1]); px(ctx, o + 8, 1, p[1]);
      rect(ctx, o + 7, 5, 3, 1, '#f6d24a'); px(ctx, o + 8, 4, '#fff3a0');
    }
  }
  return { canvas: c, fw: FW, fh: FH, ox: 8, oy: 9 };
}

// ---------------------------------------------------------------- rocks & small props
export function rockSheet(size: 0 | 1 | 2, seed: number): Sheet {
  const dims = [[11, 8], [16, 12], [24, 17]][size];
  const [c, ctx] = makeCanvas(dims[0] + 2, dims[1] + 2);
  const cx = dims[0] / 2 + 1, cy = dims[1] / 2 + 1, rx = dims[0] / 2, ry = dims[1] / 2;
  for (let y = 0; y < dims[1] + 2; y++) for (let x = 0; x < dims[0] + 2; x++) {
    const e = Math.hypot((x - cx) / rx, (y - cy) / ry) + (vnoise(x, y, 4, seed) - 0.5) * 0.35;
    if (e > 1 || y > dims[1] - 1) continue;
    const n = ((cx - x) / rx) * 0.5 + ((cy - y) / ry) * 0.8 + (hash(x, y, seed) - 0.5) * 0.25;
    px(ctx, x, y, n > 0.55 ? '#cfc8b6' : n > 0.1 ? '#aaa394' : n > -0.4 ? '#8a8378' : '#6b6560');
    if (n > 0.45 && hash(x, y, seed + 1) < 0.18 && size > 0) px(ctx, x, y, LEAF[3]);
  }
  outline(c, '#3a3340');
  return { canvas: c, fw: dims[0] + 2, fh: dims[1] + 2, ox: Math.round(cx), oy: dims[1] };
}

export function fenceSheet(): Sheet {
  const [c, ctx] = makeCanvas(34, 20);
  rect(ctx, 1, 8, 32, 2, WOOD[2]); rect(ctx, 1, 8, 32, 1, WOOD[3]);
  rect(ctx, 1, 13, 32, 2, WOOD[1]); rect(ctx, 1, 13, 32, 1, WOOD[2]);
  for (const x of [2, 15, 28]) {
    rect(ctx, x, 3, 4, 15, WOOD[1]); rect(ctx, x, 3, 1, 15, WOOD[3]); rect(ctx, x + 3, 3, 1, 15, WOOD[0]);
    rect(ctx, x, 2, 4, 1, WOOD[3]);
  }
  outline(c, OL);
  return { canvas: c, fw: 34, fh: 20, ox: 17, oy: 18 };
}

export function dockSheet(waterRows: number): Sheet {
  // Flat sprite: planks run top (deep water) to bottom (land). Posts stick out the sides.
  const W = 40, H = 112;
  const [c, ctx] = makeCanvas(W, H);
  const x0 = 7, pw = 26;
  // shadow on the water
  rect(ctx, x0 + 3, 4, pw + 2, waterRows + 2, 'rgba(12,44,74,0.38)');
  for (let y = 4; y < H - 4; y += 5) {
    const tint = hash(1, y, 9);
    const mid = tint < 0.33 ? '#b0814f' : tint < 0.66 ? '#a8794a' : '#b98a56';
    rect(ctx, x0, y, pw, 5, mid);
    rect(ctx, x0, y, pw, 1, '#cfa26a');
    rect(ctx, x0, y + 4, pw, 1, '#7d5632');
    const split = x0 + 6 + Math.floor(hash(2, y, 9) * 14);
    rect(ctx, split, y + 1, 1, 3, '#8a6038');
    px(ctx, x0 + 2, y + 2, '#6e4628'); px(ctx, x0 + pw - 3, y + 2, '#6e4628');
    if (hash(3, y, 9) < 0.35) rect(ctx, x0 + 8 + Math.floor(hash(4, y, 9) * 10), y + 2, 3, 1, '#9a6f44');
  }
  rect(ctx, x0, 3, pw, 1, '#cfa26a');
  // mooring posts
  for (const y of [2, 34, 66]) {
    for (const x of [x0 - 4, x0 + pw]) {
      rect(ctx, x, y, 4, 11, WOOD[0]); rect(ctx, x, y, 4, 3, '#a8744a'); rect(ctx, x, y, 1, 11, WOOD[1]);
      rect(ctx, x, y + 11, 4, 1, 'rgba(233,251,241,0.7)');
    }
  }
  // rope coil on the first post
  rect(ctx, x0 - 5, 6, 6, 2, '#e0d2a8'); rect(ctx, x0 - 5, 7, 6, 1, '#b9a878');
  outline(c, OL);
  return { canvas: c, fw: W, fh: H, ox: x0, oy: 4 };
}

export function bucketSheet(): Sheet {
  const [c, ctx] = makeCanvas(16, 17);
  for (let y = 5; y < 15; y++) {
    const inset = Math.floor((y - 5) / 5);
    rect(ctx, 2 + inset, y, 12 - inset * 2, 1, '#9fb0bd');
    px(ctx, 2 + inset, y, '#cfdbe3'); rect(ctx, 11 - inset, y, 3, 1, '#70818f');
  }
  rect(ctx, 2, 8, 12, 1, '#5f6f7d'); rect(ctx, 3, 12, 10, 1, '#5f6f7d');
  ellipse(ctx, 8, 5, 6, 2, '#cfdbe3'); ellipse(ctx, 8, 5, 5, 1.2, '#3aa5a5');
  rect(ctx, 6, 4, 3, 1, '#86dcc6');
  // a tail poking out
  rect(ctx, 9, 2, 2, 3, '#f2a65a'); px(ctx, 11, 1, '#f2a65a'); px(ctx, 8, 1, '#ffd08a');
  line(ctx, 2, 5, 4, 1, '#4d5a66'); line(ctx, 4, 1, 11, 0, '#4d5a66'); line(ctx, 12, 1, 14, 5, '#4d5a66');
  outline(c, OL);
  return { canvas: c, fw: 16, fh: 17, ox: 8, oy: 15 };
}

export function stonesSheet(): Sheet {
  const [c, ctx] = makeCanvas(20, 12);
  for (const [x, y, r] of [[5, 8, 3], [11, 8, 3.4], [15, 9, 2.4], [8, 5, 2.6], [12, 4, 2]] as const) {
    ellipse(ctx, x, y, r, r * 0.8, '#8a8378'); ellipse(ctx, x - 0.6, y - 0.6, r * 0.6, r * 0.45, '#b6af9f');
    px(ctx, x - 1, y - 1, '#d8d2c0');
  }
  outline(c, '#3a3340');
  return { canvas: c, fw: 20, fh: 12, ox: 10, oy: 11 };
}

export function basketSheet(): Sheet {
  const [c, ctx] = makeCanvas(16, 15);
  for (let y = 4; y < 13; y++) {
    const bulge = y < 6 ? 1 : y > 10 ? 1 : 0;
    for (let x = 2 + bulge; x < 14 - bulge; x++) px(ctx, x, y, (x + y) % 2 ? '#c99a52' : '#a87a3a');
    px(ctx, 2 + bulge, y, '#e0b56a');
  }
  rect(ctx, 2, 3, 12, 2, '#e0b56a'); rect(ctx, 3, 4, 10, 1, '#5a3d27');
  rect(ctx, 5, 2, 3, 2, '#9fb0bd'); px(ctx, 9, 3, '#cfdbe3'); // fish glint
  outline(c, OL);
  return { canvas: c, fw: 16, fh: 15, ox: 8, oy: 13 };
}

export function crateSheet(): Sheet {
  const [c, ctx] = makeCanvas(16, 16);
  rect(ctx, 2, 2, 12, 5, WOOD[3]); rect(ctx, 2, 7, 12, 7, WOOD[2]);
  rect(ctx, 2, 6, 12, 1, WOOD[0]); rect(ctx, 5, 7, 1, 7, WOOD[1]); rect(ctx, 10, 7, 1, 7, WOOD[1]);
  rect(ctx, 2, 13, 12, 1, WOOD[0]); rect(ctx, 4, 3, 8, 1, WOOD[2]);
  // coiled rope on top
  ellipse(ctx, 8, 3, 3, 1.4, '#e0d2a8'); px(ctx, 8, 3, '#b9a878');
  outline(c, OL);
  return { canvas: c, fw: 16, fh: 16, ox: 8, oy: 14 };
}

export function benchSheet(): Sheet {
  const [c, ctx] = makeCanvas(28, 12);
  rect(ctx, 1, 2, 26, 4, WOOD[2]); rect(ctx, 1, 2, 26, 1, WOOD[3]); rect(ctx, 1, 5, 26, 1, WOOD[0]);
  rect(ctx, 3, 6, 3, 5, WOOD[1]); rect(ctx, 22, 6, 3, 5, WOOD[1]);
  outline(c, OL);
  return { canvas: c, fw: 28, fh: 12, ox: 14, oy: 11 };
}

export function potSheet(): Sheet {
  const [c, ctx] = makeCanvas(12, 13);
  ellipse(ctx, 6, 8, 4.6, 3.8, '#b9563a'); ellipse(ctx, 5, 7, 2.5, 2, '#d9774f');
  rect(ctx, 4, 2, 4, 2, '#b9563a'); rect(ctx, 3, 1, 6, 1, '#d9774f'); rect(ctx, 4, 2, 4, 1, '#5a2a1e');
  px(ctx, 4, 6, '#f0a37a');
  outline(c, OL);
  return { canvas: c, fw: 12, fh: 13, ox: 6, oy: 12 };
}

export function thambiliSheet(): Sheet {
  const [c, ctx] = makeCanvas(20, 16);
  for (const [x, y] of [[5, 11], [11, 11], [15, 12], [8, 7], [13, 7]] as const) {
    ellipse(ctx, x, y, 3, 3, '#e8922e'); px(ctx, x - 1, y - 2, '#ffd27a'); px(ctx, x - 2, y - 1, '#ffc45a'); px(ctx, x + 1, y + 2, '#b9661c');
    px(ctx, x, y - 3, '#6b8a3a');
  }
  outline(c, OL);
  return { canvas: c, fw: 20, fh: 16, ox: 10, oy: 15 };
}

export function sackSheet(): Sheet {
  const [c, ctx] = makeCanvas(14, 15);
  ellipse(ctx, 7, 9, 5, 4.6, '#c9b07a'); ellipse(ctx, 6, 8, 3, 2.6, '#e0cc98');
  rect(ctx, 5, 2, 4, 3, '#c9b07a'); rect(ctx, 5, 4, 4, 1, '#8a6a3a');
  for (let y = 7; y < 13; y += 2) px(ctx, 9, y, '#a89060');
  outline(c, OL);
  return { canvas: c, fw: 14, fh: 15, ox: 7, oy: 14 };
}

export function canoeSheet(): Sheet {
  // Oruwa: a slim outrigger canoe, drawn flat on the water.
  const W = 70, H = 26;
  const [c, ctx] = makeCanvas(W, H);
  rect(ctx, 8, 22, 56, 2, 'rgba(12,44,74,0.35)');
  // outrigger float + booms
  rect(ctx, 16, 2, 38, 2, WOOD[2]); rect(ctx, 16, 2, 38, 1, WOOD[3]); px(ctx, 15, 3, WOOD[2]); px(ctx, 54, 3, WOOD[2]);
  for (const x of [24, 45]) { line(ctx, x, 4, x - 1, 9, WOOD[1]); line(ctx, x - 1, 9, x, 14, WOOD[1]); }
  // hull
  for (let y = 12; y < 22; y++) {
    const t = (y - 12) / 9;
    const inset = Math.round(6 * Math.pow(t, 2.2)) + (y === 12 ? 1 : 0);
    rect(ctx, 4 + inset, y, W - 8 - inset * 2, 1, y < 14 ? '#a8744a' : y < 19 ? '#6e4628' : '#4f3220');
  }
  rect(ctx, 9, 14, W - 18, 3, '#3a2418');
  for (const x of [20, 34, 48]) rect(ctx, x, 14, 3, 3, '#8b5e3c');
  rect(ctx, 2, 11, 5, 2, '#a8744a'); rect(ctx, W - 7, 11, 5, 2, '#a8744a');
  rect(ctx, 12, 18, W - 26, 1, '#c0432f'); // painted stripe
  line(ctx, 28, 15, 42, 12, '#c69862'); // paddle
  rect(ctx, 42, 11, 4, 3, '#c69862');
  outline(c, OL);
  return { canvas: c, fw: W, fh: H, ox: 35, oy: 18 };
}

// ---------------------------------------------------------------- Sabapathi's kade
export function shopSheet(): Sheet {
  const W = 128, H = 116;
  const [c, ctx] = makeCanvas(W, H);
  const R = PAL.roof;
  // --- wall
  rect(ctx, 10, 54, 108, 54, '#eadfbf');
  for (let y = 54; y < 100; y++) for (let x = 10; x < 118; x++) {
    const n = vnoise(x, y, 7, 5);
    if (n > 0.72) px(ctx, x, y, '#f4ecd2'); else if (n < 0.24 || y > 96 - n * 6) px(ctx, x, y, '#d6c7a0');
  }
  rect(ctx, 10, 54, 108, 5, '#b3a47f'); rect(ctx, 10, 59, 108, 1, '#c9ba94'); // eave shadow
  rect(ctx, 10, 100, 108, 8, '#b24a35'); rect(ctx, 10, 100, 108, 1, '#d0654a'); rect(ctx, 10, 106, 108, 2, '#8a3526'); // red-oxide plinth
  rect(ctx, 112, 54, 6, 54, 'rgba(60,40,60,0.18)');

  // --- counter opening
  rect(ctx, 15, 62, 62, 30, '#33252b');
  rect(ctx, 15, 62, 62, 1, WOOD[0]); rect(ctx, 15, 62, 1, 30, WOOD[0]); rect(ctx, 76, 62, 1, 30, WOOD[0]);
  const tins = ['#e8433f', '#f6d24a', '#3aa5a5', '#f08bb0', '#62ad48', '#f2a65a', '#7a9be0', '#fff3d6'];
  for (const sy of [66, 76]) {
    rect(ctx, 17, sy + 6, 58, 1, '#7a5637');
    for (let x = 18; x < 73; x += 4) {
      const h = 3 + Math.floor(hash(x, sy, 2) * 3);
      const col = tins[Math.floor(hash(x, sy, 3) * tins.length)];
      rect(ctx, x, sy + 6 - h, 3, h, col); px(ctx, x, sy + 6 - h, '#ffffff');
      rect(ctx, x + 2, sy + 6 - h, 1, h, 'rgba(0,0,0,0.25)');
    }
  }
  rect(ctx, 16, 63, 60, 3, 'rgba(0,0,0,0.3)');
  // counter
  rect(ctx, 13, 88, 66, 4, '#c69862'); rect(ctx, 13, 88, 66, 1, '#e0b983'); rect(ctx, 13, 91, 66, 1, WOOD[0]);
  rect(ctx, 14, 92, 64, 8, WOOD[1]);
  for (let x = 20; x < 78; x += 8) rect(ctx, x, 92, 1, 8, WOOD[0]);
  rect(ctx, 14, 92, 64, 1, '#5a3a22');
  // sweet jars
  for (const x of [20, 30, 62]) {
    rect(ctx, x, 80, 7, 8, '#cfeef0'); rect(ctx, x, 80, 1, 8, '#ffffff'); rect(ctx, x + 6, 80, 1, 8, '#9cc9cf');
    rect(ctx, x, 78, 7, 2, '#e8433f'); rect(ctx, x + 1, 78, 3, 1, '#ff8a70');
    for (let k = 0; k < 6; k++) px(ctx, x + 1 + (k % 5), 83 + ((k * 3) % 5), tins[(x + k) % tins.length]);
  }
  rect(ctx, 44, 85, 12, 3, '#62ad48'); rect(ctx, 45, 84, 10, 1, '#8fcb55'); // betel leaves tray
  // hanging banana comb + king coconuts
  rect(ctx, 23, 62, 1, 4, '#6b8a3a');
  for (let i = 0; i < 5; i++) { rect(ctx, 20 + (i % 2), 65 + i * 2, 7, 2, '#f0d34a'); rect(ctx, 20 + (i % 2), 65 + i * 2, 2, 1, '#fbf0a0'); px(ctx, 26 + (i % 2), 66 + i * 2, '#b9951f'); }
  rect(ctx, 68, 62, 1, 3, '#6b8a3a');
  for (const [x, y] of [[66, 67], [70, 67], [68, 71]] as const) { ellipse(ctx, x, y, 2.4, 2.4, '#e8922e'); px(ctx, x - 1, y - 1, '#ffd27a'); }
  // awning
  for (let x = 11; x < 81; x++) {
    const red = Math.floor((x - 11) / 5) % 2 === 0;
    const drop = (x - 11) % 5 === 0 || (x - 11) % 5 === 4 ? 6 : 7;
    rect(ctx, x, 55, 1, drop, red ? '#d6453d' : '#f6ead0');
    px(ctx, x, 55, red ? '#f0705f' : '#ffffff'); px(ctx, x, 55 + drop - 1, red ? '#9c2d2a' : '#cfc0a0');
  }
  // --- door
  rect(ctx, 86, 62, 26, 46, WOOD[0]);
  rect(ctx, 88, 64, 22, 44, '#2a1f24'); rect(ctx, 88, 98, 22, 10, '#4a3830'); rect(ctx, 88, 96, 22, 2, '#3a2c2c');
  rect(ctx, 88, 64, 7, 44, '#2f9a94'); rect(ctx, 88, 64, 1, 44, '#58c4b8'); rect(ctx, 94, 64, 1, 44, '#1f6f70');
  rect(ctx, 90, 68, 3, 12, '#258580'); rect(ctx, 90, 84, 3, 14, '#258580'); px(ctx, 93, 86, '#f6d24a');
  rect(ctx, 98, 60, 4, 4, '#ffd76a'); px(ctx, 99, 61, '#fff6c8'); rect(ctx, 99, 58, 2, 2, WOOD[0]); // lantern
  rect(ctx, 84, 108, 30, 4, '#aaa394'); rect(ctx, 84, 108, 30, 1, '#cfc8b6'); rect(ctx, 84, 111, 30, 1, '#7d766c');
  // little poster between counter and door
  rect(ctx, 79, 68, 6, 9, '#f6d24a'); rect(ctx, 80, 69, 4, 3, '#e8433f'); rect(ctx, 80, 73, 4, 1, '#3a2418'); rect(ctx, 80, 75, 3, 1, '#3a2418');

  // --- tiled roof (ulu)
  for (let y = 6; y < 54; y++) {
    const t = (y - 6) / 48;
    const xl = Math.round(20 - 18 * t), xr = Math.round(108 + 18 * t);
    const row = Math.floor((y - 6) / 5), ry = (y - 6) % 5;
    for (let x = xl; x <= xr; x++) {
      const tx = (x + (row % 2) * 3) % 6;
      let col: string = (x * 0.4 + y) < 62 ? R[2] : R[1];
      if (ry === 0) col = R[3]; else if (ry === 4) col = R[0];
      if (tx === 0 && ry !== 0) col = R[0];
      if (hash(Math.floor((x + (row % 2) * 3) / 6), row, 4) < 0.14 && ry > 0 && ry < 4 && tx !== 0) col = '#a8452f';
      if (x > xr - 5) col = ry === 0 ? R[1] : R[0];
      px(ctx, x, y, col);
    }
  }
  rect(ctx, 18, 3, 92, 3, '#e9a070'); rect(ctx, 18, 3, 92, 1, '#f6c39a'); rect(ctx, 18, 5, 92, 1, R[1]);
  rect(ctx, 2, 53, 124, 2, '#6d2619');
  // --- sign board
  const label = 'SABAPATHI STORES';
  const sw = textWidth(label) + 10, sx = Math.round(64 - sw / 2);
  rect(ctx, sx, 38, sw, 13, '#1f6f70'); rect(ctx, sx + 1, 39, sw - 2, 11, '#f6d24a');
  rect(ctx, sx + 1, 39, sw - 2, 1, '#fff3a0'); rect(ctx, sx + 1, 49, sw - 2, 1, '#d9a92a');
  drawText(ctx, label, sx + 5, 42, '#b3261e');
  px(ctx, sx + 2, 44, '#e8433f'); px(ctx, sx + sw - 3, 44, '#e8433f');
  outline(c, OL);
  return { canvas: c, fw: W, fh: H, ox: 64, oy: 112 };
}

// ---------------------------------------------------------------- creatures & fx
export function egretSheet(): Sheet {
  const FW = 16, FH = 22;
  const [c, ctx] = makeCanvas(FW * 2, FH);
  for (let f = 0; f < 2; f++) {
    const o = f * FW, n = f;
    line(ctx, o + 8, 14, o + 8, 19, '#3a3340'); line(ctx, o + 10, 14, o + 10, 19, '#3a3340');
    ellipse(ctx, o + 9, 11, 4, 3, '#f7f4ea'); rect(ctx, o + 10, 12, 4, 2, '#d8d6cc'); px(ctx, o + 14, 12, '#f7f4ea');
    line(ctx, o + 6, 9, o + 5, 5 + n, '#f7f4ea'); line(ctx, o + 5, 5 + n, o + 6, 3 + n, '#f7f4ea');
    rect(ctx, o + 5, 2 + n, 3, 2, '#f7f4ea'); rect(ctx, o + 2, 3 + n, 3, 1, '#f2a93a'); px(ctx, o + 6, 2 + n, '#2b1b2e');
    rect(ctx, o + 6, 20, 6, 1, 'rgba(233,251,241,0.7)');
  }
  outline(c, OL);
  return { canvas: c, fw: FW, fh: FH, ox: 9, oy: 19 };
}

export function fishSheet(): Sheet {
  // frames 0-1 dark shadow fish, 2-3 golden one
  const FW = 16, FH = 8;
  const [c, ctx] = makeCanvas(FW * 4, FH);
  for (let f = 0; f < 4; f++) {
    const o = f * FW, gold = f > 1, flip = f % 2;
    const body = gold ? '#c9703a' : '#0f3e5c', hi = gold ? '#e89a55' : '#16506f';
    ellipse(ctx, o + 6, 4, 5, 2.2, body); rect(ctx, o + 3, 3, 5, 1, hi);
    rect(ctx, o + 11, 3 + (flip ? 1 : -1), 2, 2, body); rect(ctx, o + 13, 2 + (flip ? 2 : -1), 2, 3, body);
  }
  return { canvas: c, fw: FW, fh: FH, ox: 8, oy: 4 };
}

export function butterflySheet(): Sheet {
  // 4 colours x 2 frames
  const FW = 8, FH = 6;
  const cols = [['#f6d24a', '#fff3a0'], ['#fff8ea', '#d8e8ff'], ['#6fb7f0', '#bfe3ff'], ['#f2843a', '#ffc27a']];
  const [c, ctx] = makeCanvas(FW * 2, FH * 4);
  cols.forEach(([a, b], r) => {
    const y = r * FH;
    rect(ctx, 1, y + 1, 2, 3, a); rect(ctx, 5, y + 1, 2, 3, a); px(ctx, 1, y + 1, b); px(ctx, 6, y + 1, b); rect(ctx, 3, y + 1, 2, 4, '#2b1b2e'); px(ctx, 0, y + 2, a); px(ctx, 7, y + 2, a);
    rect(ctx, FW + 2, y + 1, 1, 3, a); rect(ctx, FW + 5, y + 1, 1, 3, a); rect(ctx, FW + 3, y + 1, 2, 4, '#2b1b2e');
  });
  return { canvas: c, fw: FW, fh: FH, ox: 4, oy: 3 };
}

export function dragonflySheet(): Sheet {
  const FW = 10, FH = 5;
  const [c, ctx] = makeCanvas(FW * 2, FH);
  for (let f = 0; f < 2; f++) {
    const o = f * FW;
    rect(ctx, o + 1, 2, 8, 1, '#e8433f'); px(ctx, o + 1, 2, '#2b1b2e');
    if (f === 0) { rect(ctx, o + 2, 0, 3, 2, 'rgba(255,255,255,0.75)'); rect(ctx, o + 2, 3, 3, 2, 'rgba(255,255,255,0.75)'); }
    else { rect(ctx, o + 2, 1, 3, 1, 'rgba(255,255,255,0.75)'); rect(ctx, o + 2, 3, 3, 1, 'rgba(255,255,255,0.75)'); }
  }
  return { canvas: c, fw: FW, fh: FH, ox: 5, oy: 2 };
}

export function sparkleSheet(): Sheet {
  const [c, ctx] = makeCanvas(15, 5);
  px(ctx, 2, 2, '#fff6c8');
  rect(ctx, 6, 2, 3, 1, '#fff6c8'); rect(ctx, 7, 1, 1, 3, '#fff6c8'); px(ctx, 7, 2, '#ffffff');
  rect(ctx, 10, 2, 5, 1, '#fff6c8'); rect(ctx, 12, 0, 1, 5, '#fff6c8'); rect(ctx, 11, 1, 3, 3, '#ffffff');
  return { canvas: c, fw: 5, fh: 5, ox: 2, oy: 2 };
}

export function ringSheet(): Sheet {
  const FW = 24, FH = 12;
  const [c, ctx] = makeCanvas(FW * 4, FH);
  for (let f = 0; f < 4; f++) {
    const rx = 3 + f * 2.6, ry = 1.2 + f * 1.1;
    const a = [0.9, 0.7, 0.45, 0.22][f];
    for (let i = 0; i < 64; i++) {
      const t = (i / 64) * Math.PI * 2;
      if (f > 1 && i % 4 === 0) continue;
      px(ctx, f * FW + 12 + Math.cos(t) * rx, 6 + Math.sin(t) * ry, `rgba(220,250,240,${a})`);
    }
  }
  return { canvas: c, fw: FW, fh: FH, ox: 12, oy: 6 };
}

export function puffSheet(): Sheet {
  const FW = 10, FH = 10;
  const [c, ctx] = makeCanvas(FW * 4, FH);
  const col = ['rgba(232,214,170,0.9)', 'rgba(232,214,170,0.7)', 'rgba(232,214,170,0.45)', 'rgba(232,214,170,0.25)'];
  for (let f = 0; f < 4; f++) {
    const o = f * FW;
    if (f === 0) ellipse(ctx, o + 5, 6, 2, 1.5, col[0]);
    if (f === 1) { ellipse(ctx, o + 4, 5, 2.4, 2, col[1]); ellipse(ctx, o + 7, 6, 1.5, 1.2, col[1]); }
    if (f === 2) { ellipse(ctx, o + 3, 4, 2, 1.6, col[2]); ellipse(ctx, o + 7, 5, 1.6, 1.3, col[2]); px(ctx, o + 5, 2, col[2]); }
    if (f === 3) { px(ctx, o + 2, 3, col[3]); px(ctx, o + 7, 4, col[3]); px(ctx, o + 5, 1, col[3]); px(ctx, o + 3, 5, col[3]); }
  }
  return { canvas: c, fw: FW, fh: FH, ox: 5, oy: 7 };
}

export function leafSheet(): Sheet {
  const [c, ctx] = makeCanvas(8, 3);
  rect(ctx, 0, 1, 3, 1, '#c98a3a'); px(ctx, 1, 0, '#e0a84c');
  rect(ctx, 5, 0, 1, 3, '#c98a3a'); px(ctx, 6, 1, '#e0a84c');
  return { canvas: c, fw: 4, fh: 3, ox: 2, oy: 1 };
}


// ---------------------------------------------------------------- fishing
export function catchSheet(kinds: { colors: [string, string, string] }[]): Sheet {
  const FW = 16, FH = 11;
  const [c, ctx] = makeCanvas(FW * kinds.length, FH);
  kinds.forEach((k, i) => {
    const o = i * FW, [back, belly, fin] = k.colors;
    ellipse(ctx, o + 7, 5, 5.4, 3.2, back);
    rect(ctx, o + 3, 6, 8, 2, belly); rect(ctx, o + 4, 8, 5, 1, belly);
    rect(ctx, o + 3, 3, 6, 1, 'rgba(255,255,255,0.35)');
    rect(ctx, o + 12, 3, 1, 5, fin); rect(ctx, o + 13, 2, 1, 7, fin); px(ctx, o + 14, 1, fin); px(ctx, o + 14, 9, fin);
    rect(ctx, o + 6, 1, 3, 1, fin); rect(ctx, o + 7, 9, 2, 1, fin);
    px(ctx, o + 3, 4, '#ffffff'); px(ctx, o + 4, 4, OL);
  });
  outline(c, OL);
  return { canvas: c, fw: FW, fh: FH, ox: 8, oy: 5 };
}

export function bobberSheet(): Sheet {
  // frame 0 floating, frame 1 pulled under
  const [c, ctx] = makeCanvas(14, 8);
  rect(ctx, 2, 1, 3, 2, '#e8433f'); rect(ctx, 2, 3, 3, 2, '#fff8ea'); px(ctx, 2, 1, '#ff8a70'); px(ctx, 3, 0, OL);
  rect(ctx, 0, 5, 7, 1, 'rgba(233,251,241,0.8)');
  rect(ctx, 9, 4, 3, 1, '#e8433f'); rect(ctx, 7, 5, 7, 1, 'rgba(233,251,241,0.9)'); px(ctx, 8, 6, 'rgba(233,251,241,0.7)'); px(ctx, 12, 6, 'rgba(233,251,241,0.7)');
  return { canvas: c, fw: 7, fh: 8, ox: 3, oy: 5 };
}

export function bangCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(11, 15);
  rect(ctx, 1, 1, 9, 10, '#f6d24a'); rect(ctx, 2, 0, 7, 12, '#f6d24a'); rect(ctx, 4, 12, 3, 1, '#f6d24a'); px(ctx, 5, 13, '#f6d24a');
  rect(ctx, 2, 1, 6, 1, '#fff3a0');
  rect(ctx, 5, 2, 2, 5, '#b3261e'); rect(ctx, 5, 8, 2, 2, '#b3261e');
  outline(c, OL);
  return c;
}

export function dropCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(2, 2);
  rect(ctx, 0, 0, 2, 2, '#d9f7ee'); px(ctx, 1, 1, '#86dcc6');
  return c;
}

// ---------------------------------------------------------------- crocodile + combat
export const CROC_FW = 42;
export const CROC_FH = 20;
/** Frames: 0-1 swim (eyes and ridge only), 2-3 walk, 4 jaws open (telegraph), 5 lunge, 6 stunned. Faces left. */
export function crocSheet(G: string[] = ['#3c5f2a', '#567f36', '#6f9a42', '#8fb857'], BELLY = '#cfd29a'): Sheet {
  const [c, ctx] = makeCanvas(CROC_FW * 7, CROC_FH);
  const body = (x: CanvasRenderingContext2D, mode: 'walk' | 'open' | 'lunge' | 'stun', leg: number) => {
    const sx = mode === 'lunge' ? -2 : 0;
    // tail
    for (let i = 0; i < 14; i++) { const th = Math.max(1, Math.round(5 - i * 0.36)); rect(x, 27 + i, 12 - th / 2 + (mode === 'lunge' ? 0 : Math.round(Math.sin(i / 3 + leg * 3) * 1)), 1, th, i % 3 === 0 ? G[0] : G[1]); }
    // legs
    if (mode !== 'lunge') for (const [lx, ph] of [[15, 0], [25, 1]] as const) {
      const o = (leg + ph) % 2 === 0 ? -1 : 1;
      rect(x, lx + o, 14, 3, 3, G[1]); rect(x, lx + o - 1, 16, 4, 1, G[0]);
    }
    // trunk
    ellipse(x, 21 + sx, 11.5, 9, 4.6, G[2]);
    rect(x, 13 + sx, 13, 17, 2, BELLY); rect(x, 15 + sx, 15, 12, 1, '#a9ad78');
    for (let i = 13; i < 30; i += 2) { px(x, i + sx, 7, G[0]); px(x, i + sx + 1, 6, G[0]); }
    rect(x, 14 + sx, 8, 14, 1, G[3]);
    // head
    const open = mode === 'open' || mode === 'lunge';
    rect(x, 3 + sx, 11, 11, 3, G[2]); rect(x, 3 + sx, 13, 11, 1, BELLY); // lower jaw
    if (open) {
      rect(x, 4 + sx, 7, 9, 4, '#b3261e'); rect(x, 5 + sx, 9, 6, 2, '#e8635a');
      for (let i = 0; i < 10; i++) rect(x, 13 + sx - i, 7 - Math.round(i * 0.45), 1, 3, i < 2 ? G[1] : G[2]); // raised upper jaw
      for (const tx of [4, 6, 8, 10]) { px(x, tx + sx, 10, '#ffffff'); px(x, tx + sx, 6 - Math.round((13 - tx) * 0.45) + 3, '#ffffff'); }
      rect(x, 12 + sx, 4, 3, 2, G[3]); px(x, 13 + sx, 5, '#f6d24a'); px(x, 13 + sx, 4, '#2b1b2e');
    } else {
      rect(x, 3 + sx, 8, 11, 3, G[2]); rect(x, 3 + sx, 8, 10, 1, G[3]); px(x, 3 + sx, 7, G[1]); // snout + nostril
      rect(x, 3 + sx, 11, 10, 1, G[0]);
      for (const tx of [4, 6, 8]) px(x, tx + sx, 11, '#ffffff');
      rect(x, 11 + sx, 6, 3, 2, G[3]);
      if (mode === 'stun') { px(x, 11 + sx, 6, '#2b1b2e'); px(x, 13 + sx, 6, '#2b1b2e'); px(x, 12 + sx, 7, '#2b1b2e'); }
      else { px(x, 12 + sx, 7, '#f6d24a'); px(x, 12 + sx, 6, '#2b1b2e'); }
    }
  };
  const frame = (i: number, mode: 'walk' | 'open' | 'lunge' | 'stun', leg: number) => {
    const [f, fx] = makeCanvas(CROC_FW, CROC_FH);
    body(fx, mode, leg);
    outline(f, OL);
    ctx.drawImage(f, i * CROC_FW, 0);
  };
  frame(2, 'walk', 0); frame(3, 'walk', 1); frame(4, 'open', 0); frame(5, 'lunge', 0); frame(6, 'stun', 0);
  // swim frames: only what breaks the surface
  for (let i = 0; i < 2; i++) {
    const [f, fx] = makeCanvas(CROC_FW, CROC_FH);
    body(fx, 'walk', i);
    fx.clearRect(0, 10, CROC_FW, CROC_FH);
    fx.clearRect(27, 0, CROC_FW, CROC_FH);
    for (let k = 30; k < 38; k += 3) px(fx, k, 9 - ((k + i) % 2), G[0]); // tail ridge
    outline(f, '#17332a');
    rect(fx, 2 + i, 10, 12, 1, 'rgba(233,251,241,0.8)'); rect(fx, 16 - i, 10, 14, 1, 'rgba(233,251,241,0.6)'); rect(fx, 31 + i, 10, 8, 1, 'rgba(233,251,241,0.5)');
    ctx.drawImage(f, i * CROC_FW, 0);
  }
  return { canvas: c, fw: CROC_FW, fh: CROC_FH, ox: 21, oy: 16 };
}

export function lootCanvas(): HTMLCanvasElement {
  // gunny sack with a fish tail sticking out
  const [c, ctx] = makeCanvas(13, 14);
  ellipse(ctx, 6, 9, 5, 4.4, '#c9b07a'); ellipse(ctx, 5, 8, 3, 2.4, '#e0cc98');
  rect(ctx, 5, 3, 3, 3, '#c9b07a'); rect(ctx, 5, 5, 3, 1, '#8a6a3a');
  rect(ctx, 8, 1, 2, 3, '#f2a65a'); px(ctx, 10, 0, '#f2a65a'); px(ctx, 7, 0, '#ffd08a');
  outline(c, OL);
  return c;
}

export function arrowCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(9, 9);
  for (let i = 0; i < 4; i++) rect(ctx, 2 + i, 1 + i, 1, 7 - i * 2, '#e8433f');
  rect(ctx, 2, 1, 1, 7, '#ff8a70');
  outline(c, OL);
  return c;
}

/** The stationary fish bag: a big gunny sack on a pallet. Frame 0 empty, 1 some fish, 2 bulging. */
export function bagSheet(): Sheet {
  const FW = 30, FH = 30;
  const [c, ctx] = makeCanvas(FW * 3, FH);
  for (let f = 0; f < 3; f++) {
    const o = f * FW;
    rect(ctx, o + 2, 24, 26, 3, WOOD[2]); rect(ctx, o + 2, 24, 26, 1, WOOD[3]); rect(ctx, o + 4, 27, 3, 2, WOOD[0]); rect(ctx, o + 23, 27, 3, 2, WOOD[0]);
    const top = f === 0 ? 14 : f === 1 ? 10 : 7, rx = f === 0 ? 9 : f === 1 ? 10 : 11;
    for (let y = top; y < 25; y++) {
      const t = (y - top) / (24 - top), w = Math.round(rx * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1))));
      rect(ctx, o + 15 - w, y, w * 2, 1, '#c9b07a'); rect(ctx, o + 15 - w, y, 2, 1, '#e0cc98'); rect(ctx, o + 15 + w - 3, y, 3, 1, '#a89060');
      if ((y & 1) === 0) for (let x = o + 15 - w + 3; x < o + 15 + w - 3; x += 3) px(ctx, x, y, '#b59e68');
    }
    rect(ctx, o + 9, top - 1, 12, 2, '#e0cc98'); rect(ctx, o + 10, top, 10, 1, '#5a4636'); // rolled rim, dark mouth
    rect(ctx, o + 11, 17, 8, 5, '#2f7fb8'); rect(ctx, o + 13, 19, 3, 1, '#f6ead0'); px(ctx, o + 16, 18, '#f6ead0'); px(ctx, o + 16, 20, '#f6ead0'); // stencilled fish
    if (f > 0) { rect(ctx, o + 11, top - 4, 3, 4, '#7f8c9a'); px(ctx, o + 10, top - 5, '#7f8c9a'); px(ctx, o + 14, top - 5, '#7f8c9a'); }
    if (f > 1) { rect(ctx, o + 16, top - 5, 3, 5, '#f2a65a'); px(ctx, o + 15, top - 6, '#f2a65a'); px(ctx, o + 19, top - 6, '#f2a65a'); rect(ctx, o + 20, top - 2, 2, 2, '#c9a23a'); }
  }
  outline(c, OL);
  return { canvas: c, fw: FW, fh: FH, ox: 15, oy: 27 };
}

/** The fish stall (maalu lella) where catches are banked. */
export function lellaSheet(): Sheet {
  const W = 46, H = 42;
  const [c, ctx] = makeCanvas(W, H);
  // posts
  for (const x of [4, 39]) { rect(ctx, x, 12, 3, 27, WOOD[1]); rect(ctx, x, 12, 1, 27, WOOD[3]); }
  // table + ice box
  rect(ctx, 5, 26, 36, 4, WOOD[3]); rect(ctx, 5, 26, 36, 1, '#e0b983'); rect(ctx, 5, 29, 36, 1, WOOD[0]);
  rect(ctx, 6, 30, 34, 9, WOOD[1]); for (let x = 12; x < 40; x += 7) rect(ctx, x, 30, 1, 9, WOOD[0]);
  rect(ctx, 9, 19, 16, 7, '#e9f6f8'); rect(ctx, 9, 19, 16, 1, '#ffffff'); rect(ctx, 9, 25, 16, 1, '#9cc9cf'); rect(ctx, 24, 19, 1, 7, '#9cc9cf');
  for (const [x, col] of [[11, '#7f8c9a'], [16, '#f2a65a'], [20, '#c9a23a']] as const) { rect(ctx, x, 21, 4, 2, col); px(ctx, x, 21, '#ffffff'); px(ctx, x + 4, 22, col); }
  // scales
  rect(ctx, 30, 22, 7, 1, '#70818f'); rect(ctx, 33, 19, 1, 7, '#70818f'); rect(ctx, 29, 23, 3, 2, '#cfdbe3'); rect(ctx, 35, 23, 3, 2, '#cfdbe3');
  // awning
  for (let x = 1; x < 45; x++) {
    const blue = Math.floor((x - 1) / 5) % 2 === 0;
    const drop = (x - 1) % 5 === 0 || (x - 1) % 5 === 4 ? 9 : 10;
    rect(ctx, x, 3, 1, drop, blue ? '#2f7fb8' : '#f6ead0');
    px(ctx, x, 3, blue ? '#6fb7f0' : '#ffffff'); px(ctx, x, 3 + drop - 1, blue ? '#215a8a' : '#cfc0a0');
  }
  // hanging sign: a fish
  rect(ctx, 17, 13, 12, 6, '#f6d24a'); rect(ctx, 17, 13, 12, 1, '#fff3a0');
  rect(ctx, 19, 15, 5, 2, '#b3261e'); rect(ctx, 24, 14, 2, 4, '#b3261e');
  outline(c, OL);
  return { canvas: c, fw: W, fh: H, ox: 23, oy: 39 };
}

/** Zone signposts: frame 0 green (one fish), 1 amber (two), 2 red (three). */
export function signSheet(): Sheet {
  const FW = 20, FH = 22;
  const [c, ctx] = makeCanvas(FW * 3, FH);
  const band = ['#62ad48', '#f2a63a', '#e8433f'];
  for (let f = 0; f < 3; f++) {
    const o = f * FW;
    rect(ctx, o + 9, 10, 2, 10, WOOD[1]); px(ctx, o + 9, 10, WOOD[3]);
    rect(ctx, o + 2, 2, 16, 9, WOOD[3]); rect(ctx, o + 2, 2, 16, 1, '#e0b983'); rect(ctx, o + 2, 10, 16, 1, WOOD[1]);
    rect(ctx, o + 2, 2, 16, 2, band[f]);
    for (let k = 0; k <= f; k++) { const x = o + 4 + k * 5 - (f === 0 ? -5 : f === 1 ? -2 : 0); rect(ctx, x, 6, 3, 2, '#3a2418'); px(ctx, x + 3, 5, '#3a2418'); px(ctx, x + 3, 8, '#3a2418'); }
  }
  outline(c, OL);
  return { canvas: c, fw: FW, fh: FH, ox: 10, oy: 20 };
}

export function stumpSheet(): Sheet {
  const [c, ctx] = makeCanvas(14, 18);
  for (let y = 3; y < 14; y++) { const w = y > 11 ? 8 : 6; rect(ctx, 7 - w / 2, y, w, 1, '#5a4636'); px(ctx, 7 - w / 2, y, '#7a6248'); px(ctx, 7 + w / 2 - 1, y, '#3c2e26'); }
  rect(ctx, 4, 2, 2, 2, '#5a4636'); rect(ctx, 8, 1, 2, 3, '#5a4636'); px(ctx, 6, 3, '#3c2e26');
  line(ctx, 9, 6, 12, 3, '#5a4636'); px(ctx, 5, 8, '#62ad48'); px(ctx, 6, 9, '#62ad48');
  outline(c, '#1f1a22');
  rect(ctx, 1, 14, 12, 1, 'rgba(233,251,241,0.6)'); rect(ctx, 3, 16, 8, 1, 'rgba(233,251,241,0.35)');
  return { canvas: c, fw: 14, fh: 18, ox: 7, oy: 14 };
}

/** Equipment icons: 0 rod, 1 net, 2 advanced net. */
export function gearSheet(): Sheet {
  const F = 18;
  const [c, ctx] = makeCanvas(F * 3, F);
  // rod
  line(ctx, 3, 15, 13, 2, WOOD[1]); line(ctx, 4, 15, 14, 2, WOOD[3]); px(ctx, 14, 1, '#e8e8e8');
  line(ctx, 14, 2, 14, 10, '#f6f1e0'); rect(ctx, 13, 10, 3, 2, '#e8433f'); rect(ctx, 13, 12, 3, 1, '#fff8ea'); rect(ctx, 2, 13, 3, 3, WOOD[0]);
  // nets: hoop, mesh, handle
  const net = (o: number, r: number, rim: string, hi: string) => {
    for (let a = 0; a < 64; a++) { const t = (a / 64) * Math.PI * 2; px(ctx, o + 10 + Math.cos(t) * r, 7 + Math.sin(t) * (r - 1), rim); }
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (Math.hypot(x, y * 1.15) < r - 0.6 && (x + y) % 2 === 0) px(ctx, o + 10 + x, 7 + y, '#e6dcc0');
    px(ctx, o + 10 - r + 1, 5, hi); px(ctx, o + 10 - r + 2, 4, hi);
    line(ctx, o + 10 - r + 1, 7 + r - 1, o + 2, 16, WOOD[1]); line(ctx, o + 10 - r + 2, 7 + r - 1, o + 3, 16, WOOD[3]);
  };
  net(F, 5, '#8b5e3c', '#c69862');
  net(F * 2, 7, '#f6d24a', '#fff3a0');
  rect(ctx, F * 2 + 14, 13, 3, 3, '#e8433f'); px(ctx, F * 2 + 15, 12, '#ff8a70'); // float
  outline(c, OL);
  return { canvas: c, fw: F, fh: F, ox: 9, oy: 9 };
}

/** A net lying on the water: frame 0 small, 1 large, 2 small pulled tight, 3 large pulled tight. */
export function netSheet(): Sheet {
  const FW = 30, FH = 18;
  const [c, ctx] = makeCanvas(FW * 4, FH);
  for (let f = 0; f < 4; f++) {
    const o = f * FW, big = f % 2 === 1, tight = f > 1;
    const rx = (big ? 12 : 8) - (tight ? 2 : 0), ry = (big ? 6 : 4) - (tight ? 1 : 0), rim = big ? '#f6d24a' : '#c69862';
    for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) {
      const e = Math.hypot(x / rx, y / ry);
      if (e > 1) continue;
      if (e > 0.82) px(ctx, o + 15 + x, 9 + y, rim);
      else if ((x + y * 2) % 3 === 0 || (x - y * 2) % 3 === 0) px(ctx, o + 15 + x, 9 + y, 'rgba(240,232,208,0.85)');
    }
    for (const fx of [-rx, rx]) { rect(ctx, o + 15 + fx - 1, 8, 2, 2, '#e8433f'); px(ctx, o + 15 + fx - 1, 8, '#ff8a70'); }
    if (tight) rect(ctx, o + 15 - rx, 9 + ry + 1, rx * 2, 1, 'rgba(233,251,241,0.8)');
  }
  return { canvas: c, fw: FW, fh: FH, ox: 15, oy: 9 };
}

/** "SHOP" board for the gear stall, with a little net on it. Frame 1 is the lit version shown when you are close. */
export function shopSignSheet(): Sheet {
  const FW = 50, FH = 22;
  const [c, ctx] = makeCanvas(FW * 2, FH);
  for (let f = 0; f < 2; f++) {
    const o = f * FW, lit = f === 1;
    rect(ctx, o + 9, 15, 2, 5, WOOD[1]); rect(ctx, o + 39, 15, 2, 5, WOOD[1]); // posts down to the awning
    rect(ctx, o + 2, 2, 46, 14, lit ? '#fff3a0' : '#f6ead0'); // cream frame
    rect(ctx, o + 3, 3, 44, 12, lit ? '#3a93cf' : '#2f7fb8'); rect(ctx, o + 3, 3, 44, 1, lit ? '#9fd4f5' : '#6fb7f0'); rect(ctx, o + 3, 14, 44, 1, '#215a8a');
    // net symbol
    for (let a = 0; a < 40; a++) { const t = (a / 40) * Math.PI * 2; px(ctx, o + 10 + Math.cos(t) * 3.4, 8 + Math.sin(t) * 3, '#f6d24a'); }
    px(ctx, o + 9, 7, '#f6ead0'); px(ctx, o + 11, 8, '#f6ead0'); px(ctx, o + 10, 9, '#f6ead0'); px(ctx, o + 9, 9, '#f6ead0'); px(ctx, o + 11, 6, '#f6ead0');
    line(ctx, o + 7, 11, o + 5, 13, '#f6d24a');
    drawText(ctx, 'SHOP', o + 17, 5, '#12324d', 2); // shadow
    drawText(ctx, 'SHOP', o + 16, 4, lit ? '#ffffff' : '#fff3d6', 2);
  }
  outline(c, OL);
  return { canvas: c, fw: FW, fh: FH, ox: 25, oy: 20 };
}

export function clockCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(9, 9);
  ellipse(ctx, 4, 4, 3.4, 3.4, '#fff6d8');
  rect(ctx, 4, 2, 1, 3, '#2b1b2e'); rect(ctx, 5, 4, 2, 1, '#2b1b2e');
  outline(c, OL);
  return c;
}

export function warnIconCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(11, 10);
  for (let y = 0; y < 8; y++) rect(ctx, 5 - Math.floor(y * 0.6), 1 + y, 1 + Math.floor(y * 0.6) * 2, 1, '#f6d24a');
  rect(ctx, 5, 3, 1, 3, '#2b1b2e'); px(ctx, 5, 7, '#2b1b2e');
  outline(c, OL);
  return c;
}

export function coinCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(7, 7);
  rect(ctx, 2, 1, 3, 5, '#f6d24a'); rect(ctx, 1, 2, 5, 3, '#f6d24a'); px(ctx, 2, 2, '#fff3a0'); px(ctx, 4, 4, '#c98a1c');
  outline(c, OL);
  return c;
}

export function alertCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(11, 15);
  rect(ctx, 1, 1, 9, 10, '#e8433f'); rect(ctx, 2, 0, 7, 12, '#e8433f'); rect(ctx, 4, 12, 3, 1, '#e8433f'); px(ctx, 5, 13, '#e8433f');
  rect(ctx, 2, 1, 6, 1, '#ff8a70');
  rect(ctx, 5, 2, 2, 5, '#ffffff'); rect(ctx, 5, 8, 2, 2, '#ffffff');
  outline(c, OL);
  return c;
}

export function stoneCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(6, 6);
  rect(ctx, 2, 1, 2, 4, '#8a8378'); rect(ctx, 1, 2, 4, 2, '#8a8378'); px(ctx, 2, 2, '#cfc8b6'); px(ctx, 3, 3, '#6b6560');
  outline(c, '#3a3340');
  return c;
}

export function heartSheet(): Sheet {
  const [c, ctx] = makeCanvas(22, 10);
  for (let f = 0; f < 2; f++) {
    const o = f * 11, fill = f === 0 ? '#e8433f' : '#5a3a3a', hi = f === 0 ? '#ff9a8a' : '#6e4a4a';
    rect(ctx, o + 2, 1, 3, 1, fill); rect(ctx, o + 6, 1, 3, 1, fill); rect(ctx, o + 1, 2, 9, 3, fill);
    rect(ctx, o + 2, 5, 7, 1, fill); rect(ctx, o + 3, 6, 5, 1, fill); rect(ctx, o + 4, 7, 3, 1, fill); px(ctx, o + 5, 8, fill);
    rect(ctx, o + 2, 2, 2, 1, hi);
  }
  outline(c, OL);
  return { canvas: c, fw: 11, fh: 10, ox: 0, oy: 0 };
}

export function reticleCanvas(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(9, 9);
  for (const [x, y, w, h] of [[4, 0, 1, 3], [4, 6, 1, 3], [0, 4, 3, 1], [6, 4, 3, 1]]) rect(ctx, x, y, w, h, '#fff6c8');
  outline(c, OL);
  px(ctx, 4, 4, '#e8433f');
  return c;
}

// ---------------------------------------------------------------- light


