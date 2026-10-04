import { clamp, createRng } from '../math';
import type { Route } from './route';
import type { RoadKind, RouteEvent } from './types';

export type VehicleKind = 'car' | 'van' | 'truck';

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  /** Route position of the front bumper, m. Oncoming vehicles count down. */
  s: number;
  /** Lane (0 = rightmost). Fractional while changing lanes. */
  lane: number;
  targetLane: number;
  /** Speed, m/s. */
  v: number;
  /** Acceleration last step, m/s². */
  a: number;
  length: number;
  /** Personal factor on the legal speed (drivers differ). */
  temper: number;
  /** Preferred cruise speed where there's no limit, m/s. */
  freeSpeed: number;
  oncoming: boolean;
  /** Event override: speed cap (m/s) until a route position, or a hard stop. */
  cap?: { v: number; until: number };
  brakeUntil?: number;
  colour: number;
  /** Seconds since the last lane-change decision. */
  lcTimer: number;
}

/** The ego car as other traffic sees it. */
export interface EgoState {
  s: number;
  lane: number;
  v: number;
  length: number;
}

/** A stop line a vehicle must respect (red light, end of road). */
export interface StopLine {
  s: number;
}

export interface TrafficContext {
  /** Legal speed (m/s) at s, or null for none. */
  limit(s: number): number | null;
  /** Red/amber stop lines between s0 and s1. */
  stopLines(s0: number, s1: number): StopLine[];
  /** Simulation time, s. */
  time: number;
  /** Speed factor for weather (1 dry). */
  weather: number;
}

/** Intelligent Driver Model parameters (Treiber et al.), typical values. */
const IDM = { aMax: 1.6, b: 2.2, s0: 2.5, T: 1.4, delta: 4 };
const TRUCK = { aMax: 0.7, b: 1.8, s0: 3, T: 1.8, delta: 4 };

/** Vehicles per km per lane, by road kind (light demo traffic). */
const DENSITY: Record<RoadKind, number> = {
  parking: 0,
  urban: 6,
  zone30: 2,
  rural: 2.5,
  ramp: 0,
  motorway: 4.5,
};
const WINDOW_BEHIND = 350;
const WINDOW_AHEAD = 1100;
const LANE_CHANGE_S = 3.5;

/** Speed a driver takes a bend at: lateral ≈ 0.3 g. */
export function curveSpeed(curvature: number, lateralG = 0.3): number {
  return Math.abs(curvature) < 1e-4 ? Infinity : Math.sqrt((lateralG * 9.81) / Math.abs(curvature));
}

/**
 * Other road users around the ego car. Same-direction traffic follows the
 * Intelligent Driver Model and changes lanes keep-right style (overtake on the
 * left, return when clear); oncoming cars on two-way roads only pass by.
 * Vehicles that fall out of the window around the ego car are recycled, so
 * there is always traffic nearby. Route events add a slow truck, a jam and a
 * sudden brake by the vehicle ahead.
 */
export class Traffic {
  vehicles: Vehicle[] = [];
  private rng: () => number;
  private nextId = 1;
  private fired = new Set<RouteEvent>();

  constructor(
    private route: Route,
    seed = 5,
  ) {
    this.rng = createRng(seed);
  }

  /** Fill the window around the ego position (on start or after a jump). */
  populate(ego: EgoState): void {
    this.vehicles = [];
    this.fired.clear();
    for (
      let s = Math.max(0, ego.s - WINDOW_BEHIND);
      s < Math.min(this.route.length, ego.s + WINDOW_AHEAD);
      s += 20
    ) {
      const kind = this.route.kindAt(s);
      const lanes = this.route.lanesAt(s);
      for (let lane = 0; lane < lanes; lane++) {
        if (Math.abs(s - ego.s) < 60 && lane === ego.lane) continue;
        if (this.rng() < (DENSITY[kind] * lanes * 20) / 1000 / lanes) this.spawn(s, lane, false);
      }
      if (lanes === 1 && kind !== 'parking' && kind !== 'ramp' && this.rng() < 0.012)
        this.spawn(s, 0, true);
    }
  }

