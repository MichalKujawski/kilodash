import type { FuelType } from '../datasource/types';
import { S } from '../signals/catalog';
import type { SignalStore } from '../signals/store';
import type { SignalId } from '../signals/types';
import { fuelRateFromMaf, litresPer100km } from './fuel';

/** Fallback consumption for range estimates before the trip has enough data. */
const DEFAULT_CONSUMPTION_L100 = 8.5;

export interface TripState {
  distanceKm: number;
  fuelUsedL: number;
  durationS: number;
}

export interface DerivedOptions {
  fuelType: FuelType;
  tankL: number;
  trip?: TripState;
}

/**
 * Computes signals the car doesn't report directly (consumption, range, trip
 * computer) from the ones it does, and writes them back into the store tagged
 * `derived`. Call `tick` at a modest fixed rate (~10 Hz).
 */
export class DerivedEngine {
  trip: TripState;
  private lastNow: number | undefined;
  private avgWindow: number | undefined;

  constructor(
    private store: SignalStore,
    private options: DerivedOptions,
  ) {
    this.trip = options.trip ?? { distanceKm: 0, fuelUsedL: 0, durationS: 0 };
  }

  /** Which derived signals this engine can produce given the available inputs. */
  static provides(available: ReadonlySet<SignalId>): SignalId[] {
    const out: SignalId[] = [];
    const hasFuel = available.has(S.FuelRate) || available.has(S.MAF);
    if (available.has(S.Speed)) out.push(S.TripDistance, S.AverageSpeed, S.TripDuration);
    if (hasFuel && available.has(S.Speed)) out.push(S.InstantConsumption, S.AverageConsumption);
    if (available.has(S.FuelLevel)) out.push(S.Range);
    if (available.has(S.MAP) && available.has(S.BarometricPressure)) out.push(S.Boost);
    return out;
  }

  resetTrip(): void {
    this.trip = { distanceKm: 0, fuelUsedL: 0, durationS: 0 };
  }

  /** Best available fuel flow, L/h. */
  fuelRateLh(): number | undefined {
    if (this.store.has(S.FuelRate)) return this.store.value(S.FuelRate);
    if (this.store.has(S.MAF))
      return fuelRateFromMaf(this.store.value(S.MAF), this.options.fuelType);
    return undefined;
  }

  tick(now: number): void {
    const dt = this.lastNow === undefined ? 0 : Math.min((now - this.lastNow) / 1000, 1);
    this.lastNow = now;
    const st = this.store;
    if (!st.has(S.Speed)) return;
    const speed = st.value(S.Speed);
    const rate = this.fuelRateLh();
    // Drive time counts while the ignition is on (hybrids drive with the engine off).
    const running = st.has(S.Ignition)
      ? st.value(S.Ignition) >= 2
      : !st.has(S.EngineRunning) || st.value(S.EngineRunning) > 0;

    if (running) this.trip.durationS += dt;
    this.trip.distanceKm += (speed * dt) / 3600;
    if (rate !== undefined) this.trip.fuelUsedL += (rate * dt) / 3600;

    const put = (id: SignalId, value: number): void =>
      st.write({ id, value, ts: now, source: 'derived' }, true);

    put(S.TripDistance, this.trip.distanceKm);
    put(S.TripDuration, this.trip.durationS);
    if (this.trip.durationS > 1)
      put(S.AverageSpeed, (this.trip.distanceKm / this.trip.durationS) * 3600);

    let avg: number | undefined;
    if (rate !== undefined) {
      const inst = litresPer100km(rate, speed);
      // Stationary: publish NaN so widgets can switch to L/h.
      put(S.InstantConsumption, inst ?? Number.NaN);
      if (this.trip.distanceKm > 0.2) {
        avg = (this.trip.fuelUsedL / this.trip.distanceKm) * 100;
        put(S.AverageConsumption, avg);
      }
    }

    if (st.has(S.MAP) && st.has(S.BarometricPressure)) {
      put(S.Boost, st.value(S.MAP) - st.value(S.BarometricPressure));
    }

    if (st.has(S.FuelLevel) && this.options.tankL > 0) {
      const litres = (st.value(S.FuelLevel) / 100) * this.options.tankL;
      // Smooth the consumption used for range so the number doesn't jump around.
      const basis = avg ?? DEFAULT_CONSUMPTION_L100;
      this.avgWindow =
        this.avgWindow === undefined ? basis : this.avgWindow + (basis - this.avgWindow) * 0.02;
      put(S.Range, (litres / Math.max(this.avgWindow, 2)) * 100);
    }
  }
}
