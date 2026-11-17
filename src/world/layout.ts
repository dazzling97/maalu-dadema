import { WORLD, CELL } from '../config/game';
import { vnoise, rng } from '../art/px';
import { ZoneId, ZONES } from '../config/balance';

// The whole village is described here as data: pond shape, paths, where every
// prop stands, and the collision grid. Art generators and gameplay both read it.

export type PropKind =
  | 'palm' | 'palmKing' | 'tree' | 'banana' | 'bush' | 'bushFlower' | 'rockL' | 'rockM' | 'rockS'
  | 'reeds' | 'fence' | 'bag' | 'lella' | 'signA' | 'signB' | 'signC'
  | 'basket' | 'bench' | 'pot' | 'thambili' | 'sack' | 'crate' | 'shop' | 'egret';

export interface Prop { kind: PropKind; x: number; y: number; r?: number; }
export interface Lily { x: number; y: number; flower: 0 | 1 | 2; }
export interface Rect { x: number; y: number; w: number; h: number; }

export const SHOP = { x: 1290, y: 340, w: 112, h: 62 }; // base-centre x, base y, solid footprint
export const SHOP_DOOR = { x: SHOP.x + 35, y: SHOP.y + 4 };
/** Walkable planks. Both docks run from the south bank up into the water. */
export const DOCKS: Rect[] = [
  { x: 548, y: 506, w: 26, h: 104 }, // main dock, Dock Shallows
  { x: 868, y: 542, w: 26, h: 104 }, // east dock, River Bend
];
export const DOCK = DOCKS[0];
export const POND_C = { x: 600, y: 380 };
export const SPAWN = { x: 561, y: 626 };
/** The stationary fish bag: a short walk from the main dock, beside the road Sabapathi uses. */
export const BAG_POS = { x: 646, y: 668 };
/** The fishing-gear stall: just west of the main dock, on the way to nowhere Sabapathi goes. */
export const GEAR_POS = { x: 476, y: 674 };
/** Water west of / north of this corner is the Deep Swamp. */
export const SWAMP = { x: 430, y: 370 };
export const BEND_X = 800; // water east of this is the River Bend

/** Which fishing zone a point on the water belongs to. */
export function waterZone(x: number, y: number): ZoneId {
  if (x < SWAMP.x && y < SWAMP.y) return 'C';
  if (x > BEND_X) return 'B';
  return 'A';
}

const PATHS: [number, number][][] = [
  // shop door -> down the east side -> along the south bank past the bag -> main dock
  [[SHOP_DOOR.x, SHOP_DOOR.y], [1318, 400], [1262, 500], [1160, 650], [1010, 712], [880, 702], [760, 714], [640, 694], [575, 650], [561, 618]],
  [[880, 702], [881, 652]], // spur to the east dock
  [[640, 694], [470, 728], [300, 706], [170, 660], [120, 540], [125, 380], [190, 230]], // west bank, up to the swamp
  [[300, 706], [150, 766], [-20, 790]], // road out west
  [[1160, 650], [1190, 780], [1170, 860]], // road out south
];

function ell(x: number, y: number, cx: number, cy: number, rx: number, ry: number) {
  return (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);
}
function smin(a: number, b: number, k: number) {
  const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - a)) / k));
  return b + (a - b) * h - k * h * (1 - h);
}
function pondRaw(x: number, y: number): number {
  // a broad main body, an eastern lobe (the river bend) and a north-west arm (the swamp).
  // Sized so that, seen from the south bank, water fills about half of the view.
  let d = smin(ell(x, y, 590, 370, 390, 200), ell(x, y, 910, 470, 175, 140), 40);
  d = smin(d, ell(x, y, 320, 280, 135, 105), 36);
  return d + (vnoise(x, y, 46, 7) - 0.5) * 26 + (vnoise(x, y, 17, 9) - 0.5) * 8;
}

