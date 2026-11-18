import Phaser from 'phaser';
import { VIEW } from '../config/game';
import { GEAR, GEAR_ORDER, GearId, RUN, CUR, COIN_PER_FISH } from '../config/balance';
import { GearState, sellFish, buyGear, equipGear, shopHint } from '../systems/Gear';
import { Economy } from '../systems/Economy';
import { audio } from '../systems/Audio';
import { UiScene } from './UiScene';
import { touchMode } from '../systems/Touch';
import { HD } from '../art/hd';

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

  private build(focus = -1) {
    this.clearUi();
    this.dim(0.55);
    const { eco, gear } = this.api;
    if (this.confirm) return this.buildConfirm();
    const cx = VIEW.w / 2, w = 280, x = cx - w / 2, y = 12;
    const hint = shopHint(gear, eco, CUR.index);
    this.panel(x, y, w, 238);
    this.text(x + 14, y + 10, 'FISHING GEAR', '#ffe9a8', 2);

    // what you have: bag, hands, wallet
    const stat = (sx: number, label: string, value: string, col: string) => {
      this.sans(sx, y + 28, label, 6.5, '#e0c38a', false, true);
      this.sans(sx, y + 37, value, 10, col, true, true);
    };
    stat(cx - 88, 'Fish in Bag', `${eco.stored} / ${RUN.target}`, '#f6e7c1');
    stat(cx, 'Carrying', `${eco.carried}`, eco.carried ? '#ffe9a8' : '#c9d4b8');
    stat(cx + 88, 'Fish Coins', `${gear.coins}`, '#ffe36a');
    this.root.add(this.add.image(cx + 88 - 6 - `${gear.coins}`.length * 3, y + 39, 'coin').setOrigin(1, 0).setScale(HD));

    // what to do next
    const tone = hint.kind === 'sell' || hint.kind === 'buy' ? '#9ff08a' : hint.kind === 'deposit' ? '#ffe9a8' : '#ffc48a';
    if (hint.text) this.sans(cx, y + 55, hint.text, 7.5, tone, true, true);

    // equipment rows: price on the right, faded when it cannot be bought yet
    let ry = y + 68;
    GEAR_ORDER.forEach((id: GearId, i) => {
      const d = GEAR[id], owned = gear.owned.includes(id), equipped = gear.equipped === id, locked = CUR.index < d.stage;
      const poor = !owned && !locked && gear.coins < d.cost;
      this.button(cx, ry, w - 24, '', () => {
        if (equipped) return this.say(`${d.name} is already in your hands.`, true, i);
        if (owned) { equipGear(gear, id); audio.play('equip'); return this.say(`${d.name} equipped.`, true, i); }
        const r = buyGear(gear, id, CUR.index);
        if (r === 'ok') { audio.play('buy'); return this.say('Equipment upgraded! You can now catch more fish at once!', true, i); }
        audio.play('deny');
        this.cameras.main.shake(90, 0.0025);
        this.say(r === 'locked' ? `The ${d.name} unlocks in Stage ${d.stage + 1}.` : this.poorReason(d.cost), false, i);
      }, { h: 28, disabled: locked || poor });
      const icon = this.add.image(x + 26, ry + 14, 'gear', d.frame).setScale(HD).setAlpha(locked ? 0.4 : 1);
      this.root.add(icon);
      this.sans(x + 42, ry + 3, d.name, 8.5, locked ? '#8f879c' : '#f6e7c1', true);
      this.sans(x + 42, ry + 15, d.desc, 6.5, locked ? '#8f879c' : '#c9d4b8');
      const [status, col] = equipped ? ['Equipped', '#9ff08a'] : owned ? ['Owned · Equip', '#e0c38a'] : locked ? [`Unlocks Stage ${d.stage + 1}`, '#8f879c']
        : [`Buy · ${d.cost} coins`, poor ? '#ff9a8a' : '#ffe36a'];
      this.sans(x + w - 22, ry + 5, status, 8, col, true).setOrigin(1, 0);
      if (poor) this.sans(x + w - 22, ry + 16, `Need ${d.cost - gear.coins} more`, 6.5, '#ff9a8a').setOrigin(1, 0);
      ry += 31;
    });

    // selling: only fish already stored in the bag
    this.sans(cx, ry + 1, `Sell fish from the bag: 1 fish = ${COIN_PER_FISH} Fish Coin. Sold fish stop counting toward the target.`, 6.5, '#e0c38a', false, true);
    ry += 13;
    const sell = (n: number, bx: number, idx: number) => this.button(bx, ry, 118, `Sell ${n} fish`, () => {
      if (eco.stored < n) { audio.play('deny'); return this.say(this.sellReason(n), false, idx); }
      this.confirm = n; this.build();
    }, { disabled: eco.stored < n });
    sell(1, cx - 63, 3); sell(5, cx + 63, 4);
    ry += 21;
    this.sans(cx, ry, this.note || (touchMode() ? 'GEAR switches equipment while you fish.' : 'Q switches equipment while you fish.'), 7, this.note ? (this.noteGood ? '#9ff08a' : '#ff9a8a') : '#c9d4b8', false, true);
    this.button(cx, ry + 12, 96, 'Close', () => this.close(), { style: 'primary', h: 18 });
    // start on the step the player should take next
    const next = hint.next ? GEAR_ORDER.indexOf(hint.next) : -1;
    this.focus(focus >= 0 ? focus : hint.kind === 'buy' ? next : hint.kind === 'sell' ? (eco.stored >= 5 && hint.need >= 5 ? 4 : 3) : 5);
  }
  private sellReason(n: number) {
    const { eco } = this.api;
    if (eco.stored === 0) return eco.carried ? 'Deposit your fish in the bag before selling!' : 'Your bag is empty. Catch fish and store them first.';
    return `Only ${eco.stored} fish in the bag.`;
  }
  private poorReason(cost: number) {
    const { eco, gear } = this.api, short = cost - gear.coins;
    if (eco.stored >= short) return `Need ${short} more Fish Coins. Sell ${short} stored fish first.`;
    return eco.carried ? 'Not enough Fish Coins. Deposit your fish in the bag, then sell them.' : 'Not enough Fish Coins. Catch fish, store them, then sell them.';
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
      this.say(`Sold ${sold} fish. You have ${gear.coins} Fish Coins.`, true, -1); // focus moves to the next step
    }, { style: 'primary', h: 20 });
    this.button(cx + 54, y + 76, 96, 'Cancel', () => { this.confirm = 0; this.build(n === 1 ? 3 : 4); });
  }
}
