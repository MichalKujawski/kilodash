import type { Route } from './route';
import type { RoadKind } from './types';

export type ManeuverKind =
  'turnLeft' | 'turnRight' | 'roundabout' | 'join' | 'exit' | 'destination';

export interface Maneuver {
  s: number;
  kind: ManeuverKind;
  /** Road or place after the manoeuvre. */
  road: string;
  exitNumber?: number;
  /** Roundabout exit to take. */
  roundaboutExit?: number;
  /** Lane guidance: one entry per lane (rightmost first), true = use this lane. */
  lanes?: boolean[];
}

export interface NavState {
  current: Maneuver | null;
  /** Distance to the current manoeuvre, m. */
  distance: number;
  next: Maneuver | null;
  road: string;
  /** Distance to destination, m. */
  remaining: number;
  /** Estimated driving time to destination, s. */
  timeLeft: number;
  destination: string;
}

/** Typical speeds (km/h) used for the arrival-time estimate. */
const TYPICAL: Record<RoadKind, number> = {
  parking: 8,
  urban: 32,
  zone30: 22,
  rural: 75,
  ramp: 55,
  motorway: 120,
};

/** Turn-by-turn guidance derived from the route the car is actually driving. */
export class Navigation {
  readonly maneuvers: Maneuver[];

  constructor(private route: Route) {
    this.maneuvers = route.features.flatMap((f): Maneuver[] => {
      switch (f.kind) {
        case 'junction':
          return [
            { s: f.s, kind: f.turn === 'left' ? 'turnLeft' : 'turnRight', road: f.name ?? '' },
          ];
        case 'roundabout':
          return [{ s: f.s, kind: 'roundabout', road: f.name ?? '', roundaboutExit: f.exit }];
        case 'motorwayJoin':
          return [{ s: f.s, kind: 'join', road: f.name ?? '' }];
        case 'motorwayExit': {
          const lanes = route.lanesAt(f.s - 600);
          return [
            {
              s: f.s,
              kind: 'exit',
              road: f.name ?? '',
              exitNumber: f.exit,
              lanes: Array.from({ length: lanes }, (_, i) => i === 0),
            },
          ];
        }
        case 'destination':
          return [{ s: f.s, kind: 'destination', road: f.name ?? '' }];
        default:
          return [];
      }
    });
  }

  get destination(): string {
    return this.maneuvers[this.maneuvers.length - 1]?.road ?? '';
  }

  state(s: number): NavState {
    const idx = this.maneuvers.findIndex((m) => m.s > s - 2);
    const current = idx >= 0 ? this.maneuvers[idx]! : null;
    const next = idx >= 0 ? (this.maneuvers[idx + 1] ?? null) : null;
    const seg = this.route.segmentAt(s);
    return {
      current,
      distance: current ? Math.max(0, current.s - s) : 0,
      next,
      road: seg.name,
      remaining: Math.max(0, this.route.length - s),
      timeLeft: this.timeLeft(s),
      destination: this.destination,
    };
  }

  private timeLeft(s: number): number {
    let t = 0;
    for (const seg of this.route.segments) {
      const from = Math.max(s, seg.s0);
      const to = seg.s0 + seg.length;
      if (to > from) t += (to - from) / (TYPICAL[seg.kind] / 3.6);
    }
    return t;
  }
}
