import type { DriveModeId, IndividualSettings } from '@/core/drive/modes';
import { AlertEngine } from '@/core/alerts/AlertEngine';
import { Flasher } from '@/core/alerts/flasher';
import { ALERT_RULES } from '@/core/alerts/rules';
import type { HistorySnapshot } from '@/core/derived/ConsumptionHistory';
import { DerivedEngine, type TripState } from '@/core/derived/DerivedEngine';
import type { CapabilityProfile } from '@/core/datasource/types';
import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import type { EnvironmentSettings } from '@/core/world/environment';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';
import type { VehicleEnv } from '@/cluster/renderer/types';

const DERIVED_HZ = 10;
const ALERTS_HZ = 5;
const TRIP_SAVE_MS = 5000;

export interface SessionOptions {
  /** Begin parked with the ignition off; the Demo drive starts the car. */
  startOff?: boolean;
  env?: Partial<EnvironmentSettings>;
}

function loadTrip(profileId: string): TripState | undefined {
  try {
    const raw = localStorage.getItem(`opencluster.trip.${profileId}`);
    return raw ? (JSON.parse(raw) as TripState) : undefined;
  } catch {
    return undefined;
  }
}

function saveTrip(profileId: string, trip: TripState, history?: HistorySnapshot): void {
  try {
    localStorage.setItem(`opencluster.trip.${profileId}`, JSON.stringify(trip));
    if (history) localStorage.setItem(`opencluster.history.${profileId}`, JSON.stringify(history));
  } catch {
    // Storage unavailable (private mode): trips are simply not persisted.
  }
}

function loadHistory(profileId: string): HistorySnapshot | undefined {
  try {
    const raw = localStorage.getItem(`opencluster.history.${profileId}`);
    return raw ? (JSON.parse(raw) as HistorySnapshot) : undefined;
  } catch {
    return undefined;
  }
}

interface DriveModeSettings {
  individual: IndividualSettings;
  rememberLast: boolean;
  last: DriveModeId;
}

function loadDriveModes(profileId: string): DriveModeSettings | undefined {
  try {
    const raw = localStorage.getItem(`opencluster.driveModes.${profileId}`);
    return raw ? (JSON.parse(raw) as DriveModeSettings) : undefined;
  } catch {
    return undefined;
  }
}

function saveDriveModes(profileId: string, s: DriveModeSettings): void {
  try {
    localStorage.setItem(`opencluster.driveModes.${profileId}`, JSON.stringify(s));
  } catch {
    // Not persisted without storage.
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
    this.derived.history.restore(loadHistory(profile.id));
    this.alerts = new AlertEngine(this.store, ALERT_RULES);
    // Individual settings and "remember last mode" survive reloads, like the car's memory.
    const dm = this.source.sim.driveModes;
    const saved = loadDriveModes(profile.id);
    if (saved) {
      dm.state.individual = { ...dm.state.individual, ...saved.individual };
      dm.rememberLast = saved.rememberLast;
      if (saved.rememberLast) dm.select(saved.last);
    }
  }

  private persist(): void {
    saveTrip(this.profile.id, this.derived.trip, this.derived.history.snapshot());
    const dm = this.source.sim.driveModes;
    saveDriveModes(this.profile.id, {
      individual: dm.state.individual,
      rememberLast: dm.rememberLast,
      last: dm.state.current,
    });
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
      setInterval(() => this.persist(), TRIP_SAVE_MS),
    );
  }

  async stop(): Promise<void> {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
    this.persist();
    this.unsub?.();
    await this.source.disconnect();
  }

  resetTrip(clearHistory = false): void {
    this.derived.resetTrip();
    if (clearHistory) this.derived.history.restore({ buckets: [], recent: [] });
    this.persist();
  }

  /**
   * Run the simulation ahead instantly while the derived engine keeps up
   * (tests and screenshots): trip computer and history fill as if driven.
   */
  fastForward(seconds: number, each?: () => void): void {
    // Chunks of at most 0.1 s that add up to exactly `seconds`.
    const steps = Math.max(1, Math.ceil(seconds / 0.1 - 1e-9));
    const stepS = seconds / steps;
    for (let i = 0; i < steps; i++) {
      this.source.fastForward(stepS, each);
      this.derived.step(performance.now(), stepS);
    }
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
