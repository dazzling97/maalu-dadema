// Tiny pixel-drawing toolkit used by every art generator.
export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.imageSmoothingEnabled = false;
  return [c, x];
}

export function rect(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
export function px(ctx: Ctx, x: number, y: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
}

export function hash(x: number, y: number, s = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function vnoise(x: number, y: number, scale: number, seed = 0): number {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  let tx = fx - x0, ty = fy - y0;
  tx = tx * tx * (3 - 2 * tx);
  ty = ty * ty * (3 - 2 * ty);
  const a = hash(x0, y0, seed), b = hash(x0 + 1, y0, seed);
  const c = hash(x0, y0 + 1, seed), d = hash(x0 + 1, y0 + 1, seed);
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered-dither test: true when t (0..1) beats the Bayer threshold at x,y. */
export function dither(x: number, y: number, t: number): boolean {
  return t > (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}
export function bayer(x: number, y: number): number {
  return (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function ellipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, c: string) {
  ctx.fillStyle = c;
  for (let y = Math.floor(-ry); y <= ry; y++) {
    const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.5);
    if (w > 0 || Math.abs(y) < ry) ctx.fillRect(Math.round(cx - w), Math.round(cy + y), Math.max(1, w * 2), 1);
  }
}

export function line(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, c: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let e = dx + dy;
  ctx.fillStyle = c;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * e;
    if (e2 >= dy) { e += dy; x0 += sx; }
    if (e2 <= dx) { e += dx; y0 += sy; }
  }
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Adds a 1px outline around every opaque shape in the canvas (4-neighbour). */
export function outline(c: HTMLCanvasElement, color: string, region?: { x: number; y: number; w: number; h: number }) {
  const ctx = c.getContext('2d')!;
  const r = region ?? { x: 0, y: 0, w: c.width, h: c.height };
  const img = ctx.getImageData(r.x, r.y, r.w, r.h);
  const src = new Uint8ClampedArray(img.data);
  const [cr, cg, cb] = hexRgb(color);
  const { w, h } = r;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] > 200;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (src[i + 3] > 200) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        img.data[i] = cr; img.data[i + 1] = cg; img.data[i + 2] = cb; img.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, r.x, r.y);
}

export function flipH(src: HTMLCanvasElement): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}