function catmull(pts: [number, number][], step = 3): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const n = Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step);
    for (let j = 0; j < n; j++) {
      const t = j / n, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export class Layout {
  readonly w = WORLD.w;
  readonly h = WORLD.h;
  readonly cell = CELL;
  /** Signed distance to the pond shore, per pixel. Negative = water. */
  readonly pond = new Float32Array(WORLD.w * WORLD.h);
  /** Distance to the nearest dirt-path centre line (capped at 40). */
  readonly pathDist = new Float32Array(WORLD.w * WORLD.h).fill(40);
  readonly props: Prop[] = [];
  readonly lilies: Lily[] = [];
  readonly gw = WORLD.w / CELL;
  readonly gh = WORLD.h / CELL;
  /** Collision grid: 1 = blocked. */
  readonly solid = new Uint8Array(this.gw * this.gh);
  readonly pathLines = PATHS.map((p) => catmull(p));

  constructor() {
    const { w, h } = this;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) this.pond[y * w + x] = pondRaw(x, y);
    for (const pl of this.pathLines) {
      for (const [px, py] of pl) {
        const R = 16;
        for (let y = Math.max(0, Math.floor(py - R)); y < Math.min(h, py + R); y++) {
          for (let x = Math.max(0, Math.floor(px - R)); x < Math.min(w, px + R); x++) {
            const d = Math.hypot(x - px, y - py);
            const i = y * w + x;
            if (d < this.pathDist[i]) this.pathDist[i] = d;
          }
        }
      }
    }
    this.placeProps();
    this.buildCollision();
  }

  pondAt(x: number, y: number): number {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 99;
    return this.pond[y * this.w + x];
  }
  pathAt(x: number, y: number): number {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 40;
    return this.pathDist[y * this.w + x];
  }
  onDock(x: number, y: number, pad = 0): boolean {
    return DOCKS.some((d) => x >= d.x - pad && x <= d.x + d.w + pad && y >= d.y - pad && y <= d.y + d.h + pad);
  }

  /** March out from the pond centre to find the shore at an angle. `inset` > 0 lands inside the water. */
  shorePoint(angle: number, inset: number): { x: number; y: number } {
    const dx = Math.cos(angle), dy = Math.sin(angle);
    let t = 20;
    while (t < 900 && this.pondAt(POND_C.x + dx * t, POND_C.y + dy * t) < -inset) t += 1;
    return { x: Math.round(POND_C.x + dx * t), y: Math.round(POND_C.y + dy * t) };
  }

  /** Is this spot clear of water, paths, the shop yard, the bag and other props? */
  private free(x: number, y: number, pad: number): boolean {
    if (x < 8 || y < 30 || x > this.w - 8 || y > this.h - 4) return false;
    if (this.pondAt(x, y) < pad + 4) return false;
    if (this.pathAt(x, y) < pad + 10) return false;
    if (Math.abs(x - SHOP.x) < SHOP.w / 2 + 26 && y > SHOP.y - SHOP.h - 44 && y < SHOP.y + 46) return false;
    if (Math.hypot(x - SPAWN.x, y - SPAWN.y) < 54) return false;
    if (Math.hypot(x - BAG_POS.x, y - BAG_POS.y) < 46) return false;
    if (Math.hypot(x - GEAR_POS.x, y - GEAR_POS.y) < 50) return false;
    for (const d of DOCKS) if (Math.abs(x - (d.x + 13)) < 30 && Math.abs(y - (d.y + d.h)) < 30) return false;
    for (const p of this.props) if (Math.hypot(p.x - x, (p.y - y) * 1.4) < pad + (p.r ?? 6) + 5) return false;
    return true;
  }
  private add(kind: PropKind, x: number, y: number, r?: number) {
    this.props.push({ kind, x: Math.round(x), y: Math.round(y), r });
  }

  private placeProps() {
    const R = rng(20261116);
    this.add('shop', SHOP.x, SHOP.y, 0);
    this.add('bag', BAG_POS.x, BAG_POS.y, 6);
    this.add('lella', GEAR_POS.x, GEAR_POS.y, 0);
    this.add('signA', DOCK.x + 44, DOCK.y + DOCK.h + 4, 0);
    { const b = this.shorePoint(0.2, -13); this.add('signB', b.x, b.y, 0); const c = this.shorePoint(-2.75, -13); this.add('signC', c.x, c.y, 0); }
    // a little fishing gear by each dock
    this.add('basket', DOCK.x + 54, DOCK.y + DOCK.h + 22, 4);
    this.add('crate', DOCK.x - 22, DOCK.y + DOCK.h - 2, 5);
    this.add('crate', DOCKS[1].x + 48, DOCKS[1].y + DOCKS[1].h + 2, 5);
    // shop yard
    this.add('bench', SHOP.x - 30, SHOP.y + 14, 0);
    this.add('pot', SHOP.x - 60, SHOP.y + 6, 4);
    this.add('pot', SHOP.x - 68, SHOP.y + 12, 4);
    this.add('thambili', SHOP.x + 60, SHOP.y + 8, 5);
    this.add('sack', SHOP.x + 8, SHOP.y + 6, 4);
    for (let i = 0; i < 2; i++) this.add('fence', SHOP.x - 110 + i * 32, SHOP.y - 40, -1);
    for (let i = 0; i < 3; i++) this.add('fence', 400 + i * 32, 790, -1);

    // hero trees framing the water and the roads; anything landing on water or a path is skipped
    const hero: [PropKind, number, number][] = [
      ['palm', 450, 636], ['palmKing', 700, 636], ['palm', 800, 668], ['palmKing', 960, 676], ['tree', 330, 650],
      ['palm', 160, 520], ['tree', 70, 440], ['palm', 60, 280], ['palmKing', 140, 150], ['tree', 260, 110],
      ['palm', 420, 100], ['palm', 560, 110], ['tree', 700, 100], ['palmKing', 850, 130], ['palm', 1000, 190],
      ['tree', 1120, 270], ['palm', 1140, 400], ['palmKing', 1200, 540], ['tree', 1380, 480], ['palm', 1400, 320],
      ['banana', 1200, 270], ['banana', 1380, 400], ['tree', 1000, 790], ['palm', 860, 780], ['tree', 620, 800],
      ['palm', 340, 800], ['banana', 240, 620], ['tree', 1300, 700], ['palm', 1280, 800], ['banana', 760, 790],
      ['palm', 60, 660], ['tree', 180, 810], ['palmKing', 540, 770], ['palm', 1080, 620],
    ];

    for (const [k, x, y] of hero) if (this.free(x, y, 4)) this.add(k, x, y, 5);

    // jungle wall around the map edge
    for (let x = 20; x < this.w; x += 44) {
      for (const y of [44 + R() * 22, this.h - 6 - R() * 14]) {
        const xx = x + (R() - 0.5) * 24;
        if (this.free(xx, y, 2)) this.add(R() < 0.5 ? 'tree' : R() < 0.5 ? 'palm' : 'palmKing', xx, y, 5);
      }
    }
    for (let y = 90; y < this.h - 30; y += 52) {
      for (const x of [16 + R() * 20, this.w - 16 - R() * 20]) {
        const yy = y + (R() - 0.5) * 24;
        if (this.free(x, yy, 2)) this.add(R() < 0.55 ? 'tree' : 'palm', x, yy, 5);
      }
    }
    // scatter: enough to feel lush, sparse enough to leave room to run
    const scatter = (kind: PropKind, n: number, r: number) => {
      let tries = 0;
      while (n > 0 && tries++ < 6000) {
        const x = 20 + R() * (this.w - 40), y = 50 + R() * (this.h - 70);
        if (this.free(x, y, r + 3)) { this.add(kind, x, y, r); n--; }
      }
    };
    scatter('banana', 9, 5);
    scatter('bush', 38, 6);
    scatter('bushFlower', 30, 6);
    scatter('rockL', 8, 7);
    scatter('rockM', 12, 5);
    scatter('rockS', 26, 0);

    // reeds hugging the shore (skipping the dock mouths)
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2 + R() * 0.08;
      const p = this.shorePoint(a, R() * 5 - 1);
      if (DOCKS.some((d) => Math.abs(p.x - (d.x + 13)) < 36 && p.y > d.y)) continue;
      if (R() < 0.3) continue;
      this.add('reeds', p.x, p.y + 2, 0);
    }
    { const e = this.shorePoint(-0.9, 7); this.add('egret', e.x, e.y, 0); }

    // lily pads in loose clusters
    for (let c = 0; c < 20; c++) {
      const a = R() * Math.PI * 2;
      const base = this.shorePoint(a, 16 + R() * 30);
      const n = 2 + Math.floor(R() * 4);
      for (let i = 0; i < n; i++) {
        const x = base.x + (R() - 0.5) * 34, y = base.y + (R() - 0.5) * 18;
        if (this.pondAt(x, y) > -9 || this.onDock(x, y, 14)) continue;
        if (this.lilies.some((l) => Math.hypot(l.x - x, l.y - y) < 12)) continue;
        this.lilies.push({ x: Math.round(x), y: Math.round(y), flower: R() < 0.3 ? 1 : R() < 0.2 ? 2 : 0 });
      }
    }
    this.props.sort((a, b) => a.y - b.y);
  }

  private block(x0: number, y0: number, x1: number, y1: number) {
    for (let gy = Math.max(0, Math.floor(y0 / CELL)); gy <= Math.min(this.gh - 1, Math.floor(y1 / CELL)); gy++)
      for (let gx = Math.max(0, Math.floor(x0 / CELL)); gx <= Math.min(this.gw - 1, Math.floor(x1 / CELL)); gx++)
        this.solid[gy * this.gw + gx] = 1;
  }

  private buildCollision() {
    const { gw, gh } = this;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = gx * CELL + 2, y = gy * CELL + 2;
        const edge = x < 26 || x > this.w - 26 || y < 60 || y > this.h - 14;
        const water = this.pondAt(x, y) < 1 && !this.onDock(x, y, 0);
        if (edge || water) this.solid[gy * gw + gx] = 1;
      }
    }
    for (const p of this.props) {
      if (p.kind === 'shop') this.block(SHOP.x - SHOP.w / 2, SHOP.y - SHOP.h, SHOP.x + SHOP.w / 2, SHOP.y - 2);
      else if (p.kind === 'fence') this.block(p.x - 15, p.y - 5, p.x + 15, p.y - 1);
      else if (p.kind === 'bench') this.block(p.x - 12, p.y - 5, p.x + 12, p.y - 1);
      else if (p.r && p.r > 0) this.block(p.x - p.r, p.y - p.r, p.x + p.r, p.y);
    }
  }

  /** The gear stall only exists from Stage 2, so its footprint is switched on and off with it. */
  setStall(open: boolean) {
    for (let gy = Math.floor((GEAR_POS.y - 12) / CELL); gy <= Math.floor((GEAR_POS.y - 2) / CELL); gy++)
      for (let gx = Math.floor((GEAR_POS.x - 18) / CELL); gx <= Math.floor((GEAR_POS.x + 18) / CELL); gx++)
        this.solid[gy * this.gw + gx] = open ? 1 : 0;
  }
  blocked(x: number, y: number): boolean {
    const gx = Math.floor(x / CELL), gy = Math.floor(y / CELL);
    if (gx < 0 || gy < 0 || gx >= this.gw || gy >= this.gh) return true;
    return this.solid[gy * this.gw + gx] === 1;
  }
  /** Blocked by scenery or the map edge, ignoring water. Used by creatures that swim. */
  landBlocked(x: number, y: number): boolean {
    if (x < 26 || x > this.w - 26 || y < 60 || y > this.h - 14) return true;
    return this.blocked(x, y) && this.pondAt(x, y) >= 1;
  }
  /** Can a small actor (feet box) stand here? */
  canStand(x: number, y: number): boolean {
    return !(this.blocked(x - 4, y) || this.blocked(x + 4, y) || this.blocked(x - 4, y - 3) || this.blocked(x + 4, y - 3));
  }

  /** Stumps (swamp) and rocks (river bend) standing in the water, to make the zones readable. */
  waterDecor(): { kind: 'stump' | 'rock'; x: number; y: number }[] {
    const out: { kind: 'stump' | 'rock'; x: number; y: number }[] = [];
    const R = rng(909);
    for (let i = 0; i < 90 && out.length < 22; i++) {
      const swamp = i % 2 === 0;
      const p = this.shorePoint(swamp ? -3.1 + R() * 1.0 : -0.25 + R() * 1.1, 10 + R() * 40);
      if (waterZone(p.x, p.y) !== (swamp ? 'C' : 'B') || this.pondAt(p.x, p.y) > -8 || this.onDock(p.x, p.y, 16)) continue;
      if (out.some((o) => Math.hypot(o.x - p.x, o.y - p.y) < 24)) continue;
      out.push({ kind: swamp ? 'stump' : 'rock', x: p.x, y: p.y });
    }
    return out;
  }
  /** The fishing zone the player is standing beside, or null when away from the water. */
  zoneNear(x: number, y: number): ZoneId | null {
    if (this.pondAt(x, y) > 46) return null;
    // look for the nearest water in eight directions
    for (let r = 0; r <= 60; r += 6) {
      for (let k = 0; k < 8; k++) {
        const px = x + Math.cos((k * Math.PI) / 4) * r, py = y + Math.sin((k * Math.PI) / 4) * r;
        if (this.pondAt(px, py) < 0 && !this.onDock(px, py, 0)) return waterZone(px, py);
      }
    }
    return null;
  }

  /**
   * Places where a throwable rock can lie: along the banks and beside the
   * roads. Every spot is standable and connected to the spawn point.
   */
  rockSpots(reachable: (x: number, y: number) => boolean): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    const ok = (x: number, y: number) => this.canStand(x, y) && this.canStand(x, y + 6) && this.pathAt(x, y) > 6 && reachable(x, y) && !out.some((o) => Math.hypot(o.x - x, o.y - y) < 70) && Math.hypot(x - BAG_POS.x, y - BAG_POS.y) > 30 && Math.hypot(x - GEAR_POS.x, y - GEAR_POS.y) > 40;
    const tryAdd = (x: number, y: number) => { x = Math.round(x); y = Math.round(y); if (ok(x, y)) out.push({ x, y }); };
    tryAdd(DOCK.x - 30, DOCK.y + DOCK.h + 14);
    tryAdd(BAG_POS.x + 46, BAG_POS.y - 26);
    for (let i = 0; i < 26; i++) { const p = this.shorePoint((i / 26) * Math.PI * 2 + 0.2, -17); tryAdd(p.x, p.y); }
    const R = rng(4242);
    for (const line of this.pathLines) for (let i = 20; i < line.length; i += 46) tryAdd(line[i][0] + (R() < 0.5 ? -17 : 17), line[i][1] + (R() - 0.5) * 10);
    return out;
  }

  zoneAt(x: number, y: number): string {
    if (Math.hypot(x - SHOP_DOOR.x, y - SHOP_DOOR.y) < 78) return "SABAPATHI'S KADE";
    const z = this.zoneNear(x, y);
    if (z) return ZONES[z].name;
    return '';
  }
}
