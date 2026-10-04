import type { ParkDistances } from '../body/ParkAssist';
import { createRng, SmoothNoise } from '../math';
import { Environment, type EnvironmentSettings } from './environment';
import { Navigation } from './navigation';
import { Route, type Pose } from './route';
import type { LightState, SceneObject, SceneSnapshot } from './scene';
import { DEMO_ROUTE } from './template';
import { Traffic, type EgoState, type StopLine } from './traffic';
import type { Feature, Sign } from './types';

/** Traffic light cycle (s): green, amber, red, red+amber (German sequence). */
const CYCLE = { green: 22, amber: 3, red: 20, redAmber: 1.5 };
const CYCLE_LEN = CYCLE.green + CYCLE.amber + CYCLE.red + CYCLE.redAmber;
export const LANE_WIDTH = 3.5;
const EGO_LENGTH = 4.6;
/** Objects reported to the car's sensors within this range, m. */
const SENSOR_RANGE = 200;

export function lightState(f: Feature, time: number): LightState {
  const t = (((time + (f.phase ?? 0)) % CYCLE_LEN) + CYCLE_LEN) % CYCLE_LEN;
  if (t < CYCLE.green) return 'green';
  if (t < CYCLE.green + CYCLE.amber) return 'amber';
  if (t < CYCLE.green + CYCLE.amber + CYCLE.red) return 'red';
  return 'redAmber';
}

export interface Ego {
  s: number;
  lane: number;
  targetLane: number;
  direction: 1 | -1;
  /** Starting bay: metres from the cusp (0 = on the route). */
  bayPos: number;
  inBay: boolean;
  v: number;
  /** Lateral offset from the lane centre, m (+ = left), and its rate, m/s. */
  lat: number;
  latV: number;
}

/**
 * The continuous world the car drives through: one route with signs, lights
 * and junctions; traffic; time of day, weather and road surface; and the ego
 * car's place in it. Produces a `SceneSnapshot` for assist systems, navigation
 * and the cluster.
 */
export class World {
  readonly route: Route;
  readonly env: Environment;
  readonly traffic: Traffic;
  readonly nav: Navigation;
  readonly bayLength: number;
  time = 0;
  ego: Ego;
  private lights: Feature[];
  private recentSigns: { sign: Sign; t: number }[] = [];
  private gust: SmoothNoise;
  /** The car-park cross-traffic car has been sent (once per departure). */
  private crossingSent = false;

  constructor(options: { seed?: number; env?: Partial<EnvironmentSettings> } = {}) {
    this.route = new Route(DEMO_ROUTE);
    this.env = new Environment(options.env);
    this.traffic = new Traffic(this.route, options.seed ?? 5);
    this.gust = new SmoothNoise(createRng((options.seed ?? 5) + 3), 0.3);
    this.nav = new Navigation(this.route);
    this.lights = this.route.features.filter((f) => f.kind === 'trafficLight');
    const bay = this.route.startBay;
    let len = 0;
    for (let i = 1; i < bay.length; i++)
      len += Math.hypot(bay[i]!.x - bay[i - 1]!.x, bay[i]!.y - bay[i - 1]!.y);
    this.bayLength = len;
    this.ego = {
      s: 0,
      lane: 0,
      targetLane: 0,
      direction: 1,
      bayPos: len,
      inBay: true,
      v: 0,
      lat: 0,
      latV: 0,
    };
    this.traffic.populate(this.egoState());
  }

  egoState(): EgoState {
    return { s: this.ego.s, lane: this.ego.lane, v: this.ego.v, length: EGO_LENGTH };
  }

  /** Start of a new day: parked in the starting bay, facing the wall. */
  resetToStart(): void {
    this.ego = {
      ...this.ego,
      s: 0,
      lane: 0,
      targetLane: 0,
      bayPos: this.bayLength,
      inBay: true,
      direction: 1,
      v: 0,
      lat: 0,
      latV: 0,
    };
    this.recentSigns = [];
    this.crossingSent = false;
    this.traffic.populate(this.egoState());
  }

  /** Put the car somewhere on the route (demo jumps, screenshots). */
  jumpTo(s: number, lane = 0): void {
    this.ego = {
      ...this.ego,
      s,
      lane,
      targetLane: lane,
      inBay: false,
      bayPos: 0,
      direction: 1,
      lat: 0,
      latV: 0,
    };
    this.recentSigns = [];
    this.traffic.populate(this.egoState());
  }

  /** Request a lane change (driver steering); ignored if the lane doesn't exist. */
  changeLane(dir: 1 | -1): void {
    const target = this.ego.targetLane + dir;
    if (target >= 0 && target < this.route.lanesAt(this.ego.s)) this.ego.targetLane = target;
  }

  /** Path curvature the car is following right now (1/m). */
  curvature(): number {
    if (this.ego.inBay) return this.ego.bayPos < this.bayLength - 3 ? -1 / 5 : 0;
    return this.route.curvatureAt(this.ego.s);
  }

  gradient(): number {
    return this.ego.inBay ? 0 : this.route.gradientAt(this.ego.s);
  }

