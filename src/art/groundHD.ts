// The ground in high resolution: grass, sand bank, dirt paths, the pond bed and
// soft prop shadows, lit by one low sun in the upper-left. Painted into tiles so
// no single texture exceeds what every GPU accepts.
import { WORLD } from '../config/game';
import { Layout, DOCKS, SWAMP } from '../world/layout';
import { vnoise, hash, rng } from './px';
import { ART, hdCanvas, hex, mix, ramp, smooth, clamp01, bilinear, softShadow, RGB } from './hd';

export const GROUND_TILE = { w: 480, h: 420 }; // world pixels per ground tile (1440 x 1260 texture pixels)
export const GROUND_COLS = WORLD.w / GROUND_TILE.w;
export const GROUND_ROWS = WORLD.h / GROUND_TILE.h;

// --- palette: every surface shares one warm-sun / cool-shade grade
const GRASS: [number, RGB][] = [[0, hex('#2f6a37')], [0.3, hex('#4a8d3f')], [0.62, hex('#6aa947')], [0.85, hex('#8cc152')], [1, hex('#a9d466')]];
const SAND: [number, RGB][] = [[0, hex('#b89160')], [0.5, hex('#d2b07a')], [1, hex('#e6cc96')]];
const PATH: [number, RGB][] = [[0, hex('#94683a')], [0.45, hex('#b98b55')], [1, hex('#d8b07a')]];
const WATER: [number, RGB][] = [[0, hex('#5fc9b8')], [0.12, hex('#3db0ae')], [0.35, hex('#2a8ea6')], [0.65, hex('#226f98')], [1, hex('#1a5384')]];
const SWAMPW: [number, RGB][] = [[0, hex('#7fb48c')], [0.15, hex('#5c9a7c')], [0.4, hex('#41806c')], [1, hex('#2b5b52')]];
const BED = hex('#c9ad78'); // sandy bottom seen through the shallows
const WET = hex('#6e5436'), WET2 = hex('#93734a');
const FOAM = hex('#eafbf3');
const SHADE = hex('#1f4630'); // jungle wall and reflected banks
const SKY = hex('#bfe9ec');

interface Fields { M: Float32Array; G: Float32Array; S: Float32Array; N: Float32Array; DN: Float32Array; SW: Float32Array; BK: Float32Array; PW: Float32Array; LIT: Float32Array; REF: Float32Array; }

/** Smooth noise and lighting fields at world resolution; sampled bilinearly per texture pixel. */
function fields(L: Layout): Fields {
  const W = WORLD.w, H = WORLD.h, n = W * H;
  const f = () => new Float32Array(n);
  const F: Fields = { M: f(), G: f(), S: f(), N: f(), DN: f(), SW: f(), BK: f(), PW: f(), LIT: f(), REF: f() };
  const hgt = f();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, pd = L.pond[i];
    F.G[i] = vnoise(x, y, 70, 21) * 0.6 + vnoise(x, y, 22, 22) * 0.3 + vnoise(x, y, 7, 23) * 0.1;
    F.S[i] = vnoise(x + 300, y, 120, 31);
    F.M[i] = vnoise(x, y, 3.2, 24) * 0.6 + vnoise(x, y, 1.6, 25) * 0.4; // fine mottling: clumps of grass
    F.N[i] = vnoise(x, y, 9, 12);
    F.BK[i] = 8 + vnoise(x, y, 20, 11) * 9;
    F.PW[i] = 8 + vnoise(x, y, 18, 50) * 4;
    if (pd < 0) {
      F.DN[i] = (vnoise(x, y, 60, 3) - 0.5) * 14;
      F.SW[i] = clamp01(Math.min((SWAMP.x + 6 - x) / 26, (SWAMP.y + 6 - y) / 26) + (vnoise(x, y, 30, 61) - 0.5) * 0.8);
    }
    // gentle relief: land rises away from the shore and rolls; the pond bed sinks
    hgt[i] = pd >= 0 ? 7 * smooth(0, 46, pd) + 5 * vnoise(x, y, 95, 5) - 2 * smooth(0, 10, 10 - L.pathDist[i])
      : -Math.min(-pd, 60) * 0.06;
  }
  // sunlight from the upper-left: slopes facing it brighten, the others fall into shade
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    const hx = (hgt[i + 1] - hgt[i - 1]) * 0.5, hy = (hgt[i + W] - hgt[i - W]) * 0.5;
    F.LIT[i] = Math.max(-0.22, Math.min(0.22, (hx * 0.55 + hy * 0.65) * 1.6));
  }
  // banks reflected in the water: how close the shore is straight "above" a water pixel
  for (let x = 0; x < W; x++) {
    let land = 99;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (L.pond[i] >= 0) land = 0; else land++;
      F.REF[i] = L.pond[i] < 0 ? 1 - smooth(2, 34, land) : 0;
    }
  }
  return F;
}

