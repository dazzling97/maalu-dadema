import Phaser from 'phaser';
import { VIEW, PAL } from '../config/game';
import { CHARACTERS, RUN, STAGES } from '../config/balance';
import { makeCanvas, rect, outline } from '../art/px';
import { drawText, textWidth } from '../art/font';
import { keycap } from '../art/ui';
import { load, save, fmtTime } from '../systems/Storage';
import { audio } from '../systems/Audio';
import { UiScene } from './UiScene';
import { startRun } from './flow';

type Screen = 'main' | 'chars' | 'how' | 'settings' | 'scores';
const CX = VIEW.w / 2;
const VERSION = 'v1.0';

/** Big carved logo: chunky pixel letters with a gold-to-orange face, dark rim and drop shadow. */
function logoCanvas(sinhala: boolean): HTMLCanvasElement {
  const S = 6, title = 'MAALU HORU';
  const tw = textWidth(title, S);
  const [c, ctx] = makeCanvas(tw + 24, 5 * S + (sinhala ? 30 : 10));
  const [t, tc] = makeCanvas(tw + 4, 5 * S + 4);
  drawText(tc, title, 2, 2, '#f6d24a', S);
  const img = tc.getImageData(0, 0, t.width, t.height);
  for (let y = 0; y < t.height; y++) for (let x = 0; x < t.width; x++) {
    const i = (y * t.width + x) * 4;
    if (img.data[i + 3] === 0) continue;
    const band = Math.floor(((y - 2) / (5 * S)) * 4);
    const col = [[255, 243, 160], [246, 210, 74], [242, 166, 58], [224, 122, 46]][Math.min(3, Math.max(0, band))];
    img.data[i] = col[0]; img.data[i + 1] = col[1]; img.data[i + 2] = col[2];
  }
  tc.putImageData(img, 0, 0);
  outline(t, PAL.outline); outline(t, PAL.outline);
  ctx.globalAlpha = 0.5; ctx.drawImage(t, 12, 5); ctx.globalAlpha = 1;
  ctx.drawImage(t, 10, 1);
  if (sinhala) {
    // Sinhala title set in a real font, then snapped to hard pixels
    const [s, sc] = makeCanvas(c.width, 18);
    sc.font = '700 13px "Noto Sans Sinhala", sans-serif';
    sc.textAlign = 'center'; sc.textBaseline = 'middle'; sc.fillStyle = '#ffe9a8';
    sc.fillText('මාළු හොරු', c.width / 2, 9);
    const d = sc.getImageData(0, 0, s.width, s.height);
    for (let i = 0; i < d.data.length; i += 4) d.data[i + 3] = d.data[i + 3] > 105 ? 255 : 0;
    sc.putImageData(d, 0, 0);
    outline(s, PAL.outline);
    ctx.drawImage(s, 0, 5 * S + 8);
  }
  return c;
}

export class MenuScene extends UiScene {
  private screen: Screen = 'main';
  private name = '';
  private charIdx = 0;
  private card = 0;
  private first = true;
  constructor() { super('menu'); }

