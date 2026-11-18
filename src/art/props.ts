import { PAL } from '../config/game';
import { makeCanvas, rect, px, ellipse, line, outline } from './px';

const OL = PAL.outline;
const WOOD = PAL.wood;

export interface Sheet { canvas: HTMLCanvasElement; fw: number; fh: number; ox: number; oy: number; }
// ox / oy = origin (the point that sits on the ground) inside one frame.

// ---------------------------------------------------------------- foliage helpers
/** Lobed, lit foliage mass built from overlapping circles. */

// ---------------------------------------------------------------- trees






// ---------------------------------------------------------------- rocks & small props




export function stonesSheet(): Sheet {
  const [c, ctx] = makeCanvas(20, 12);
  for (const [x, y, r] of [[5, 8, 3], [11, 8, 3.4], [15, 9, 2.4], [8, 5, 2.6], [12, 4, 2]] as const) {
    ellipse(ctx, x, y, r, r * 0.8, '#8a8378'); ellipse(ctx, x - 0.6, y - 0.6, r * 0.6, r * 0.45, '#b6af9f');
    px(ctx, x - 1, y - 1, '#d8d2c0');
  }
  outline(c, '#3a3340');
  return { canvas: c, fw: 20, fh: 12, ox: 10, oy: 11 };
}








// ---------------------------------------------------------------- Sabapathi's kade

// ---------------------------------------------------------------- creatures & fx









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




// ---------------------------------------------------------------- crocodile + combat
/** Frames: 0-1 swim (eyes and ridge only), 2-3 walk, 4 jaws open (telegraph), 5 lunge, 6 stunned. Faces left. */


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

/** Zone signposts: frame 0 green (one fish), 1 amber (two), 2 red (three). */


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

/** "SHOP" board for the gear stall, with a little net on it. Frame 1 is the lit version shown when you are close. */

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


