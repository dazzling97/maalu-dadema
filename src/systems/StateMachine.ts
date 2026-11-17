// Minimal finite-state machine shared by the player and every NPC.
export interface State<C> {
  enter?(ctx: C): void;
  update?(ctx: C, dt: number): void;
  exit?(ctx: C): void;
}

export class StateMachine<C, K extends string = string> {
  current!: K;
  time = 0; // seconds spent in the current state
  constructor(private ctx: C, private states: Record<K, State<C>>, initial: K) {
    this.current = initial;
    this.states[initial].enter?.(ctx);
  }
  is(k: K) { return this.current === k; }
  go(k: K) {
    if (k === this.current) return;
    this.states[this.current].exit?.(this.ctx);
    this.current = k;
    this.time = 0;
    this.states[k].enter?.(this.ctx);
  }
  update(dt: number) {
    this.time += dt;
    this.states[this.current].update?.(this.ctx, dt);
  }
}
