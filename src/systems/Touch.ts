// Touch input for phones and tablets. The on-screen controls (TouchScene) write
// into `touch`; Input reads it alongside the keyboard, so every game system keeps
// asking the same questions ("moving which way?", "action pressed?") and the
// desktop controls are untouched.
import { load } from './Storage';

export type TouchPref = 'auto' | 'on' | 'off';
export type TouchKey = 'fish' | 'use' | 'gear' | 'dash';

/** A phone or tablet: the main pointer is a finger and nothing can hover. */
export function touchCapable(): boolean {
  try {
    const mq = (q: string) => window.matchMedia(q).matches;
    return mq('(pointer: coarse)') || (navigator.maxTouchPoints > 0 && !mq('(hover: hover)'));
  } catch { return false; }
}

/** Whether the on-screen controls are in use. `?touch=1` / `?touch=0` in the address overrides the setting. */
export function touchMode(): boolean {
  const q = new URLSearchParams(window.location.search).get('touch');
  if (q === '1') return true;
  if (q === '0') return false;
  const pref = load().touch;
  return pref === 'on' ? true : pref === 'off' ? false : touchCapable();
}

/** A button press counts only if a game frame picks it up promptly, so nothing fires late after a pause. */
const FRESH_MS = 160;

class TouchState {
  /** Joystick direction (unit vector, or 0 / 0 at rest). */
  mx = 0;
  my = 0;
  /** ROCK was tapped: the next tap on a crocodile or Sabapathi throws. */
  aiming = false;
  /** Pointer ids currently held by an on-screen control, so the world ignores them. */
  readonly claimed = new Set<number>();
  private at: Partial<Record<TouchKey, number>> = {};

  press(k: TouchKey) { this.at[k] = performance.now(); }
  /** True once per press. */
  take(k: TouchKey): boolean {
    const t = this.at[k];
    this.at[k] = 0;
    return !!t && performance.now() - t < FRESH_MS;
  }
  /** Let go of everything: lifted fingers, a pause, a lost tab, a rotation. Nothing can stay stuck. */
  reset() { this.mx = 0; this.my = 0; this.aiming = false; this.at = {}; this.claimed.clear(); }
}
export const touch = new TouchState();
