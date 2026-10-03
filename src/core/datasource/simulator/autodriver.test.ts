import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE, profileById } from '@/profiles';
import { S } from '../../signals/catalog';
import { SignalStore } from '../../signals/store';
import { SimulatorSource } from './SimulatorSource';
import { profileSignals } from './signals';

function drive(src: SimulatorSource, store: SignalStore, seconds: number, clock: { now: number }) {
  let maxSpeed = 0;
  for (let i = 0; i < seconds * 100; i++) {
    clock.now += 10;
    src.tick(clock.now);
    maxSpeed = Math.max(maxSpeed, store.value(S.Speed));
  }
  return maxSpeed;
}

function setup(profile = DEFAULT_PROFILE, options = {}) {
  const clock = { now: 0 };
  const src = new SimulatorSource(profile, { seed: 7, ...options }, () => clock.now);
  const store = new SignalStore(() => clock.now);
  src.onSample((s) => store.write(s));
  return { src, store, clock };
}

describe('SimulatorSource', () => {
  it('drives the city scenario and publishes live samples', () => {
    const { src, store, clock } = setup();
    expect(drive(src, store, 40, clock)).toBeGreaterThan(45);
    expect(store.quality(S.Speed)).toBe('live');
    expect(store.quality(S.CoolantTemp)).toBe('live');
    expect(store.rateHz(S.Speed)).toBeGreaterThan(40);
  });

  it('plays the start-up sequence from ignition off', () => {
    const { src, store, clock } = setup(DEFAULT_PROFILE, { startOff: true });
    drive(src, store, 0.2, clock);
    expect(store.value(S.Ignition)).toBe(0);
    expect(store.has(S.Speed)).toBe(false); // OBD silent with ignition off
    drive(src, store, 4, clock);
    expect(store.value(S.EngineRunning)).toBe(1);
  });

  it('tags signals with the channel a real car would use', () => {
    const sources = Object.fromEntries(
      profileSignals(DEFAULT_PROFILE).map((s) => [s.id, s.source]),
    );
    expect(sources[S.EngineSpeed]).toBe('obd-standard');
    expect(sources[S.Gear]).toBe('obd-manufacturer');
    expect(sources[S.IndicatorLeft]).toBe('can');
  });

  it('exposes only what the old hatchback supports over OBD', () => {
    const ids = profileSignals(profileById('hatchback-2008'))
      .filter((s) => s.source !== 'can')
      .map((s) => s.id);
    expect(ids).toContain(S.Speed);
    expect(ids).toContain(S.CoolantTemp);
    expect(ids).not.toContain(S.FuelLevel);
    expect(ids).not.toContain(S.Gear);
  });

  it('runs the track scenario with paddle shifts and shift lights', () => {
    const { src, store, clock } = setup();
    src.setScenario('track');
    let manual = false;
    let shiftLight = false;
    let maxGear = 0;
    for (let i = 0; i < 3000; i++) {
      clock.now += 10;
      src.tick(clock.now);
      manual ||= store.value(S.SelectedGear) !== 127;
      shiftLight ||= store.value(S.ShiftRequest) > 0;
      maxGear = Math.max(maxGear, store.value(S.Gear));
    }
    expect(manual).toBe(true);
    expect(shiftLight).toBe(true);
    expect(maxGear).toBeGreaterThanOrEqual(4);
  });

  it('engages cruise control on the highway', () => {
    const { src, store, clock } = setup();
    src.setScenario('highway');
    let cruise = false;
    for (let i = 0; i < 6000 && !cruise; i++) {
      clock.now += 10;
      src.tick(clock.now);
      cruise = store.value(S.CruiseActive) > 0;
    }
    expect(cruise).toBe(true);
    expect(store.value(S.CruiseSpeed)).toBe(130);
  });

  it('reports DTCs for injected faults', async () => {
    const { src } = setup();
    src.setFault('checkEngine', true);
    expect((await src.readDTCs()).map((d) => d.code)).toContain('P0301');
  });
});