  create() {
    this.initUi();
    const s = load();
    this.charIdx = Math.max(0, CHARACTERS.findIndex((c) => c.id === s.charId));
    this.name = s.name;
    this.first = true;
    this.show('main');
    this.cameras.main.fadeIn(400, 22, 38, 29);
    this.input.keyboard!.on('keydown', this.onKey, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard!.off('keydown', this.onKey, this); this.clearUi(); });
  }

  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (this.screen === 'chars') {
      if (k === 'ArrowLeft' || k === 'ArrowRight') { this.charIdx = (this.charIdx + (k === 'ArrowLeft' ? CHARACTERS.length - 1 : 1)) % CHARACTERS.length; audio.play('uiMove'); this.show('chars'); }
      else if (k === 'Enter' || k === 'Escape') { audio.play('uiSelect'); this.confirmChar(); }
      else if (k === 'Backspace') { this.name = this.name.slice(0, -1); this.show('chars'); }
      else if (/^[a-zA-Z0-9 ]$/.test(k) && this.name.length < 10) { this.name = (this.name + k.toUpperCase()).replace(/^ +/, ''); this.show('chars'); }
      return;
    }
    if (this.screen === 'how') {
      if (k === 'ArrowRight' || k === 'Enter' || k === ' ') { audio.play('uiSelect'); if (this.card < 3) { this.card++; this.show('how'); } else startRun(this); }
      else if (k === 'ArrowLeft') { if (this.card > 0) { audio.play('uiMove'); this.card--; this.show('how'); } }
      else if (k === 'Escape') this.show('main');
      return;
    }
    if (k === 'ArrowUp' || k === 'w' || k === 'W') this.focus(this.sel - 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.focus(this.sel + 1);
    else if ((k === 'ArrowLeft' || k === 'ArrowRight') && this.btns[this.sel]?.adjust) { audio.play('uiMove'); this.btns[this.sel].adjust!(k === 'ArrowLeft' ? -1 : 1); }
    else if (k === 'Enter' || k === ' ') this.press(this.btns[this.sel]);
    else if (k === 'Escape' && this.screen !== 'main') this.show(this.screen === 'scores' ? 'settings' : 'main');
  }
  private confirmChar() {
    save({ charId: CHARACTERS[this.charIdx].id, name: this.name.trim() });
    this.show('settings');
  }

  private show(screen: Screen, focus = 0) {
    this.clearUi();
    this.screen = screen;
    if (screen === 'main') this.buildMain();
    else if (screen === 'chars') this.buildChars();
    else if (screen === 'how') this.buildHow();
    else if (screen === 'settings') this.buildSettings();
    else this.buildScores();
    if (focus) this.focus(focus);
  }
  private heading(title: string) { this.text(CX, 12, title, '#ffe9a8', 2, true); }
  private footer(text: string) { this.sans(CX, VIEW.h - 14, text, 6.5, '#c9d4b8', false, true); }

  // ---------------------------------------------------------------- title screen
  /** Title, three actions, nothing else. The pond drifts by behind a gradient scrim. */
  private buildMain() {
    this.gradient();
    const sinhala = this.registry.get('sinhala') === true;
    const logo = this.add.image(CX, 30, this.tx(logoCanvas(sinhala))).setOrigin(0.5, 0);
    this.root.add(logo);
    const subY = 30 + logo.height + 2;
    const sub = this.sans(CX, subY, 'The Great Fish Heist', 10, '#f6e7c1', false, true);
    sub.setLetterSpacing(1.5);
    const y0 = subY + 34;
    const play = this.button(CX, y0, 132, 'Play Game', () => startRun(this), { style: 'primary', h: 22 });
    const how = this.button(CX, y0 + 30, 132, 'How to Play', () => { this.card = 0; this.show('how'); });
    const set = this.button(CX, y0 + 54, 80, 'Settings', () => this.show('settings'), { style: 'link', h: 14 });
    const ver = this.sans(VIEW.w - 8, VIEW.h - 13, VERSION, 6, '#c9d4b8').setOrigin(1, 0).setAlpha(0.7);
    if (this.first) { // gentle entrance, once
      this.first = false;
      const rise = (o: { y: number; setAlpha(a: number): unknown }, delay: number) => {
        const y = o.y; o.y = y + 6; o.setAlpha(0);
        this.tweens.add({ targets: o, y, alpha: 1, duration: 420, delay, ease: 'Cubic.out' });
      };
      rise(logo, 100); rise(sub, 260); rise(play.c, 420); rise(how.c, 500); rise(set.c, 580);
      ver.setAlpha(0); this.tweens.add({ targets: ver, alpha: 0.7, duration: 400, delay: 700 });
    }
  }

  // ---------------------------------------------------------------- fisherman
  private buildChars() {
    this.dim();
    this.heading('CHOOSE YOUR FISHERMAN');
    CHARACTERS.forEach((ch, i) => {
      const x = CX - 126 + i * 132, on = i === this.charIdx;
      const card = this.panel(x, 34, 120, 146, on);
      card.setInteractive().on('pointerdown', () => { this.charIdx = i; audio.play('uiMove'); this.show('chars'); });
      const [g, gc] = makeCanvas(4, 4); rect(gc, 0, 0, 4, 4, on ? '#62a645' : '#3f6a3a');
      this.root.add(this.add.image(x + 8, 42, this.tx(g)).setOrigin(0).setScale(26, 24));
      const sp = this.add.sprite(x + 60, 134, ch.id, 0).setOrigin(0.5, 1).setScale(3);
      sp.play(`${ch.id}-${on ? 'walk' : 'idle'}-down`);
      if (!on) sp.setAlpha(0.7);
      this.root.add(sp);
      this.sans(x + 60, 143, ch.name, 9, on ? '#ffe9a8' : '#f6e7c1', true, true);
      this.sans(x + 60, 156, ch.blurb, 7, '#f6e7c1', false, true);
      this.sans(x + 60, 166, `Speed ${Math.round(ch.speedMul * 100)}   Luck ${Math.round(ch.luckMul * 100)}`, 6.5, '#e0c38a', false, true);
    });
    this.sans(CX, 187, 'Name on the scoreboard', 7, '#e0c38a', false, true);
    this.panel(CX - 70, 198, 140, 20, true);
    const shown = this.name || CHARACTERS[this.charIdx].name.toUpperCase();
    this.sans(CX, 202, `${shown}${this.name.length < 10 ? '_' : ''}`, 10, this.name ? '#fff3a0' : '#b9ad8a', true, true);
    this.button(CX, 226, 118, 'Confirm', () => this.confirmChar(), { style: 'primary', h: 18 });
    this.footer('Type a name.  Left / Right to choose.  Enter to confirm');
  }

  // ---------------------------------------------------------------- how to play
  /** Four picture cards: one idea each, in plain words. */
  private buildHow() {
    this.dim();
    const cards = [
      { head: 'Catch Fish', lines: ['Point at the water and press Space to cast.', 'Press Space again when a fish bites (!).'], keys: ['MOUSE', 'SPACE'] },
      { head: 'Store Fish', lines: ['You can only carry a few fish at a time.', 'Take them to the fish bag and press E.'], keys: ['W', 'A', 'S', 'D', 'E'] },
      { head: 'Stop Sabapathi', lines: ['He sneaks out of his shop to rob the bag.', 'Hit him with a rock and he drops the fish.'], keys: ['CLICK'] },
      { head: 'Survive Crocodiles', lines: ['Move away when one rears up, or dash with Shift.', 'Walk over rocks to pick them up, then throw to stun.'], keys: ['SHIFT', 'CLICK'] },
    ];
    const c = cards[this.card], x = CX - 150, y = 28, w = 300, h = 170;
    this.heading('HOW TO PLAY');
    this.panel(x, y, w, h, true);
    const [g, gc] = makeCanvas(4, 4); rect(gc, 0, 0, 4, 4, this.card === 0 ? '#2b8a9e' : '#62a645');
    this.root.add(this.add.image(x + 12, y + 12, this.tx(g)).setOrigin(0).setScale(69, 20));
    const art = (key: string, ax: number, ay: number, frame: number | string = 0, scale = 2) => { const s = this.add.sprite(x + ax, y + ay, key, frame).setScale(scale); this.root.add(s); return s; };
    const hero = load().charId;
    if (this.card === 0) {
      const [l, lc] = makeCanvas(4, 4); rect(lc, 0, 0, 4, 4, '#62a645');
      this.root.add(this.add.image(x + 12, y + 12, this.tx(l)).setOrigin(0).setScale(26, 20));
      art(hero, 86, 54).play(`${hero}-fish-right`);
      art('bobber', 196, 62, 1, 3); art('ring', 196, 66, 1, 3); art('bang', 196, 34, 0, 2);
      art('fish', 236, 70, 0, 3).setAlpha(0.6);
    } else if (this.card === 1) {
      art(hero, 110, 54).play(`${hero}-walk-right`);
      art('catch', 150, 46, 0, 2); art('catch', 166, 56, 1, 2);
      art('bag', 206, 56, 2, 2); art('key-e', 206, 26, 0, 2);
    } else if (this.card === 2) {
      art('bag', 70, 56, 1, 2);
      art('sabapathi', 150, 54).play('sabapathi-walk-right'); art('loot', 136, 50, 0, 2);
      art('stone', 190, 44, 0, 3); art(hero, 244, 54).play(`${hero}-fish-left`);
    } else {
      art('croc', 110, 58, 4, 3); art('alert', 110, 28, 0, 2);
      art('stone', 170, 40, 0, 3); art('stones', 250, 74, 0, 2);
      art(hero, 214, 54).play(`${hero}-idle-left`);
    }
    this.sans(x + 14, y + 100, `${this.card + 1} of 4`, 6.5, '#e0c38a', true);
    this.sans(x + 14, y + 109, c.head, 12, '#ffe9a8', true);
    c.lines.forEach((t, i) => this.sans(x + 14, y + 127 + i * 12, t, 8.5, '#f6e7c1'));
    let kx = x + w - 14;
    for (const k of [...c.keys].reverse()) { const img = this.add.image(kx, y + 104, this.tx(keycap(k))).setOrigin(1, 0); this.root.add(img); kx -= img.width + 3; }
    for (let i = 0; i < 4; i++) { const [d, dc] = makeCanvas(4, 4); rect(dc, 0, 0, 4, 4, i === this.card ? '#f6d24a' : '#4a3f58'); this.root.add(this.add.image(CX - 14 + i * 8, y + h - 9, this.tx(d)).setOrigin(0)); }
    const by = 206;
    if (this.card > 0) this.button(CX - 110, by + 2, 70, 'Back', () => { this.card--; this.show('how'); });
    this.button(CX, by + 3, 56, 'Skip', () => this.show('main'), { style: 'link', h: 14 });
    this.button(CX + 104, by, 92, this.card < 3 ? 'Next' : 'Start Game', () => { if (this.card < 3) { this.card++; this.show('how'); } else startRun(this); }, { style: 'primary', h: 20 });
    this.focus(this.btns.length - 1);
    this.sans(CX, 234, 'Move  W A S D      Dash  Shift      Cast / reel  Space      Store fish  E      Throw  Click      Pause  Esc', 6.5, '#c9d4b8', false, true);
    this.sans(CX, 245, `Three stages:  ${STAGES.map((st) => `${st.target} fish in ${fmtTime(st.duration)}`).join('   ')}   ·   ${RUN.hearts} hearts each`, 6.5, '#e0c38a', false, true);
  }

  // ---------------------------------------------------------------- settings
  private buildSettings() {
    this.dim();
    this.heading('SETTINGS');
    this.panel(CX - 116, 32, 232, 196);
    const W = 208;
    let y = this.settingsRows(CX, 40, W, (row) => this.show('settings', row));
    this.button(CX, y, W, 'Fisherman and name', () => this.show('chars')); y += 19;
    this.button(CX, y, W, 'Best runs', () => this.show('scores')); y += 23;
    this.button(CX, y, 100, 'Back', () => this.show('main'), { style: 'primary', h: 18 });
    this.soundState(CX, 234);
    this.footer('Up / Down to choose.  Left / Right to adjust.  Enter to select');
  }

  private buildScores() {
    this.dim();
    this.heading('BEST RUNS');
    this.panel(CX - 150, 34, 300, 112);
    const s = load().scores;
    if (!s.length) this.sans(CX, 82, 'No runs yet. Go catch something!', 8, '#f6e7c1', false, true);
    else { this.sans(CX - 134, 42, 'Name', 7, '#e0c38a'); this.sans(CX - 40, 42, 'Stages', 7, '#e0c38a'); this.sans(CX + 30, 42, 'Fish', 7, '#e0c38a'); this.sans(CX + 80, 42, 'Time to spare', 7, '#e0c38a'); }
    s.forEach((e, i) => {
      const y = 56 + i * 15, col = i === 0 ? '#ffe9a8' : '#f6e7c1';
      this.sans(CX - 134, y, `${i + 1}.  ${e.name}`, 8, col, i === 0);
      this.sans(CX - 40, y, e.won ? 'All 3' : `${e.stages} of 3`, 8, e.won ? '#9ff08a' : col);
      this.sans(CX + 30, y, String(e.fish), 8, col);
      this.sans(CX + 80, y, e.won ? fmtTime(e.left) : '-', 8, col);
    });
    this.button(CX - 56, 160, 100, 'Back', () => this.show('settings', 7), { style: 'primary', h: 18 });
    this.button(CX + 56, 161, 100, 'Clear best runs', () => { save({ scores: [] }); this.show('scores'); });
  }
}
