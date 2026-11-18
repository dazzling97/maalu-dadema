import Phaser from 'phaser';
import { DEPTH } from '../config/game';
import { CUR, GEAR } from '../config/balance';
import { BAG_POS, DOCKS, GEAR_POS } from '../world/layout';
import { Tutorials, TutId } from '../systems/Tutorial';
import { load, save } from '../systems/Storage';
import { Economy } from '../systems/Economy';
import { GearState } from '../systems/Gear';
import { Player } from './Player';
import { Stones } from './Stones';
import { Crocs, Crocodile } from './Crocodile';
import { Thief } from './Thief';
import { HD } from '../art/hd';
import { Loot } from './Loot';

/** What the HUD shows for a tutorial: one line, an optional second, a small icon. */
export interface CoachCard { id: TutId; title: string; sub?: string; icon?: string; frame?: number; hud?: 'rocks' | 'fish' | 'carry'; }
export interface TutorCtx {
  scene: Phaser.Scene; player: Player; eco: Economy; stones: Stones; crocs: Crocs; thief: Thief; loot: Loot;
  gear: () => GearState; stallOpen: boolean; nearStall: () => boolean; deposits: () => number;
}
type Spot = { x: number; y: number; r: number; trail?: boolean };

/** How long a card may stay up before it steps aside (it still completes when the action happens). */
const TTL: Record<TutId, number> = { first_fishing: 40, first_deposit: 40, first_crocodile: 14, first_rock_pickup: 30, first_sabapathi_entrance: 3.6, first_sabapathi_theft: 60, first_shop: 7 };

/**
 * First-time tutorials in the world: watches the game for the moment each one
 * becomes relevant, draws the highlight on the thing it is about, and tells
 * the HUD which card to show. It never pauses the game or takes input away;
 * X dismisses the card on screen.
 */
export class Tutor {
  readonly tut: Tutorials;
  private g: Phaser.GameObjects.Graphics;
  private arrow: Phaser.GameObjects.Image;
  private ttl = 0;
  private shown: TutId | null = null;
  private seen = { caught: false, stored: false, rocks: false, shopNear: false, shopAfford: false, hitPraise: false };
  private croc: Crocodile | null = null;
  private crocEase = 0;
  private recovering = false;
  private pickedBase = 0;
  private stolen = 0;
  private shopCard: 'open' | 'near' | 'afford' = 'open';
  private threwAt = -99;
  private now = 0;
  private keyX: Phaser.Input.Keyboard.Key;

