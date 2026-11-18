import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { RUN, CUR, STAGES, GEAR, GearId, SHOP_OPENS_STAGE } from '../config/balance';
import { HD, hdScale } from '../art/hd';
import { fmtTime, load } from '../systems/Storage';
import { fitUi, uiText, darkPanel, displayText } from './UiScene';
import type { CoachCard } from '../entities/Tutor';
import { touchMode } from '../systems/Touch';

/** mm:ss with a leading zero, so the strip never changes width. */
const clock = (t: number) => fmtTime(t).padStart(5, '0');

type Txt = Phaser.GameObjects.Text;

/**
 * In-game interface. Timer and fish target lead; everything else is small and
 * quiet at the screen corners. Small text is sharp sans-serif on dark panels.
 */
export class HudScene extends Phaser.Scene {
  private n = 0;
  private timer!: Txt;
  private timerBox!: Phaser.GameObjects.Image;
  private timerBoxHot!: Phaser.GameObjects.Image;
  private stored!: Txt;
  private bar!: Phaser.GameObjects.Image;
  private hearts: Phaser.GameObjects.Image[] = [];
  private rocks!: Txt;
  private slots: Phaser.GameObjects.Image[] = [];
  private carriedText!: Txt;
  private toast?: Phaser.GameObjects.Container;
  private toastKey = '';
  private toastAt = 0;
  private toastRank = 0;
  private gearIcon!: Phaser.GameObjects.Image;
  private gearText!: Txt;
  private coinText!: Txt;
  private swapKey!: Phaser.GameObjects.Image;
  private coach?: Phaser.GameObjects.Container;
  private mark?: Phaser.GameObjects.Rectangle;
  private hudBoxes: Record<string, { x: number; y: number; w: number; h: number }> = {};
  private point!: Phaser.GameObjects.Image;
  private reticle!: Phaser.GameObjects.Image;
  private arrow!: Phaser.GameObjects.Image;
  private urgent = false;
  private ended = false;
  constructor() { super('hud'); }

  private tex(c: HTMLCanvasElement): string {
    const key = `hud-${this.n++}`;
    this.textures.addCanvas(key, c)!.setFilter(Phaser.Textures.FilterMode.LINEAR);
    return key;
  }
  /** A dark HUD panel (drawn at ART density, shown at world size). */
  private panelImg(x: number, y: number, w: number, h: number, edge?: string) {
    return this.add.image(x, y, this.tex(darkPanel(w, h, edge))).setOrigin(0).setScale(HD);
  }
  private box(x: number, y: number, w: number, h: number, edge?: string) { return this.panelImg(x, y, w, h, edge); }

