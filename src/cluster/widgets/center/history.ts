import { S } from '@/core/signals/catalog';
import type { SignalStore } from '@/core/signals/store';

/** Fixed-size ring buffer of numbers. */
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
}

/** Rolling consumption history shared by the trip and efficiency pages. */
export class History {
  /** Instant consumption, one sample per 0.5 s for the last minute. */
  readonly recent = new Ring(120);
  /** Average consumption per 10 s bucket (bar graph). */
  readonly buckets = new Ring(24);
  private t = 0;
  private bucketT = 0;
  private bucketSum = 0;
  private bucketN = 0;

  update(store: SignalStore, dt: number): void {
    if (!store.has(S.InstantConsumption)) return;
    this.t += dt;
    this.bucketT += dt;
    if (this.t >= 0.5) {
      this.t = 0;
      const v = store.value(S.InstantConsumption);
      const val = Number.isFinite(v) ? Math.min(v, 40) : 0;
      this.recent.push(val);
      this.bucketSum += val;
      this.bucketN++;
    }
    if (this.bucketT >= 10 && this.bucketN > 0) {
      this.buckets.push(this.bucketSum / this.bucketN);
      this.bucketT = 0;
      this.bucketSum = 0;
      this.bucketN = 0;
    }
  }
}
