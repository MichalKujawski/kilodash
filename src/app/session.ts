import { AlertEngine } from '@/core/alerts/AlertEngine';
import { Flasher } from '@/core/alerts/flasher';
import { ALERT_RULES } from '@/core/alerts/rules';
import { DerivedEngine, type TripState } from '@/core/derived/DerivedEngine';
import type { CapabilityProfile } from '@/core/datasource/types';
import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import type { ScenarioId } from '@/core/datasource/simulator/scenarios';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';
import type { VehicleEnv } from '@/cluster/renderer/types';

const DERIVED_HZ = 10;
const ALERTS_HZ = 5;
const TRIP_SAVE_MS = 5000;

export interface SessionOptions {
  startOff?: boolean;
  scenario?: ScenarioId;
  attract?: boolean;
}

function loadTrip(profileId: string): TripState | undefined {
  try {
    const raw = localStorage.getItem(`opencluster.trip.${profileId}`);
    return raw ? (JSON.parse(raw) as TripState) : undefined;
  } catch {
    return undefined;
  }
}

function saveTrip(profileId: string, trip: TripState): void {
  try {
    localStorage.setItem(`opencluster.trip.${profileId}`, JSON.stringify(trip));
  } catch {
    // Storage unavailable (private mode): trips are simply not persisted.
  }
}

/**
 * Wires one vehicle session together: DataSource → SignalStore → DerivedEngine
 * and AlertEngine, plus the capability profile the layout engine builds from.
 */
export class ClusterSession {
  readonly store = new SignalStore();
  readonly source: SimulatorSource;
  readonly derived: DerivedEngine;
  readonly alerts: AlertEngine;
  readonly flasher = new Flasher();
  capabilities: CapabilityProfile | undefined;
  /** Direct + derivable signals. */
  available = new Set<SignalId>();

  private unsub: (() => void) | undefined;
  private timers: ReturnType<typeof setInterval>[] = [];

  constructor(
    readonly profile: VehicleProfile,
    options: SessionOptions = {},
  ) {
    this.source = new SimulatorSource(profile, { seed: 1, ...options });
    this.derived = new DerivedEngine(this.store, {
      fuelType: profile.fuelType,
      tankL: profile.tankL,
      trip: loadTrip(profile.id),
    });
    this.alerts = new AlertEngine(this.store, ALERT_RULES);
  }

  async start(): Promise<void> {
    this.unsub = this.source.onSample((s) => this.store.write(s));
    await this.source.connect();
    this.capabilities = await this.source.discover();
    const direct = new Set(this.capabilities.signals);
    this.available = new Set([...direct, ...DerivedEngine.provides(direct)]);
    this.timers.push(
      setInterval(() => this.derived.tick(performance.now()), 1000 / DERIVED_HZ),
      setInterval(() => this.alerts.update(performance.now()), 1000 / ALERTS_HZ),
      setInterval(() => saveTrip(this.profile.id, this.derived.trip), TRIP_SAVE_MS),
    );
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    saveTrip(this.profile.id, this.derived.trip);
    this.unsub?.();
    await this.source.disconnect();
  }

  resetTrip(): void {
    this.derived.resetTrip();
    saveTrip(this.profile.id, this.derived.trip);
  }

  env(): VehicleEnv {
    const p = this.profile;
    return {
      speedoMaxKmh: p.speedoMaxKmh,
      tachoMaxRpm: p.tachoMaxRpm,
      redlineRpm: p.engine?.redlineRpm ?? 0,
      gearCount: p.gearRatios.length,
      tankL: p.tankL,
    };
  }
}
