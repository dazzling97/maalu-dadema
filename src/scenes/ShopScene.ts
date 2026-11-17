import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { GEAR, GEAR_ORDER, GearId, RUN, CUR, COIN_PER_FISH } from '../config/balance';
import { GearState, sellFish, buyGear, equipGear } from '../systems/Gear';
import { Economy } from '../systems/Economy';
import { audio } from '../systems/Audio';
import { UiScene } from './UiScene';

export interface ShopApi { eco: Economy; gear: GearState; }

/** The fishing-gear stall: sell fish from the bag for Fish Coins, buy and equip nets. The world is paused behind it. */
export class ShopScene extends UiScene {
  private api!: ShopApi;
  private confirm = 0; // fish count awaiting a "sell?" confirmation
  private note = '';
  private noteGood = true;
  constructor() { super('shop'); }

  create(api: ShopApi) {
    this.api = api;
    this.confirm = 0; this.note = '';
    this.initUi();
    this.build();
    // ignore the E press that opened the shop
    this.time.delayedCall(200, () => this.input.keyboard!.on('keydown', this.onKey, this));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { this.input.keyboard!.off('keydown', this.onKey, this); this.clearUi(); });
  }
  private close() { this.scene.resume('world'); this.scene.stop(); }
  private onKey(e: KeyboardEvent) {
    const k = e.key;
    if (k === 'Escape' || k === 'e' || k === 'E') { if (this.confirm) { this.confirm = 0; this.build(); } else this.close(); }
    else if (k === 'ArrowUp' || k === 'w' || k === 'W') this.focus(this.sel - 1);
    else if (k === 'ArrowDown' || k === 's' || k === 'S') this.focus(this.sel + 1);
    else if (k === 'ArrowLeft' || k === 'ArrowRight') this.focus(this.sel + (k === 'ArrowLeft' ? -1 : 1));
    else if (k === 'Enter' || k === ' ') this.press(this.btns[this.sel]);
  }
  private say(text: string, good: boolean, focus: number) { this.note = text; this.noteGood = good; this.build(focus); }

  private build(focus = 0) {
    this.clearUi();
    this.dim(0.55);
    const { eco, gear } = this.api;
    const cx = VIEW.w / 2, w = 268, x = cx - w / 2, y = 30;
    if (this.confirm) return this.buildConfirm();
    this.panel(x, y, w, 212);
    this.text(x + 14, y + 10, 'FISHING GEAR', '#ffe9a8', 2);
    // wallet and bag, top right
    this.root.add(this.add.image(x + w - 78, y + 11, 'coin').setOrigin(0, 0));
    this.sans(x + w - 68, y + 9, `${gear.coins} Fish Coins`, 8, '#ffe36a', true);
    this.sans(x + w - 14, y + 20, `Bag ${eco.stored} / ${RUN.target}`, 7, '#c9d4b8').setOrigin(1, 0);

    let ry = y + 34;
    GEAR_ORDER.forEach((id: GearId, i) => {
      const d = GEAR[id], owned = gear.owned.includes(id), equipped = gear.equipped === id, locked = CUR.index < d.stage;
      this.button(cx, ry, w - 24, '', () => {
        if (equipped) return this.say(`${d.name} is already in your hands.`, true, i);
        if (owned) { equipGear(gear, id); audio.play('equip'); return this.say(`${d.name} equipped.`, true, i); }
        const r = buyGear(gear, id, CUR.index);
        if (r === 'ok') { audio.play('buy'); return this.say(`Bought the ${d.name}! It is equipped.`, true, i); }
        audio.play('deny');
        this.cameras.main.shake(90, 0.0025);
        this.say(r === 'locked' ? `The ${d.name} unlocks in Stage ${d.stage + 1}.` : 'Not enough Fish Coins. Sell some fish to earn more.', false, i);
      }, { h: 30 });
      const icon = this.add.image(x + 26, ry + 15, 'gear', d.frame).setScale(1).setAlpha(locked ? 0.4 : 1);
      this.root.add(icon);
      this.sans(x + 42, ry + 4, d.name, 8.5, locked ? '#8f879c' : '#f6e7c1', true);
      this.sans(x + 42, ry + 16, d.desc, 6.5, locked ? '#8f879c' : '#c9d4b8');
      const [status, col] = equipped ? ['Equipped', '#9ff08a'] : owned ? ['Owned', '#e0c38a'] : locked ? [`Stage ${d.stage + 1}`, '#8f879c']
        : [`${d.cost} coins`, gear.coins >= d.cost ? '#ffe36a' : '#ff9a8a'];
      this.sans(x + w - 22, ry + 9, status, 8, col, true).setOrigin(1, 0);
      ry += 34;
    });

    // selling
    this.sans(x + 14, ry + 2, `Sell fish from the bag: 1 fish = ${COIN_PER_FISH} coin. Sold fish no longer count toward the target.`, 6.5, '#e0c38a');
    ry += 14;
    const sell = (n: number, bx: number, idx: number) => this.button(bx, ry, 118, `Sell ${n} fish`, () => {
      if (eco.stored < n) { audio.play('deny'); return this.say(eco.stored ? `Only ${eco.stored} fish in the bag.` : 'The bag is empty. Store some fish first.', false, idx); }
      this.confirm = n; this.build();
    });
    sell(1, cx - 63, 3); sell(5, cx + 63, 4);
    ry += 22;
    this.sans(cx, ry, this.note || 'Q switches equipment while you fish.', 7, this.note ? (this.noteGood ? '#9ff08a' : '#ff9a8a') : '#c9d4b8', false, true);
    this.button(cx, ry + 13, 96, 'Close', () => this.close(), { style: 'primary', h: 18 });
    this.focus(focus);
  }

  /** Selling always asks first, and spells out what it does to the stage target. */
  private buildConfirm() {
    const { eco, gear } = this.api, n = this.confirm, cx = VIEW.w / 2, w = 232, x = cx - w / 2, y = 78;
    const after = eco.stored - n, big = n >= Math.max(3, eco.stored / 2);
    this.panel(x, y, w, 112, true);
    this.sans(cx, y + 12, `Sell ${n} fish for ${n * COIN_PER_FISH} coin${n > 1 ? 's' : ''}?`, 11, '#ffe9a8', true, true);
    this.sans(cx, y + 34, `Bag:  ${eco.stored}  →  ${after}  of  ${RUN.target}`, 9, '#f6e7c1', true, true);
    this.sans(cx, y + 50, big ? 'That is a big bite out of your progress this stage.' : 'You will need to catch these again to finish the stage.', 7, big ? '#ff9a8a' : '#c9d4b8', false, true);
    this.button(cx - 54, y + 74, 96, 'Sell', () => {
      const sold = sellFish(gear, eco, n); // one call: fish leave the bag and become coins exactly once
      this.confirm = 0;
      for (let i = 0; i < sold; i++) this.time.delayedCall(i * 60, () => audio.play('sell', 1 + i * 0.06));
      this.say(`Sold ${sold} fish. You have ${gear.coins} Fish Coins.`, true, n === 1 ? 3 : 4);
    }, { style: 'primary', h: 20 });
    this.button(cx + 54, y + 76, 96, 'Cancel', () => { this.confirm = 0; this.build(this.confirm === 1 ? 3 : 4); });
  }
}
