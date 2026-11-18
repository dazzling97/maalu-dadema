// High-resolution villagers. One parametric renderer draws every human in the game
// (same proportions, same light from the upper-left, same ink outline), so the
// fisherman, Lekam and Sabapathi clearly belong to one world. Identities come from
// the CharSpec: colours, hair, moustache, headband, belly.
import { CharSpec, Dir, DIRS } from './characters';
import { ART, hdCanvas, Ctx } from './hd';

export const HCHAR = { fw: 26, fh: 34, ox: 13, oy: 31 } as const; // world units per frame; origin at the feet
/** Columns: idle0 idle1 blink, walk0..5, fish0 fish1, throw, hurt. */
export const HCOL = { idle: 0, blink: 2, walk: 3, fish: 9, throw: 11, hurt: 12, count: 13 } as const;

type Arms = 'rest' | 'swing' | 'fish' | 'throw' | 'hurt';
type Eyes = 'open' | 'blink' | 'squint';
type Mouth = 'smile' | 'grin' | 'flat' | 'o';
interface Pose { bob: number; t: number | null; arms: Arms; eyes: Eyes; mouth: Mouth; lift?: number; lean?: number; }

const INK = 'rgba(43,27,46,0.92)';
const INK_W = 0.5;
const SANDAL = ['#7a5236', '#5b3a26', '#3f281b'] as const;

// ---------------------------------------------------------------- colour + shape helpers
const toRgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const lighten = (h: string, t: number) => { const c = toRgb(h).map((v) => Math.round(v + (255 - v) * t)); return `rgb(${c[0]},${c[1]},${c[2]})`; };
const darken = (h: string, t: number) => { const c = toRgb(h).map((v) => Math.round(v * (1 - t))); return `rgb(${c[0]},${c[1]},${c[2]})`; };

class Painter {
  constructor(readonly c: Ctx) {}
  /** Fill a path with light from the upper-left (light, base, shade) and ink its edge. */
  shade(p: Path2D, box: [number, number, number, number], cols: readonly [string, string, string], ink = true) {
    const [x0, y0, x1, y1] = box, g = this.c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, cols[0]); g.addColorStop(0.42, cols[1]); g.addColorStop(1, cols[2]);
    this.c.fillStyle = g; this.c.fill(p);
    if (ink) { this.c.strokeStyle = INK; this.c.lineWidth = INK_W; this.c.lineJoin = 'round'; this.c.stroke(p); }
  }
  flat(p: Path2D, col: string, ink = false) { this.c.fillStyle = col; this.c.fill(p); if (ink) { this.c.strokeStyle = INK; this.c.lineWidth = INK_W; this.c.stroke(p); } }
  line(x0: number, y0: number, x1: number, y1: number, col: string, w: number) {
    this.c.strokeStyle = col; this.c.lineWidth = w; this.c.lineCap = 'round';
    this.c.beginPath(); this.c.moveTo(x0, y0); this.c.lineTo(x1, y1); this.c.stroke();
  }
  curve(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, w: number) {
    this.c.strokeStyle = col; this.c.lineWidth = w; this.c.lineCap = 'round';
    this.c.beginPath(); this.c.moveTo(x0, y0); this.c.quadraticCurveTo(cx, cy, x1, y1); this.c.stroke();
  }
}
const ell = (x: number, y: number, rx: number, ry: number, rot = 0) => { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; };
const rrect = (x: number, y: number, w: number, h: number, r: number) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };
/** A limb: round-ended capsule from (x1,y1) to (x2,y2). */
function capsule(x1: number, y1: number, x2: number, y2: number, r: number) {
  const a = Math.atan2(y2 - y1, x2 - x1), p = new Path2D();
  p.arc(x1, y1, r, a + Math.PI / 2, a - Math.PI / 2);
  p.arc(x2, y2, r, a - Math.PI / 2, a + Math.PI / 2);
  p.closePath();
  return p;
}
const skinCols = (s: CharSpec) => [lighten(s.skin[0], 0.12), s.skin[1], s.skin[2]] as const;
const shirtCols = (s: CharSpec) => [lighten(s.shirtCol[0], 0.35), s.shirtCol[0], s.shirtCol[1]] as const;
const sarongCols = (s: CharSpec) => [lighten(s.sarong[0], 0.22), s.sarong[0], s.sarong[2]] as const;
const hairCols = (s: CharSpec) => [lighten(s.hairCol[1], 0.1), s.hairCol[0], darken(s.hairCol[0], 0.35)] as const;

