import { describe, expect, it } from 'vitest';
import { S } from './catalog';
import { SignalStore } from './store';

describe('SignalStore', () => {
  it('reports unavailable before any sample', () => {
    const store = new SignalStore(() => 0);
    expect(store.quality(S.Speed)).toBe('unavailable');
    expect(store.value(S.Speed, -1)).toBe(-1);
  });

  it('marks a signal stale after missed intervals', () => {
    let now = 0;
    const store = new SignalStore(() => now);
    store.write({ id: S.Speed, value: 50, ts: 0, source: 'simulated' });
    now = 100;
    expect(store.quality(S.Speed)).toBe('live');
    now = 1000; // Speed expects 10 Hz -> stale after 400 ms
    expect(store.quality(S.Speed)).toBe('stale');
  });

  it('extrapolates no further than one interval', () => {
    const store = new SignalStore(() => 0);
    store.write({ id: S.Speed, value: 10, ts: 0, source: 'simulated' });
    store.write({ id: S.Speed, value: 20, ts: 100, source: 'simulated' });
    expect(store.predicted(S.Speed, 150)).toBeCloseTo(25);
    expect(store.predicted(S.Speed, 10_000)).toBeCloseTo(30);
  });

  it('tracks the achieved update rate', () => {
    const store = new SignalStore(() => 0);
    for (let i = 0; i < 50; i++)
      store.write({ id: S.Speed, value: i, ts: i * 50, source: 'simulated' });
    expect(store.rateHz(S.Speed)).toBeCloseTo(20, 0);
  });
});
