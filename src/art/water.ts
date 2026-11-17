import { Layout } from '../world/layout';
import { makeCanvas, hash, vnoise } from './px';

export const WATER_FRAMES = 8;
export const WATER_BOX = { x: 166, y: 150, w: 938, h: 480 };
export const GLITTER = { x: 520, y: 300, rx: 180, ry: 72 }; // where the low sun hits the pond

/**
 * Animated water surface: drifting highlight dashes, a lapping foam line along
 * the shore and a warm glitter path. Returned as a 4x2 sheet of looping frames.
 */
export function paintWaterSheet(L: Layout): HTMLCanvasElement {
  const B = WATER_BOX;
  const [c, ctx] = makeCanvas(B.w * 4, B.h * 2);
  for (let f = 0; f < WATER_FRAMES; f++) {
    const ox = (f % 4) * B.w, oy = Math.floor(f / 4) * B.h;
    const ang = (f / WATER_FRAMES) * Math.PI * 2;
    const sx = Math.cos(ang) * 2.5, sy = Math.sin(ang) * 2.5;

    // shore foam
    for (let y = 0; y < B.h; y++) {
      for (let x = 0; x < B.w; x++) {
        const wx = B.x + x, wy = B.y + y;
        const depth = -L.pond[wy * L.w + wx];
        if (depth < 1.6 || depth > 10) continue;
        if (L.onDock(wx, wy, 2)) continue;
        if (depth < 4.6) {
          if (vnoise(wx + sx, wy + sy, 9, 77) > 0.54) {
            ctx.fillStyle = 'rgba(233,251,241,0.9)';
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        } else if (depth > 7 && depth < 9) {
          if (vnoise(wx - sx * 1.4, wy - sy * 1.4, 12, 78) > 0.66) {
            ctx.fillStyle = 'rgba(190,240,228,0.4)';
            ctx.fillRect(ox + x, oy + y, 1, 1);
          }
        }
      }
    }
    // drifting highlight dashes
    const CW = 17, CH = 6;
    for (let cy = 0; cy < B.h / CH; cy++) {
      for (let cx = 0; cx < B.w / CW; cx++) {
        if (hash(cx, cy, 1) > 0.62) continue;
        const phase = Math.floor(hash(cx, cy, 2) * WATER_FRAMES);
        const life = (f + phase) % WATER_FRAMES;
        if (life > 4) continue;
        const len = 3 + Math.floor(hash(cx, cy, 3) * 6) - (life === 0 || life === 4 ? 2 : 0);
        const x0 = cx * CW + Math.floor(hash(cx, cy, 4) * 12) + (life >> 1);
        const y0 = cy * CH + Math.floor(hash(cx, cy, 5) * 4);
        const wx = B.x + x0, wy = B.y + y0;
        const g = Math.hypot((wx - GLITTER.x) / GLITTER.rx, (wy - GLITTER.y) / GLITTER.ry);
        const bright = life >= 1 && life <= 3;
        for (let k = 0; k < len; k++) {
          const xx = wx + k;
          if (xx >= L.w || -L.pond[wy * L.w + xx] < 6 || L.onDock(xx, wy, 3)) continue;
          ctx.fillStyle = g < 1
            ? (bright ? 'rgba(255,247,206,0.95)' : 'rgba(255,236,170,0.55)')
            : (bright ? 'rgba(178,240,230,0.6)' : 'rgba(150,225,220,0.32)');
          ctx.fillRect(ox + x0 + k, oy + y0, 1, 1);
          if (bright && k > 0 && k < len - 1) {
            ctx.fillStyle = 'rgba(16,58,96,0.22)';
            ctx.fillRect(ox + x0 + k + 1, oy + y0 + 1, 1, 1);
          }
        }
      }
    }
  }
  return c;
}