/** One ground tile, painted pixel by pixel from the fields, then detailed with vector strokes. */
function paintTile(L: Layout, F: Fields, col: number, row: number, details: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const W = WORLD.w, H = WORLD.h, T = GROUND_TILE;
  const ox = col * T.w, oy = row * T.h;
  const [c, ctx] = hdCanvas(T.w, T.h, false);
  const img = ctx.createImageData(c.width, c.height), d = img.data;
  const s = (fld: Float32Array, x: number, y: number) => bilinear(fld, W, H, x, y);
  for (let Y = 0; Y < c.height; Y++) {
    const wy = oy + (Y + 0.5) / ART - 0.5;
    for (let X = 0; X < c.width; X++) {
      const wx = ox + (X + 0.5) / ART - 0.5;
      const pd = s(L.pond, wx, wy);
      const grain = hash(X + ox * ART, Y + oy * ART, 9) - 0.5;
      let col: RGB;
      let lit = s(F.LIT, wx, wy);
      if (pd < 0) {
        // --- the pond bed: clear over sand at the edge, deepening blue, murky in the swamp
        const depth = -pd + s(F.DN, wx, wy);
        const sw = s(F.SW, wx, wy);
        const deep = mix(ramp(WATER, clamp01(depth / 92)), ramp(SWAMPW, clamp01(depth / 80)), sw);
        col = mix(mix(BED, deep, 0.45), deep, smooth(0, 15, depth)); // see-through shallows
        if (depth < 22 && sw < 0.5) { // sunlight caustics on the sandy bottom
          const web = Math.abs(vnoise(wx, wy, 5, 88) - vnoise(wx + 9, wy - 4, 7, 89));
          col = mix(col, FOAM, (1 - smooth(0.02, 0.09, web)) * (1 - smooth(4, 22, depth)) * 0.22);
        }
        col = mix(col, SHADE, s(F.REF, wx, wy) * 0.32); // the bank mirrored in the surface
        col = mix(col, SKY, (1 - smooth(150, 640, wy)) * 0.1 * smooth(8, 30, depth)); // far water catches the sky
        col = mix(col, FOAM, smooth(-1.6, -0.1, pd) * 0.55); // wet glint where water meets land
        lit *= 0.35;
        const k = 1 + grain * 0.025;
        col = [col[0] * k, col[1] * k, col[2] * k];
      } else if (pd < 2.6) {
        col = mix(WET, WET2, smooth(0, 2.6, pd));
        col = mix(col, [col[0] * 1.08, col[1] * 1.08, col[2] * 1.08], grain + 0.5);
      } else {
        const g = s(F.G, wx, wy), n = s(F.N, wx, wy), bank = s(F.BK, wx, wy), pw = s(F.PW, wx, wy);
        const pdist = s(L.pathDist, wx, wy);
        // grass: rolling tones, warm sunlit clearings
        col = ramp(GRASS, clamp01((g - 0.22) / 0.5 + smooth(0.55, 0.75, s(F.S, wx, wy)) * 0.22 + (s(F.M, wx, wy) - 0.5) * 0.32 + grain * 0.07));
        // dirt path: worn and pale down the middle, darker at the kerb
        const pathT = 1 - smooth(pw - 2.2, pw + 0.8, pdist);
        if (pathT > 0) {
          let p = ramp(PATH, clamp01(0.25 + n * 0.5 + (1 - smooth(0, pw * 0.7, pdist)) * 0.35 + grain * 0.1));
          p = mix(p, hex('#7a5530'), smooth(pw - 3.5, pw - 0.5, pdist) * 0.45);
          col = mix(col, p, pathT);
        }
        // the sand bank along the shore
        const sandT = 1 - smooth(bank - 2.5, bank + 1, pd);
        if (sandT > 0) {
          const sd = mix(ramp(SAND, clamp01(n + grain * 0.15)), WET2, 1 - smooth(2.6, 6, pd));
          col = mix(col, sd, sandT);
        }
        // cool shade under the jungle wall at the world's edges
        const edge = Math.min(wx, wy - 30, W - wx, H - wy);
        col = mix(col, SHADE, (1 - smooth(0, 52, edge)) * 0.6);
      }
      const k = 1 + lit;
      const o = (Y * c.width + X) * 4;
      d[o] = Math.min(255, col[0] * k); d[o + 1] = Math.min(255, col[1] * k); d[o + 2] = Math.min(255, col[2] * k); d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  ctx.save();
  ctx.scale(ART, ART);
  ctx.translate(-ox, -oy);
  details(ctx);
  ctx.restore();
  return c;
}

/** Vector detail shared by every tile: prop shadows, grass blades, flowers, pebbles, leaves, dappled light. */
function detailPass(L: Layout) {
  const W = WORLD.w, H = WORLD.h, R = rng(77);
  const onGrass = (x: number, y: number) => L.pondAt(x, y) > 18 && L.pathAt(x, y) > 14;
  type Item = { x: number; y: number; draw: (ctx: CanvasRenderingContext2D) => void };
  const items: Item[] = [];

  // soft shadows, cast toward the lower-right by the low sun
  const sh = (x: number, y: number, rx: number, ry: number, a = 0.3) => items.push({ x, y, draw: (c) => softShadow(c, x, y, rx, ry, a) });
  for (const p of L.props) {
    switch (p.kind) {
      case 'palm': case 'palmKing': sh(p.x + 22, p.y + 4, 24, 8); break;
      case 'tree': sh(p.x + 16, p.y + 3, 36, 12, 0.34); break;
      case 'banana': sh(p.x + 10, p.y + 2, 18, 6); break;
      case 'bush': case 'bushFlower': sh(p.x + 5, p.y + 1, 15, 5); break;
      case 'rockL': sh(p.x + 4, p.y + 1, 12, 4); break;
      case 'rockM': sh(p.x + 3, p.y + 1, 8, 3); break;
      case 'shop': sh(p.x + 6, p.y + 3, 70, 9, 0.36); sh(p.x + 64, p.y - 22, 20, 32, 0.22); break;
      case 'fence': sh(p.x + 2, p.y + 1, 18, 3); break;
      case 'bag': sh(p.x + 5, p.y + 1, 13, 4); break;
      case 'signA': case 'signB': case 'signC': sh(p.x + 4, p.y + 1, 7, 2.5); break;
      case 'bench': sh(p.x + 2, p.y + 1, 15, 3.5); break;
      case 'basket': case 'pot': case 'sack': case 'crate': case 'thambili': sh(p.x + 3, p.y + 1, 8, 3); break;
      default: break;
    }
  }
  // worn earth where everyone stands to fish
  for (const D of DOCKS) for (let k = 0; k < 26; k++) {
    const x = D.x + 13 + (R() - 0.5) * 46, y = D.y + D.h + 6 + (R() - 0.5) * 16;
    if (L.pondAt(x, y) <= 5) continue;
    const rx = 2 + R() * 4, a = 0.18 + R() * 0.15;
    items.push({ x, y, draw: (c) => { c.fillStyle = `rgba(150,110,62,${a})`; c.beginPath(); c.ellipse(x, y, rx, rx * 0.45, 0, 0, Math.PI * 2); c.fill(); } });
  }
  // grass tufts: a few curved blades, dark at the root, sunlit at the tip
  for (let n = 0; n < 5200; n++) {
    const x = R() * W, y = 40 + R() * (H - 44);
    if (!onGrass(x, y)) continue;
    const blades = 3 + Math.floor(R() * 3), lean = (R() - 0.5) * 1.6, tall = 2.6 + R() * 2.4, warm = R() < 0.45;
    const seeds = Array.from({ length: blades }, () => [(R() - 0.5) * 3.4, R()]);
    items.push({ x, y, draw: (c) => {
      c.lineCap = 'round';
      for (const [dx, r] of seeds) {
        const h = tall * (0.7 + r * 0.5), bx = x + dx;
        const g = c.createLinearGradient(bx, y, bx, y - h);
        g.addColorStop(0, 'rgba(36,82,40,0.95)'); g.addColorStop(1, warm ? 'rgba(186,222,108,0.95)' : 'rgba(124,184,76,0.95)');
        c.strokeStyle = g; c.lineWidth = 0.55;
        c.beginPath(); c.moveTo(bx, y); c.quadraticCurveTo(bx + lean * 0.3 + dx * 0.2, y - h * 0.6, bx + lean + dx * 0.4, y - h); c.stroke();
      }
    } });
  }
  // wildflowers in little drifts
  const blooms = ['#fff3d6', '#f6d24a', '#f08bb0', '#b9a8f5', '#ff8d5c'];
  for (let n = 0; n < 170; n++) {
    const cx = R() * W, cy = 50 + R() * (H - 60), col = blooms[Math.floor(R() * blooms.length)];
    for (let k = 0; k < 5; k++) {
      const x = cx + (R() - 0.5) * 22, y = cy + (R() - 0.5) * 12, r = 0.8 + R() * 0.5;
      if (!onGrass(x, y)) continue;
      items.push({ x, y, draw: (c) => {
        c.strokeStyle = 'rgba(40,96,46,0.9)'; c.lineWidth = 0.45; c.beginPath(); c.moveTo(x, y + 2.2); c.lineTo(x, y + 0.4); c.stroke();
        c.fillStyle = col;
        for (let p = 0; p < 5; p++) { const a = (p / 5) * Math.PI * 2; c.beginPath(); c.arc(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.6, r * 0.55, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = col === '#f6d24a' ? '#fff8dc' : '#f6c23a'; c.beginPath(); c.arc(x, y, r * 0.38, 0, Math.PI * 2); c.fill();
      } });
    }
  }
  // pebbles on the bank and along the path, lit from the upper-left
  for (let n = 0; n < 620; n++) {
    const x = R() * W, y = 50 + R() * (H - 60), pd = L.pondAt(x, y), pa = L.pathAt(x, y);
    if (!((pd > 3 && pd < 14) || (pa < 13 && pa > 5 && pd > 14))) continue;
    const rx = 0.9 + R() * 1.1, ry = rx * (0.55 + R() * 0.2), tone = 150 + R() * 60;
    items.push({ x, y, draw: (c) => {
      softShadow(c, x + 0.6, y + 0.5, rx * 1.2, ry * 1.1, 0.35);
      const g = c.createRadialGradient(x - rx * 0.4, y - ry * 0.5, 0, x, y, rx * 1.1);
      g.addColorStop(0, `rgb(${tone + 50},${tone + 44},${tone + 30})`); g.addColorStop(1, `rgb(${tone - 50},${tone - 56},${tone - 64})`);
      c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
    } });
  }
  // fallen leaves
  for (let n = 0; n < 260; n++) {
    const x = R() * W, y = 50 + R() * (H - 60);
    if (L.pondAt(x, y) < 6) continue;
    const a = R() * Math.PI, col = R() < 0.5 ? '#c98a3a' : '#a85f2a';
    items.push({ x, y, draw: (c) => {
      c.save(); c.translate(x, y); c.rotate(a);
      c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, 1.7, 0.75, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(255,214,140,0.7)'; c.lineWidth = 0.25; c.beginPath(); c.moveTo(-1.4, 0); c.lineTo(1.4, 0); c.stroke();
      c.restore();
    } });
  }
  // dappled light spilling between the canopies
  for (const p of L.props) {
    if (p.kind !== 'tree' && p.kind !== 'palm') continue;
    for (let k = 0; k < 5; k++) {
      const x = p.x + 30 + (R() - 0.5) * 60, y = p.y + 14 + (R() - 0.5) * 26;
      if (L.pondAt(x, y) < 4) continue;
      const rx = 4 + R() * 5;
      items.push({ x, y, draw: (c) => softShadow(c, x, y, rx, rx * 0.45, 0.16, '255,236,150') });
    }
  }
  return (ctx: CanvasRenderingContext2D, ox: number, oy: number) => {
    const T = GROUND_TILE, pad = 80;
    for (const it of items) if (it.x > ox - pad && it.x < ox + T.w + pad && it.y > oy - pad && it.y < oy + T.h + pad) it.draw(ctx);
  };
}

/** The whole ground as GROUND_COLS x GROUND_ROWS high-resolution tiles, row by row. */
export function paintGroundHD(L: Layout): HTMLCanvasElement[] {
  const F = fields(L), detail = detailPass(L), out: HTMLCanvasElement[] = [];
  for (let r = 0; r < GROUND_ROWS; r++) for (let c = 0; c < GROUND_COLS; c++) {
    out.push(paintTile(L, F, c, r, (ctx) => detail(ctx, c * GROUND_TILE.w, r * GROUND_TILE.h)));
  }
  return out;
}
