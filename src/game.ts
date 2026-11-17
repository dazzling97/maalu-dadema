import Phaser from 'phaser';
import { SCREEN, setZoom } from './config/game';
import { ResultScene } from './scenes/ResultScene';
import { ShopScene } from './scenes/ShopScene';
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { HudScene } from './scenes/HudScene';
import { MenuScene } from './scenes/MenuScene';
import { PauseScene } from './scenes/PauseScene';

export interface MountOptions {
  /** Existing canvas to render into (keyboard input is then scoped to it). */
  canvas?: HTMLCanvasElement;
  /** Element to create the canvas in when no canvas is given. */
  parent?: HTMLElement | string;
  /** Render scale, 1 to 4. Default 3 (sharp text). Use 1 on slow machines. Also settable with ?zoom=1 in the address. */
  zoom?: number;
}

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch { return false; }
}

export function mount(opts: MountOptions = {}): Phaser.Game {
  const canvas = opts.canvas;
  const q = Number(new URLSearchParams(window.location.search).get('zoom'));
  setZoom(opts.zoom ?? (q >= 1 ? q : 3));
  if (canvas) {
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', () => canvas.focus());
  }
  return new Phaser.Game({
    type: canvas ? (hasWebGL() ? Phaser.WEBGL : Phaser.CANVAS) : Phaser.AUTO, // a supplied canvas needs an explicit choice
    canvas,
    parent: canvas ? (canvas.parentElement ?? undefined) : opts.parent,
    width: SCREEN.w,
    height: SCREEN.h,
    backgroundColor: '#16261d',
    pixelArt: true,
    roundPixels: true,
    banner: false,
    audio: { noAudio: true }, // sound arrives in Phase 5
    fps: { target: 60 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: canvas ? Phaser.Scale.NO_CENTER : Phaser.Scale.CENTER_BOTH },
    input: { keyboard: { target: canvas ?? window } },
    scene: [BootScene, WorldScene, HudScene, PauseScene, ShopScene, ResultScene, MenuScene],
  });
}
