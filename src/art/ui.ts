import { PAL } from '../config/game';
import { makeCanvas, rect, px, hash } from './px';
import { drawText, textWidth } from './font';

/** Carved wooden sign board, the base of every HUD element. */
export function woodPanel(w: number, h: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(w, h + 2);
  rect(ctx, 1, 2, w - 2, h, 'rgba(20,12,24,0.45)'); // drop shadow
  rect(ctx, 1, 0, w - 2, h, PAL.outline); rect(ctx, 0, 1, w, h - 2, PAL.outline);
  rect(ctx, 1, 1, w - 2, h - 2, '#8b5e3c');
  rect(ctx, 1, 1, w - 2, 1, '#c69862'); rect(ctx, 1, h - 2, w - 2, 1, '#5a3a22');
  rect(ctx, 1, 1, 1, h - 2, '#a8744a'); rect(ctx, w - 2, 1, 1, h - 2, '#6e4628');
  for (let y = 3; y < h - 3; y += 2) {
    for (let x = 3; x < w - 3; x++) if (hash(x >> 2, y, 12) < 0.3) px(ctx, x, y, '#7d5434');
  }
  for (const [x, y] of [[3, 3], [w - 4, 3], [3, h - 4], [w - 4, h - 4]]) { px(ctx, x, y, '#e0d2a8'); px(ctx, x, y + 1, '#5a3a22'); }
  return c;
}

export function keycap(label: string): HTMLCanvasElement {
  const w = textWidth(label) + 6;
  const [c, ctx] = makeCanvas(w, 11);
  rect(ctx, 1, 0, w - 2, 11, PAL.outline); rect(ctx, 0, 1, w, 9, PAL.outline);
  rect(ctx, 1, 1, w - 2, 7, PAL.cream); rect(ctx, 1, 8, w - 2, 2, '#b9a878'); rect(ctx, 1, 1, w - 2, 1, '#ffffff');
  drawText(ctx, label, 3, 2, PAL.ink);
  return c;
}

export function fishIcon(): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(13, 9);
  rect(ctx, 2, 2, 7, 5, '#f2a65a'); rect(ctx, 3, 1, 5, 7, '#f2a65a'); rect(ctx, 3, 2, 4, 2, '#ffd08a');
  rect(ctx, 9, 3, 2, 3, '#e07a3a'); rect(ctx, 11, 1, 2, 7, '#e07a3a'); px(ctx, 11, 4, '#f2a65a');
  px(ctx, 4, 3, PAL.outline); rect(ctx, 2, 6, 6, 1, '#e07a3a');
  return c;
}
