import { approach, clamp, createRng, SmoothNoise } from '../math';
import type { VehicleSimulator } from '../datasource/simulator/vehicle';
import type { SceneObject, SceneSnapshot } from './scene';
import { curveSpeed } from './traffic';
import type { World } from './World';

/** Driver model parameters: calm, law-abiding with small human deviations. */
const DRIVER = {
  /** Comfortable acceleration / deceleration, m/s². */
  aMax: 1.5,
  b: 1.8,
  /** Time gap to the car ahead, s ("half the speedometer" rule ≈ 1.8 s). */
  T: 1.7,
  s0: 2.5,
  /** Lateral acceleration accepted in bends, g. */
  lateralG: 0.28,
};

export type DemoPhase = 'startup' | 'reversing' | 'drive' | 'parking' | 'parked';

/** Speed a driver prefers where there's no limit (German Autobahn), km/h. */
const FREE_SPEED = 135;

/**
 * The simulated driver of the Demo drive. Reads the scene like a human would
 * (limits, bends ahead, lights, the car in front) and works the pedals,
 * indicators, gear selector and lane changes. Starts the day by reversing out
 * of a bay and ends it by parking at the destination, then repeats.
 */
export class DemoDriver {
  phase: DemoPhase = 'startup';
  private t = 0;
  private vRef = 0;
  private integral = 0;
  private noise: SmoothNoise;
  private laneTimer = 0;
  private pendingLane: 1 | -1 | 0 = 0;
  private rng: () => number;

  constructor(seed = 9) {
    this.rng = createRng(seed);
    this.noise = new SmoothNoise(this.rng, 1 / 40);
  }

  /** Begin a new day from the starting bay with the ignition off. */
  restart(): void {
    this.phase = 'startup';
    this.t = 0;
    this.vRef = 0;
    this.integral = 0;
  }

  /** Continue driving from wherever the car is (after a takeover or jump). */
  resume(sim: VehicleSimulator): void {
    // The demo driver uses the normal automatic program and centres the stalks.
    if (sim.gearProgram === 'M') sim.setGearProgram('D');
    if (sim.state.selector !== 'D' && sim.state.speedMs < 0.5 && sim.state.ready)
      sim.setSelector('D');
    this.vRef = sim.state.speedMs;
    this.integral = 0.15;
    if (this.phase !== 'drive' && this.phase !== 'parking') this.phase = 'drive';
  }

  update(sim: VehicleSimulator, world: World, scene: SceneSnapshot, dt: number): void {
    this.t += dt;
    switch (this.phase) {
      case 'startup':
        return this.startup(sim, world);
      case 'reversing':
        return this.reverseOut(sim, world, dt);
      case 'parked':
        return this.parked(sim, world);
      default:
        return this.drive(sim, world, scene, dt);
    }
  }

  private hold(sim: VehicleSimulator): void {
    sim.inputs.throttle = 0;
    sim.inputs.brake = 0.4;
  }

  private startup(sim: VehicleSimulator, world: World): void {
    this.hold(sim);
    const s = sim.state;
    if (this.t > 0.6 && s.ignition < 2) sim.setIgnition(2);
    if (this.t > 3.2 && !s.ready && s.ignition === 2) sim.start();
    if (this.t > 6 && s.ready) {
      sim.setSelector(world.ego.inBay ? 'R' : 'D');
      this.phase = world.ego.inBay ? 'reversing' : 'drive';
      this.t = 0;
    }
  }

  private reverseOut(sim: VehicleSimulator, world: World, dt: number): void {
    sim.inputs.leftIndicator = sim.inputs.rightIndicator = false;
    if (world.ego.inBay) {
      // Walking pace (~4 km/h) backwards out of the bay.
      const target = 1.15;
      this.pedalsFor(sim, target, (target - sim.state.speedMs) * 1.2, dt);
      return;
    }
    this.hold(sim);
    if (sim.state.speedMs < 0.05 && this.t > 0.5) {
      sim.setSelector('D');
      this.phase = 'drive';
      this.t = 0;
      this.vRef = 0;
    }
  }

  private parked(sim: VehicleSimulator, world: World): void {
    this.hold(sim);
    if (this.t > 1 && sim.state.selector !== 'P') sim.setSelector('P');
    if (this.t > 3 && sim.state.ignition >= 2) sim.setIgnition(0);
    // The trip summary shows for a while; then a new day starts in the first car park.
    if (this.t > 14) {
      world.resetToStart();
      this.restart();
    }
  }