  stopLines(s0: number, s1: number): StopLine[] {
    return this.lights
      .filter((f) => f.s > s0 && f.s <= s1 && lightState(f, this.time) !== 'green')
      .map((f) => ({ s: f.s - 3 }));
  }

  /**
   * Advance the world by dt with the ego car moving at `speed` (m/s) in
   * `direction`; `steer` is the lateral acceleration from the driver and the
   * lane assist (m/s², + = left).
   */
  step(dt: number, speed: number, direction: 1 | -1, steer = 0): void {
    this.time += dt;
    const e = this.ego;
    this.stepLateral(dt, speed, steer);
    // As we start reversing out of the bay, a car comes along the aisle.
    if (e.inBay && direction === -1 && speed > 0.3 && !this.crossingSent) {
      this.crossingSent = true;
      this.traffic.spawnCrossing(24);
    }
    e.v = speed;
    e.direction = direction;
    const before = e.s;
    if (e.inBay) {
      e.bayPos = Math.min(this.bayLength, e.bayPos + direction * speed * dt);
      if (e.bayPos <= 0) {
        e.inBay = false;
        e.bayPos = 0;
      }
    } else {
      e.s = Math.max(0, Math.min(this.route.length, e.s + direction * speed * dt));
    }
    // Lane changes take about 4 s.
    const lanes = this.route.lanesAt(e.s);
    if (e.targetLane >= lanes) e.targetLane = lanes - 1;
    if (e.lane !== e.targetLane) {
      const dir = Math.sign(e.targetLane - e.lane);
      e.lane += (dir * dt) / 4;
      if ((dir > 0 && e.lane >= e.targetLane) || (dir < 0 && e.lane <= e.targetLane))
        e.lane = e.targetLane;
    }
    for (const sign of this.route.signs)
      if (sign.s > before && sign.s <= e.s) this.recentSigns.push({ sign, t: this.time });
    this.recentSigns = this.recentSigns.filter((r) => this.time - r.t < 3);

    this.env.step(dt, !e.inBay && this.route.inTunnel(e.s));
    const ctx = { wet: this.env.wet, hour: this.env.hour };
    const weather =
      this.env.surface === 'icy'
        ? 0.6
        : this.env.wet
          ? 0.92
          : this.env.settings.weather === 'fog'
            ? 0.7
            : 1;
    this.traffic.step(dt, this.egoState(), {
      time: this.time,
      weather,
      limit: (s) => {
        const l = this.route.legalAt(s, ctx).limit;
        return l === null ? null : l / 3.6;
      },
      stopLines: (s0, s1) => this.stopLines(s0, s1),
    });
  }

  /**
   * Lateral motion in the lane. Without steering the car drifts: road camber
   * pulls it right, bends push it outwards, gusts nudge it. Driver and lane
   * assist steer against that. At the line the wheels run onto the rumble
   * strip and the car is held there (the simulator has no road edge crash).
   */
  private stepLateral(dt: number, speed: number, steer: number): void {
    const e = this.ego;
    if (e.inBay || speed < 1.5) {
      e.lat *= Math.max(0, 1 - dt * 2);
      e.latV = 0;
      return;
    }
    const gust = this.gust.next(dt) * 0.12;
    const camber = -0.06;
    const bend = 0.05 * speed * speed * this.route.curvatureAt(e.s);
    e.latV += (steer + camber + bend + gust) * dt;
    e.latV -= e.latV * 0.15 * dt;
    e.lat += e.latV * dt;
    if (Math.abs(e.lat) > 1.6) {
      e.lat = Math.sign(e.lat) * 1.6;
      e.latV = 0;
    }
  }