// ---------------------------------------------------------------- shared parts
function sandal(P: Painter, x: number, y: number, side: boolean) {
  P.shade(ell(x, y, side ? 2.1 : 1.7, 0.9), [x - 2, y - 1, x + 2, y + 1], SANDAL);
}
function leg(P: Painter, s: CharSpec, x1: number, y1: number, x2: number, y2: number, far = false) {
  const k = skinCols(s);
  P.shade(capsule(x1, y1, x2, y2, 1.25), [x1 - 2, y1, x2 + 2, y2], far ? [k[1], k[2], darken(s.skin[2], 0.15)] : k);
}
/** Arm from the shoulder to the hand; a short sleeve if the character wears a shirt. */
function arm(P: Painter, s: CharSpec, sx: number, sy: number, hx: number, hy: number, far = false) {
  const k = skinCols(s), r = s.belly ? 1.35 : 1.2;
  P.shade(capsule(sx, sy, hx, hy, r), [sx - 2, sy - 2, hx + 2, hy + 2], far ? [k[1], k[2], darken(s.skin[2], 0.2)] : k);
  if (s.shirt === 'shirt') {
    const ex = sx + (hx - sx) * 0.42, ey = sy + (hy - sy) * 0.42;
    const c = shirtCols(s);
    P.shade(capsule(sx, sy, ex, ey, r + 0.45), [sx - 2, sy - 2, ex + 2, ey + 2], far ? [c[1], c[2], darken(s.shirtCol[1], 0.2)] : c);
  }
  P.shade(ell(hx, hy, 1.15, 1.05), [hx - 1, hy - 1, hx + 1, hy + 1], [lighten(s.skin[0], 0.2), s.skin[0], s.skin[1]]);
}
function sarongStripes(P: Painter, s: CharSpec, shape: Path2D, x0: number, x1: number, y0: number, y1: number) {
  const c = P.c;
  c.save(); c.clip(shape);
  c.strokeStyle = s.sarong[1]; c.globalAlpha = 0.75; c.lineWidth = 0.6;
  for (let x = x0 + 1.2; x < x1; x += 2.4) { c.beginPath(); c.moveTo(x, y0); c.lineTo(x + 0.4, y1); c.stroke(); }
  c.globalAlpha = 1;
  c.fillStyle = s.sarong[2]; c.fillRect(x0 - 1, y1 - 1.1, x1 - x0 + 2, 1.1); // hem
  c.restore();
  c.strokeStyle = INK; c.lineWidth = INK_W; c.stroke(shape);
}
function rod(P: Painter, x0: number, y0: number, x1: number, y1: number) {
  P.line(x0, y0, x1, y1, '#5e3c22', 1.05);
  P.line(x0, y0, x1, y1, '#a8744a', 0.55);
  P.c.fillStyle = '#f4f1e6'; P.c.beginPath(); P.c.arc(x1, y1, 0.45, 0, Math.PI * 2); P.c.fill();
}

// ---------------------------------------------------------------- faces
function eye(P: Painter, x: number, y: number, e: Eyes, look = 0) {
  if (e === 'blink') { P.curve(x - 1, y + 0.2, x, y + 0.9, x + 1, y + 0.2, '#2a1a22', 0.45); return; }
  if (e === 'squint') { P.curve(x - 1, y - 0.5, x + 0.6, y + 0.1, x - 1, y + 0.7, '#2a1a22', 0.45); return; }
  P.flat(ell(x, y, 1.05, 1.3), '#fbf7ee');
  P.flat(ell(x + look, y + 0.25, 0.72, 0.9), '#2a1a22');
  P.flat(ell(x + look - 0.3, y - 0.2, 0.28, 0.28), '#ffffff');
}
function mouth(P: Painter, x: number, y: number, m: Mouth, w = 1.3) {
  const lip = '#8a3a2a';
  if (m === 'flat') { P.line(x - w * 0.7, y, x + w * 0.7, y, lip, 0.45); return; }
  if (m === 'o') { P.flat(ell(x, y + 0.2, 0.75, 0.9), '#5a1e1e'); return; }
  if (m === 'grin') {
    const p = new Path2D(); p.moveTo(x - w, y - 0.2); p.quadraticCurveTo(x, y + 2.1, x + w, y - 0.2); p.closePath();
    P.flat(p, '#5a1e1e'); P.c.save(); P.c.clip(p); P.c.fillStyle = '#fffaf0'; P.c.fillRect(x - w, y - 0.4, w * 2, 0.75); P.c.restore();
    return;
  }
  P.curve(x - w, y - 0.2, x, y + 1.2, x + w, y - 0.2, lip, 0.5);
}

