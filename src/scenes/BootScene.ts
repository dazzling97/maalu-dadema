import Phaser from 'phaser';
import { VIEW, PAL } from '../config/game';
import { fitUi, displayText, uiText } from './UiScene';
import { audio } from '../systems/Audio';
import { Layout } from '../world/layout';
import { buildTextures } from '../art/textures';

/** Shows a loading card, then generates the world data and every texture. */
export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  create() {
    this.cameras.main.setBackgroundColor('#16261d');
    fitUi(this);
    displayText(this, VIEW.w / 2, VIEW.h / 2 - 22, 'Malu Dadayama', PAL.cream, 3, true);
    const sub = uiText(this, VIEW.w / 2, VIEW.h / 2 + 8, 'Filling the wewa…', 8, '#8fcb55', true).setOrigin(0.5, 0);
    this.tweens.add({ targets: sub, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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
      // if the font turns up after we have moved on, the title screen adds the Sinhala line then
      fonts.load('700 13px "Noto Sans Sinhala"', 'මාළු දඩයම').then((f) => { if (started && f.length > 0) this.registry.set('sinhala', true); begin(f.length > 0); }, () => begin(false));
      this.time.delayedCall(1800, () => begin(false));
    } else this.time.delayedCall(60, () => begin(false));
  }
}
