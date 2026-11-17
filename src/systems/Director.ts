import { BANDS, Band, BAG_RAID, BAND_SPAN, CUR, RUN, ZONES, ZoneId } from '../config/balance';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The difficulty band for this moment of the five-minute run. */
export function bandAt(elapsed: number): Band {
  const t = elapsed * (BAND_SPAN / RUN.duration); // a longer stage stretches the same four bands
  for (const b of BANDS) if (t < b.until) return b;
  return BANDS[BANDS.length - 1];
}

/** Seconds between crocodile arrivals: the band sets the pace, riskier water shortens it. */
export function crocInterval(band: Band, zone: ZoneId | null): number {
  return band.crocInterval * CUR.crocIntervalMul * (1 - (zone ? ZONES[zone].danger : 0));
}

export interface UrgeInput { stored: number; playerDist: number; fishing: boolean; sinceLastRaid: number; elapsed: number; }
/** Chance (per check) that Sabapathi sets out for the bag. Zero when it would be pointless or too soon. */
export function theftUrge(i: UrgeInput): number {
  const band = bandAt(i.elapsed);
  if (i.elapsed < BAG_RAID.firstAt || i.sinceLastRaid < band.thiefCooldown * CUR.thiefCooldownMul || i.stored < BAG_RAID.minStored) return 0;
  return clamp01(
    BAG_RAID.urgeBase
    + (i.playerDist > BAG_RAID.awayDist ? BAG_RAID.urgeAway : 0)
    + (i.fishing ? BAG_RAID.urgeFishing : 0)
    + BAG_RAID.urgeFull * clamp01(i.stored / RUN.target),
  );
}
/** How many fish he grabs from a bag holding `stored`. Small, and never more than there are. */
export function grabSize(stored: number): number {
  return Math.max(0, Math.min(stored, BAG_RAID.maxTake, 1 + Math.floor(stored * BAG_RAID.takeFrac)));
}

/** Turns the band's pace into crocodile arrivals, with a breather after each encounter. */
export class SpawnClock {
  private progress = 0;
  private grace = 0;
  constructor(private firstSpawn: number, private graceTime: number) {}
  /** Call when an encounter ends (crocodile stunned, bit you, or left). */
  breather() { this.grace = this.graceTime; }
  /** Returns true when a crocodile should arrive now. */
  tick(dt: number, elapsed: number, interval: number, max: number, active: number): boolean {
    this.grace -= dt;
    if (elapsed < this.firstSpawn) return false;
    this.progress += dt / interval;
    if (this.progress < 1) return false;
    if (active >= max || this.grace > 0) { this.progress = 1; return false; }
    this.progress = 0;
    return true;
  }
}