// ---------------------------------------------------------------- front and back
function drawFront(P: Painter, s: CharSpec, p: Pose, back: boolean) {
  const b = p.bob, wide = s.belly ? 1.2 : 0;
  const ph = p.t === null ? 0 : Math.sin(p.t * Math.PI * 2);
  const hipY = 23.5 + b, footY = 30.6;
  const shY = 14.6 + b, lsx = 7.6 - wide, rsx = 18.4 + wide;

  // the rod rides on the shoulder when not in use
  if (s.rod && (p.arms === 'rest' || p.arms === 'swing')) {
    if (back) rod(P, 17, 22 + b, 22, 2.5); else rod(P, 20, 21 + b, 24, 2.5);
  }
  // legs and sandals: on the beat, one foot lifts
  const liftL = Math.max(0, ph) * 1.6, liftR = Math.max(0, -ph) * 1.6;
  leg(P, s, 10.6, hipY, 10.6, footY - liftL); leg(P, s, 15.4, hipY, 15.4, footY - liftR, true);
  sandal(P, 10.4, footY + 0.2 - liftL, false); sandal(P, 15.6, footY + 0.2 - liftR, false);

  // sarong: a slightly flared wrap with its stripes
  const wy = 19.6 + b, hy = (s.sarongShort ? 26 : 28) + b + Math.abs(ph) * 0.2;
  const sar = new Path2D();
  sar.moveTo(8.2 - wide, wy); sar.lineTo(17.8 + wide, wy);
  sar.quadraticCurveTo(19 + wide, hy - 2, 18.6 + wide, hy); sar.quadraticCurveTo(13, hy + 0.9, 7.4 - wide, hy);
  sar.quadraticCurveTo(7 - wide, hy - 2, 8.2 - wide, wy); sar.closePath();
  P.shade(sar, [7, wy, 19, hy], sarongCols(s), false);
  sarongStripes(P, s, sar, 7 - wide, 19 + wide, wy, hy + 1);
  if (!back) P.shade(ell(13, wy + 0.9, 1.3, 1), [12, wy, 14, wy + 2], [lighten(s.sarong[0], 0.3), s.sarong[0], s.sarong[2]]); // tucked knot

  // arms behind the body first when they swing back
  const swing = ph * 0.45;
  const handAt = (sx: number, dir: number, ang: number): [number, number] => [sx + Math.sin(ang) * 1.2 * dir - dir * 0.6, shY + Math.cos(ang) * 6.6];
  let L: [number, number], R: [number, number];
  switch (p.arms) {
    case 'fish': L = back ? [16.2, 14.8 + b] : [17, 17 + b]; R = back ? [19, 14 + b] : [19, 15.6 + b]; break;
    case 'throw': L = back ? [8, 19 + b] : [9.4, 19.6 + b]; R = [21.4, 6.6 + b]; break;
    case 'hurt': L = [4.4, 10.6 + b]; R = [21.6, 10.6 + b]; break;
    case 'swing': L = handAt(lsx, -1, swing); R = handAt(rsx, 1, -swing); break;
    default: L = [lsx - 0.9, shY + 6.4]; R = [rsx + 0.9, shY + 6.4];
  }

  // torso
  const torso = rrect(8 - wide, 13.4 + b, 10 + wide * 2, 7.2 + wide * 0.4, 3);
  P.shade(torso, [8, 13 + b, 18, 21 + b], shirtCols(s));
  if (s.belly) P.shade(ell(13, 19.2 + b, 6.6, 3.2), [7, 16 + b, 19, 22 + b], shirtCols(s));
  if (s.shirt === 'vest') {
    const k = skinCols(s);
    // bare shoulders, and the open neck of the vest
    P.shade(ell(8.6 - wide, 14.6 + b, 1.6, 1.3), [7, 13 + b, 10, 16 + b], k, false);
    P.shade(ell(17.4 + wide, 14.6 + b, 1.6, 1.3), [16, 13 + b, 19, 16 + b], k, false);
    if (!back) { const v = new Path2D(); v.moveTo(11, 13.5 + b); v.lineTo(13, 16.6 + b); v.lineTo(15, 13.5 + b); v.closePath(); P.flat(v, s.skin[1]); }
  } else if (!back) {
    const v = new Path2D(); v.moveTo(11.3, 13.5 + b); v.lineTo(13, 15.4 + b); v.lineTo(14.7, 13.5 + b); v.closePath(); P.flat(v, s.skin[1]);
    P.line(13, 15.4 + b, 13, 20 + b, darken(s.shirtCol[1], 0.1), 0.35);
    for (const y of [16.6, 18.4]) P.flat(ell(13.6, y + b, 0.3, 0.3), darken(s.shirtCol[1], 0.25));
  }
  arm(P, s, lsx + 0.4, shY, L[0], L[1]);
  arm(P, s, rsx - 0.4, shY, R[0], R[1], true);

  head(P, s, p, back ? 'back' : 'front');
}

