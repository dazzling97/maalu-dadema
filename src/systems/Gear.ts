import { GEAR, GEAR_ORDER, GearId, COIN_PER_FISH } from '../config/balance';
import { Economy } from './Economy';

/** What the player owns across stages: Fish Coins and fishing equipment. */
export interface GearState { coins: number; owned: GearId[]; equipped: GearId; }
export const freshGear = (): GearState => ({ coins: 0, owned: ['rod'], equipped: 'rod' });
export const copyGear = (g: GearState): GearState => ({ coins: g.coins, owned: [...g.owned], equipped: g.equipped });

/** Sell up to n fish out of the bag. Each fish becomes coins exactly once. Returns the number sold. */
export function sellFish(g: GearState, eco: Economy, n: number): number {
  const sold = eco.sell(n);
  g.coins += sold * COIN_PER_FISH;
  return sold;
}
export type BuyResult = 'ok' | 'locked' | 'owned' | 'poor';
/** Buy a piece of equipment if it is unlocked in this stage, not yet owned, and affordable. Buying equips it. */
export function buyGear(g: GearState, id: GearId, stageIndex: number): BuyResult {
  const d = GEAR[id];
  if (g.owned.includes(id)) return 'owned';
  if (stageIndex < d.stage) return 'locked';
  if (g.coins < d.cost) return 'poor';
  g.coins -= d.cost;
  g.owned.push(id);
  g.equipped = id;
  return 'ok';
}
export function equipGear(g: GearState, id: GearId): boolean {
  if (!g.owned.includes(id)) return false;
  g.equipped = id;
  return true;
}
/** Switch to the next owned piece of equipment. Returns the newly equipped id. */
export function cycleGear(g: GearState): GearId {
  const owned = GEAR_ORDER.filter((id) => g.owned.includes(id));
  g.equipped = owned[(owned.indexOf(g.equipped) + 1) % owned.length];
  return g.equipped;
}
/** Fish one successful catch lands: limited by the equipment, free hands, and fish left in the spot. */
export function catchSize(gearCatch: number, room: number, fishInZone: number): number {
  return Math.max(0, Math.min(gearCatch, room, Math.max(1, Math.floor(fishInZone))));
}
