import { EVENTS, EventId } from '../config/balance';

/** Weighted choice among the eligible events. `roll` is 0..1. Null when nothing is eligible. */
export function pickEvent(eligible: EventId[], roll: number): EventId | null {
  const total = eligible.reduce((a, id) => a + EVENTS.defs[id].weight, 0);
  if (total <= 0) return null;
  let r = roll * total;
  for (const id of eligible) { r -= EVENTS.defs[id].weight; if (r <= 0) return id; }
  return eligible[eligible.length - 1];
}

/** One event at a time, with a quiet gap between them. */
export class EventClock {
  active: EventId | null = null;
  remaining = 0;
  private nextAt = EVENTS.firstAt;

  /** Returns 'start' with the chosen id, 'end' with the id that finished, or null. */
  tick(dt: number, elapsed: number, eligible: EventId[], rand: () => number = Math.random): { type: 'start' | 'end'; id: EventId } | null {
    if (this.active) {
      this.remaining -= dt;
      if (this.remaining > 0) return null;
      return this.stop(elapsed, rand);
    }
    if (elapsed < this.nextAt) return null;
    const id = pickEvent(eligible, rand());
    if (!id) { this.nextAt = elapsed + 5; return null; } // nothing fair to run right now: look again shortly
    this.active = id; this.remaining = EVENTS.defs[id].duration;
    return { type: 'start', id };
  }
  /** End the running event early (for example the golden fish was caught). */
  stop(elapsed: number, rand: () => number = Math.random): { type: 'end'; id: EventId } | null {
    if (!this.active) return null;
    const id = this.active;
    this.active = null; this.remaining = 0;
    this.nextAt = elapsed + EVENTS.gapMin + rand() * (EVENTS.gapMax - EVENTS.gapMin);
    return { type: 'end', id };
  }
}
