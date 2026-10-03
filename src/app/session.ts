import { DerivedEngine } from '@/core/derived/DerivedEngine';
import type { CapabilityProfile } from '@/core/datasource/types';
import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';
import type { VehicleEnv } from '@/cluster/renderer/types';

const DERIVED_HZ = 10;

/**
 * Wires one vehicle session together: DataSource → SignalStore → DerivedEngine,
 * plus the capability profile the layout engine builds from.
 */
export class ClusterSession {
  readonly store = new SignalStore();
  readonly source: SimulatorSource;
  readonly derived: DerivedEngine;
  capabilities: CapabilityProfile | undefined;
  /** Direct + derivable signals. */
  available = new Set<SignalId>();

  private unsub: (() => void) | undefined;
  private derivedTimer: ReturnType<typeof setInterval> | undefined;

  constructor(readonly profile: VehicleProfile) {
    this.source = new SimulatorSource(profile, 1);
    this.derived = new DerivedEngine(this.store, {
      fuelType: profile.fuelType,
      tankL: profile.tankL,
    });
  }

  async start(): Promise<void> {
    this.unsub = this.source.onSample((s) => this.store.write(s));
    await this.source.connect();
    this.capabilities = await this.source.discover();
    const direct = new Set(this.capabilities.signals);
    this.available = new Set([...direct, ...DerivedEngine.provides(direct)]);
    this.derivedTimer = setInterval(() => this.derived.tick(performance.now()), 1000 / DERIVED_HZ);
  }

  async stop(): Promise<void> {
    clearInterval(this.derivedTimer);
    this.unsub?.();
    await this.source.disconnect();
  }

  env(): VehicleEnv {
    const p = this.profile;
    return {
      speedoMaxKmh: p.speedoMaxKmh,
      tachoMaxRpm: p.tachoMaxRpm,
      redlineRpm: p.engine.redlineRpm,
      gearCount: p.gearRatios.length,
      tankL: p.tankL,
    };
  }
}
