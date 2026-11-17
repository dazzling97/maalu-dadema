// First-time tutorials: which one is on screen, which are waiting, which are done.
// Pure logic (no Phaser), so the rules can be unit-tested.

export const TUT_IDS = ['first_fishing', 'first_deposit', 'first_crocodile', 'first_rock_pickup', 'first_sabapathi_entrance', 'first_sabapathi_theft', 'first_shop'] as const;
export type TutId = (typeof TUT_IDS)[number];

/** 1 is most urgent. Danger first, then theft, then the fishing basics, rocks, and the optional shop last. */
export const TUT_PRIORITY: Record<TutId, number> = {
  first_crocodile: 1,
  first_sabapathi_theft: 2,
  first_sabapathi_entrance: 2,
  first_fishing: 3,
  first_deposit: 3,
  first_rock_pickup: 4,
  first_shop: 5,
};

/**
 * One tutorial is active at a time. The rest wait in a queue and are promoted by
 * priority; a more urgent one interrupts a less urgent one, which goes back to
 * waiting. A tutorial is only ever marked done by `finish` (the game confirmed
 * the action) or `skip` (the player dismissed it).
 */
export class Tutorials {
  active: TutId | null = null;
  private waiting: TutId[] = [];
  private resting = new Set<TutId>(); // hidden after a while, but still completes when the action happens
  private done: Set<string>;

  constructor(done: string[], public enabled: boolean, private persist: (done: string[]) => void = () => undefined) {
    this.done = new Set(done);
  }

  isDone(id: TutId) { return this.done.has(id); }
  /** Asked for and not finished: on screen, waiting, or resting. */
  open(id: TutId) { return this.active === id || this.waiting.includes(id) || this.resting.has(id); }
  get pending(): readonly TutId[] { return this.waiting; }

  /** Ask for a tutorial to be shown. False if it is done, switched off, or already on its way. */
  request(id: TutId): boolean {
    if (!this.enabled || this.done.has(id) || this.active === id || this.waiting.includes(id)) return false;
    this.resting.delete(id);
    this.waiting.push(id);
    return true;
  }
  /** The game confirmed the action. Only counts for a tutorial that was actually asked for. */
  finish(id: TutId): boolean {
    if (!this.open(id)) return false;
    this.remove(id);
    this.done.add(id);
    this.persist([...this.done]);
    return true;
  }
  /** The moment passed without the action (the crocodile left, Sabapathi got away): teach it next time. */
  drop(id: TutId) { this.remove(id); }
  /** Take it off screen but keep listening for the action. */
  rest(id: TutId) { if (this.open(id)) { this.remove(id); this.resting.add(id); } }
  /** The player dismissed the one on screen: never show it again. */
  skip(): TutId | null {
    const id = this.active;
    if (!id) return null;
    this.remove(id);
    this.done.add(id);
    this.persist([...this.done]);
    return id;
  }
  /** Settings changed (switched off, or reset) while the game was paused. */
  sync(done: string[], enabled: boolean) {
    this.done = new Set(done);
    this.enabled = enabled;
    if (!enabled) { this.active = null; this.waiting = []; this.resting.clear(); }
  }
  /** Promote the most urgent waiting tutorial. Returns true if what is on screen changed. */
  tick(): boolean {
    if (!this.waiting.length) return false;
    let best = 0;
    for (let i = 1; i < this.waiting.length; i++) if (TUT_PRIORITY[this.waiting[i]] < TUT_PRIORITY[this.waiting[best]]) best = i;
    const next = this.waiting[best];
    if (this.active && TUT_PRIORITY[next] >= TUT_PRIORITY[this.active]) return false;
    this.waiting.splice(best, 1);
    if (this.active) this.waiting.push(this.active); // interrupted: it comes back afterwards
    this.active = next;
    return true;
  }
  private remove(id: TutId) {
    if (this.active === id) this.active = null;
    this.waiting = this.waiting.filter((w) => w !== id);
    this.resting.delete(id);
  }
}