  constructor(private c: TutorCtx) {
    const s = load();
    this.tut = new Tutorials(s.tutorials, s.hints, (done) => save({ tutorials: done }));
    this.g = c.scene.add.graphics().setDepth(DEPTH.air + 5);
    this.arrow = c.scene.add.image(0, 0, 'arrow').setScale(HD).setDepth(DEPTH.air + 5).setRotation(Math.PI / 2).setVisible(false);
    this.keyX = c.scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X);
    this.emit(null);
  }
  /** Called once the stage intro card has cleared. */
  begin() {
    if (CUR.index === 0) this.tut.request('first_fishing');
    if (this.c.stallOpen && !this.tut.isDone('first_shop')) { this.shopCard = 'open'; this.tut.request('first_shop'); }
  }
  /** True if the shop tutorial is about to introduce the stall (so the sign can sparkle). */
  get introducingShop() { return this.c.stallOpen && this.tut.enabled && !this.tut.isDone('first_shop'); }
  /** After the pause menu or the shop closes: settings may have changed. */
  sync() { const s = load(); this.tut.sync(s.tutorials, s.hints); if (!s.hints) { this.release(); this.show(); } }
  stop() { this.tut.sync(load().tutorials, false); this.release(); this.show(); }

  // ---- things the world tells us
  onThrow(ok: boolean) {
    if (!ok) return;
    this.threwAt = this.now;
    if (this.tut.finish('first_crocodile')) this.release();
    if (this.tut.active === 'first_sabapathi_theft' && !this.recovering) this.tut.rest('first_sabapathi_theft'); // they know what to do; stop telling them
  }
  /** A rock landed. Praise the first hit that follows the crocodile lesson. */
  onBonk(target: unknown): string | null {
    if (target instanceof Crocodile && !this.seen.hitPraise && this.tut.isDone('first_crocodile') && this.now - this.threwAt < 3 && this.tut.enabled) {
      this.seen.hitPraise = true;
      return 'Direct hit! The crocodile backs off.';
    }
    return null;
  }
  /** Sabapathi has left his shop. True if the tutorial will announce it (so the plain warning can stay quiet). */
  onProwl(): boolean { return this.tut.request('first_sabapathi_entrance'); }
  onHeist(h: { n: number; status: 'stolen' | 'dropped' | 'escaped' } | null): string | null {
    const id: TutId = 'first_sabapathi_theft';
    if (!h) { if (!this.recovering) this.tut.drop(id); this.c.thief.ease = 1; return null; }
    if (h.status === 'stolen') {
      this.stolen = h.n; this.recovering = false;
      if (this.tut.request(id) && !load().eased.includes(id)) { save({ eased: [...load().eased, id] }); this.c.thief.ease = 0.75; }
      return null;
    }
    this.c.thief.ease = 1;
    if (h.status === 'dropped') {
      if (this.tut.open(id)) { this.recovering = true; this.pickedBase = this.c.loot.picked; this.tut.request(id); if (this.tut.active === id) this.show(); }
      return null;
    }
    // escaped: nothing was learned yet, so it is taught again next time
    const was = this.tut.open(id);
    this.tut.drop(id); this.recovering = false;
    return was ? 'He got away. Next time, hit him with a rock before he reaches his shop.' : null;
  }

  private release() { if (this.croc) this.croc.ease = 1; this.crocEase = 0; }

  private card(id: TutId): CoachCard {
    switch (id) {
      case 'first_fishing': return { id, title: "Let's catch some fish! Head to the water and cast your line.", sub: 'Move: WASD or arrows   ·   Aim: mouse   ·   Space to cast, Space again on the !', icon: 'catch' };
      case 'first_deposit': return { id, title: 'Great catch! Take your fish to the bag to store them.', sub: 'Press E at the bag. Only stored fish count toward the stage target.', icon: 'key-e', hud: 'fish' };
      case 'first_crocodile': return { id, title: 'Watch out! Crocodile! Aim and click to throw a rock!', icon: 'warn', hud: 'rocks' };
      case 'first_rock_pickup': return { id, title: 'Out of rocks? Walk over stones on the ground to collect more!', icon: 'stones', hud: 'rocks' };
      case 'first_sabapathi_entrance': return { id, title: 'Sabapathi is here! Keep an eye on your fish bag!', icon: 'warn' };
      case 'first_sabapathi_theft': return this.recovering
        ? { id, title: 'He dropped them! Walk over the fish to pick them up.', icon: 'catch', hud: 'carry' }
        : { id, title: 'Sabapathi stole your fish! Chase him and throw a rock to get them back!', sub: `He is running to his shop with ${this.stolen} of your fish.`, icon: 'warn', hud: 'rocks' };
      case 'first_shop': return this.shopCard === 'near' ? { id, title: 'Press E to open the shop.', icon: 'key-e' }
        : this.shopCard === 'afford' ? { id, title: `Sell ${GEAR.net.cost} fish to buy a Fishing Net and catch up to ${GEAR.net.catch} fish at once!`, icon: 'gear', frame: GEAR.net.frame }
        : { id, title: 'New shop unlocked! Sell fish and buy better fishing equipment.', icon: 'gear', frame: GEAR.net.frame };
    }
  }
  private emit(card: CoachCard | null) { this.c.scene.game.events.emit('coach', card); }
  private show() {
    const id = this.tut.active;
    this.shown = id;
    this.ttl = id ? TTL[id] : 0;
    this.emit(id ? this.card(id) : null);
    if (id === 'first_crocodile' && this.croc && !load().eased.includes(id)) { // the first one ever is slower and warns for longer
      save({ eased: [...load().eased, id] });
      this.croc.ease = 0.5; this.crocEase = 10;
    }
    if (id === 'first_rock_pickup') this.c.stones.ensureNear(this.c.player.x, this.c.player.y, 150);
  }
  /** Where the highlight goes for the card on screen. */
  private spot(): Spot | null {
    const { player: p, thief, stones, loot } = this.c;
    switch (this.shown) {
      case 'first_fishing': return { x: DOCKS[0].x + DOCKS[0].w / 2, y: DOCKS[0].y - 14, r: 30 };
      case 'first_deposit': return { x: BAG_POS.x, y: BAG_POS.y - 8, r: 17 };
      case 'first_crocodile': return this.croc ? { x: this.croc.x, y: this.croc.y - 3, r: 20, trail: true } : null;
      case 'first_rock_pickup': { const r = stones.nearest(p.x, p.y); return r ? { x: r.x, y: r.y - 4, r: 11, trail: true } : null; }
      case 'first_sabapathi_entrance': return { x: thief.x, y: thief.y - 12, r: 17 };
      case 'first_sabapathi_theft': { const d = this.recovering ? loot.positions[0] : null; return d ? { x: d.x, y: d.y - 2, r: 14 } : { x: thief.x, y: thief.y - 12, r: 17 }; }
      case 'first_shop': return { x: GEAR_POS.x, y: GEAR_POS.y - 22, r: 34 };
      default: return null;
    }
  }

  update(dt: number, time: number) {
    const { eco, stones, crocs, thief, loot, player } = this.c, t = this.tut;
    this.now += dt;

    // ---- confirmed actions and first-time moments
    if (!this.seen.caught && eco.caught >= 1) { this.seen.caught = true; t.finish('first_fishing'); if (this.c.deposits() === 0) t.request('first_deposit'); }
    if (!this.seen.stored && this.c.deposits() >= 1) { this.seen.stored = true; t.finish('first_deposit'); }

    if (this.croc && !crocs.list.includes(this.croc)) { this.croc.ease = 1; this.croc = null; this.crocEase = 0; t.drop('first_crocodile'); } // it left; teach it on the next one
    if (!this.croc && crocs.list.length && !t.isDone('first_crocodile') && t.enabled) { this.croc = crocs.list[0]; t.request('first_crocodile'); }
    if (this.crocEase > 0) { this.crocEase -= dt; if (this.crocEase <= 0 && this.croc) this.croc.ease = 1; }

    if (stones.ammo === 0 && !this.seen.rocks) { this.seen.rocks = true; t.request('first_rock_pickup'); }
    if (stones.ammo > 0 && this.seen.rocks) { this.seen.rocks = false; t.finish('first_rock_pickup'); } // only walking over a rock raises the count

    if (t.open('first_sabapathi_entrance') && t.active !== 'first_sabapathi_entrance' && !thief.incoming) t.drop('first_sabapathi_entrance');
    if (this.recovering) {
      if (loot.picked > this.pickedBase) { this.recovering = false; if (t.finish('first_sabapathi_theft')) this.c.scene.game.events.emit('coachNote', { text: 'Fish recovered!', kind: 'good' }); }
      else if (loot.count === 0) { this.recovering = false; t.drop('first_sabapathi_theft'); } // they lay there too long
    }

    if (this.c.stallOpen && !t.isDone('first_shop') && t.enabled) {
      const g = this.c.gear();
      if (g.owned.length > 1) { t.request('first_shop'); t.finish('first_shop'); }
      else {
        const near = this.c.nearStall(), afford = eco.stored + g.coins >= GEAR.net.cost;
        if (near && !this.seen.shopNear) { this.seen.shopNear = true; this.shopCard = 'near'; if (!t.request('first_shop') && t.active === 'first_shop') this.show(); }
        else if (afford && !this.seen.shopAfford && !near && t.active !== 'first_shop') { this.seen.shopAfford = true; this.shopCard = 'afford'; t.request('first_shop'); }
      }
    }

    // ---- dismissing, timing out, and promoting the next one
    if (Phaser.Input.Keyboard.JustDown(this.keyX) && t.active) { const id = t.skip(); if (id === 'first_crocodile') this.release(); if (id === 'first_sabapathi_theft') { thief.ease = 1; this.recovering = false; } }
    if (t.active && t.active === this.shown) {
      this.ttl -= dt;
      if (this.ttl <= 0) { if (t.active === 'first_sabapathi_entrance') t.finish(t.active); else t.rest(t.active); } // the warning only has to be seen
    }
    t.tick();
    if (t.active !== this.shown) this.show();

    // ---- highlight: a soft pulsing outline, a bobbing arrow, and for throws and rocks a dotted lead from the player
    const g = this.g, s = this.spot();
    g.clear();
    this.arrow.setVisible(!!s);
    this.c.scene.registry.set('pointAt', s ? { x: s.x, y: s.y } : null);
    if (!s) return;
    const pulse = 0.5 + 0.5 * Math.sin(time / 260), r = s.r + pulse * 2;
    g.lineStyle(1, 0xffe36a, 0.45 + pulse * 0.4);
    g.strokeEllipse(Math.round(s.x), Math.round(s.y), r * 2, r * 1.5);
    g.lineStyle(1, 0xfff6d8, 0.18 + pulse * 0.15);
    g.strokeEllipse(Math.round(s.x), Math.round(s.y), r * 2 + 6, r * 1.5 + 4);
    this.arrow.setPosition(Math.round(s.x), Math.round(s.y - r * 0.75 - 9 + Math.sin(time / 200) * 2));
    if (s.trail) {
      const px = player.x, py = player.y - 8, dx = s.x - px, dy = s.y - py, len = Math.hypot(dx, dy) || 1, reach = Math.min(len - s.r * 0.6, 90);
      for (let k = 0; k < 4; k++) {
        const u = (time / 900 + k / 4) % 1, d = 14 + u * Math.max(0, reach - 14);
        g.fillStyle(0xfff6d8, Math.sin(Math.PI * u) * 0.85);
        g.fillRect(Math.round(px + (dx / len) * d) - 1, Math.round(py + (dy / len) * d) - 1, 2, 2);
      }
    }
  }
  /** Stage over or cutscene: take everything off screen. */
  hide() { this.g.clear(); this.arrow.setVisible(false); this.c.scene.registry.set('pointAt', null); this.emit(null); this.shown = null; }
}
