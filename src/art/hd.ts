// High-resolution art. Textures here are drawn at ART pixels per world pixel with
// smooth (anti-aliased) shapes and shown at 1/ART scale, so at the default render
// zoom every texture pixel lands on exactly one screen pixel: sharp, not upscaled.
import Phaser from 'phaser';

export const ART = 3;
/** Scale to show an HD texture at world size. */
export const HD = 1 / ART;

export type Ctx = CanvasRenderingContext2D;

/** A canvas `w` x `h` world pixels in size, ART times denser, with smoothing on. */
export function hdCanvas(w: number, h: number, scaled = true): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * ART);
  c.height = Math.ceil(h * ART);
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  if (scaled) x.scale(ART, ART); // draw in world units
  return [c, x];
}

/** Every texture key drawn in high resolution: shown at HD scale (see hdScale). */
export const HD_KEYS = new Set<string>();
/** The scale that shows a texture at world size: HD for high-resolution keys, 1 for the rest. */
export const hdScale = (key: string) => (HD_KEYS.has(key) ? HD : 1);

/** Register a canvas as a texture with smooth filtering (the rest of the game uses nearest-neighbour). */
export function addHD(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const t = scene.textures.addCanvas(key, c)!;
  t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  HD_KEYS.add(key);
  return t;
}
/** Register a sheet drawn at ART density; frame sizes and origin are given in world units. */
export function addHDSheet(scene: Phaser.Scene, key: string, s: { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number }) {
  const t = addHD(scene, key, s.canvas), fw = s.fw * ART, fh = s.fh * ART;
  const cols = Math.round(s.canvas.width / fw), rows = Math.round(s.canvas.height / fh);
  for (let r = 0, n = 0; r < rows; r++) for (let c = 0; c < cols; c++) t.add(n++, 0, c * fw, r * fh, fw, fh);
  return { x: s.ox / s.fw, y: s.oy / s.fh };
}

// ---------------------------------------------------------------- colour helpers
export type RGB = [number, number, number];
export const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
export const smooth = (e0: number, e1: number, x: number) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
/** Sample a gradient given as [position, colour] stops (positions 0..1, ascending). */
export function ramp(stops: [number, RGB][], t: number): RGB {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) return mix(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  }
  return stops[stops.length - 1][1];
}
export const rgba = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

/** Soft elliptical shadow (radial gradient), the one shadow shape used everywhere. */
export function softShadow(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.32, col = '18,40,44') {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
  g.addColorStop(0, `rgba(${col},${a})`);
  g.addColorStop(0.55, `rgba(${col},${a * 0.7})`);
  g.addColorStop(1, `rgba(${col},0)`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/** Bilinear sample of a world-resolution field. */
export function bilinear(f: Float32Array, w: number, h: number, x: number, y: number): number {
  if (x < 0) x = 0; else if (x > w - 1.001) x = w - 1.001;
  if (y < 0) y = 0; else if (y > h - 1.001) y = h - 1.001;
  const x0 = x | 0, y0 = y | 0, tx = x - x0, ty = y - y0, i = y0 * w + x0;
  const a = f[i], b = f[i + 1], c = f[i + w], d = f[i + w + 1];
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
}
