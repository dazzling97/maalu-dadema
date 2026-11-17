import { Ctx, makeCanvas } from './px';

// Original 5-row pixel font. Most glyphs are 3 wide; M, N and W are wider so they read clearly.
const G: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '1000111011101011000110001', N: '10011101101110011001', O: '010101101101010', P: '111101111100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '1000110001101011101110001', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010',
  '8': '010101010101010', '9': '010101011001110',
  '.': '000000000000010', '-': '000000111000000', "'": '010010000000000', '!': '010010010000010',
  ':': '000010000010000', '/': '001001010100100', '+': '000010111010000', ' ': '000000000000000',
};

const widthOf = (ch: string) => (G[ch] ?? G[' ']).length / 5;

export function textWidth(text: string, scale = 1): number {
  let w = 0;
  for (const ch of text.toUpperCase()) w += widthOf(ch) + 1;
  return Math.max(0, w - 1) * scale;
}

export function drawText(ctx: Ctx, text: string, x: number, y: number, color: string, scale = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text.toUpperCase()) {
    const g = G[ch] ?? G[' '], gw = g.length / 5;
    for (let i = 0; i < g.length; i++) {
      if (g[i] === '1') ctx.fillRect(cx + (i % gw) * scale, y + Math.floor(i / gw) * scale, scale, scale);
    }
    cx += (gw + 1) * scale;
  }
}
/** Text with a 1px drop shadow on its own canvas. */
export function textCanvas(text: string, color: string, shadow: string | null, scale = 1): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(textWidth(text, scale) + 1, 5 * scale + 1);
  if (shadow) drawText(ctx, text, 1, 1, shadow, scale);
  drawText(ctx, text, 0, 0, color, scale);
  return c;
}
