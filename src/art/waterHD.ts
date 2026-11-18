// Moving water in high resolution: two drifting ripple layers (sunlit crests and
// cool troughs) clipped to open water, and a lapping foam band along the shore.
// The layers are small seamless tiles, so the effect costs a few draws per frame.
import { Layout } from '../world/layout';
import { rng } from './px';
import { hdCanvas, smooth, softShadow } from './hd';
import { WATER_BOX } from './water';

/** Alpha masks at world resolution (smoothed when scaled): open water, and the band along the shore. */
export function waterMasks(L: Layout): { open: HTMLCanvasElement; shore: HTMLCanvasElement } {
  const B = WATER_BOX;
  const mk = () => { const c = document.createElement('canvas'); c.width = B.w; c.height = B.h; return c; };
  const open = mk(), shore = mk();
  const oc = open.getContext('2d')!, sc = shore.getContext('2d')!;
  const oi = oc.createImageData(B.w, B.h), si = sc.createImageData(B.w, B.h);
  for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
    const wx = B.x + x, wy = B.y + y, depth = -L.pond[wy * L.w + wx], o = (y * B.w + x) * 4 + 3;
    const dock = L.onDock(wx, wy, 1) ? 0 : 1;
    oi.data[o] = 255 * smooth(3, 9, depth) * dock;
    si.data[o] = 255 * smooth(-0.6, 1, depth) * (1 - smooth(3.5, 8, depth)) * dock;
  }
  for (const c of [oi, si]) for (let i = 0; i < c.data.length; i += 4) { c.data[i] = c.data[i + 1] = c.data[i + 2] = 255; }
  oc.putImageData(oi, 0, 0); sc.putImageData(si, 0, 0);
  return { open, shore };
}

/** Draw `fn` at every wrap offset so the tile repeats seamlessly. */
function wrap(size: number, fn: (dx: number, dy: number) => void) {
  for (const dy of [-size, 0, size]) for (const dx of [-size, 0, size]) fn(dx, dy);
}

/** Seamless ripple tile `size` world pixels square: thin curved strokes, wider than tall (the view is angled). */
export function rippleTile(size: number, seed: number, light: boolean): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(size, size);
  const R = rng(seed);
  const n = light ? 120 : 90;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const x = R() * size, y = R() * size, len = 3 + R() * R() * (light ? 18 : 22), bend = (R() < 0.75 ? 1 : -1) * (0.3 + R() * 1.3), tilt = (R() - 0.5) * 0.25;
    const a = light ? 0.35 + R() * 0.5 : 0.25 + R() * 0.35, w = light ? 0.35 + R() * 0.45 : 0.6 + R() * 0.7;
    wrap(size, (dx, dy) => {
      const x0 = x + dx, y0 = y + dy;
      ctx.strokeStyle = light ? `rgba(226,252,246,${a})` : `rgba(12,52,86,${a})`;
      ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0 - len / 2, y0 - tilt * len); ctx.quadraticCurveTo(x0, y0 - bend, x0 + len / 2, y0 + tilt * len); ctx.stroke();
    });
  }
  return c;
}

/** Seamless swell tile: broad soft patches of lighter and darker water that drift slowly across the pond. */
export function swellTile(size: number): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(size, size);
  const R = rng(515);
  for (let i = 0; i < 26; i++) {
    const x = R() * size, y = R() * size, r = 18 + R() * 40, light = R() < 0.5, a = 0.1 + R() * 0.12;
    wrap(size, (dx, dy) => softShadow(ctx, x + dx, y + dy, r, r * 0.42, a, light ? '170,236,232' : '10,40,78'));
  }
  return c;
}

/** Seamless foam tile: soft clumps and flecks of white water. */
export function foamTile(size: number): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(size, size);
  const R = rng(404);
  for (let i = 0; i < 70; i++) {
    const x = R() * size, y = R() * size, r = 1.5 + R() * 4;
    wrap(size, (dx, dy) => softShadow(ctx, x + dx, y + dy, r, r * 0.55, 0.55 + R() * 0.3, '240,253,247'));
  }
  for (let i = 0; i < 160; i++) {
    const x = R() * size, y = R() * size, r = 0.25 + R() * 0.45;
    wrap(size, (dx, dy) => { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill(); });
  }
  return c;
}

/** A four-point sun glint. */
export function glintCanvas(): HTMLCanvasElement {
  const S = 9, [c, ctx] = hdCanvas(S, S), m = S / 2;
  softShadow(ctx, m, m, 3, 3, 0.7, '255,246,206');
  ctx.fillStyle = 'rgba(255,252,236,0.95)';
  ctx.beginPath();
  ctx.moveTo(m, 0); ctx.quadraticCurveTo(m + 0.4, m - 0.4, S, m); ctx.quadraticCurveTo(m + 0.4, m + 0.4, m, S);
  ctx.quadraticCurveTo(m - 0.4, m + 0.4, 0, m); ctx.quadraticCurveTo(m - 0.4, m - 0.4, m, 0);
  ctx.fill();
  return c;
}

// ---------------------------------------------------------------- light
/** Shafts of warm light through the canopy: soft diagonal beams fading downward. */
export function raysHD(): HTMLCanvasElement {
  const W = 190, H = 170, [c, ctx] = hdCanvas(W, H);
  const beams: [number, number][] = [[14, 8], [44, 13], [78, 6], [100, 10]];
  ctx.globalCompositeOperation = 'lighter';
  for (const [bx, bw] of beams) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,226,140,0)'); g.addColorStop(0.14, 'rgba(255,226,140,0.07)'); g.addColorStop(1, 'rgba(255,226,140,0)');
    ctx.fillStyle = g;
    // stacked, narrowing beams give a soft edge and a brighter core
    for (let k = 0; k < 6; k++) {
      const w = bw * (1 - k / 7);
      ctx.beginPath(); ctx.moveTo(bx - w, 0); ctx.lineTo(bx + w, 0); ctx.lineTo(bx + w + H * 0.42, H); ctx.lineTo(bx - w + H * 0.42, H); ctx.closePath();
      ctx.fill();
    }
  }
  return c;
}
/** Warm key light from the upper-left, cool falloff toward the lower-right. View-sized, screen-fixed. */
export function gradeHD(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(w, h);
  const g = ctx.createLinearGradient(0, 0, w * 0.85, h);
  g.addColorStop(0, 'rgba(255,190,96,0.16)'); g.addColorStop(0.45, 'rgba(255,200,120,0.02)');
  g.addColorStop(0.62, 'rgba(40,30,90,0)'); g.addColorStop(1, 'rgba(40,30,90,0.16)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  return c;
}
export function vignetteHD(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2); ctx.scale(1, h / w);
  const g = ctx.createRadialGradient(0, 0, w * 0.38, 0, 0, w * 0.62);
  g.addColorStop(0, 'rgba(24,14,40,0)'); g.addColorStop(1, 'rgba(24,14,40,0.32)');
  ctx.fillStyle = g; ctx.fillRect(-w, -w, w * 2, w * 2);
  ctx.restore();
  return c;
}
/** Soft contact shadow under characters, 16 x 7 world pixels. */
export function shadowHD(): HTMLCanvasElement {
  const [c, ctx] = hdCanvas(16, 7);
  softShadow(ctx, 8, 3.5, 7.5, 3.2, 0.42);
  return c;
}
