import Phaser from 'phaser';
import { VIEW, PAL } from '../config/game';
import { fitUi } from './UiScene';
import { audio } from '../systems/Audio';
import { Layout } from '../world/layout';
import { buildTextures } from '../art/textures';
import { textCanvas } from '../art/font';

/** Shows a loading card, then generates the world data and every texture. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    this.cameras.main.setBackgroundColor('#16261d');
    fitUi(this);
    this.textures.addCanvas('boot-title', textCanvas('MAALU HORU', PAL.cream, '#0c1410', 3));
    this.textures.addCanvas('boot-sub', textCanvas('FILLING THE WEWA...', '#8fcb55', null, 1));
    this.add.image(VIEW.w / 2, VIEW.h / 2 - 8, 'boot-title');
    this.add.image(VIEW.w / 2, VIEW.h / 2 + 14, 'boot-sub');
    // give the loading card one frame on screen before the (synchronous) art pass
    const go = () => {
      const layout = new Layout();
      buildTextures(this, layout);
      this.registry.set('layout', layout);
      this.registry.set('attract', true);
      this.scene.start('world');
      this.scene.launch('menu');
      audio.install();
      audio.startMusic(); // begins on the player's first click or key press
    };
    // The Sinhala logotype needs a Sinhala web font. Wait briefly for it; carry on without if it never arrives.
    let started = false;
    const begin = (ok: boolean) => { if (started) return; started = true; this.registry.set('sinhala', ok); this.time.delayedCall(30, go); };
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.load) {
      fonts.load('700 12px Nunito').catch(() => undefined); fonts.load('400 12px Nunito').catch(() => undefined);
      fonts.load('700 13px "Noto Sans Sinhala"', 'මාළු').then((f) => begin(f.length > 0), () => begin(false));
      this.time.delayedCall(1800, () => begin(false));
    } else this.time.delayedCall(60, () => begin(false));
  }
}
