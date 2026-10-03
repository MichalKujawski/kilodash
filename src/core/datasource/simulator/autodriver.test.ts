import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@/profiles';
import { S } from '../../signals/catalog';
import { SignalStore } from '../../signals/store';
import { SimulatorSource } from './SimulatorSource';

describe('SimulatorSource + AutoDriver', () => {
  it('drives the demo loop and publishes samples to a store', async () => {
    let now = 0;
    const src = new SimulatorSource(DEFAULT_PROFILE, 7, () => now);
    const store = new SignalStore(() => now);
    src.onSample((s) => store.write(s));
    // Drive 40 simulated seconds without real timers.
    let maxSpeed = 0;
    for (let i = 0; i < 4000; i++) {
      now += 10;
      src.tick(now);
      maxSpeed = Math.max(maxSpeed, store.value(S.Speed));
    }
    expect(maxSpeed).toBeGreaterThan(45);
    expect(store.quality(S.Speed)).toBe('live');
    expect(store.quality(S.CoolantTemp)).toBe('live');
    expect(store.rateHz(S.Speed)).toBeGreaterThan(40);
  });

  it('only publishes signals the profile supports', async () => {
    const profile = { ...DEFAULT_PROFILE, signals: [S.Speed] };
    let now = 0;
    const src = new SimulatorSource(profile, 1, () => now);
    const ids = new Set<string>();
    src.onSample((s) => ids.add(s.id));
    for (let i = 0; i < 100; i++) src.tick((now += 10));
    expect([...ids]).toEqual([S.Speed]);
    expect((await src.discover()).signals).toEqual([S.Speed]);
  });
});
