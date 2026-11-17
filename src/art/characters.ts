import { PAL } from '../config/game';
import { Ctx, makeCanvas, rect, px, line, outline, flipH } from './px';

// One parametric villager renderer draws every human in the game, so all
// characters share proportions, pixel density and lighting.
export interface CharSpec {
  skin: [string, string, string]; // light, base, shade
  hair: 'mop' | 'sidepart' | 'bald';
  hairCol: [string, string];
  headband?: string;
  shirt: 'vest' | 'shirt';
  shirtCol: [string, string]; // base, shade
  sarong: [string, string, string]; // base, stripe, shade
  sarongShort?: boolean;
  moustache: 0 | 1 | 2;
  belly?: boolean;
  rod?: boolean;
  brows?: boolean;
}

export const SPECS: Record<string, CharSpec> = {
  podipasiya: {
    skin: ['#c98a5a', '#a86a42', '#84502f'], hair: 'mop', hairCol: ['#2a2030', '#4a3a55'], headband: '#e8433f',
    shirt: 'vest', shirtCol: ['#f7f1e0', '#cfc6ae'], sarong: ['#2f7fb8', '#8fd0f0', '#215a8a'], sarongShort: true,
    moustache: 0, rod: true,
  },
  lekam: {
    skin: ['#bd8256', '#9c6340', '#7a4a2e'], hair: 'sidepart', hairCol: ['#4a4650', '#8a8690'],
    shirt: 'shirt', shirtCol: ['#f3ead2', '#cdbf9c'], sarong: ['#7a3f5f', '#d9a9c0', '#572a44'],
    moustache: 1, rod: true, brows: true,
  },
  sabapathi: {
    skin: ['#c08456', '#a0643e', '#7c4a2c'], hair: 'bald', hairCol: ['#2a2030', '#4a3a55'],
    shirt: 'shirt', shirtCol: ['#f2b632', '#c98a1c'], sarong: ['#8a2f7a', '#f6d24a', '#5f1f58'],
    moustache: 2, belly: true, brows: true,
  },
};

export type Dir = 'down' | 'left' | 'right' | 'up';
export const DIRS: Dir[] = ['down', 'left', 'right', 'up'];
export const CHAR_FW = 26;
export const CHAR_FH = 34;
export const CHAR_COLS = 8; // idle0 idle1 walk0..3 fish0 fish1

interface Pose { bob: number; leg: number; fish?: boolean; }

const INK = PAL.outline;

