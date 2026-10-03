export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Frame-rate independent exponential approach: fraction to move this step. */
export const approach = (dt: number, tau: number): number =>
  tau <= 0 ? 1 : 1 - Math.exp(-dt / tau);

/** Piecewise-linear lookup in a table of [x, y] points sorted by x. */
export function interpTable(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  if (x >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const b = table[i]!;
    if (x <= b[0]) {
      const a = table[i - 1]!;
      return lerp(a[1], b[1], (x - a[0]) / (b[0] - a[0]));
    }
  }
  return last[1];
}

/** Seedable PRNG (mulberry32) so simulator runs are reproducible. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth 1-D value noise in [-1, 1], driven by a seeded RNG. */
export class SmoothNoise {
  private a: number;
  private b: number;
  private t = 0;

  constructor(
    private rng: () => number,
    private hz: number,
  ) {
    this.a = rng() * 2 - 1;
    this.b = rng() * 2 - 1;
  }

  next(dt: number): number {
    this.t += dt * this.hz;
    while (this.t >= 1) {
      this.t -= 1;
      this.a = this.b;
      this.b = this.rng() * 2 - 1;
    }
    const s = this.t * this.t * (3 - 2 * this.t);
    return lerp(this.a, this.b, s);
  }
}