  /** A car placed at s in a lane at speed v (review poses). */
  spawnAt(s: number, lane: number, v: number, kind: VehicleKind = 'car'): Vehicle {
    const veh = this.spawn(s, lane, false, kind);
    veh.v = v;
    veh.cap = { v, until: s + 2000 };
    return veh;
  }

  /** A car coming along the car-park aisle towards our parking space (cross traffic). */
  spawnCrossing(s: number): void {
    const veh = this.spawn(s, 0, true, 'car');
    veh.v = 12 / 3.6;
  }

  private spawn(s: number, lane: number, oncoming: boolean, kind?: VehicleKind): Vehicle {
    const r = this.rng();
    const k: VehicleKind = kind ?? (r < 0.12 ? 'truck' : r < 0.25 ? 'van' : 'car');
    const legal = this.route.legalAt(s, { wet: false, hour: 12 }).limit;
    const temper = 0.92 + this.rng() * 0.2;
    const freeSpeed = (k === 'truck' ? 85 : 115 + this.rng() * 45) / 3.6;
    const v0 = Math.min(legal !== null ? (legal / 3.6) * temper : freeSpeed, freeSpeed);
    const veh: Vehicle = {
      id: this.nextId++,
      kind: k,
      s,
      lane,
      targetLane: lane,
      v: v0 * (0.85 + this.rng() * 0.15),
      a: 0,
      length: k === 'truck' ? 16 : k === 'van' ? 5.5 : 4.6,
      temper,
      freeSpeed,
      oncoming,
      colour: Math.floor(this.rng() * 6),
      lcTimer: this.rng(),
    };
    this.vehicles.push(veh);
    return veh;
  }

  private desired(v: Vehicle, ctx: TrafficContext): number {
    const legal = ctx.limit(v.s);
    let target = legal !== null ? legal * v.temper : v.freeSpeed;
    if (v.kind === 'truck')
      target = Math.min(target, (legal !== null && legal < 60 / 3.6 ? legal : 80 / 3.6) * 1.0);
    // Slow down for the tightest bend in the next 100 m.
    let k = 0;
    for (let d = 0; d <= 100; d += 10) k = Math.max(k, Math.abs(this.route.curvatureAt(v.s + d)));
    target = Math.min(target, curveSpeed(k));
    if (v.cap && v.s < v.cap.until) target = Math.min(target, v.cap.v);
    return target * ctx.weather;
  }

  /** Nearest vehicle (or the ego car) ahead in `lane`, as [gap m, speed m/s]. */
  leaderOf(
    v: { s: number; lane: number; id?: number },
    ego: EgoState | null,
    lane = v.lane,
  ): [number, number] | null {
    let best: [number, number] | null = null;
    const consider = (s: number, len: number, speed: number): void => {
      const gap = s - len - v.s;
      if (gap > -0.5 && (!best || gap < best[0])) best = [gap, speed];
    };
    for (const o of this.vehicles) {
      if (o.oncoming || o.id === v.id) continue;
      if (Math.abs(o.lane - lane) < 0.6 || Math.abs(o.targetLane - lane) < 0.1)
        consider(o.s, o.length, o.v);
    }
    if (ego && Math.abs(ego.lane - lane) < 0.6) consider(ego.s, ego.length, ego.v);
    return best;
  }

  /** Nearest follower in `lane` behind position s: [gap m, speed m/s]. */
  followerOf(
    s: number,
    lane: number,
    ego: EgoState | null,
    selfId?: number,
  ): [number, number] | null {
    let best: [number, number] | null = null;
    for (const o of this.vehicles) {
      if (o.oncoming || o.id === selfId || Math.abs(o.lane - lane) >= 0.6) continue;
      const gap = s - o.s;
      if (gap >= 0 && (!best || gap < best[0])) best = [gap, o.v];
    }
    if (ego && Math.abs(ego.lane - lane) < 0.6) {
      const gap = s - ego.s;
      if (gap >= 0 && (!best || gap < best[0])) best = [gap, ego.v];
    }
    return best;
  }

