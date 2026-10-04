import { S } from '@/core/signals/catalog';
import type { SignalStore } from '@/core/signals/store';

export type StartupPhase = 'off' | 'boot' | 'on' | 'shutdown';

export interface TripSnapshot {
  distanceKm?: number;
  durationS?: number;
  avgSpeed?: number;
  avgConsumption?: number;
}

/** What the start-up/shut-down choreography asks of the renderer this frame. */
export interface ClusterRuntime {
  phase: StartupPhase;
  /** Needle override 0..1 during the start-up sweep, else null. */
  sweep: number | null;
  /** Bulb check: warning lamps lit. */
  selfTest: boolean;
  /** Opacity of the main content (dials, pages). */
  contentAlpha: number;
  logoAlpha: number;
  summaryAlpha: number;
  summary: TripSnapshot | null;
}

const BOOT_S = 2.3;
const SHUTDOWN_S = 7;

const ease = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const ramp = (t: number, a: number, b: number): number => ease((t - a) / (b - a));

/**
 * Ignition-driven choreography. Boot: logo reveal, needle sweep to the stops and
 * back, ~1.5 s warning-lamp self-test, layout fade-in. Shutdown: trip summary
 * card, then dark. Without an ignition signal (plain OBD) the boot plays once.
 */
export class StartupSequence {
  phase: StartupPhase = 'off';
  private t = 0;
  private wasOn: boolean | null = null;
  private summary: TripSnapshot | null = null;

  /** Play the boot choreography again (guided demo start-up chapter). */
  replayBoot(): void {
    this.phase = 'boot';
    this.t = 0;
  }

  update(store: SignalStore, dt: number): ClusterRuntime {
    const on = !store.has(S.Ignition) || store.value(S.Ignition) >= 2;
    if (this.wasOn === null || on !== this.wasOn) {
      if (on) {
        this.phase = 'boot';
        this.t = 0;
      } else if (this.wasOn) {
        this.phase = 'shutdown';
        this.t = 0;
        this.summary = snapshot(store);
      } else this.phase = 'off';
      this.wasOn = on;
    }
    this.t += dt;
    const t = this.t;
    if (this.phase === 'boot' && t > BOOT_S) this.phase = 'on';
    if (this.phase === 'shutdown' && t > SHUTDOWN_S) this.phase = 'off';

    switch (this.phase) {
      case 'boot': {
        const f = (t - 0.35) / 1.6;
        const sweep = f < 0 || f > 1 ? null : f < 0.5 ? ease(f * 2) : ease(2 - f * 2);
        return {
          phase: 'boot',
          sweep,
          selfTest: t > 0.25 && t < 1.85,
          contentAlpha: 0.12 + 0.88 * ramp(t, 0.25, 1.5),
          logoAlpha: ramp(t, 0, 0.45) * (1 - ramp(t, 1.3, 1.9)),
          summaryAlpha: 0,
          summary: null,
        };
      }
      case 'shutdown':
        return {
          phase: 'shutdown',
          sweep: null,
          selfTest: false,
          contentAlpha: 1 - 0.96 * ramp(t, 0, 0.7),
          logoAlpha: 0,
          summaryAlpha: ramp(t, 0.3, 0.8) * (1 - ramp(t, 6, 6.8)),
          summary: this.summary,
        };
      case 'off':
        return {
          phase: 'off',
          sweep: null,
          selfTest: false,
          contentAlpha: 0,
          logoAlpha: 0,
          summaryAlpha: 0,
          summary: null,
        };
      default:
        return {
          phase: 'on',
          sweep: null,
          selfTest: false,
          contentAlpha: 1,
          logoAlpha: 0,
          summaryAlpha: 0,
          summary: null,
        };
    }
  }
}

function snapshot(store: SignalStore): TripSnapshot {
  const v = (id: string): number | undefined => (store.has(id) ? store.value(id) : undefined);
  return {
    distanceKm: v(S.TripDistance),
    durationS: v(S.TripDuration),
    avgSpeed: v(S.AverageSpeed),
    avgConsumption: v(S.AverageConsumption),
  };
}
