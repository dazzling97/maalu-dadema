import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { UiScene } from './UiScene';
import { retryStage, goMenu } from './flow';
import { audio } from '../systems/Audio';

type Mode = 'menu' | 'settings' | 'quit';

/**
 * Pause menu. The world scene is paused underneath for as long as this is
 * open, including its Settings and Quit confirmation screens, so nothing can
 * hurt the player or run the clock down while they decide.
 */
export class PauseScene extends UiScene {
  private mode: Mode = 'menu';
  constructor() { super('pause'); }

  create() {
    this.initUi();
    this.mode = 'menu';
    audio.setPaused(true);
    this.build();
    this.input.keyboard!.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard!.off('keydown', this.onKey, this); this.clearUi(); audio.setPaused(false); });
  }
  private resume() { this.scene.resume('world'); this.scene.stop(); }
  private go(mode: Mode, focus = 0) { this.mode = mode; this.build(focus); }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'Escape') { if (this.mode === 'menu') this.resume(); else this.go('menu', this.mode === 'settings' ? 2 : 3); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') this.focus(this.sel - 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.focus(this.sel + 1);
    else if (k === 'ArrowLeft' || k === 'ArrowRight') {
      const b = this.btns[this.sel];
      if (b?.adjust) { audio.play('uiMove'); b.adjust(k === 'ArrowLeft' ? -1 : 1); }
      else if (this.mode === 'quit') this.focus(this.sel + (k === 'ArrowLeft' ? -1 : 1));
    }
    else if (k === 'Enter' || k === ' ') this.press(this.btns[this.sel]);
  }

  private build(focus = 0) {
    this.clearUi();
    this.dim(0.6);
    const cx = VIEW.w / 2;
    if (this.mode === 'menu') {
      this.panel(cx - 82, 54, 164, 150);
      this.text(cx, 66, 'PAUSED', '#ffe9a8', 3, true);
      this.button(cx, 92, 124, 'Resume Game', () => this.resume(), { style: 'primary' });
      this.button(cx, 118, 124, 'Restart Stage', () => retryStage(this));
      this.button(cx, 138, 124, 'Settings', () => this.go('settings'));
      this.button(cx, 158, 124, 'Quit Game', () => this.go('quit'));
      this.sans(cx, 184, 'Esc to resume', 7, '#e0c38a', false, true);
    } else if (this.mode === 'settings') {
      this.panel(cx - 116, 34, 232, 186);
      this.text(cx, 42, 'SETTINGS', '#ffe9a8', 2, true);
      const y = this.settingsRows(cx, 60, 208, (row) => this.go('settings', row));
      this.button(cx, y + 4, 100, 'Back', () => this.go('menu', 2), { style: 'primary', h: 18 });
      this.soundState(cx, y + 28);
    } else {
      // quitting always asks first, and Cancel is the default
      this.panel(cx - 122, 84, 244, 96, true);
      this.sans(cx, 96, 'Quit the game?', 11, '#ffe9a8', true, true);
      this.sans(cx, 116, 'Your current stage progress will be lost.', 8, '#f6e7c1', false, true);
      this.button(cx - 62, 142, 100, 'Cancel', () => this.go('menu', 3));
      this.button(cx + 56, 140, 124, 'Quit to Main Menu', () => goMenu(this), { style: 'primary' });
    }
    this.focus(focus);
  }
}