  /** Ego pose on the map: in the bay, or on its lane. */
  egoPose(): Pose & { lateral: number } {
    const e = this.ego;
    if (e.inBay) {
      const bay = this.route.startBay;
      let left = e.bayPos;
      for (let i = 1; i < bay.length; i++) {
        const a = bay[i - 1]!;
        const b = bay[i]!;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        if (left <= d || i === bay.length - 1) {
          const t = Math.min(1, left / d);
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            heading: a.heading + (b.heading - a.heading) * t,
            lateral: 0,
          };
        }
        left -= d;
      }
    }
    const p = this.route.pointAt(e.s);
    const off = this.laneOffset(e.s, e.lane) - e.lat;
    return {
      x: p.x - Math.sin(p.heading) * off,
      y: p.y + Math.cos(p.heading) * off,
      heading: p.heading,
      lateral: e.lat,
    };
  }

  /**
   * Ultrasonic park-sensor view: cars parked beside us and the kerb ahead in
   * the starting bay, the wall and neighbours in the destination bay, a car
   * crossing behind, and close traffic in front/behind at walking pace.
   */
  private parkDistances(objects: SceneObject[]): ParkDistances {
    const e = this.ego;
    const d: ParkDistances = {
      front: [null, null, null],
      rear: [null, null, null],
      left: null,
      right: null,
    };
    const set = (arr: (number | null)[], k: number, v: number): void => {
      if (v < 2.5 && (arr[k] === null || v < arr[k]!)) arr[k] = Math.max(0.05, v);
    };
    if (e.inBay) {
      // Parked cars on both sides while we're between them, the kerb ahead.
      if (e.bayPos > 2) {
        d.left = 0.55;
        d.right = 0.62;
      }
      const kerb = this.bayLength + 0.6 - e.bayPos;
      set(d.front, 1, kerb);
      set(d.front, 0, kerb + 0.15);
      set(d.front, 2, kerb + 0.15);
      // A car on the aisle passing behind us.
      for (const v of this.traffic.vehicles) {
        if (!v.oncoming || Math.abs(v.s) > 6) continue;
        const gap = 0.9 + (this.bayLength - e.bayPos) * 0.1 + Math.abs(v.s) * 0.35;
        set(d.rear, 1, gap);
        set(d.rear, v.s > 0 ? 2 : 0, gap - 0.2);
      }
      return d;
    }
    const toEnd = this.route.length - e.s;
    if (toEnd < 14) {
      d.left = 0.6;
      d.right = 0.65;
      set(d.front, 1, toEnd - 0.2);
      set(d.front, 0, toEnd - 0.05);
      set(d.front, 2, toEnd - 0.05);
    }
    // Close traffic at walking pace (queues, junctions).
    for (const o of objects) {
      if (o.oncoming || Math.abs(o.laneOffset) > 0.5) continue;
      if (o.dx >= 0) set(d.front, 1, o.dx);
      else set(d.rear, 1, -(o.dx + o.length) - EGO_LENGTH);
    }
    return d;
  }

  /** Distance of a lane's centre to the right of the road centre line, m. */
  laneOffset(s: number, lane: number): number {
    const kind = this.route.kindAt(s);
    const lanes = this.route.segmentAt(s).lanes;
    if (kind === 'motorway') return 1.2 + (lanes - 1 - lane + 0.5) * LANE_WIDTH;
    if (kind === 'parking') return 0;
    return (lanes - 1 - lane + 0.5) * LANE_WIDTH;
  }

  snapshot(): SceneSnapshot {
    const e = this.ego;
    const pose = this.egoPose();
    const p = this.route.pointAt(e.s);
    const seg = this.route.segmentAt(e.s);
    const ctx = { wet: this.env.wet, hour: this.env.hour };
    const objects: SceneObject[] = [];
    for (const v of this.traffic.vehicles) {
      const dx = v.oncoming ? v.s - e.s : v.s - v.length - e.s;
      const front = v.oncoming ? dx : v.s - e.s + EGO_LENGTH;
      if (Math.abs(dx) > SENSOR_RANGE && Math.abs(front) > SENSOR_RANGE) continue;
      objects.push({
        id: v.id,
        kind: v.kind,
        dx: e.inBay ? dx + 50 : dx,
        laneOffset: v.oncoming ? 1 : v.lane - e.lane,
        v: v.v,
        a: v.a,
        braking: v.a < -1,
        oncoming: v.oncoming,
        length: v.length,
      });
    }
    const lead =
      objects
        .filter((o) => !o.oncoming && Math.abs(o.laneOffset) < 0.5 && o.dx > -1)
        .sort((a, b) => a.dx - b.dx)[0] ?? null;
    const light = this.lights.find((f) => f.s > e.s && f.s - e.s < 250);
    const toEnd = this.route.length - e.s;
    const obstacleAhead = e.inBay
      ? Math.max(0, this.bayLength + 0.3 - e.bayPos)
      : toEnd < 30
        ? Math.max(0, toEnd - 0.2)
        : null;
    return {
      route: this.route,
      time: this.time,
      ego: {
        s: e.s,
        lane: e.lane,
        lanes: this.route.lanesAt(e.s),
        x: pose.x,
        y: pose.y,
        heading: pose.heading,
        lateral: e.lat,
        lateralV: e.latV,
        direction: e.direction,
        inBay: e.inBay,
      },
      road: {
        kind: seg.kind,
        name: seg.name,
        town: this.route.townAt(e.s),
        curvature: this.curvature(),
        gradient: this.gradient(),
        elevation: p.elevation,
        inTunnel: this.route.inTunnel(e.s),
      },
      legal: this.route.legalAt(e.s, ctx),
      passedSigns: this.recentSigns.map((r) => r.sign),
      objects,
      lead,
      trafficLight: light ? { distance: light.s - e.s, state: lightState(light, this.time) } : null,
      obstacleAhead,
      obstacleBehind: null,
      park: this.parkDistances(objects),
      crossTraffic:
        e.inBay && e.direction === -1
          ? this.traffic.vehicles
              .filter((v) => v.oncoming && v.s > 0 && v.s < 50)
              .map((v) => ({ distance: Math.max(0, v.s - 2), speed: v.v }))
          : [],
      nav: this.nav.state(e.s),
      env: {
        hour: this.env.hour,
        weather: this.env.settings.weather,
        temperatureC: this.env.settings.temperatureC,
        surface: this.env.surface,
        light: this.env.light,
        rain: this.env.rain,
        wet: this.env.wet,
      },
    };
  }
}
