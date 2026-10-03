import { describe, expect, it } from 'vitest';
import { S } from '../signals/catalog';
import { SignalStore } from '../signals/store';
import { DerivedEngine } from './DerivedEngine';
import { fuelRateFromMaf, litresPer100km } from './fuel';

describe('fuel maths', () => {
  it('converts MAF to fuel flow for petrol', () => {
    // 10 g/s air -> 10*3600/(14.7*745) ≈ 3.29 L/h
    expect(fuelRateFromMaf(10, 'petrol')).toBeCloseTo(3.287, 2);
  });

  it('uses diesel constants for diesel', () => {
    expect(fuelRateFromMaf(10, 'diesel')).toBeCloseTo(2.984, 2);
  });

  it('gives L/100km only when moving', () => {
    expect(litresPer100km(6, 100)).toBeCloseTo(6);
    expect(litresPer100km(1, 0)).toBeUndefined();
  });
});

describe('DerivedEngine', () => {
  it('integrates a trip at constant speed and consumption', () => {
    const store = new SignalStore(() => 0);
    const engine = new DerivedEngine(store, { fuelType: 'petrol', tankL: 50 });
    // 100 km/h, 7 L/h for one simulated hour at 10 Hz
    for (let i = 0; i <= 36_000; i++) {
      const now = i * 100;
      store.write({ id: S.Speed, value: 100, ts: now, source: 'simulated' });
      store.write({ id: S.FuelRate, value: 7, ts: now, source: 'simulated' });
      store.write({ id: S.FuelLevel, value: 50, ts: now, source: 'simulated' });
      engine.tick(now);
    }
    expect(engine.trip.distanceKm).toBeCloseTo(100, 0);
    expect(store.value(S.AverageConsumption)).toBeCloseTo(7, 1);
    expect(store.value(S.AverageSpeed)).toBeCloseTo(100, 0);
    expect(store.value(S.InstantConsumption)).toBeCloseTo(7, 1);
    // 25 L left at ~7 L/100km -> ~357 km
    expect(store.value(S.Range)).toBeGreaterThan(300);
    expect(store.value(S.Range)).toBeLessThan(400);
  });

  it('falls back to MAF when the car has no fuel-rate PID', () => {
    const store = new SignalStore(() => 0);
    store.write({ id: S.MAF, value: 10, ts: 0, source: 'obd-standard' });
    const engine = new DerivedEngine(store, { fuelType: 'petrol', tankL: 50 });
    expect(engine.fuelRateLh()).toBeCloseTo(3.287, 2);
  });

  it('declares what it can derive from the available signals', () => {
    expect(DerivedEngine.provides(new Set([S.Speed]))).not.toContain(S.Range);
    expect(DerivedEngine.provides(new Set([S.Speed, S.MAF, S.FuelLevel]))).toContain(S.Range);
  });
});
