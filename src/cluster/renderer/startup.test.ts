import { describe, expect, it } from 'vitest';
import { S } from '@/core/signals/catalog';
import { SignalStore } from '@/core/signals/store';
import { StartupSequence } from './startup';

describe('StartupSequence', () => {
  const run = (seq: StartupSequence, store: SignalStore, seconds: number) => {
    const out = [seq.update(store, 0)];
    for (let i = 0; i < seconds * 60; i++) out.push(seq.update(store, 1 / 60));
    return out;
  };

  it('sweeps needles to the stop and back, with a lamp self-test, on ignition', () => {
    const store = new SignalStore(() => 0);
    store.write({ id: S.Ignition, value: 0, ts: 0, source: 'can' });
    const seq = new StartupSequence();
    expect(run(seq, store, 0.5).at(-1)!.contentAlpha).toBe(0);
    store.write({ id: S.Ignition, value: 2, ts: 0, source: 'can' });
    const frames = run(seq, store, 3);
    const sweeps = frames.map((f) => f.sweep).filter((s): s is number => s !== null);
    expect(Math.max(...sweeps)).toBeCloseTo(1, 1);
    expect(sweeps.at(-1)!).toBeLessThan(0.05);
    expect(frames.some((f) => f.selfTest)).toBe(true);
    expect(frames.at(-1)!.phase).toBe('on');
    expect(frames.at(-1)!.contentAlpha).toBe(1);
  });

  it('shows a trip summary on shutdown, then goes dark', () => {
    const store = new SignalStore(() => 0);
    store.write({ id: S.Ignition, value: 2, ts: 0, source: 'can' });
    store.write({ id: S.TripDistance, value: 12.3, ts: 0, source: 'derived' });
    const seq = new StartupSequence();
    run(seq, store, 3);
    store.write({ id: S.Ignition, value: 0, ts: 0, source: 'can' });
    const frames = run(seq, store, 8);
    expect(Math.max(...frames.map((f) => f.summaryAlpha))).toBeCloseTo(1, 2);
    expect(frames.find((f) => f.summary)?.summary?.distanceKm).toBe(12.3);
    expect(frames.at(-1)!.phase).toBe('off');
  });

  it('boots once when the source has no ignition signal (plain OBD)', () => {
    const seq = new StartupSequence();
    const store = new SignalStore(() => 0);
    expect(seq.update(store, 0).phase).toBe('boot');
  });
});
