import { describe, it, expect } from 'vitest';
import { Tutorials } from '../src/systems/Tutorial';

describe('Tutorials', () => {
  it('shows one at a time, most urgent first, and resumes the interrupted one', () => {
    const t = new Tutorials([], true);
    t.request('first_fishing'); t.tick();
    expect(t.active).toBe('first_fishing');
    t.request('first_shop'); t.tick();
    expect(t.active).toBe('first_fishing'); // lower priority waits
    t.request('first_crocodile'); t.tick();
    expect(t.active).toBe('first_crocodile'); // danger interrupts
    t.finish('first_crocodile'); t.tick();
    expect(t.active).toBe('first_fishing');
    t.finish('first_fishing'); t.tick();
    expect(t.active).toBe('first_shop');
  });
  it('only completes tutorials that were asked for, and persists completions', () => {
    let saved: string[] = [];
    const t = new Tutorials([], true, (d) => (saved = d));
    expect(t.finish('first_deposit')).toBe(false);
    t.request('first_deposit'); t.tick();
    expect(t.finish('first_deposit')).toBe(true);
    expect(saved).toContain('first_deposit');
    expect(t.request('first_deposit')).toBe(false); // once per player
  });
  it('a dropped tutorial can come back; a skipped one cannot', () => {
    const t = new Tutorials([], true);
    t.request('first_crocodile'); t.tick(); t.drop('first_crocodile');
    expect(t.request('first_crocodile')).toBe(true);
    t.tick(); expect(t.skip()).toBe('first_crocodile');
    expect(t.request('first_crocodile')).toBe(false);
  });
  it('a resting tutorial is off screen but still completes', () => {
    const t = new Tutorials([], true);
    t.request('first_fishing'); t.tick(); t.rest('first_fishing');
    expect(t.active).toBe(null);
    expect(t.finish('first_fishing')).toBe(true);
  });
  it('does nothing when switched off, and switching off clears the screen', () => {
    const t = new Tutorials([], false);
    expect(t.request('first_fishing')).toBe(false);
    const u = new Tutorials([], true);
    u.request('first_fishing'); u.tick();
    u.sync([], false);
    expect(u.active).toBe(null);
  });
  it('reset brings everything back', () => {
    const t = new Tutorials(['first_fishing'], true);
    expect(t.request('first_fishing')).toBe(false);
    t.sync([], true);
    expect(t.request('first_fishing')).toBe(true);
  });
});
