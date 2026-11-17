import { ZONES, ZoneId, DEPLETION, CUR } from '../config/balance';

const IDS: ZoneId[] = ['A', 'B', 'C'];

/** Fish population per zone: fishing drains it, leaving lets it recover. */
export class ZoneState {
  /** Later stages stock the water more heavily so their bigger targets stay reachable. */
  max(z: ZoneId) { return ZONES[z].popMax * CUR.fishStock; }
  pop: Record<ZoneId, number> = { A: this.max('A'), B: this.max('B'), C: this.max('C') };

  ratio(z: ZoneId) { return this.pop[z] / this.max(z); }
  available(z: ZoneId) { return this.pop[z] >= 1; }
  thin(z: ZoneId) { return this.ratio(z) < DEPLETION.thinRatio; }
  /** Bites slow down as the spot empties. */
  waitMul(z: ZoneId) { return 1 + (1 - this.ratio(z)) * DEPLETION.waitPenalty; }
  take(z: ZoneId) { this.pop[z] = Math.max(0, this.pop[z] - 1); }

  /** `fishingIn` is the zone holding the player's line, if any: that zone does not recover. */
  update(dt: number, fishingIn: ZoneId | null) {
    for (const z of IDS) if (z !== fishingIn) this.pop[z] = Math.min(this.max(z), this.pop[z] + ZONES[z].regen * CUR.fishStock * dt);
    // never leave the player with nowhere to fish
    if (!IDS.some((z) => this.available(z))) {
      const best = IDS.filter((z) => z !== fishingIn).sort((a, b) => this.pop[b] - this.pop[a])[0] ?? 'A';
      this.pop[best] = Math.max(this.pop[best], 2);
    }
  }
}