  private idm(v: Vehicle, v0: number, leader: [number, number] | null): number {
    const p = v.kind === 'truck' ? TRUCK : IDM;
    let a = p.aMax * (1 - Math.pow(v.v / Math.max(v0, 0.1), p.delta));
    if (leader) {
      const [gap, vl] = leader;
      const sStar =
        p.s0 + Math.max(0, v.v * p.T + (v.v * (v.v - vl)) / (2 * Math.sqrt(p.aMax * p.b)));
      a -= p.aMax * Math.pow(sStar / Math.max(gap, 0.1), 2);
    }
    return clamp(a, -9, p.aMax);
  }

  step(dt: number, ego: EgoState, ctx: TrafficContext): void {
    this.fireEvents(ego, ctx);
    for (const v of this.vehicles) {
      if (v.oncoming) {
        v.s -= v.v * dt;
        continue;
      }
      const v0 = this.desired(v, ctx);
      let leader = this.leaderOf(v, ego);
      if (v.lane !== v.targetLane) {
        // While changing lanes, respect the car ahead in both lanes.
        const other = this.leaderOf(v, ego, v.targetLane);
        if (other && (!leader || other[0] < leader[0])) leader = other;
      }
      for (const line of ctx.stopLines(v.s, v.s + 150)) {
        const gap = line.s - v.s;
        // Stop for red/amber unless too close to stop comfortably.
        if (gap > (v.v * v.v) / (2 * 4) && (!leader || gap < leader[0])) leader = [gap, 0];
      }
      let a = this.idm(v, v0, leader);
      if (v.brakeUntil !== undefined) {
        if (ctx.time < v.brakeUntil) a = Math.min(a, -6.5);
        else v.brakeUntil = undefined;
      }
      v.a = a;
      v.v = Math.max(0, v.v + a * dt);
      v.s += v.v * dt;
      this.laneChange(v, ego, dt, ctx);
    }
    this.recycle(ego);
  }

  /** Keep right, overtake slower vehicles on the left when there's room. */
  private laneChange(v: Vehicle, ego: EgoState, dt: number, ctx: TrafficContext): void {
    const lanes = this.route.lanesAt(v.s);
    if (v.lane !== v.targetLane) {
      const dir = Math.sign(v.targetLane - v.lane);
      v.lane += (dir * dt) / LANE_CHANGE_S;
      if ((dir > 0 && v.lane >= v.targetLane) || (dir < 0 && v.lane <= v.targetLane))
        v.lane = v.targetLane;
      return;
    }
    v.lcTimer += dt;
    if (v.lcTimer < 1) return;
    v.lcTimer = 0;
    // Merge right before a lane drop.
    const lanesSoon = this.route.lanesAt(v.s + 250);
    if (v.lane >= lanesSoon && this.safe(v, v.lane - 1, ego)) {
      v.targetLane = v.lane - 1;
      return;
    }
    if (lanes < 2 || this.route.legalAt(v.s, { wet: false, hour: 12 }).noOvertaking) return;
    const v0 = this.desired(v, ctx);
    const lead = this.leaderOf(v, ego);
    if (
      lead &&
      lead[0] < 80 &&
      lead[1] < v0 - 3 &&
      v.lane + 1 < lanes &&
      this.safe(v, v.lane + 1, ego)
    ) {
      v.targetLane = v.lane + 1;
    } else if (v.lane > 0 && this.safe(v, v.lane - 1, ego)) {
      // Keep right: move back once the right lane is clear for ~5 s of driving.
      const right = this.leaderOf(v, ego, v.lane - 1);
      if (!right || right[0] > Math.max(120, v.v * 5) || right[1] >= v0 - 2)
        v.targetLane = v.lane - 1;
    }
  }

  private safe(v: Vehicle, lane: number, ego: EgoState): boolean {
    // Nobody alongside (with a few metres of margin) in the target lane.
    const inLane = (l: number, t: number): boolean => Math.abs(l - lane) < 0.6 || t === lane;
    const overlaps = (front: number, len: number): boolean =>
      front > v.s - v.length - 8 && front - len < v.s + 8;
    for (const o of this.vehicles) {
      if (o.id !== v.id && !o.oncoming && inLane(o.lane, o.targetLane) && overlaps(o.s, o.length))
        return false;
    }
    if (inLane(ego.lane, ego.lane) && overlaps(ego.s, ego.length)) return false;
    const ahead = this.leaderOf(v, ego, lane);
    const behind = this.followerOf(v.s - v.length, lane, ego, v.id);
    const okAhead = !ahead || ahead[0] > Math.max(15, v.v * 1.0);
    const okBehind = !behind || behind[0] > Math.max(20, (behind[1] - v.v) * 3 + 10);
    return okAhead && okBehind;
  }