function head(P: Painter, s: CharSpec, p: Pose, view: 'front' | 'back' | 'side') {
  const b = p.bob + (p.lift ?? 0), cx = view === 'side' ? 12.4 : 13, cy = 8.4 + b;
  const k = skinCols(s), [h0] = s.hairCol, hc = hairCols(s);
  const c = P.c;
  c.save();
  if (p.lean) { c.translate(cx, cy + 5); c.rotate(p.lean); c.translate(-cx, -cy - 5); }
  // neck and ears
  P.shade(rrect(cx - 1.6, cy + 4, 3.2, 2.6, 1), [cx - 2, cy + 4, cx + 2, cy + 7], [k[1], k[2], k[2]], false);
  if (view !== 'side') { P.shade(ell(cx - 6.2, cy + 0.9, 1, 1.4), [cx - 7, cy, cx - 5, cy + 2], k); P.shade(ell(cx + 6.2, cy + 0.9, 1, 1.4), [cx + 5, cy, cx + 7, cy + 2], k); }
  const face = view === 'side' ? ell(cx, cy, 5.7, 6) : ell(cx, cy, 6.3, 6);
  P.shade(face, [cx - 6, cy - 6, cx + 6, cy + 6], k);

  if (view === 'front') {
    const brow = h0, look = p.arms === 'fish' ? 0.25 : 0;
    eye(P, cx - 2.4, cy + 0.8, p.eyes, look); eye(P, cx + 2.4, cy + 0.8, p.eyes, look);
    const frown = p.arms === 'throw' ? 0.6 : p.eyes === 'squint' ? -0.5 : 0;
    if (s.brows || p.arms === 'throw') { P.line(cx - 3.4, cy - 1.2 - frown * 0.3, cx - 1.4, cy - 1.2 + frown, brow, 0.65); P.line(cx + 1.4, cy - 1.2 + frown, cx + 3.4, cy - 1.2 - frown * 0.3, brow, 0.65); }
    P.curve(cx - 0.6, cy + 2.3, cx, cy + 2.9, cx + 0.6, cy + 2.3, s.skin[2], 0.4); // nose
    P.flat(ell(cx - 3.6, cy + 2.6, 1.1, 0.6), 'rgba(226,112,96,0.35)'); P.flat(ell(cx + 3.6, cy + 2.6, 1.1, 0.6), 'rgba(226,112,96,0.3)');
    if (s.moustache === 1) { const m = new Path2D(); m.moveTo(cx - 2.2, cy + 3.8); m.quadraticCurveTo(cx, cy + 3, cx + 2.2, cy + 3.8); m.quadraticCurveTo(cx, cy + 3.7, cx - 2.2, cy + 3.8); P.flat(m, h0); P.line(cx - 2.2, cy + 3.8, cx + 2.2, cy + 3.8, h0, 0.45); }
    if (s.moustache === 2) {
      const m = new Path2D();
      m.moveTo(cx, cy + 3.2); m.bezierCurveTo(cx - 2.5, cy + 2.6, cx - 4, cy + 4.6, cx - 5.4, cy + 2.4);
      m.bezierCurveTo(cx - 4.4, cy + 5.4, cx - 1.4, cy + 4.6, cx, cy + 4.2);
      m.bezierCurveTo(cx + 1.4, cy + 4.6, cx + 4.4, cy + 5.4, cx + 5.4, cy + 2.4);
      m.bezierCurveTo(cx + 4, cy + 4.6, cx + 2.5, cy + 2.6, cx, cy + 3.2); P.shade(m, [cx - 5, cy + 2, cx + 5, cy + 5], hc);
    }
    mouth(P, cx, cy + 4.6, p.mouth, s.moustache === 2 ? 1 : 1.3);
  }

  if (view === 'side') {
    P.shade(ell(cx - 5.4, cy + 1.6, 1, 0.95), [cx - 6, cy + 1, cx - 4.5, cy + 2.5], k); // nose
    P.shade(ell(cx + 2.2, cy + 1, 1, 1.4), [cx + 1, cy, cx + 3, cy + 2], k); // ear
    eye(P, cx - 2.9, cy + 0.6, p.eyes, -0.3);
    if (s.brows || p.arms === 'throw') P.line(cx - 4, cy - 1.4 + (p.arms === 'throw' ? 0.4 : 0), cx - 1.9, cy - 1.5, h0, 0.65);
    P.flat(ell(cx - 3, cy + 2.6, 1, 0.55), 'rgba(226,112,96,0.35)');
    if (s.moustache === 1) P.line(cx - 5.2, cy + 3.3, cx - 2.9, cy + 3.5, h0, 0.7);
    if (s.moustache === 2) { const m = new Path2D(); m.moveTo(cx - 2.4, cy + 3.3); m.bezierCurveTo(cx - 4.5, cy + 2.6, cx - 6.5, cy + 4.6, cx - 7.4, cy + 2.4); m.bezierCurveTo(cx - 6.4, cy + 5.3, cx - 3.6, cy + 4.6, cx - 2.4, cy + 4.3); m.closePath(); P.shade(m, [cx - 7, cy + 2, cx - 2, cy + 5], hc); }
    const mo = p.mouth === 'grin' ? 'smile' : p.mouth;
    mouth(P, cx - 3.8, cy + 4.5, mo, 0.8);
  }

  // hair
  const hair = new Path2D();
  if (s.hair === 'mop') {
    if (view === 'back') { hair.ellipse(cx, cy - 0.4, 6.6, 6.2, 0, Math.PI * 0.9, Math.PI * 2.1); hair.closePath(); }
    else if (view === 'side') {
      hair.moveTo(cx - 5.6, cy - 0.6); hair.quadraticCurveTo(cx - 6, cy - 6.8, cx + 0.6, cy - 6.8);
      hair.quadraticCurveTo(cx + 6.8, cy - 6, cx + 5.8, cy + 3.6); hair.lineTo(cx + 3.6, cy + 2.6); hair.lineTo(cx + 3.4, cy - 0.6);
      hair.lineTo(cx + 1.6, cy - 2.1); hair.lineTo(cx - 1.2, cy - 1.5); hair.lineTo(cx - 3.2, cy - 2.2); hair.closePath();
    } else {
      hair.moveTo(cx - 6.4, cy + 0.8); hair.quadraticCurveTo(cx - 7, cy - 6.6, cx, cy - 6.9); hair.quadraticCurveTo(cx + 7, cy - 6.6, cx + 6.4, cy + 0.8);
      hair.lineTo(cx + 5.2, cy - 1.4); hair.lineTo(cx + 3.6, cy - 1.8); hair.lineTo(cx + 2.2, cy - 1); hair.lineTo(cx + 0.6, cy - 2.2);
      hair.lineTo(cx - 1.2, cy - 1.2); hair.lineTo(cx - 2.8, cy - 2.3); hair.lineTo(cx - 4.4, cy - 1.2); hair.lineTo(cx - 5.4, cy - 1.8); hair.closePath();
    }
    P.shade(hair, [cx - 6, cy - 7, cx + 6, cy + 2], hc);
    // a cheeky tuft on top
    const tuft = new Path2D(); tuft.moveTo(cx - 0.8, cy - 6.4); tuft.quadraticCurveTo(cx + 0.4, cy - 9.4, cx + 2.2, cy - 8.8); tuft.quadraticCurveTo(cx + 1, cy - 7.6, cx + 1.6, cy - 6.3); tuft.closePath();
    P.shade(tuft, [cx - 1, cy - 9, cx + 2, cy - 6], hc);
    P.curve(cx - 3.6, cy - 5, cx - 1.6, cy - 6.3, cx + 0.4, cy - 5.8, 'rgba(255,255,255,0.28)', 0.6);
  } else if (s.hair === 'sidepart') {
    if (view === 'back') { hair.ellipse(cx, cy - 0.4, 6.5, 6.1, 0, Math.PI * 0.92, Math.PI * 2.08); hair.closePath(); }
    else if (view === 'side') {
      hair.moveTo(cx - 5.4, cy - 1.4); hair.quadraticCurveTo(cx - 5, cy - 6.6, cx + 0.8, cy - 6.6);
      hair.quadraticCurveTo(cx + 6.4, cy - 5.8, cx + 5.6, cy + 3); hair.lineTo(cx + 3.6, cy + 2); hair.lineTo(cx + 3.6, cy - 1.6); hair.quadraticCurveTo(cx - 1, cy - 3.6, cx - 5.4, cy - 1.4);
    } else {
      hair.moveTo(cx - 6.4, cy + 0.4); hair.quadraticCurveTo(cx - 6.8, cy - 6.4, cx + 0.4, cy - 6.6); hair.quadraticCurveTo(cx + 7, cy - 6.4, cx + 6.4, cy + 0.4);
      hair.lineTo(cx + 5.6, cy - 2.2); hair.quadraticCurveTo(cx + 1, cy - 3.6, cx - 2.2, cy - 2.6); hair.lineTo(cx - 2.6, cy - 4.4); hair.lineTo(cx - 5.6, cy - 1.6); hair.closePath();
    }
    P.shade(hair, [cx - 6, cy - 7, cx + 6, cy + 2], hc);
    if (view !== 'back') P.curve(cx - 2.4, cy - 4.6, cx - 2.2, cy - 6.2, cx - 0.6, cy - 6.4, 'rgba(255,255,255,0.3)', 0.4); // the parting
    // greying temples
    const t = s.hairCol[1];
    // thin streaks inside the hairline (separate blobs over the ears read as headphones)
    if (view === 'front') { P.curve(cx - 5.9, cy - 0.2, cx - 6.1, cy - 2.6, cx - 4.6, cy - 4.2, t, 0.75); P.curve(cx + 5.9, cy - 0.2, cx + 6.1, cy - 2.6, cx + 4.6, cy - 4.2, t, 0.75); }
    else if (view === 'side') P.curve(cx + 1.4, cy - 1.9, cx + 3.2, cy - 2.6, cx + 4.6, cy - 0.6, t, 0.75);
  } else {
    // bald on top with a shine; a horseshoe of hair round the back
    // a thin greying fringe, close to the head (it must never read as ear-muffs)
    const fr = [lighten(s.hairCol[1], 0.25), s.hairCol[1], s.hairCol[0]] as const;
    const crescent = (x: number, y: number, flip: number) => {
      const q = new Path2D();
      q.moveTo(x, y - 2.2); q.quadraticCurveTo(x + 1.3 * flip, y, x, y + 2.4); q.quadraticCurveTo(x + 0.5 * flip, y, x, y - 2.2); q.closePath();
      P.shade(q, [x - 1, y - 2, x + 1, y + 2], fr, false);
    };
    if (view === 'back') { hair.moveTo(cx - 6.1, cy - 0.4); hair.quadraticCurveTo(cx, cy + 3.4, cx + 6.1, cy - 0.4); hair.quadraticCurveTo(cx, cy + 5.4, cx - 6.1, cy - 0.4); P.shade(hair, [cx - 6, cy, cx + 6, cy + 5], fr, false); }
    else if (view === 'side') { hair.moveTo(cx + 1.4, cy - 1.6); hair.quadraticCurveTo(cx + 6.4, cy - 1, cx + 3.4, cy + 4.6); hair.quadraticCurveTo(cx + 4.8, cy + 0.4, cx + 1.4, cy - 1.6); P.shade(hair, [cx + 1, cy - 2, cx + 6, cy + 5], fr, false); }
    else { crescent(cx - 6, cy - 0.6, -1); crescent(cx + 6, cy - 0.6, 1); }
    P.flat(ell(cx - 2, cy - 4, 1.8, 0.9, -0.4), 'rgba(255,240,210,0.55)');
  }
  // headband with its tails
  if (s.headband) {
    const hb = s.headband, sway = p.t === null ? 0 : Math.sin(p.t * Math.PI * 2) * 0.8;
    if (view === 'side') {
      P.shade(rrect(cx - 5.7, cy - 3, 11.4, 1.6, 0.6), [cx - 6, cy - 3, cx + 6, cy - 1], [lighten(hb, 0.3), hb, darken(hb, 0.3)]);
      P.curve(cx + 5.2, cy - 2.2, cx + 7.4, cy - 2 + sway, cx + 8.6, cy - 0.4 + sway, hb, 0.9);
      P.curve(cx + 5.2, cy - 2, cx + 6.8, cy + 0.2, cx + 7.6, cy + 1.6 - sway, darken(hb, 0.2), 0.8);
    } else {
      P.shade(rrect(cx - 6.4, cy - 3.2, 12.8, 1.7, 0.7), [cx - 6, cy - 3, cx + 6, cy - 1], [lighten(hb, 0.3), hb, darken(hb, 0.3)]);
      if (view === 'back') { P.shade(ell(cx, cy - 2.3, 1, 0.9), [cx - 1, cy - 3, cx + 1, cy - 1], [lighten(hb, 0.3), hb, darken(hb, 0.3)]); P.curve(cx, cy - 2, cx - 1, cy + 1, cx - 0.6 + sway, cy + 3, hb, 0.9); P.curve(cx, cy - 2, cx + 1.2, cy + 0.8, cx + 1.4 + sway, cy + 2.6, darken(hb, 0.2), 0.8); }
      else { P.curve(cx + 6, cy - 2.4, cx + 8, cy - 2 + sway, cx + 8.6, cy + 0.2 + sway, hb, 0.9); P.curve(cx + 6, cy - 2.2, cx + 7.2, cy + 0.4, cx + 7.4, cy + 2 - sway, darken(hb, 0.2), 0.8); }
    }
  }
  c.restore();
}

