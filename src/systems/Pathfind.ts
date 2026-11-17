// A* over the collision grid. Used by Sabapathi so he can reach the bucket
// anywhere on the map and always find his way home.
export interface Grid { gw: number; gh: number; cell: number; solid: Uint8Array; }
export interface Pt { x: number; y: number; }

function nearestFree(g: Grid, cx: number, cy: number): [number, number] | null {
  for (let r = 0; r < 14; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < g.gw && y < g.gh && !g.solid[y * g.gw + x]) return [x, y];
    }
  }
  return null;
}

export function findPath(g: Grid, from: Pt, to: Pt): Pt[] | null {
  const s = nearestFree(g, Math.floor(from.x / g.cell), Math.floor(from.y / g.cell));
  const t = nearestFree(g, Math.floor(to.x / g.cell), Math.floor(to.y / g.cell));
  if (!s || !t) return null;
  const N = g.gw * g.gh, si = s[1] * g.gw + s[0], ti = t[1] * g.gw + t[0];
  const gs = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
  const heap: number[] = [], f = new Float32Array(N);
  const h = (i: number) => { const dx = Math.abs((i % g.gw) - t[0]), dy = Math.abs(Math.floor(i / g.gw) - t[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); };
  const push = (i: number) => { heap.push(i); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (f[heap[p]] <= f[heap[c]]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) { heap[0] = last; let p = 0; for (;;) { let m = p; const l = p * 2 + 1, r = l + 1; if (l < heap.length && f[heap[l]] < f[heap[m]]) m = l; if (r < heap.length && f[heap[r]] < f[heap[m]]) m = r; if (m === p) break; [heap[p], heap[m]] = [heap[m], heap[p]]; p = m; } }
    return top;
  };
  gs[si] = 0; f[si] = h(si); push(si);
  while (heap.length) {
    const cur = pop();
    if (cur === ti) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    const cx = cur % g.gw, cy = Math.floor(cur / g.gw);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= g.gw || ny >= g.gh) continue;
      const ni = ny * g.gw + nx;
      if (g.solid[ni] || closed[ni]) continue;
      if (dx && dy && (g.solid[cy * g.gw + nx] || g.solid[ny * g.gw + cx])) continue; // no cutting corners
      const cost = gs[cur] + (dx && dy ? 1.414 : 1);
      if (cost < gs[ni]) { gs[ni] = cost; came[ni] = cur; f[ni] = cost + h(ni); push(ni); }
    }
  }
  if (ti !== si && came[ti] < 0) return null;
  const out: Pt[] = [];
  for (let i = ti; i >= 0; i = came[i]) { out.push({ x: (i % g.gw) * g.cell + g.cell / 2, y: Math.floor(i / g.gw) * g.cell + g.cell / 2 }); if (i === si) break; }
  return out.reverse();
}