function drawFront(ctx: Ctx, s: CharSpec, p: Pose, back: boolean) {
  const o = p.bob;
  const [sl, sb, sd] = s.skin;
  const wide = s.belly ? 1 : 0;
  const armL = p.leg === 1 ? -1 : p.leg === 3 ? 1 : 0;
  if (s.rod && !back && !p.fish) { line(ctx, 20, 21 + o, 23, 3, PAL.wood[1]); px(ctx, 23, 3, PAL.wood[3]); px(ctx, 23, 2, '#e8e8e8'); }
  // legs
  const legTop = s.sarongShort ? 25 : 27;
  const lUp = p.leg === 1 ? 1 : 0, rUp = p.leg === 3 ? 1 : 0;
  rect(ctx, 9, legTop, 3, 31 - legTop - lUp, sb); rect(ctx, 14, legTop, 3, 31 - legTop - rUp, sb);
  px(ctx, 9, 30 - lUp, sd); rect(ctx, 14, legTop, 1, 31 - legTop - rUp, sd); rect(ctx, 9, 30 - lUp, 3, 1, sd); rect(ctx, 14, 30 - rUp, 3, 1, sd);
  // sarong
  const sy = 21 + o, sh = (s.sarongShort ? 26 : 28) - sy;
  rect(ctx, 8 - wide, sy, 10 + wide * 2, sh, s.sarong[0]);
  for (let x = 9 - wide; x < 18 + wide; x += 3) rect(ctx, x, sy + 1, 1, sh - 1, s.sarong[1]);
  rect(ctx, 8 - wide, sy + sh - 1, 10 + wide * 2, 1, s.sarong[2]);
  rect(ctx, 16 + wide, sy, 2, sh, s.sarong[2]);
  rect(ctx, 8 - wide, sy, 10 + wide * 2, 1, s.sarong[1]);
  if (!back) rect(ctx, 12, sy, 2, 2, s.sarong[2]); // tucked knot
  // torso
  const ty = 15 + o;
  rect(ctx, 8 - wide, ty, 10 + wide * 2, 6 + wide, s.shirtCol[0]);
  rect(ctx, 16 + wide, ty, 2, 6 + wide, s.shirtCol[1]);
  if (s.belly) { rect(ctx, 7, ty + 5, 12, 2, s.shirtCol[0]); rect(ctx, 17, ty + 5, 2, 2, s.shirtCol[1]); rect(ctx, 9, ty + 6, 8, 1, s.shirtCol[1]); }
  if (s.shirt === 'vest') {
    rect(ctx, 8, ty, 2, 2, sb); rect(ctx, 16, ty, 2, 2, sd);
    if (!back) { rect(ctx, 12, ty, 2, 2, sb); px(ctx, 11, ty, sb); px(ctx, 14, ty, sb); }
  } else if (!back) {
    rect(ctx, 13, ty + 1, 1, 5, s.shirtCol[1]); rect(ctx, 12, ty, 2, 1, sb);
  }
  // arms
  const arm = (x: number, dy: number, shade: boolean) => {
    rect(ctx, x, ty + dy, 2, 6, shade ? sd : sb);
    px(ctx, x, ty + dy + 5, sl);
    if (s.shirt === 'shirt') rect(ctx, x, ty + dy, 2, 3, shade ? s.shirtCol[1] : s.shirtCol[0]);
  };
  arm(6 - wide, armL, false); arm(18 + wide, p.fish ? -3 : -armL, true);
  if (s.rod && back && !p.fish) { line(ctx, 19, 21 + o, 22, 3, PAL.wood[1]); px(ctx, 22, 2, '#e8e8e8'); }
  // head
  const hy = 4 + o;
  rect(ctx, 9, hy, 8, 1, sb); rect(ctx, 8, hy + 1, 10, 1, sb); rect(ctx, 7, hy + 2, 12, 7, sb);
  rect(ctx, 8, hy + 9, 10, 1, sb); rect(ctx, 9, hy + 10, 8, 1, sd);
  rect(ctx, 17, hy + 2, 2, 7, sd); px(ctx, 17, hy + 9, sd);
  rect(ctx, 8, hy + 3, 2, 4, sl);
  rect(ctx, 6, hy + 5, 1, 2, sb); rect(ctx, 19, hy + 5, 1, 2, sd); // ears
  const [h0, h1] = s.hairCol;
  if (back) {
    if (s.hair === 'bald') { rect(ctx, 7, hy + 5, 12, 4, h0); rect(ctx, 8, hy + 9, 10, 1, h0); px(ctx, 10, hy + 1, sl); px(ctx, 11, hy + 1, sl); }
    else { rect(ctx, 9, hy - 1, 8, 1, h0); rect(ctx, 8, hy, 10, 1, h0); rect(ctx, 7, hy + 1, 12, 8, h0); rect(ctx, 8, hy + 9, 10, 1, h0); rect(ctx, 9, hy + 1, 4, 1, h1); }
  } else {
    // face
    rect(ctx, 9, hy + 5, 2, 2, INK); rect(ctx, 15, hy + 5, 2, 2, INK); px(ctx, 9, hy + 5, '#ffffff'); px(ctx, 15, hy + 5, '#ffffff');
    if (s.brows) { rect(ctx, 9, hy + 3, 3, 1, h0); rect(ctx, 14, hy + 3, 3, 1, h0); }
    px(ctx, 12, hy + 7, sd); px(ctx, 13, hy + 7, sd);
    if (s.moustache === 0) { rect(ctx, 11, hy + 8, 4, 1, '#ffffff'); rect(ctx, 11, hy + 9, 4, 1, '#8a3a2a'); px(ctx, 10, hy + 8, '#8a3a2a'); px(ctx, 15, hy + 8, '#8a3a2a'); }
    if (s.moustache === 1) { rect(ctx, 10, hy + 8, 6, 1, h0); px(ctx, 9, hy + 9, h0); px(ctx, 16, hy + 9, h0); rect(ctx, 12, hy + 9, 2, 1, '#8a3a2a'); }
    if (s.moustache === 2) { rect(ctx, 9, hy + 8, 8, 1, h0); rect(ctx, 8, hy + 9, 3, 1, h0); rect(ctx, 15, hy + 9, 3, 1, h0); px(ctx, 7, hy + 8, h0); px(ctx, 18, hy + 8, h0); px(ctx, 7, hy + 7, h0); px(ctx, 18, hy + 7, h0); rect(ctx, 12, hy + 9, 2, 1, '#8a3a2a'); }
    px(ctx, 8, hy + 7, '#d9836a'); px(ctx, 17, hy + 7, '#b5654e'); // cheeks
    if (s.hair === 'mop') {
      rect(ctx, 9, hy - 1, 8, 1, h0); rect(ctx, 8, hy, 10, 1, h0); rect(ctx, 7, hy + 1, 12, 2, h0);
      px(ctx, 7, hy + 3, h0); px(ctx, 8, hy + 3, h0); px(ctx, 11, hy + 3, h0); px(ctx, 14, hy + 3, h0); px(ctx, 18, hy + 3, h0);
      rect(ctx, 12, hy - 2, 3, 1, h0); px(ctx, 13, hy - 3, h0); rect(ctx, 10, hy, 3, 1, h1);
    } else if (s.hair === 'sidepart') {
      rect(ctx, 9, hy - 1, 8, 1, h0); rect(ctx, 8, hy, 10, 1, h0); rect(ctx, 7, hy + 1, 12, 1, h0); rect(ctx, 7, hy + 2, 2, 2, h0); rect(ctx, 13, hy + 2, 6, 1, h0); px(ctx, 18, hy + 3, h0);
      rect(ctx, 10, hy, 5, 1, h1);
    } else {
      rect(ctx, 7, hy + 3, 1, 3, h0); rect(ctx, 18, hy + 3, 1, 3, h0); rect(ctx, 10, hy + 1, 3, 1, sl); px(ctx, 10, hy + 2, '#f0c8a0');
    }
  }
  if (s.headband) {
    rect(ctx, 7, hy + 2, 12, 1, s.headband); px(ctx, 6, hy + 2, s.headband);
    if (!back) { rect(ctx, 19, hy + 2, 2, 1, s.headband); px(ctx, 20, hy + 3, s.headband); px(ctx, 20, hy + 4, s.headband); }
    else { rect(ctx, 12, hy + 3, 2, 3, s.headband); }
  }
}