  /** Target speed from the law, the road ahead and the weather (m/s). */
  targetSpeed(world: World, scene: SceneSnapshot): number {
    const route = world.route;
    const s = scene.ego.s;
    const env = scene.env;
    const kind = scene.road.kind;
    // Humans drive a little around the limit: a slow personal drift of ±3 %, slightly above in rural areas.
    const bias = kind === 'rural' ? 1.04 : kind === 'motorway' ? 1.01 : 1.02;
    const drift = 1 + this.noise.next(0) * 0.03;
    const legal = scene.legal.limit;
    let v = ((legal ?? FREE_SPEED) / 3.6) * bias * drift;
    if (env.surface === 'icy') v = Math.min(v * 0.55, 50 / 3.6);
    else if (env.wet) v *= 0.9;
    if (env.weather === 'fog') v = Math.min(v, 60 / 3.6);
    const lateralG = env.surface === 'icy' ? 0.12 : env.wet ? 0.22 : DRIVER.lateralG;
    // Anticipate bends and lower limits ahead: v_allowed = sqrt(v_target² + 2·b·distance).
    const horizon = Math.max(80, (v * v) / (2 * DRIVER.b) + 60);
    for (let d = 0; d <= horizon; d += 8) {
      const vc = curveSpeed(route.curvatureAt(s + d), lateralG);
      v = Math.min(v, Math.sqrt(vc * vc + 2 * DRIVER.b * d));
    }
    for (let d = 25; d <= 350; d += 25) {
      const l = route.legalAt(s + d, { wet: env.wet, hour: env.hour }).limit;
      if (l !== null)
        v = Math.min(v, Math.sqrt((l / 3.6) ** 2 + 2 * DRIVER.b * 0.8 * Math.max(0, d - 30)));
    }
    return v;
  }

  /** IDM acceleration towards v0, behind a leader at `gap` with speed `vl`. */
  private idm(v: number, v0: number, gap: number | null, vl = 0): number {
    let a = DRIVER.aMax * (1 - Math.pow(v / Math.max(v0, 0.3), 4));
    if (gap !== null) {
      const sStar =
        DRIVER.s0 +
        Math.max(0, v * DRIVER.T + (v * (v - vl)) / (2 * Math.sqrt(DRIVER.aMax * DRIVER.b)));
      a -= DRIVER.aMax * Math.pow(sStar / Math.max(gap, 0.1), 2);
    }
    return a;
  }

  private drive(sim: VehicleSimulator, world: World, scene: SceneSnapshot, dt: number): void {
    const v = sim.state.speedMs;
    const s = scene.ego.s;
    const toEnd = world.route.length - s;
    if (toEnd < 90) this.phase = 'parking';
    let v0 = this.targetSpeed(world, scene);
    let a = this.idm(v, v0, null);
    if (scene.lead) a = Math.min(a, this.idm(v, v0, scene.lead.dx, scene.lead.v));
    const light = scene.trafficLight;
    // Stop at red; at amber only if there's room to stop comfortably.
    if (light && light.state !== 'green') {
      const stopGap = light.distance - 3;
      const canStop = stopGap > (v * v) / (2 * 4);
      if (light.state !== 'amber' || canStop)
        a = Math.min(a, this.idm(v, v0, Math.max(0.1, stopGap), 0));
    }
    if (this.phase === 'parking') {
      // Creep into the bay and stop ~30 cm from the wall.
      // Car-following keeps metres of gap; parking creeps up to the wall instead:
      // the speed that still lets us stop at 0.3 m with a gentle 0.8 m/s².
      const gap = (scene.obstacleAhead ?? toEnd) - 0.3;
      v0 = Math.min(v0, 8 / 3.6, Math.sqrt(2 * 0.8 * Math.max(0, gap)));
      a = Math.min(a, (v0 - v) * 1.5);
      if (gap < 0.1 && v < 0.2) {
        this.phase = 'parked';
        this.t = 0;
      }
    }
    this.pedalsFor(sim, v0, a, dt);
    this.signalAndLanes(sim, world, scene, v0, dt);
  }