  private fireEvents(ego: EgoState, ctx: TrafficContext): void {
    for (const e of this.route.events) {
      if (this.fired.has(e)) continue;
      if (e.kind === 'slowTruck' && ego.s > e.s - 450 && ego.s < e.s) {
        this.fired.add(e);
        const truck = this.spawn(ego.s + 260, 0, false, 'truck');
        truck.v = 60 / 3.6;
        truck.cap = { v: 62 / 3.6, until: e.s + 900 };
      } else if (e.kind === 'queue' && ego.s > e.s - 1600 && ego.s < e.s) {
        this.fired.add(e);
        // A jam: dense, slow traffic in every lane of the affected stretch.
        const len = e.length ?? 600;
        for (let s = e.s; s < e.s + len; s += 14 + this.rng() * 6) {
          for (let lane = 0; lane < this.route.lanesAt(s); lane++) {
            const veh = this.spawn(s + this.rng() * 4, lane, false);
            veh.v = 2 + this.rng() * 4;
            veh.cap = { v: 22 / 3.6, until: e.s + len };
          }
        }
      } else if (e.kind === 'hardBrake' && ego.s > e.s) {
        this.fired.add(e);
        const lead = this.vehicles
          .filter(
            (o) =>
              !o.oncoming && Math.abs(o.lane - ego.lane) < 0.6 && o.s > ego.s && o.s - ego.s < 140,
          )
          .sort((a, b) => a.s - b.s)[0];
        if (lead) lead.brakeUntil = ctx.time + 2.2;
      }
    }
  }

  private recycle(ego: EgoState): void {
    this.vehicles = this.vehicles.filter((v) => {
      if (v.oncoming) return v.s > ego.s - WINDOW_BEHIND && v.s < ego.s + WINDOW_AHEAD + 200;
      return (
        v.s > ego.s - WINDOW_BEHIND && v.s < Math.min(this.route.length, ego.s + WINDOW_AHEAD + 200)
      );
    });
    // Top up to the target density for the road ahead.
    const sAhead = ego.s + WINDOW_AHEAD;
    if (sAhead >= this.route.length - 50) return;
    const kind = this.route.kindAt(sAhead);
    const lanes = this.route.lanesAt(sAhead);
    const wanted = (DENSITY[kind] * lanes * (WINDOW_AHEAD + WINDOW_BEHIND)) / 1000;
    const same = this.vehicles.filter((v) => !v.oncoming).length;
    if (same < wanted && this.rng() < 0.05) {
      const lane = Math.floor(this.rng() * lanes);
      if (!this.vehicles.some((v) => Math.abs(v.s - sAhead) < 40 && Math.abs(v.lane - lane) < 0.6))
        this.spawn(sAhead, lane, false);
    }
    // Faster cars approaching from behind on multi-lane roads (they will overtake).
    if (lanes >= 2 && same < wanted && this.rng() < 0.02) {
      const s = ego.s - WINDOW_BEHIND + 20;
      const lane = Math.min(lanes - 1, 1 + Math.floor(this.rng() * (lanes - 1)));
      if (
        s > 0 &&
        !this.vehicles.some((v) => Math.abs(v.s - s) < 50 && Math.abs(v.lane - lane) < 0.6)
      ) {
        const veh = this.spawn(s, lane, false, 'car');
        veh.v = Math.max(ego.v + 6, veh.v);
        veh.freeSpeed = Math.max(veh.freeSpeed, ego.v + 8);
      }
    }
    // Oncoming traffic on two-way roads.
    if (lanes === 1 && (kind === 'rural' || kind === 'urban') && this.rng() < 0.004) {
      const veh = this.spawn(sAhead, 0, true, this.rng() < 0.2 ? 'truck' : 'car');
      veh.v = ((this.route.legalAt(sAhead, { wet: false, hour: 12 }).limit ?? 100) / 3.6) * 0.95;
    }
  }
}