function drawSide(ctx: Ctx, s: CharSpec, p: Pose) {
  // Faces left. Right-facing frames are mirrored from this.
  const o = p.bob;
  const [sl, sb, sd] = s.skin;
  const wide = s.belly ? 1 : 0;
  if (s.rod && !p.fish) { line(ctx, 15, 20 + o, 22, 4, PAL.wood[1]); px(ctx, 22, 3, '#e8e8e8'); }
  const legTop = s.sarongShort ? 25 : 27;
  if (p.leg === 1 || p.leg === 3) {
    const fwd = p.leg === 1;
    rect(ctx, 15, legTop, 3, 30 - legTop, fwd ? sd : sb); rect(ctx, 15, 29, 4, 1, sd);
    rect(ctx, 8, legTop, 3, 31 - legTop, fwd ? sb : sd); rect(ctx, 7, 30, 4, 1, sd);
  } else {
    rect(ctx, 11, legTop, 4, 31 - legTop, sb); rect(ctx, 13, legTop, 2, 31 - legTop, sd); rect(ctx, 10, 30, 5, 1, sd);
  }
  const sy = 21 + o, sh = (s.sarongShort ? 26 : 28) - sy;
  rect(ctx, 9 - wide, sy, 8 + wide * 2, sh, s.sarong[0]);
  for (let x = 10 - wide; x < 17 + wide; x += 3) rect(ctx, x, sy + 1, 1, sh - 1, s.sarong[1]);
  rect(ctx, 9 - wide, sy + sh - 1, 8 + wide * 2, 1, s.sarong[2]); rect(ctx, 15 + wide, sy, 2, sh, s.sarong[2]);
  rect(ctx, 9 - wide, sy, 8 + wide * 2, 1, s.sarong[1]);
  const ty = 15 + o;
  rect(ctx, 9, ty, 8, 6, s.shirtCol[0]); rect(ctx, 15, ty, 2, 6, s.shirtCol[1]);
  if (s.belly) { rect(ctx, 7, ty + 2, 3, 5, s.shirtCol[0]); rect(ctx, 8, ty + 6, 8, 1, s.shirtCol[1]); }
  if (s.shirt === 'vest') { rect(ctx, 9, ty, 2, 1, sb); rect(ctx, 14, ty, 3, 2, sd); }
  const ax = p.leg === 1 ? 14 : p.leg === 3 ? 10 : 12;
  if (p.fish) { rect(ctx, 5, ty + 2, 8, 2, sb); px(ctx, 5, ty + 2, sl); if (s.shirt === 'shirt') rect(ctx, 10, ty + 2, 3, 2, s.shirtCol[1]); }
  else {
    rect(ctx, ax, ty + 1, 2, 6, sb); px(ctx, ax, ty + 6, sl); px(ctx, ax + 1, ty + 3, sd);
    if (s.shirt === 'shirt') rect(ctx, ax, ty + 1, 2, 3, s.shirtCol[1]);
  }
  const hy = 4 + o;
  rect(ctx, 9, hy, 8, 1, sb); rect(ctx, 8, hy + 1, 10, 1, sb); rect(ctx, 7, hy + 2, 12, 7, sb);
  rect(ctx, 8, hy + 9, 10, 1, sb); rect(ctx, 9, hy + 10, 7, 1, sd);
  rect(ctx, 16, hy + 2, 3, 7, sd);
  px(ctx, 6, hy + 6, sb); px(ctx, 6, hy + 7, sd); // nose
  rect(ctx, 14, hy + 5, 2, 2, sd); px(ctx, 14, hy + 5, sl); // ear
  rect(ctx, 9, hy + 5, 2, 2, INK); px(ctx, 9, hy + 5, '#ffffff');
  const [h0, h1] = s.hairCol;
  if (s.brows) rect(ctx, 8, hy + 3, 3, 1, h0);
  if (s.moustache === 0) { rect(ctx, 8, hy + 8, 3, 1, '#ffffff'); rect(ctx, 8, hy + 9, 3, 1, '#8a3a2a'); }
  if (s.moustache === 1) { rect(ctx, 7, hy + 8, 4, 1, h0); px(ctx, 10, hy + 9, h0); }
  if (s.moustache === 2) { rect(ctx, 6, hy + 8, 6, 1, h0); rect(ctx, 10, hy + 9, 3, 1, h0); px(ctx, 5, hy + 7, h0); px(ctx, 5, hy + 8, h0); }
  if (s.hair === 'mop') {
    rect(ctx, 9, hy - 1, 8, 1, h0); rect(ctx, 8, hy, 10, 1, h0); rect(ctx, 7, hy + 1, 12, 2, h0);
    rect(ctx, 16, hy + 3, 3, 4, h0); px(ctx, 15, hy + 3, h0); px(ctx, 7, hy + 3, h0); px(ctx, 10, hy + 3, h0); rect(ctx, 12, hy - 2, 3, 1, h0); px(ctx, 13, hy - 3, h0); rect(ctx, 10, hy, 3, 1, h1);
  } else if (s.hair === 'sidepart') {
    rect(ctx, 9, hy - 1, 8, 1, h0); rect(ctx, 8, hy, 10, 1, h0); rect(ctx, 8, hy + 1, 11, 1, h0); rect(ctx, 12, hy + 2, 7, 2, h0); rect(ctx, 16, hy + 4, 3, 4, h0); rect(ctx, 10, hy, 5, 1, h1);
  } else {
    rect(ctx, 13, hy + 3, 6, 2, h0); rect(ctx, 16, hy + 5, 3, 4, h0); rect(ctx, 10, hy + 1, 3, 1, sl);
  }
  if (s.headband) { rect(ctx, 7, hy + 2, 12, 1, s.headband); rect(ctx, 19, hy + 2, 2, 1, s.headband); px(ctx, 20, hy + 3, s.headband); px(ctx, 21, hy + 4, s.headband); }
}

/** Full sheet: 4 rows (down, left, right, up) x 6 columns (idle x2, walk x4). */
export function charSheet(spec: CharSpec): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(CHAR_FW * CHAR_COLS, CHAR_FH * 4);
  const poses: Pose[] = [
    { bob: 0, leg: 0 }, { bob: 1, leg: 0 },
    { bob: 0, leg: 1 }, { bob: 1, leg: 0 }, { bob: 0, leg: 3 }, { bob: 1, leg: 2 },
    { bob: 0, leg: 0, fish: true }, { bob: 1, leg: 0, fish: true },
  ];
  DIRS.forEach((dir, row) => {
    poses.forEach((pose, col) => {
      const [f, fx] = makeCanvas(CHAR_FW, CHAR_FH);
      if (dir === 'down') drawFront(fx, spec, pose, false);
      else if (dir === 'up') drawFront(fx, spec, pose, true);
      else drawSide(fx, spec, pose);
      outline(f, INK);
      ctx.drawImage(dir === 'right' ? flipH(f) : f, col * CHAR_FW, row * CHAR_FH);
    });
  });
  return c;
}
