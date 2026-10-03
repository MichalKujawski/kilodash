import { SIGNALS } from './catalog';
import type { Sample, SignalId, SignalQuality, SignalSource } from './types';

/** A signal is considered stale after this many missed expected intervals. */
export const STALE_FACTOR = 4;

interface Slot {
  value: number;
  ts: number;
  prevValue: number;
  prevTs: number;
  source: SignalSource;
  estimated: boolean;
  count: number;
  /** Exponentially averaged update rate, Hz. */
  rateHz: number;
}

/**
 * High-frequency vehicle data store. Lives outside React: the render loop reads it
 * directly every frame. React components poll it at low rates via `useSignal`.
 */
export class SignalStore {
  private slots = new Map<SignalId, Slot>();
  private clock: () => number;

  constructor(clock: () => number = () => performance.now()) {
    this.clock = clock;
  }

  write(sample: Sample, estimated = false): void {
    const slot = this.slots.get(sample.id);
    if (!slot) {
      this.slots.set(sample.id, {
        value: sample.value,
        ts: sample.ts,
        prevValue: sample.value,
        prevTs: sample.ts,
        source: sample.source,
        estimated,
        count: 1,
        rateHz: 0,
      });
      return;
    }
    const dt = sample.ts - slot.ts;
    if (dt > 0) {
      const inst = 1000 / dt;
      slot.rateHz = slot.rateHz === 0 ? inst : slot.rateHz * 0.9 + inst * 0.1;
    }
    slot.prevValue = slot.value;
    slot.prevTs = slot.ts;
    slot.value = sample.value;
    slot.ts = sample.ts;
    slot.source = sample.source;
    slot.estimated = estimated;
    slot.count++;
  }

  has(id: SignalId): boolean {
    return this.slots.has(id);
  }

  /** Latest raw value, or `fallback` if the signal never arrived. */
  value(id: SignalId, fallback = 0): number {
    return this.slots.get(id)?.value ?? fallback;
  }

  /**
   * Value predicted for time `now`: linear extrapolation from the last two samples,
   * clamped to one sample interval so a dropped stream never runs away.
   */
  predicted(id: SignalId, now = this.clock()): number {
    const s = this.slots.get(id);
    if (!s) return 0;
    const interval = s.ts - s.prevTs;
    if (interval <= 0 || interval > 1000) return s.value;
    const ahead = Math.min(now - s.ts, interval);
    if (ahead <= 0) return s.value;
    return s.value + ((s.value - s.prevValue) / interval) * ahead;
  }

  timestamp(id: SignalId): number | undefined {
    return this.slots.get(id)?.ts;
  }

  source(id: SignalId): SignalSource | undefined {
    return this.slots.get(id)?.source;
  }

  rateHz(id: SignalId): number {
    return this.slots.get(id)?.rateHz ?? 0;
  }

  quality(id: SignalId, now = this.clock()): SignalQuality {
    const s = this.slots.get(id);
    if (!s) return 'unavailable';
    const expected = SIGNALS.get(id)?.expectedHz ?? 1;
    if (now - s.ts > (STALE_FACTOR * 1000) / expected) return 'stale';
    return s.estimated ? 'estimated' : 'live';
  }

  ids(): SignalId[] {
    return [...this.slots.keys()];
  }

  clear(): void {
    this.slots.clear();
  }
}
