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

/** The next piece of equipment worth saving for: the first one not owned and already unlocked in this stage. */
export function nextGear(g: GearState, stageIndex: number): GearId | null {
  return GEAR_ORDER.find((id) => !g.owned.includes(id) && stageIndex >= GEAR[id].stage) ?? null;
}
export type ShopHintKind = 'catch' | 'deposit' | 'sell' | 'buy' | 'none';
/**
 * What the shop tells the player to do next, in the order the steps happen:
 * catch fish, store them in the bag, sell stored fish for coins, buy equipment.
 * Only fish in the bag can be sold, and only as many as the purchase still needs.
 */
export function shopHint(g: GearState, eco: { stored: number; carried: number }, stageIndex: number): { kind: ShopHintKind; text: string; next: GearId | null; need: number } {
  const next = nextGear(g, stageIndex);
  if (!next) return { kind: 'none', text: '', next, need: 0 };
  const need = Math.max(0, Math.ceil((GEAR[next].cost - g.coins) / COIN_PER_FISH)); // fish still to sell
  if (need === 0) return { kind: 'buy', text: `You have enough Fish Coins. Buy the ${GEAR[next].name}!`, next, need };
  if (eco.stored >= need) return { kind: 'sell', text: 'Great! Sell your stored fish to earn coins and buy better equipment.', next, need };
  if (eco.carried > 0) return { kind: 'deposit', text: 'Deposit your fish in the bag before selling!', next, need };
  return { kind: 'catch', text: 'Catch some fish and store them in your bag first!', next, need };
}
