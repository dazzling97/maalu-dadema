import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { RUN, STAGES, CUR } from '../config/balance';
import { fmtTime, load } from '../systems/Storage';
import { UiScene } from './UiScene';
import { touchMode } from '../systems/Touch';
import { startRun, nextStage, retryStage, goMenu, Totals } from './flow';

export interface RunResult {
  mode: 'stage' | 'fail' | 'final';
  outcome: 'win' | 'time' | 'dead';
  stored: number; stolen: number; stunned: number; left: number;
  totals: Totals; best: boolean;
}

/** Stage Complete, Stage Failed and the final victory card, shown over the frozen world. */
export class ResultScene extends UiScene {
  constructor() { super('result'); }
  create(r: RunResult) {
    this.initUi();
    const cx = VIEW.w / 2, n = CUR.index + 1, good = r.mode !== 'fail';
    this.dim(0.6);
    const w = 236, h = 176, x = cx - w / 2, y = 40;
    this.panel(x, y, w, h, good);
    const title = r.mode === 'final' ? 'YOU BEAT SABAPATHI!' : r.mode === 'stage' ? `STAGE ${n} COMPLETE!` : 'STAGE FAILED';
    this.text(cx, y + 12, title, good ? '#9ff08a' : '#ffb0a0', r.mode === 'final' ? 2 : 3, true);
    const who = load().name || 'You';
    const line = r.mode === 'final' ? `${who} cleared all three stages. The village eats well tonight.`
      : r.mode === 'stage' ? `${RUN.target} fish safe in the bag. Next: ${STAGES[n].name}.`
      : r.outcome === 'time' ? `Stage ${n} needed ${RUN.target} fish. You had ${r.stored}.` : `The crocodiles got you with ${r.stored} of ${RUN.target} fish in the bag.`;
    this.sans(cx, y + 36, line, 7.5, '#f6e7c1', false, true);
    if (r.best) this.sans(cx, y + 48, 'New personal best!', 7.5, '#ffe36a', true, true);
    const t = r.totals;
    const rows: [string, string, string][] = r.mode === 'final' ? [
      ['Fish collected, all stages', String(t.fish), '#9ff08a'],
      ['Fish stolen', String(t.stolen), t.stolen ? '#ffb0a0' : '#f6e7c1'],
      ['Crocodiles stunned', String(t.stunned), '#f6e7c1'],
      ['Total time to spare', fmtTime(t.left), '#f6e7c1'],
    ] : [
      ['Fish collected', `${r.stored} / ${RUN.target}`, good ? '#9ff08a' : '#f6e7c1'],
      ['Time remaining', fmtTime(r.left), '#f6e7c1'],
      ['Fish stolen', String(r.stolen), r.stolen ? '#ffb0a0' : '#f6e7c1'],
      ['Crocodiles stunned', String(r.stunned), '#f6e7c1'],
    ];
    rows.forEach(([k, v, col], i) => {
      const ry = y + 64 + i * 13;
      this.sans(x + 30, ry, k, 8, '#e0c38a');
      this.sans(x + w - 30, ry, v, 8, col, true).setOrigin(1, 0);
    });
    if (r.mode !== 'final') this.sans(cx, y + 118, `Stages completed so far: ${t.done} of ${STAGES.length}   Fish banked overall: ${t.fish}`, 6.5, '#c9d4b8', false, true);
    const by = y + 134;
    if (r.mode === 'stage') this.button(cx - 54, by - 2, 100, 'Next stage', () => nextStage(this), { style: 'primary' });
    else if (r.mode === 'fail') this.button(cx - 54, by - 2, 100, 'Retry stage', () => retryStage(this), { style: 'primary' });
    else this.button(cx - 54, by - 2, 100, 'Play again', () => startRun(this), { style: 'primary' });
    this.button(cx + 54, by, 100, 'Main menu', () => goMenu(this));
    if (!touchMode()) this.sans(cx, y + 157, 'Arrow keys to choose, Enter to select', 6.5, '#c9d4b8', false, true);
    this.root.setAlpha(0).setY(-10);
    this.tweens.add({ targets: this.root, alpha: 1, y: 0, duration: 380, ease: 'Cubic.out' });
    // ignore the keys the player was holding when the stage ended
    this.time.delayedCall(450, () => this.input.keyboard!.on('keydown', this.onKey, this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard!.off('keydown', this.onKey, this); this.clearUi(); });
  }
  private onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') this.focus(this.sel - 1);
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') this.focus(this.sel + 1);
    else if (e.key === 'Enter') this.press(this.btns[this.sel]);
  }
}
