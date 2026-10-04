import { PedalController } from '../assist/PedalController';
import type { SpeedAssist } from '../assist/SpeedAssist';
import { createRng, SmoothNoise } from '../math';
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
  private pedals = new PedalController();
  private assist: SpeedAssist | null = null;
  /** Workshop "distracted driver": looks at the phone, glances at the road now and then. */
  distracted = false;
  private glanceT = 0;
  private seenLead: { dx: number; v: number; t: number } | null = null;
  /** Seconds since the last button press on the cruise pad (humans don't press instantly). */
  private accT = 0;
  private onAcc = false;
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
    this.pedals.reset(0, 0);
  }

  /** Continue driving from wherever the car is (after a takeover or jump). */
  resume(sim: VehicleSimulator): void {
    // The demo driver uses the normal automatic program and centres the stalks.
    if (sim.gearProgram === 'M') sim.setGearProgram('D');
    if (sim.state.selector !== 'D' && sim.state.speedMs < 0.5 && sim.state.ready)
      sim.setSelector('D');
    this.pedals.reset(sim.state.speedMs, 0.15);
    this.pedals.out.throttle = sim.inputs.throttle;
    this.pedals.out.brake = sim.inputs.brake;
    if (this.phase !== 'drive' && this.phase !== 'parking') this.phase = 'drive';
  }

  update(
    sim: VehicleSimulator,
    world: World,
    scene: SceneSnapshot,
    dt: number,
    assist?: SpeedAssist,
  ): void {
    this.t += dt;
    this.assist = assist ?? null;
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
    sim.inputs.throttle = this.pedals.out.throttle = 0;
    sim.inputs.brake = this.pedals.out.brake = 0.4;
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
      this.pedals.reset(0, 0);
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
    const lead = this.perceivedLead(scene, v, dt);
    if (lead) a = Math.min(a, this.idm(v, v0, lead.dx, lead.v));
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
    if (this.useAcc(sim, scene, v0, a, dt)) {
      // ACC drives; feet off the pedals.
      sim.inputs.throttle = 0;
      sim.inputs.brake = 0;
      this.pedals.out.throttle = this.pedals.out.brake = 0;
    } else this.pedalsFor(sim, v0, a, dt);
    this.signalAndLanes(sim, world, scene, v0, dt);
  }

  /**
   * What the driver believes about the car ahead. Attentive: what is there.
   * Distracted: looks up for 0.6 s every 2.5 s; in between assumes the car
   * ahead kept its speed, so a sudden brake goes unnoticed until the next glance.
   */
  private perceivedLead(
    scene: SceneSnapshot,
    v: number,
    dt: number,
  ): { dx: number; v: number } | null {
    const lead = scene.lead;
    if (!this.distracted) {
      this.seenLead = lead ? { dx: lead.dx, v: lead.v, t: 0 } : null;
      return lead;
    }
    this.glanceT = (this.glanceT + dt) % 2.5;
    if (this.glanceT < 0.6) {
      this.seenLead = lead ? { dx: lead.dx, v: lead.v, t: 0 } : null;
      return lead;
    }
    const seen = this.seenLead;
    if (!seen) return null;
    seen.t += dt;
    seen.dx += (seen.v - v) * dt;
    return { dx: seen.dx, v: seen.v };
  }

  /**
   * On the Autobahn the demo driver uses ACC like most people do: switch on,
   * SET once above 60 km/h, adjust the set speed for limits, cancel
   * before the exit, and brake themselves if ACC asks them to take over.
   * Returns true while ACC is driving.
   */
  private useAcc(
    sim: VehicleSimulator,
    scene: SceneSnapshot,
    v0: number,
    a: number,
    dt: number,
  ): boolean {
    const acc = this.assist;
    if (!acc || acc.fn === 'limiter') return false;
    this.accT += dt;
    const v = sim.state.speedMs;
    const exit = scene.nav.current?.kind === 'exit' ? scene.nav.distance : Infinity;
    const wanted = scene.road.kind === 'motorway' && exit > 1500 && this.phase === 'drive';
    const engaged = acc.state === 'active' || acc.state === 'overridden' || acc.state === 'hold';
    if (!wanted) {
      if (engaged) acc.cancel();
      if (this.onAcc) this.pedals.reset(v, 0.15);
      this.onAcc = false;
      return false;
    }
    // Take-over request or the driver's own judgement says brake harder: intervene.
    if (engaged && (acc.out.takeover || a < -3.5)) {
      acc.cancel();
      this.accT = 0;
      this.pedals.reset(v, 0);
      this.onAcc = false;
      return false;
    }
    const setKmh = Math.round(v0 * 3.6);
    if (engaged) {
      // Nudge the set speed to the limit/conditions ahead (RES+/SET− presses).
      if (acc.setKmh !== null && Math.abs(acc.setKmh - setKmh) >= 3 && this.accT > 1) {
        acc.setSpeed(setKmh);
        this.accT = 0;
      }
      this.onAcc = true;
      return true;
    }
    if (v * 3.6 > 60 && this.accT > 1.2) {
      if (acc.state === 'off') acc.pressMain();
      else {
        acc.pressSet(false, v * 3.6);
        acc.setSpeed(setKmh);
      }
      this.accT = 0;
    }
    if (this.onAcc) this.pedals.reset(v, 0.15);
    this.onAcc = false;
    return false;
  }

  /** Work the pedals to get the wanted acceleration (see PedalController). */
  private pedalsFor(sim: VehicleSimulator, v0: number, aWanted: number, dt: number): void {
    const p = this.pedals.update(sim.state.speedMs, v0, aWanted, dt);
    sim.inputs.throttle = p.throttle;
    sim.inputs.brake = p.brake;
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
