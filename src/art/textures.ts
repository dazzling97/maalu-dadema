import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { Layout, DOCKS } from '../world/layout';
import { paintGround } from './terrain';
import { paintWaterSheet, WATER_BOX, WATER_FRAMES } from './water';
import * as P from './props';
import { FISH } from '../config/balance';
import { keycap } from './ui';
import { charSheet, SPECS, CHAR_FW, CHAR_FH, CHAR_COLS, DIRS } from './characters';

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
  addCanvas(scene, 'ground', paintGround(L));

  const water = scene.textures.addCanvas('water', paintWaterSheet(L))!;
  for (let f = 0; f < WATER_FRAMES; f++) water.add(f, 0, (f % 4) * WATER_BOX.w, Math.floor(f / 4) * WATER_BOX.h, WATER_BOX.w, WATER_BOX.h);

  for (let i = 0; i < 3; i++) {
    addSheet(scene, `palm${i}`, P.palmSheet(false, 11 + i));
    addSheet(scene, `palmKing${i}`, P.palmSheet(true, 31 + i));
    addSheet(scene, `tree${i}`, P.treeSheet(51 + i * 7));
    addSheet(scene, `bush${i}`, P.bushSheet(false, 71 + i));
    addSheet(scene, `bushFlower${i}`, P.bushSheet(true, 91 + i));
    addSheet(scene, `banana${i}`, P.bananaSheet(111 + i));
    addSheet(scene, `rockS${i}`, P.rockSheet(0, 131 + i));
    addSheet(scene, `rockM${i}`, P.rockSheet(1, 151 + i));
    addSheet(scene, `rockL${i}`, P.rockSheet(2, 171 + i));
  }
  DOCKS.forEach((D, i) => {
    let shoreY = D.y;
    while (L.pondAt(D.x + 13, shoreY) < 0 && shoreY < D.y + D.h) shoreY++;
    addSheet(scene, `dock${i}`, P.dockSheet(shoreY - D.y));
  });
  addSheet(scene, 'reeds', P.reedsSheet());
  addSheet(scene, 'lily', P.lilySheet());
  addSheet(scene, 'fence', P.fenceSheet());
  addSheet(scene, 'bucket', P.bucketSheet());
  addSheet(scene, 'stones', P.stonesSheet());
  addSheet(scene, 'basket', P.basketSheet());
  addSheet(scene, 'crate', P.crateSheet());
  addSheet(scene, 'bench', P.benchSheet());
  addSheet(scene, 'pot', P.potSheet());
  addSheet(scene, 'thambili', P.thambiliSheet());
  addSheet(scene, 'sack', P.sackSheet());
  addSheet(scene, 'canoe', P.canoeSheet());
  addSheet(scene, 'shop', P.shopSheet());
  addSheet(scene, 'egret', P.egretSheet());
  addSheet(scene, 'fish', P.fishSheet());
  addSheet(scene, 'butterfly', P.butterflySheet());
  addSheet(scene, 'dragonfly', P.dragonflySheet());
  addSheet(scene, 'sparkle', P.sparkleSheet());
  addSheet(scene, 'ring', P.ringSheet());
  addSheet(scene, 'puff', P.puffSheet());
  addSheet(scene, 'leaf', P.leafSheet());
  addSheet(scene, 'catch', P.catchSheet(FISH));
  addSheet(scene, 'bobber', P.bobberSheet());
  addCanvas(scene, 'bang', P.bangCanvas());
  addCanvas(scene, 'drop', P.dropCanvas());
  addCanvas(scene, 'key-space', keycap('SPACE'));
  addSheet(scene, 'croc', P.crocSheet());
  addSheet(scene, 'crocDark', P.crocSheet(['#27382a', '#3a5238', '#4b6a44', '#648452'], '#b5b890'));
  addSheet(scene, 'bag', P.bagSheet());
  addSheet(scene, 'lella', P.lellaSheet());
  addSheet(scene, 'gear', P.gearSheet());
  addSheet(scene, 'shopSign', P.shopSignSheet());
  addSheet(scene, 'net', P.netSheet());
  addCanvas(scene, 'warn', P.warnIconCanvas());
  addCanvas(scene, 'clock', P.clockCanvas());
  addCanvas(scene, 'key-q', keycap('Q'));
  addCanvas(scene, 'key-e', keycap('E'));
  { const sg = P.signSheet(); addSheet(scene, 'sign', sg); ORIGIN.signA = ORIGIN.signB = ORIGIN.signC = ORIGIN.sign; }
  addSheet(scene, 'stump', P.stumpSheet());
  addCanvas(scene, 'coin', P.coinCanvas());
  addSheet(scene, 'heart', P.heartSheet());
  addCanvas(scene, 'alert', P.alertCanvas());
  addCanvas(scene, 'loot', P.lootCanvas());
  addCanvas(scene, 'arrow', P.arrowCanvas());
  addCanvas(scene, 'stone', P.stoneCanvas());
  addCanvas(scene, 'reticle', P.reticleCanvas());
  addCanvas(scene, 'shadow', P.shadowBlob());
  addCanvas(scene, 'rays', P.raysCanvas());
  addCanvas(scene, 'grade', P.gradeCanvas(VIEW.w, VIEW.h));
  addCanvas(scene, 'vignette', P.vignetteCanvas(VIEW.w, VIEW.h));

  for (const id of Object.keys(SPECS)) {
    addSheet(scene, id, { canvas: charSheet(SPECS[id]), fw: CHAR_FW, fh: CHAR_FH, ox: 13, oy: 31 });
    DIRS.forEach((dir, row) => {
      const b = row * CHAR_COLS;
      scene.anims.create({ key: `${id}-idle-${dir}`, frames: frames(id, [b, b + 1]), frameRate: 2.2, repeat: -1 });
      scene.anims.create({ key: `${id}-walk-${dir}`, frames: frames(id, [b + 2, b + 3, b + 4, b + 5]), frameRate: 9, repeat: -1 });
      scene.anims.create({ key: `${id}-fish-${dir}`, frames: frames(id, [b + 6, b + 7]), frameRate: 2.2, repeat: -1 });
    });
  }

  const A = scene.anims;
  A.create({ key: 'water', frames: frames('water', [0, 1, 2, 3, 4, 5, 6, 7]), frameRate: 6, repeat: -1 });
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