// ---------------------------------------------------------------- side (faces left; right is mirrored)
function drawSide(P: Painter, s: CharSpec, p: Pose) {
  const b = p.bob, wide = s.belly ? 1.2 : 0;
  const ph = p.t === null ? 0 : Math.sin(p.t * Math.PI * 2), co = p.t === null ? 0 : Math.cos(p.t * Math.PI * 2);
  const hipX = 12.8, hipY = 23.5 + b, footY = 30.6;
  const shX = 12.6, shY = 14.8 + b;
  // hands
  let near: [number, number], far: [number, number];
  switch (p.arms) {
    case 'fish': near = [5.4, 18 + b]; far = [6.6, 17.4 + b]; break;
    case 'throw': near = [5.6, 9.4 + b]; far = [16.4, 19 + b]; break;
    case 'hurt': near = [16.6, 9 + b]; far = [8.6, 11 + b]; break;
    case 'swing': near = [shX - ph * 3.4, shY + 6.2 - Math.abs(ph) * 0.5]; far = [shX + ph * 3, shY + 6]; break;
    default: near = [shX - 0.4, shY + 6.4]; far = [shX + 0.8, shY + 6.2];
  }
  if (s.rod && (p.arms === 'rest' || p.arms === 'swing')) rod(P, near[0] + 0.6, near[1], 21.6, 3.4);
  arm(P, s, shX + 0.6, shY, far[0], far[1], true);
  // legs: stride with the walk phase; the foot coming forward lifts
  const fA = hipX - ph * 3.2, fB = hipX + ph * 3.2, lA = Math.max(0, -co) * 1.3, lB = Math.max(0, co) * 1.3;
  leg(P, s, hipX + 0.6, hipY, fB, footY - lB, true); sandal(P, fB - 0.5, footY + 0.2 - lB, true);
  leg(P, s, hipX - 0.6, hipY, fA, footY - lA); sandal(P, fA - 0.5, footY + 0.2 - lA, true);
  // sarong
  const wy = 19.6 + b, hy = (s.sarongShort ? 26 : 28) + b;
  const sar = new Path2D();
  sar.moveTo(9 - wide, wy); sar.lineTo(16.4, wy); sar.quadraticCurveTo(17.4, hy - 2, 17 + ph * 0.4, hy);
  sar.quadraticCurveTo(12.6, hy + 0.8, 8.2 - wide - ph * 0.4, hy); sar.quadraticCurveTo(8 - wide, hy - 2, 9 - wide, wy); sar.closePath();
  P.shade(sar, [8, wy, 17, hy], sarongCols(s), false);
  sarongStripes(P, s, sar, 8 - wide, 17.4, wy, hy + 1);
  // torso, belly forward
  P.shade(rrect(9.2, 13.4 + b, 7.4, 7.4, 2.8), [9, 13 + b, 17, 21 + b], shirtCols(s));
  if (s.belly) P.shade(ell(9.8, 18.6 + b, 3.4, 3.2), [6, 15 + b, 13, 22 + b], shirtCols(s));
  if (s.shirt === 'vest') P.shade(ell(12.6, 14.4 + b, 1.8, 1.2), [11, 13 + b, 14, 16 + b], skinCols(s), false);
  arm(P, s, shX, shY, near[0], near[1]);
  head(P, s, p, 'side');
}

