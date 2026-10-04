/** Fixed-size ring of numbers (oldest first). */
export class Ring {
  private data: number[] = [];

  constructor(readonly size: number) {}

  push(v: number): void {
    this.data.push(v);
    if (this.data.length > this.size) this.data.shift();
  }

  values(): readonly number[] {
    return this.data;
  }

  load(values: number[]): void {
    this.data = values.filter((v) => Number.isFinite(v)).slice(-this.size);
  }
}

/** Seconds of driving per bar in the consumption history graph. */
export const BUCKET_S = 5;
/** Interval of the short rolling graph, seconds. */
export const RECENT_STEP_S = 0.5;

export interface HistorySnapshot {
  buckets: number[];
  recent: number[];
}

/**
 * Rolling consumption history (like a real trip computer's "last minutes" bars).
 * Fed by the derived engine at a fixed rate, so it also fills while the
 * simulation is fast-forwarded, and persisted with the trip.
 */
export class ConsumptionHistory {
  /** Instant value, one sample per 0.5 s for the last minute. */
  readonly recent = new Ring(120);
  /** Average per 5 s bucket, last 2 minutes. */
  readonly buckets = new Ring(24);
  private t = 0;
  private bucketT = 0;
  private sum = 0;
  private n = 0;

  /** `value` is L/100 km while moving (or kWh/100 km for EVs); NaN when stationary counts as 0. */
  update(value: number, dt: number): void {
    const v = Number.isFinite(value) ? Math.min(Math.max(value, 0), 40) : 0;
    this.t += dt;
    this.bucketT += dt;
    // Small tolerance so summed float steps (0.1 + 0.1 + …) still hit the boundary.
    if (this.t >= RECENT_STEP_S - 1e-9) {
      this.t -= RECENT_STEP_S;
      this.recent.push(v);
      this.sum += v;
      this.n++;
    }
    if (this.bucketT >= BUCKET_S - 1e-9 && this.n > 0) {
      this.buckets.push(this.sum / this.n);
      this.bucketT = 0;
      this.sum = 0;
      this.n = 0;
    }
  }

  snapshot(): HistorySnapshot {
    return { buckets: [...this.buckets.values()], recent: [...this.recent.values()] };
  }

  restore(s: HistorySnapshot | undefined): void {
    if (!s) return;
    this.buckets.load(s.buckets ?? []);
    this.recent.load(s.recent ?? []);
  }
}