  create() {
    fitUi(this);
    this.urgent = false; this.ended = false; this.hearts = []; this.slots = [];
    const cx = VIEW.w / 2;

    // ---- centre: one compact strip — STAGE n/3 | fish stored/target | time left
    const BH = 17, BY = 4, TY = BY + 4, MID = BY + BH / 2;
    const cw = 172, x0 = cx - cw / 2;
    this.timerBox = this.box(x0, BY, cw, BH);
    this.timerBoxHot = this.box(x0, BY, cw, BH, 'rgba(255,120,100,0.95)').setVisible(false);
    const sep = (x: number) => this.add.rectangle(x, BY + 4, 1, BH - 8, 0xf6e7c1, 0.28).setOrigin(0);
    uiText(this, x0 + 8, TY, `STAGE ${CUR.index + 1}/${STAGES.length}`, 7.5, '#e0c38a', true);
    sep(x0 + 57);
    this.add.image(x0 + 64, MID, 'catch', 0).setOrigin(0, 0.5).setScale(0.8 * HD);
    this.stored = uiText(this, x0 + 80, TY - 0.5, `0/${RUN.target}`, 8.5, '#9ff08a', true);
    sep(x0 + 118);
    this.add.image(x0 + 125, MID, 'clock').setOrigin(0, 0.5).setScale(HD);
    this.timer = uiText(this, x0 + 136, TY - 0.5, clock(RUN.duration), 8.5, '#fff6d8', true);
    // progress toward the target runs along the bottom edge of the strip
    this.add.rectangle(x0 + 3, BY + BH - 2, cw - 6, 1, 0x3a2f44).setOrigin(0);
    this.bar = this.add.rectangle(x0 + 3, BY + BH - 2, cw - 6, 1, 0x9ff08a).setOrigin(0).setScale(0, 1) as unknown as Phaser.GameObjects.Image;

    // ---- left: hearts and rocks in one small group
    this.box(6, BY, 84, BH);
    for (let i = 0; i < RUN.hearts; i++) this.hearts.push(this.add.image(11 + i * 12, MID, 'heart', 0).setOrigin(0, 0.5).setScale(HD));
    sep(51);
    this.add.image(56, MID, 'stones').setOrigin(0, 0.5).setScale(0.8 * HD);
    this.rocks = uiText(this, 70, TY, `${RUN.startRocks}/${RUN.maxRocks}`, 7.5, '#f6e7c1', true);

    // ---- right: fish in hand, and from Stage 2 the gear in hand and Fish Coins
    const shop = CUR.index >= SHOP_OPENS_STAGE;
    const touchUi = touchMode();
    const rw = shop ? 118 : 46, rx = VIEW.w - 6 - rw - (touchUi ? 24 : 0); // touch: room for the pause button in the corner
    this.box(rx, BY, rw, BH);
    this.add.image(rx + 6, MID, 'bag').setOrigin(0, 0.5).setScale(0.55 * HD);
    this.carriedText = uiText(this, rx + 22, TY, `0/${RUN.carryMax}`, 7.5, '#f6e7c1', true);
    if (shop) sep(rx + 46);
    this.gearIcon = this.add.image(rx + 57, MID, 'gear', 0).setScale(0.75 * HD).setVisible(shop);
    this.gearText = uiText(this, rx + 65, TY + 0.5, 'Rod', 6.5, '#f6e7c1', true).setVisible(shop);
    this.swapKey = this.add.image(rx + 57, MID + 3, 'key-q').setOrigin(0, 0).setScale(0.5 * HD).setVisible(false);
    this.add.image(rx + 94, MID, 'coin').setOrigin(0, 0.5).setScale(HD).setVisible(shop);
    this.coinText = uiText(this, rx + 104, TY, '0', 7.5, '#ffe36a', true).setVisible(shop);

    this.hudBoxes = { rocks: { x: 52, y: BY + 1, w: 37, h: BH - 2 }, fish: { x: x0 + 58, y: BY + 1, w: 60, h: BH - 2 }, carry: { x: rx + 1, y: BY + 1, w: 44, h: BH - 2 } };
    this.coach = undefined; this.mark = undefined;
    this.point = this.add.image(0, 0, 'arrow').setScale(HD).setDepth(90).setVisible(false);

    this.arrow = this.add.image(0, 0, 'arrow').setScale(HD).setDepth(90).setVisible(false);
    this.reticle = this.add.image(0, 0, 'reticle').setScale(HD).setDepth(100).setVisible(!touchUi); // no cursor on touch screens

    const ev = this.game.events;
    const on = (name: string, fn: (...a: never[]) => void) => { ev.on(name, fn, this); this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => ev.off(name, fn, this)); };
    on('clock', this.onClock);
    on('tally', this.onTally);
    on('hearts', this.onHearts);
    on('stones', this.onStones);
    on('norocks', this.onNoRocks);
    // compact, non-blocking notices: one line, one at a time, gone in about two seconds
    on('zone', (text: string) => this.notify(text, 'info', 1600));
    on('event', (text: string) => this.notify(text, 'info', 2400));
    // the first time, the tutorial card makes this announcement instead
    on('prowl', () => { if (load().hints && !load().tutorials.includes('first_sabapathi_entrance')) return; this.notify('Sabapathi is approaching!', 'warn', 2000); });
    on('coach', this.onCoach);
    on('coachNote', (n: { text: string; kind: 'good' | 'info' }) => this.notify(n.text, n.kind, 2600));
    on('heist', this.onHeist);
    on('gear', this.onGear);
    on('tip', (t: { title: string; sub?: string; icon?: string; frame?: number; ms?: number }) => this.notify(t.title, 'tip', t.ms ?? 3200, t.sub ?? '', t.icon ?? '', t.frame ?? 0));
    this.registry.set('hudBusy', false);
    on('cutscene', () => this.cameras.main.setVisible(false));
    this.cameras.main.setVisible(true);
    this.onIntro(CUR.index); // every stage opens with its title card
    on('ended', () => { this.ended = true; this.toast?.destroy(); this.toast = undefined; this.arrow.setVisible(false); this.point.setVisible(false); this.onCoach(null); });
  }

  /** Stage title card, shown while the world waits to start. */
  private onIntro(index: number) {
    const st = STAGES[index], cx = VIEW.w / 2, w = 250, h = 74;
    const c = this.add.container(0, 0).setDepth(200);
    c.add(this.panelImg(cx - w / 2, 92, w, h, 'rgba(246,210,74,0.9)'));
    c.add(uiText(this, cx, 98, `STAGE ${index + 1} OF ${STAGES.length}  ·  ${st.label.toUpperCase()}`, 7.5, '#e0c38a', true).setOrigin(0.5, 0));
    const title = st.name.toUpperCase();
    c.add(displayText(this, cx, 111, title, '#ffe9a8', 2, true));
    c.add(uiText(this, cx, 132, `Get ${st.target} fish into the bag in ${fmtTime(st.duration)}`, 9, '#fff6d8', true).setOrigin(0.5, 0));
    c.add(uiText(this, cx, 147, index === 0 ? 'Crocodiles are slow and Sabapathi is lazy. For now.' : index === 1 ? 'Faster crocodiles. Sabapathi raids more often.' : 'Everything is faster. Guard that bag.', 7, '#c9d4b8').setOrigin(0.5, 0));
    c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 300 });
    this.tweens.add({ targets: c, alpha: 0, duration: 350, delay: 2350, onComplete: () => c.destroy() });
  }
  private onClock(left: number) {
    this.timer.setText(clock(left));
    const urgent = left <= RUN.finalStretch;
    if (urgent && !this.urgent) {
      this.urgent = true;
      this.timer.setColor('#ff8a7a');
      this.timerBoxHot.setVisible(true);
      this.tweens.add({ targets: this.timerBoxHot, alpha: 0.25, duration: 420, yoyo: true, repeat: -1 });
      this.notify('30 seconds left!', 'warn', 2000);
    }
    if (urgent) this.tweens.add({ targets: this.timer, scale: 1.15, duration: 110, yoyo: true }); // a heartbeat every second
  }
  private onTally(t: { carried: number; stored: number }) {
    const before = this.stored.text;
    this.stored.setText(`${t.stored}/${RUN.target}`);
    (this.bar as unknown as Phaser.GameObjects.Rectangle).setScale(Math.min(1, t.stored / RUN.target), 1);
    if (before !== this.stored.text) this.tweens.add({ targets: this.stored, scale: 1.2, duration: 90, yoyo: true });
    this.carriedText.setText(`${t.carried}/${RUN.carryMax}`).setColor(t.carried >= RUN.carryMax ? '#ffb0a0' : '#f6e7c1');
    this.slots.forEach((s, i) => s.setAlpha(i < t.carried ? 1 : 0.22));
  }
  private onHearts(n: number) {
    this.hearts.forEach((h, i) => {
      const full = i < n;
      if (!full && h.frame.name === '0') this.tweens.add({ targets: h, y: h.y - 3, duration: 90, yoyo: true });
      h.setFrame(full ? 0 : 1);
    });
  }
  private onStones(n: number) { this.rocks.setText(`${n}/${RUN.maxRocks}`).setColor(n === 0 ? '#ffb0a0' : '#f6e7c1'); }
  private onNoRocks() { this.tweens.add({ targets: this.rocks, x: 72, duration: 50, yoyo: true, repeat: 3 }); }
  /**
   * The tutorial card: one compact panel low on the screen, clear of the HUD strip,
   * the notices under it and the middle of the play area. Only ever one at a time.
   */
  private onCoach(card: CoachCard | null) {
    const old = this.coach;
    this.coach = undefined;
    if (old) this.tweens.add({ targets: old, alpha: 0, y: old.y + 4, duration: 180, onComplete: () => old.destroy() });
    this.mark?.destroy(); this.mark = undefined;
    this.registry.set('coach', card?.id ?? '');
    if (!card || this.ended) return;
    const pad = card.icon ? 26 : 10;
    const t = uiText(this, pad, 5, card.title, 8, '#ffe9a8', true).setOrigin(0, 0);
    const s2 = card.sub ? uiText(this, pad, 16, card.sub, 6.5, '#f6e7c1').setOrigin(0, 0) : null;
    const touchUi = touchMode();
    const skip = uiText(this, 0, 0, touchUi ? 'Tap to skip' : 'X  skip', 6, '#b8b0a0').setOrigin(1, 1);
    const h = s2 ? 29 : 19;
    const w = Math.min(VIEW.w - 16, Math.ceil(Math.max(t.width, s2 ? s2.width : 0)) + pad + 10 + Math.ceil(skip.width) + 8);
    skip.setPosition(w - 6, h - 4);
    // touch: the thumbs own the bottom corners, so the card sits under the notices instead
    const y = touchUi ? 44 : VIEW.h - h - 8;
    const c = this.add.container(Math.round(VIEW.w / 2 - w / 2), y + 5).setDepth(80).setAlpha(0);
    if (touchUi) c.add(this.add.zone(0, 0, w, h).setOrigin(0).setInteractive().on('pointerdown', () => this.game.events.emit('coachSkip')));
    c.add(this.panelImg(0, 0, w, h, 'rgba(246,210,74,0.85)'));
    if (card.icon) c.add(this.add.image(13, h / 2, card.icon, card.frame ?? 0).setScale((card.icon === 'bag' ? 0.6 : 1) * hdScale(card.icon)));
    c.add(t); if (s2) c.add(s2); c.add(skip);
    this.tweens.add({ targets: c, alpha: 1, y, duration: 240, ease: 'Cubic.out' });
    this.coach = c;
    // a soft pulsing outline on the part of the HUD the card is about
    const box = card.hud ? this.hudBoxes[card.hud] : null;
    if (box) {
      this.mark = this.add.rectangle(box.x - 1, box.y - 1, box.w + 2, box.h + 2).setOrigin(0).setStrokeStyle(1, 0xffe36a, 1).setDepth(79);
      this.tweens.add({ targets: this.mark, alpha: 0.3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }

  private onGear(g: { coins: number; equipped: GearId; owned: number }) {
    const d = GEAR[g.equipped];
    this.gearIcon.setFrame(d.frame);
    this.gearText.setText(g.equipped === 'rod' ? 'Rod' : g.equipped === 'net' ? 'Net' : 'Net+');
    this.swapKey.setVisible(false);
    this.gearText.setColor(g.owned > 1 ? '#ffe9a8' : '#f6e7c1');
    if (this.coinText.text !== String(g.coins)) this.tweens.add({ targets: this.coinText, scale: 1.25, duration: 90, yoyo: true });
    this.coinText.setText(String(g.coins));
  }

  /**
   * One small pill under the timer. Never pauses or blocks anything. A new notice
   * replaces the old one, except that passing chatter cannot push out a warning,
   * and the same text is not repeated within a few seconds.
   */
  private notify(text: string, kind: 'info' | 'warn' | 'good' | 'tip', ms: number, sub = '', iconKey = '', iconFrame = 0) {
    if (this.ended) return;
    const now = this.time.now, rank = kind === 'tip' ? -1 : kind === 'info' ? 0 : 1; // warnings beat chatter, chatter beats tips
    if (text === this.toastKey && now - this.toastAt < 4000) return;
    if (this.toast && rank < this.toastRank) return;
    this.toast?.destroy();
    this.toastKey = text; this.toastAt = now; this.toastRank = rank;
    const col = kind === 'warn' ? '#ffb4a6' : kind === 'good' ? '#9ff08a' : kind === 'tip' ? '#ffe9a8' : '#f6e7c1';
    const t = uiText(this, 0, 3, text, kind === 'tip' ? 8 : 7.5, col, kind !== 'info').setOrigin(0, 0);
    const s2 = sub ? uiText(this, 0, 14, sub, 7, '#f6e7c1').setOrigin(0, 0) : null;
    const icon = kind === 'warn' ? this.add.image(8, 8, 'warn').setScale(HD) : iconKey ? this.add.image(11, sub ? 13 : 8, iconKey, iconFrame).setScale((sub ? 1 : 0.7) * hdScale(iconKey)) : null;
    const pad = icon ? (iconKey ? (sub ? 24 : 18) : 17) : 8, h = sub ? 27 : 16;
    const w = Math.ceil(Math.max(t.width, s2 ? s2.width : 0)) + pad + 8;
    t.setX(pad); s2?.setX(pad);
    const c = this.add.container(Math.round(VIEW.w / 2 - w / 2), 19);
    const edge = kind === 'warn' ? 'rgba(255,120,100,0.9)' : kind === 'good' ? 'rgba(159,240,138,0.7)' : kind === 'tip' ? 'rgba(246,210,74,0.85)' : 'rgba(246,231,193,0.3)';
    c.add(this.panelImg(0, 0, w, h, edge));
    if (icon) { c.add(icon); if (kind === 'warn') this.tweens.add({ targets: icon, alpha: 0.35, duration: 220, yoyo: true, repeat: 3 }); }
    c.add(t); if (s2) c.add(s2);
    c.setAlpha(0);
    this.toast = c;
    this.registry.set('hudBusy', true);
    this.tweens.add({ targets: c, alpha: 1, y: 25, duration: 220, ease: 'Cubic.out' });
    this.tweens.add({ targets: c, alpha: 0, y: 21, duration: 260, delay: ms, onComplete: () => { if (this.toast === c) { this.toast = undefined; this.toastRank = 0; this.registry.set('hudBusy', false); } c.destroy(); } });
  }
  private onHeist(h: { n: number; status: 'stolen' | 'dropped' | 'escaped' } | null) {
    if (!h) return;
    if (h.status === 'stolen') this.notify(`Sabapathi stole ${h.n} fish! Stop him`, 'warn', 2400);
    else if (h.status === 'dropped') this.notify('He dropped them! Grab the fish', 'good', 2400);
    else this.notify(`${h.n} fish lost to his shop`, 'warn', 2200);
  }

  update() {
    const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    this.reticle.setPosition(Math.round(p.x), Math.round(p.y));
    // edge arrow toward Sabapathi while he is heading for the bag or running off with fish
    const t = this.registry.get('thief') as { x: number; y: number; hot: boolean; prowl: boolean } | undefined;
    const view = this.scene.get('world').cameras.main.worldView;
    let show = false;
    if (t && (t.hot || t.prowl) && !this.ended) {
      const sx = t.x - view.x, sy = t.y - view.y;
      if (sx < 0 || sy < 0 || sx > VIEW.w || sy > VIEW.h) {
        show = true;
        this.arrow.setPosition(Math.round(Phaser.Math.Clamp(sx, 12, VIEW.w - 12)), Math.round(Phaser.Math.Clamp(sy, 28, VIEW.h - 14)))
          .setRotation(Math.atan2(sy - VIEW.h / 2, sx - VIEW.w / 2))
          .setAlpha(Math.floor(this.time.now / (t.hot ? 180 : 420)) % 2 ? 1 : 0.45);
      }
    }
    this.arrow.setVisible(show);
    // the same kind of edge arrow toward whatever the tutorial is pointing at, when it is off screen
    const pt = this.registry.get('pointAt') as { x: number; y: number } | null;
    let showPt = false;
    if (pt && !show && !this.ended) {
      const sx = pt.x - view.x, sy = pt.y - view.y;
      if (sx < 0 || sy < 0 || sx > VIEW.w || sy > VIEW.h) {
        showPt = true;
        this.point.setPosition(Math.round(Phaser.Math.Clamp(sx, 12, VIEW.w - 12)), Math.round(Phaser.Math.Clamp(sy, 28, VIEW.h - 46)))
          .setRotation(Math.atan2(sy - VIEW.h / 2, sx - VIEW.w / 2)).setAlpha(0.6 + 0.4 * Math.sin(this.time.now / 220));
      }
    }
    this.point.setVisible(showPt);
  }
}
