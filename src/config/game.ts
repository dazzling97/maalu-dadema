// Core constants. Everything renders at a low internal resolution and is scaled
// up with nearest-neighbour filtering so every pixel stays crisp.
export const VIEW = { w: 480, h: 270 } as const;
/** Screen pixels per art pixel. The canvas is VIEW x ZOOM so interface text can be drawn sharp. */
export let ZOOM = 3;
export const SCREEN = { w: VIEW.w * ZOOM, h: VIEW.h * ZOOM };
/** Choose the render scale before the game is created (1 = low-resolution mode for slow machines and automated tests). */
export function setZoom(z: number) {
  ZOOM = Math.max(1, Math.min(4, Math.round(z)));
  SCREEN.w = VIEW.w * ZOOM; SCREEN.h = VIEW.h * ZOOM;
}
export const WORLD = { w: 1440, h: 840 } as const;
/** The camera sits this far above the player, so the pond fills about half of the view from the bank. */
export const CAM_LEAD = 60;
export const UI_FONT = 'Nunito, "Noto Sans Sinhala", system-ui, -apple-system, "Segoe UI", sans-serif';
export const CELL = 4; // collision grid cell size (px)

export const DEPTH = {
  ground: 0,
  fish: 1,
  waterFx: 2,
  flat: 4, // dock, lily pads, canoe: flat things lying on ground / water
  sorted: 10, // y-sorted actors and props use DEPTH.sorted + y
  air: 3000, // butterflies, leaves
  light: 4000,
} as const;

export const PAL = {
  outline: '#2b1b2e',
  // grass, dark -> sunlit
  grass: ['#3c7a3a', '#4c9040', '#62a645', '#7cba4e', '#9ccc57'],
  mud: '#5d4630',
  sand: ['#b58c54', '#c9a56b', '#dcbc82'],
  path: ['#a57a45', '#c4985c', '#cfa468', '#dcb57a'],
  // water, shallow -> deep
  water: ['#58bfae', '#3aa5a5', '#2b8a9e', '#237193', '#1d5d88'],
  waterRim: '#86dcc6',
  foam: '#e9fbf1',
  wood: ['#6e4628', '#8b5e3c', '#a8744a', '#c69862'],
  roof: ['#8f3524', '#b84a31', '#c9573a', '#e27b52'],
  leaf: ['#255a2f', '#2f7335', '#439140', '#62ad48', '#8fcb55'],
  cream: '#f6e7c1',
  ink: '#3a2418',
} as const;