// ---------------------------------------------------------------- sheet
function poseFor(col: number, spec: CharSpec): Pose {
  const smile: Mouth = spec.moustache === 0 ? 'grin' : 'smile';
  if (col <= 2) return { bob: col === 1 ? 0.35 : 0, t: null, arms: 'rest', eyes: col === 2 ? 'blink' : 'open', mouth: 'smile' };
  if (col < HCOL.fish) { const t = (col - HCOL.walk) / 6; return { bob: -Math.abs(Math.sin(t * Math.PI * 2)) * 0.7 + 0.35, t, arms: 'swing', eyes: 'open', mouth: smile }; }
  if (col < HCOL.throw) return { bob: col === HCOL.fish ? 0 : 0.3, t: null, arms: 'fish', eyes: 'open', mouth: 'flat' };
  if (col === HCOL.throw) return { bob: -0.3, t: null, arms: 'throw', eyes: 'open', mouth: 'flat', lean: -0.06 };
  return { bob: 0.4, t: null, arms: 'hurt', eyes: 'squint', mouth: 'o', lean: 0.12, lift: -0.4 };
}

/** Full HD sheet: rows down, left, right, up; HCOL.count columns. */
export function charSheetHD(spec: CharSpec): HTMLCanvasElement {
  const { fw, fh } = HCHAR;
  const [c, ctx] = hdCanvas(fw * HCOL.count, fh * DIRS.length, false);
  DIRS.forEach((dir: Dir, row) => {
    for (let col = 0; col < HCOL.count; col++) {
      const [f, fx] = hdCanvas(fw, fh);
      const P = new Painter(fx), pose = poseFor(col, spec);
      if (dir === 'down') drawFront(P, spec, pose, false);
      else if (dir === 'up') drawFront(P, spec, pose, true);
      else drawSide(P, spec, pose);
      ctx.save();
      if (dir === 'right') { ctx.translate((col + 1) * fw * ART, row * fh * ART); ctx.scale(-1, 1); ctx.drawImage(f, 0, 0); }
      else ctx.drawImage(f, col * fw * ART, row * fh * ART);
      ctx.restore();
    }
  });
  return c;
}

/** A sharp still of the front idle pose for menus, drawn at `k` times the sheet density. */
export function charPortraitHD(spec: CharSpec, k = 3): HTMLCanvasElement {
  const { fw, fh } = HCHAR;
  const [c, ctx] = hdCanvas(fw * k, fh * k);
  ctx.scale(k, k);
  drawFront(new Painter(ctx), spec, poseFor(HCOL.idle, spec), false);
  return c;
}