  /**
   * Turn the wanted acceleration into pedal positions: a speed reference that
   * integrates the acceleration, tracked by a PI controller (like a driver
   * pressing a bit more until the car does what they want).
   */
  private pedalsFor(sim: VehicleSimulator, v0: number, aWanted: number, dt: number): void {
    const v = sim.state.speedMs;
    const a = clamp(aWanted, -8, 2.5);
    this.vRef = clamp(this.vRef + a * dt, 0, Math.max(v0, 0) + 0.5);
    if (Math.abs(this.vRef - v) > 4) this.vRef = v + Math.sign(this.vRef - v) * 4;
    const err = this.vRef - v;
    let throttle = 0;
    let brake = 0;
    if (this.vRef < 0.05 && v < 1) {
      // Hold firmly at (or just before) standstill: automatic gearboxes creep.
      brake = 0.4;
      this.integral = Math.max(0, this.integral - dt);
    } else if (a < -0.6 || err < -0.6) {
      brake = clamp(Math.max(0, -a) / 10 + Math.max(0, -err - 0.3) * 0.08, 0, 1);
      this.integral = Math.max(0, this.integral - dt * 0.5);
    } else {
      this.integral = clamp(this.integral + err * dt * 0.06, 0, 0.7);
      throttle = clamp(this.integral + err * 0.18 + Math.max(0, a) * 0.08, 0, 1);
    }
    const s = sim.inputs;
    s.throttle += (throttle - s.throttle) * approach(dt, 0.12);
    s.brake += (brake - s.brake) * approach(dt, 0.08);
  }

  private signalAndLanes(
    sim: VehicleSimulator,
    world: World,
    scene: SceneSnapshot,
    v0: number,
    dt: number,
  ): void {
    const s = scene.ego.s;
    const nav = scene.nav;
    let indicator: 'left' | 'right' | null = null;
    const m = nav.current;
    if (m) {
      const d = nav.distance;
      if ((m.kind === 'turnLeft' || m.kind === 'turnRight') && d < 90)
        indicator = m.kind === 'turnLeft' ? 'left' : 'right';
      if (m.kind === 'exit' && d < 350) indicator = 'right';
      if (m.kind === 'join' && scene.road.kind === 'ramp' && d < 1) indicator = null;
    }
    // Roundabout: signal right only when leaving it.
    for (const f of world.route.features) {
      if (f.kind === 'roundabout' && s > f.s + 30 && s < f.s + 50) indicator = 'right';
      if (f.kind === 'motorwayJoin') {
        const seg = world.route.segmentAt(f.s);
        const end = seg.s0 + seg.length;
        if (s > end - 220 && s < end + 40) indicator = 'left';
      }
    }
    // Lane changes on multi-lane roads.
    this.laneTimer = Math.max(0, this.laneTimer - dt);
    if (this.pendingLane !== 0) {
      indicator = this.pendingLane > 0 ? 'left' : 'right';
      if (this.laneTimer === 0) {
        world.changeLane(this.pendingLane);
        this.pendingLane = 0;
        this.laneTimer = 5;
      }
    } else if (
      this.laneTimer === 0 &&
      scene.ego.lanes >= 2 &&
      scene.ego.lane === Math.round(scene.ego.lane)
    ) {
      const want = this.laneDecision(world, scene, v0);
      if (want !== 0) {
        this.pendingLane = want;
        this.laneTimer = 2.5; // signal before moving over
      }
    }
    if (scene.ego.lane !== world.ego.targetLane)
      indicator = world.ego.targetLane > scene.ego.lane ? 'left' : 'right';
    sim.inputs.leftIndicator = indicator === 'left';
    sim.inputs.rightIndicator = indicator === 'right';
  }

  /** +1 = move left (overtake), −1 = move right (keep right / exit / lane ends). */
  private laneDecision(world: World, scene: SceneSnapshot, v0: number): 1 | -1 | 0 {
    const s = scene.ego.s;
    const lane = scene.ego.lane;
    const route = world.route;
    const exit = scene.nav.current?.kind === 'exit' ? scene.nav.distance : Infinity;
    const lanesSoon = route.lanesAt(s + 400);
    const free = (offset: number): boolean =>
      !scene.objects.some(
        (o: SceneObject) =>
          !o.oncoming &&
          Math.abs(o.laneOffset - offset) < 0.6 &&
          ((o.dx > -o.length - 12 && o.dx < 45) ||
            (o.dx < 0 && o.dx > -90 && o.v > world.ego.v + 4)),
      );
    if ((exit < 1500 || lane >= lanesSoon) && lane > 0) return free(-1) ? -1 : 0;
    if (exit < 1500) return 0;
    const lead = scene.lead;
    const slowLead = lead && lead.dx < 90 && lead.v < v0 - 2.5;
    if (slowLead && lane + 1 < scene.ego.lanes && !scene.legal.noOvertaking && free(1)) return 1;
    if (lane > 0 && free(-1)) {
      // Back to the right once the right lane is clear for a good distance.
      const rightLead = scene.objects.find(
        (o) => !o.oncoming && Math.abs(o.laneOffset + 1) < 0.6 && o.dx > 0 && o.dx < 160,
      );
      if (!rightLead || rightLead.v >= v0 - 1) return -1;
    }
    return 0;
  }
}
