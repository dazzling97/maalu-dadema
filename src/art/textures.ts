import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { Layout, DOCKS } from '../world/layout';
import { addHD, addHDSheet, ART } from './hd';
import * as FX from './fxHD';
import * as S from './sceneryHD';
import { charSheetHD, HCHAR, HCOL } from './charactersHD';
import { paintGroundHD } from './groundHD';
import { waterMasks, rippleTile, swellTile, foamTile, glintCanvas, raysHD, gradeHD, vignetteHD, shadowHD } from './waterHD';
import * as P from './props';
import { FISH } from '../config/balance';
import { keycap } from './ui';
import { SPECS, DIRS } from './characters';

/** Origins (ground-contact point, 0..1) for every sheet, keyed by texture. */
export const ORIGIN: Record<string, { x: number; y: number }> = {};

function addSheet(scene: Phaser.Scene, key: string, s: P.Sheet) {
  const tex = scene.textures.addCanvas(key, s.canvas)!;
  const cols = Math.floor(s.canvas.width / s.fw), rows = Math.floor(s.canvas.height / s.fh);
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) tex.add(n++, 0, c * s.fw, r * s.fh, s.fw, s.fh);
  ORIGIN[key] = { x: s.ox / s.fw, y: s.oy / s.fh };
}
function addCanvas(scene: Phaser.Scene, key: string, c: HTMLCanvasElement) {
  scene.textures.addCanvas(key, c);
}
const frames = (key: string, list: number[]) => list.map((f) => ({ key, frame: f }));

/**
 * Generates every texture and animation in the game. All art is drawn in code
 * at boot, so the build ships no image files and stays tiny.
 */
