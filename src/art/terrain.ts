import { PAL, WORLD } from '../config/game';
import { Layout, DOCKS, SWAMP } from '../world/layout';
import { makeCanvas, vnoise, hash, bayer, hexRgb, rng, rect, px, ellipse } from './px';

const rgb = (hex: string) => hexRgb(hex);
const GRASS = PAL.grass.map(rgb);
const SAND = PAL.sand.map(rgb);
const PATH = PAL.path.map(rgb);
const WATER = PAL.water.map(rgb);
const SWAMP_PAL = ['#6fae8a', '#4f9478', '#3b7a68', '#2f6458', '#27524c'].map(rgb);
const MUD = rgb(PAL.mud);
const RIM = rgb(PAL.waterRim);
const PEB_L = rgb('#e8cf9c');
const PEB_D = rgb('#8f6a3c');

/** Paints the whole static ground: grass, sand bank, dirt paths and the pond bed. */
export function paintGround(L: Layout): HTMLCanvasElement {
  const W = WORLD.w, H = WORLD.h;
  const [c, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const pd = L.pond[i];
      const b = bayer(x, y);
      let col: number[];

      if (pd < 0) {
        const depth = -pd + (vnoise(x, y, 60, 3) - 0.5) * 14;
        if (-pd < 1.6) col = RIM;
        else {
          // banded depth with dithered seams
          const stops = [9, 26, 52, 86];
          let band = 0;
          for (let s = 0; s < stops.length; s++) {
            const w = 3 + s * 2;
            if (depth > stops[s] + w) band = s + 1;
            else if (depth > stops[s] - w && (depth - (stops[s] - w)) / (2 * w) > b) band = s + 1;
          }
          // the north-west corner is murky swamp water
          const sw = Math.min((SWAMP.x + 6 - x) / 26, (SWAMP.y + 6 - y) / 26) + (vnoise(x, y, 30, 61) - 0.5) * 0.8;
          const P = sw > b ? SWAMP_PAL : WATER;
          col = P[band];
          // faint static streaks so deep water is never one flat fill
          if (band > 0 && hash(x >> 3, y, 5) < 0.05) col = P[band - 1];
          if (band === 0 && hash(x, y, 6) < 0.03) col = P[1];
          if (P === SWAMP_PAL && hash(x >> 1, y >> 1, 62) < 0.012) col = SWAMP_PAL[0]; // floating weed
        }
      } else if (pd < 2.4) {
        col = MUD;
      } else {
        const bank = 8 + vnoise(x, y, 20, 11) * 9;
        const pdist = L.pathDist[i];
        const pw = 8 + vnoise(x, y, 18, 50) * 4;
        const h = hash(x, y, 40);
        if (pd < bank && !(pd > bank - 3 && (bank - pd) / 3 < b)) {
          const n = vnoise(x, y, 9, 12);
          col = n > 0.62 ? SAND[2] : n < 0.3 ? SAND[0] : SAND[1];
          if (pd < 4.5) col = SAND[0];
          if (h < 0.03) col = PEB_D; else if (h > 0.975) col = PEB_L;
        } else if (pdist < pw && !(pdist > pw - 2.5 && (pw - pdist) / 2.5 < b)) {
          const n = vnoise(x, y, 11, 51);
          col = pdist > pw - 2 ? PATH[0] : pdist < 3.5 && n > 0.4 ? PATH[3] : n > 0.55 ? PATH[2] : PATH[1];
          if (h < 0.022) col = PEB_L; else if (h > 0.982) col = PEB_D;
        } else {
          const g = vnoise(x, y, 70, 21) * 0.6 + vnoise(x, y, 22, 22) * 0.3 + vnoise(x, y, 7, 23) * 0.1;
          let tone = 1 + (g + (b - 0.5) * 0.09 > 0.4 ? 1 : 0) + (g + (b - 0.5) * 0.09 > 0.56 ? 1 : 0);
          if (g + (b - 0.5) * 0.08 < 0.3) tone = 0;
          // warm sunlit clearings
          if (vnoise(x + 300, y, 120, 31) + (b - 0.5) * 0.1 > 0.6) tone++;
          // cool shade under the jungle wall
          const edge = Math.min(x, y - 30, W - x, H - y);
          if (edge < 46 && (46 - edge) / 30 > b) tone--;
          if (h < 0.04) tone--; else if (h > 0.972) tone++;
          col = GRASS[Math.max(0, Math.min(4, tone))];
        }
      }
      const o = i * 4;
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // --- hand-stamped ground detail -------------------------------------------------
  const R = rng(77);
  const onGrass = (x: number, y: number) => L.pondAt(x, y) > 18 && L.pathAt(x, y) > 14;
  // grass tufts
  for (let n = 0; n < 1900; n++) {
    const x = Math.floor(R() * W), y = Math.floor(40 + R() * (H - 44));
    if (!onGrass(x, y)) continue;
    const dark = R() < 0.55;
    const c1 = dark ? PAL.grass[0] : PAL.grass[4], c2 = dark ? '#2f6734' : PAL.grass[3];
    px(ctx, x, y, c1); px(ctx, x, y - 1, c1); px(ctx, x - 1, y - 2, c2); px(ctx, x + 2, y, c1); px(ctx, x + 2, y - 1, c2); px(ctx, x + 3, y - 2, c2);
  }
  // wildflowers in little drifts
  const blooms = ['#fff3d6', '#f6d24a', '#f08bb0', '#b9a8f5', '#ff8d5c'];
  for (let n = 0; n < 150; n++) {
    const cx = Math.floor(R() * W), cy = Math.floor(50 + R() * (H - 60));
    const col = blooms[Math.floor(R() * blooms.length)];
    for (let k = 0; k < 5; k++) {
      const x = cx + Math.floor((R() - 0.5) * 22), y = cy + Math.floor((R() - 0.5) * 12);
      if (!onGrass(x, y)) continue;
      px(ctx, x, y + 1, '#2f6734'); px(ctx, x, y + 2, '#2f6734');
      rect(ctx, x - 1, y, 3, 1, col); px(ctx, x, y - 1, col); px(ctx, x, y, '#f6d24a');
      if (col === '#f6d24a') px(ctx, x, y, '#fff3d6');
    }
  }
  // pebbles on the bank and beside the path
  for (let n = 0; n < 520; n++) {
    const x = Math.floor(R() * W), y = Math.floor(50 + R() * (H - 60));
    const pd = L.pondAt(x, y);
    if (!((pd > 3 && pd < 14) || (L.pathAt(x, y) < 13 && L.pathAt(x, y) > 5 && pd > 14))) continue;
    rect(ctx, x, y, 2, 1, '#b9b2a2'); px(ctx, x, y + 1, '#7d766c'); px(ctx, x + 1, y + 1, '#8f887c');
  }
  // fallen leaves
  for (let n = 0; n < 250; n++) {
    const x = Math.floor(R() * W), y = Math.floor(50 + R() * (H - 60));
    if (L.pondAt(x, y) < 6) continue;
    const col = R() < 0.5 ? '#c98a3a' : '#a85f2a';
    px(ctx, x, y, col); px(ctx, x + 1, y, col); px(ctx, x + 1, y - 1, '#e0a84c');
  }

  // --- soft ground shadows (sun sits low in the upper-left) -----------------------
  ctx.fillStyle = 'rgba(18,42,48,0.26)';
  const shadow = (cx: number, cy: number, rx: number, ry: number) => {
    for (let y = -ry; y <= ry; y++) {
      const w = Math.floor(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
      ctx.fillRect(Math.round(cx - w + y * 0.5), Math.round(cy + y), w * 2, 1);
    }
  };
  for (const p of L.props) {
    switch (p.kind) {
      case 'palm': case 'palmKing': shadow(p.x + 20, p.y + 5, 18, 6); break;
      case 'tree': shadow(p.x + 16, p.y + 3, 30, 10); break;
      case 'banana': shadow(p.x + 10, p.y + 1, 15, 5); break;
      case 'bush': case 'bushFlower': shadow(p.x + 5, p.y, 13, 4); break;
      case 'rockL': shadow(p.x + 4, p.y, 10, 3); break;
      case 'rockM': shadow(p.x + 3, p.y, 7, 2); break;
      case 'shop': ctx.fillRect(p.x - 52, p.y - 2, 124, 9); shadow(p.x + 62, p.y - 24, 16, 30); break;
      case 'fence': ctx.fillRect(p.x - 14, p.y, 32, 3); break;
      case 'bag': shadow(p.x + 5, p.y, 12, 3); break;
      case 'signA': case 'signB': case 'signC': shadow(p.x + 4, p.y, 6, 2); break;
      case 'bench': ctx.fillRect(p.x - 11, p.y, 26, 3); break;
      case 'basket': case 'pot': case 'sack': case 'crate': case 'thambili': shadow(p.x + 3, p.y, 7, 2); break;
      default: break;
    }
  }
  // dappled light spilling between the canopies
  ctx.fillStyle = 'rgba(255,236,140,0.13)';
  for (const p of L.props) {
    if (p.kind !== 'tree' && p.kind !== 'palm') continue;
    for (let k = 0; k < 5; k++) {
      const x = p.x + 30 + (R() - 0.5) * 60, y = p.y + 14 + (R() - 0.5) * 26;
      if (L.pondAt(x, y) < 4) continue;
      ellipse(ctx, x, y, 3 + R() * 4, 1 + R() * 2, 'rgba(255,236,140,0.13)');
    }
  }
  // worn earth where everyone stands to fish
  for (const D of DOCKS) for (let k = 0; k < 40; k++) {
    const x = D.x + 13 + (R() - 0.5) * 46, y = D.y + D.h + 6 + (R() - 0.5) * 16;
    if (L.pondAt(x, y) > 5) rect(ctx, x, y, 2 + Math.floor(R() * 3), 1, R() < 0.5 ? PAL.path[1] : PAL.path[2]);
  }
  return c;
}
