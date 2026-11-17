import { RUN } from '../config/balance';

/**
 * Where every fish is. A fish is in exactly one place at a time: in the
 * player's hands, in the bag, on the ground, in Sabapathi's sack, or lost.
 * Only fish in the bag count toward the target.
 */
export class Economy {
  carried = 0; // in the player's hands
  stored = 0; // in the stationary bag
  stolen = 0; // lost to the shop for good
  caught = 0; // ever caught (stat only)
  stunned = 0; // crocodiles stunned (stat only)
  sold = 0; // sold from the bag for Fish Coins

  get room() { return RUN.carryMax - this.carried; }
  get won() { return this.stored >= RUN.target; }

  /** Land n fish. Returns how many fit in the player's hands. */
  catchFish(n = 1): number {
    const got = Math.max(0, Math.min(n, this.room));
    this.carried += got;
    this.caught += got;
    return got;
  }
  /** Move everything carried into the bag. Returns the number moved. */
  deposit(): number {
    const n = this.carried;
    this.stored += n;
    this.carried = 0;
    return n;
  }
  /** Bitten: everything carried falls to the ground. Returns the number dropped. */
  drop(): number {
    const n = this.carried;
    this.carried = 0;
    return n;
  }
  /** Pick one fish up off the ground, if there is room. */
  pickUp(): boolean {
    if (this.room <= 0) return false;
    this.carried++;
    return true;
  }
  /** A thief takes up to n fish from the bag. Returns the number taken. */
  steal(n: number): number {
    const got = Math.max(0, Math.min(Math.floor(n), this.stored));
    this.stored -= got;
    return got;
  }
  /** Sell up to n fish out of the bag. Returns the number sold; the bag can never go negative. */
  sell(n: number): number {
    const got = Math.max(0, Math.min(Math.floor(n), this.stored));
    this.stored -= got;
    this.sold += got;
    return got;
  }
  /** Stolen fish that reached the shop. */
  lose(n: number) { this.stolen += n; }
}