export function buildTextures(scene: Phaser.Scene, L: Layout) {
  // high-resolution ground, water and light (see hd.ts)
  paintGroundHD(L).forEach((c, i) => addHD(scene, `ground${i}`, c));
  const masks = waterMasks(L);
  addHD(scene, 'waterOpen', masks.open);
  addHD(scene, 'waterShore', masks.shore);
  addHD(scene, 'rippleLight', rippleTile(200, 21, true));
  addHD(scene, 'rippleDark', rippleTile(240, 22, false));
  addHD(scene, 'foam', foamTile(120));
  addHD(scene, 'swell', swellTile(320));
  addHD(scene, 'glint', glintCanvas());

  for (let i = 0; i < 3; i++) {
    ORIGIN[`palm${i}`] = addHDSheet(scene, `palm${i}`, S.palmHD(false, 11 + i));
    ORIGIN[`palmKing${i}`] = addHDSheet(scene, `palmKing${i}`, S.palmHD(true, 31 + i));
    ORIGIN[`tree${i}`] = addHDSheet(scene, `tree${i}`, S.treeHD(51 + i * 7));
    ORIGIN[`bush${i}`] = addHDSheet(scene, `bush${i}`, S.bushHD(false, 71 + i));
    ORIGIN[`bushFlower${i}`] = addHDSheet(scene, `bushFlower${i}`, S.bushHD(true, 91 + i));
    ORIGIN[`banana${i}`] = addHDSheet(scene, `banana${i}`, S.bananaHD(111 + i));
    ORIGIN[`rockS${i}`] = addHDSheet(scene, `rockS${i}`, S.rockHD(0, 131 + i));
    ORIGIN[`rockM${i}`] = addHDSheet(scene, `rockM${i}`, S.rockHD(1, 151 + i));
    ORIGIN[`rockL${i}`] = addHDSheet(scene, `rockL${i}`, S.rockHD(2, 171 + i));
  }
  DOCKS.forEach((D, i) => {
    let shoreY = D.y;
    while (L.pondAt(D.x + 13, shoreY) < 0 && shoreY < D.y + D.h) shoreY++;
    ORIGIN[`dock${i}`] = addHDSheet(scene, `dock${i}`, S.dockHD(shoreY - D.y));
  });
  ORIGIN['reeds'] = addHDSheet(scene, 'reeds', S.reedsHD());
  ORIGIN['lily'] = addHDSheet(scene, 'lily', S.lilyHD());
  ORIGIN['fence'] = addHDSheet(scene, 'fence', S.fenceHD());
  addSheet(scene, 'stones', P.stonesSheet()); // HUD icon (pixel until the UI pass)
  ORIGIN.stonesHD = addHDSheet(scene, 'stonesHD', FX.stonesHD());
  ORIGIN['basket'] = addHDSheet(scene, 'basket', S.basketHD());
  ORIGIN['crate'] = addHDSheet(scene, 'crate', S.crateHD());
  ORIGIN['bench'] = addHDSheet(scene, 'bench', S.benchHD());
  ORIGIN['pot'] = addHDSheet(scene, 'pot', S.potHD());
  ORIGIN['thambili'] = addHDSheet(scene, 'thambili', S.thambiliHD());
  ORIGIN['sack'] = addHDSheet(scene, 'sack', S.sackHD());
  ORIGIN['canoe'] = addHDSheet(scene, 'canoe', S.canoeHD());
  ORIGIN['shop'] = addHDSheet(scene, 'shop', S.shopHD());
  ORIGIN['egret'] = addHDSheet(scene, 'egret', S.egretHD());
  ORIGIN.fish = addHDSheet(scene, 'fish', FX.fishSheetHD());
  ORIGIN['butterfly'] = addHDSheet(scene, 'butterfly', S.butterflyHD());
  ORIGIN['dragonfly'] = addHDSheet(scene, 'dragonfly', S.dragonflyHD());
  ORIGIN.sparkle = addHDSheet(scene, 'sparkle', FX.sparkleSheetHD());
  ORIGIN.ring = addHDSheet(scene, 'ring', FX.ringSheetHD());
  ORIGIN.puff = addHDSheet(scene, 'puff', FX.puffSheetHD());
  addHD(scene, 'wake', FX.wakeCanvas());
  ORIGIN['leaf'] = addHDSheet(scene, 'leaf', S.leafHD());
  addSheet(scene, 'catch', P.catchSheet(FISH)); // HUD icon (pixel until the UI pass)
  ORIGIN.catchHD = addHDSheet(scene, 'catchHD', FX.catchSheetHD(FISH));
  ORIGIN.bobber = addHDSheet(scene, 'bobber', FX.bobberSheetHD());
  addHD(scene, 'bang', FX.bubbleHD('#f6d24a', '#fff3a0', '#b3261e'));
  addHD(scene, 'drop', FX.dropHD());
  addCanvas(scene, 'key-space', keycap('SPACE'));
  ORIGIN.croc = addHDSheet(scene, 'croc', FX.crocSheetHD());
  ORIGIN.crocDark = addHDSheet(scene, 'crocDark', FX.crocSheetHD(['#27382a', '#3a5238', '#4b6a44', '#648452'], '#b5b890'));
  addSheet(scene, 'bag', P.bagSheet()); // HUD icon (pixel until the UI pass)
  ORIGIN.bagHD = addHDSheet(scene, 'bagHD', S.bagHD());
  ORIGIN['lella'] = addHDSheet(scene, 'lella', S.lellaHD());
  addSheet(scene, 'gear', P.gearSheet());
  ORIGIN['shopSign'] = addHDSheet(scene, 'shopSign', S.shopSignHD());
  ORIGIN.net = addHDSheet(scene, 'net', FX.netSheetHD());
  addCanvas(scene, 'warn', P.warnIconCanvas());
  addCanvas(scene, 'clock', P.clockCanvas());
  addCanvas(scene, 'key-q', keycap('Q'));
  addCanvas(scene, 'key-e', keycap('E'));
  { ORIGIN.sign = addHDSheet(scene, 'sign', S.signHD()); ORIGIN.signA = ORIGIN.signB = ORIGIN.signC = ORIGIN.sign; }
  ORIGIN['stump'] = addHDSheet(scene, 'stump', S.stumpHD());
  addCanvas(scene, 'coin', P.coinCanvas());
  addSheet(scene, 'heart', P.heartSheet());
  addHD(scene, 'alert', FX.bubbleHD('#e8433f', '#ff8a70', '#ffffff'));
  addHD(scene, 'loot', S.lootHD());
  addCanvas(scene, 'arrow', P.arrowCanvas());
  addHD(scene, 'stone', FX.stoneHD());
  addCanvas(scene, 'reticle', P.reticleCanvas());
  addHD(scene, 'shadow', shadowHD());
  addHD(scene, 'rays', raysHD());
  addHD(scene, 'grade', gradeHD(VIEW.w, VIEW.h));
  addHD(scene, 'vignette', vignetteHD(VIEW.w, VIEW.h));

  for (const id of Object.keys(SPECS)) {
    // high-resolution villagers (charactersHD.ts): frames are ART x larger, shown at HD scale
    const tex = addHD(scene, id, charSheetHD(SPECS[id]));
    const FW = HCHAR.fw * ART, FH = HCHAR.fh * ART;
    for (let r = 0, n = 0; r < DIRS.length; r++) for (let c = 0; c < HCOL.count; c++) tex.add(n++, 0, c * FW, r * FH, FW, FH);
    ORIGIN[id] = { x: HCHAR.ox / HCHAR.fw, y: HCHAR.oy / HCHAR.fh };
    DIRS.forEach((dir, row) => {
      const b = row * HCOL.count, f = (i: number, duration?: number) => ({ key: id, frame: b + i, duration });
      // breathe, and blink now and then
      scene.anims.create({ key: `${id}-idle-${dir}`, frames: [f(0, 700), f(1, 700), f(0, 700), f(1, 560), f(2, 140)], repeat: -1 });
      scene.anims.create({ key: `${id}-walk-${dir}`, frames: [3, 4, 5, 6, 7, 8].map((i) => f(i)), frameRate: 11, repeat: -1 });
      scene.anims.create({ key: `${id}-fish-${dir}`, frames: [f(HCOL.fish), f(HCOL.fish + 1)], frameRate: 2.2, repeat: -1 });
      scene.anims.create({ key: `${id}-throw-${dir}`, frames: [f(HCOL.throw)], frameRate: 1 });
      scene.anims.create({ key: `${id}-hurt-${dir}`, frames: [f(HCOL.hurt)], frameRate: 1 });
    });
  }

  const A = scene.anims;
  for (let i = 0; i < 3; i++) {
    A.create({ key: `palm${i}-sway`, frames: frames(`palm${i}`, [0, 1, 2, 1]), frameRate: 2.4, repeat: -1 });
    A.create({ key: `palmKing${i}-sway`, frames: frames(`palmKing${i}`, [0, 1, 2, 1]), frameRate: 2.4, repeat: -1 });
  }
  A.create({ key: 'reeds', frames: frames('reeds', [0, 1]), frameRate: 1.6, repeat: -1 });
  A.create({ key: 'egret', frames: frames('egret', [0, 0, 0, 1, 1, 0]), frameRate: 1.5, repeat: -1 });
  A.create({ key: 'fish-dark', frames: frames('fish', [0, 1]), frameRate: 5, repeat: -1 });
  A.create({ key: 'fish-gold', frames: frames('fish', [2, 3]), frameRate: 5, repeat: -1 });
  for (let i = 0; i < 4; i++) A.create({ key: `butterfly${i}`, frames: frames('butterfly', [i * 2, i * 2 + 1]), frameRate: 9, repeat: -1 });
  A.create({ key: 'dragonfly', frames: frames('dragonfly', [0, 1]), frameRate: 16, repeat: -1 });
  A.create({ key: 'sparkle', frames: frames('sparkle', [0, 1, 2, 1, 0]), frameRate: 9 });
  A.create({ key: 'ring', frames: frames('ring', [0, 1, 2, 3]), frameRate: 7 });
  A.create({ key: 'puff', frames: frames('puff', [0, 1, 2, 3]), frameRate: 13 });
  for (const k of ['croc', 'crocDark']) {
    A.create({ key: `${k}-swim`, frames: frames(k, [0, 1]), frameRate: 3, repeat: -1 });
    A.create({ key: `${k}-walk`, frames: frames(k, [2, 3]), frameRate: 7, repeat: -1 });
  }
  A.create({ key: 'leaf', frames: frames('leaf', [0, 1]), frameRate: 3, repeat: -1 });
}
