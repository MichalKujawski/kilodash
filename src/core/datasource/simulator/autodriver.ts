import { approach, clamp } from '../../math';
import type { VehicleSimulator } from './vehicle';

export type DriverAction = 'ignitionOn' | 'ignitionOff' | 'start' | 'belt' | 'unbelt';

export interface DriveSegment {
  /** Target speed, km/h. */
  targetKmh: number;
  /** Max throttle (and braking keenness) used to reach the target, 0..1. */
  aggression?: number;
  /** Seconds to hold once the target is reached. */
  holdS?: number;
  indicator?: 'left' | 'right' | 'hazard';
  /** Road curvature during this segment, 1/m (positive = right). */
  curvature?: number;
  gradient?: number;
  /** Engage cruise control once at target. */
  cruise?: boolean;
  highBeam?: boolean;
  /** One-off driver action at the start of the segment. */
  action?: DriverAction;
}

/** A short mixed loop: city pull-away, a stop, a highway run with an overtake. */
export const DEMO_LOOP: DriveSegment[] = [
  { targetKmh: 50, aggression: 0.45, holdS: 6 },
  { targetKmh: 0, aggression: 0.5, holdS: 3, indicator: 'right' },
  { targetKmh: 90, aggression: 0.75, holdS: 5 },
  { targetKmh: 125, aggression: 0.6, holdS: 6 },
  { targetKmh: 150, aggression: 1, holdS: 4, indicator: 'left' },
  { targetKmh: 120, aggression: 0.4, holdS: 5, indicator: 'right' },
  { targetKmh: 60, aggression: 0.4, holdS: 5 },
  { targetKmh: 0, aggression: 0.6, holdS: 4 },
];

/**
 * PI "virtual driver" following a list of segments: speed targets, bends,
 * gradients, indicators, cruise control, lights and key/belt actions. With
 * `paddles` it shifts manually like a track driver (upshift at the shift light,
 * rev-matched downshifts while braking).
 */
export class AutoDriver {
  private index = 0;
  private holdTimer = 0;
  private integral = 0.1;
  private throttle = 0;
  private brake = 0;
  private started = false;
  /** Set when the last segment completed (for attract-mode cycling). */
  completedLoops = 0;
  paddles = false;
  private shiftGap = 0;

  constructor(private segments: DriveSegment[] = DEMO_LOOP) {}

  get segment(): DriveSegment {
    return this.segments[this.index]!;
  }

  get progress(): { index: number; count: number } {
    return { index: this.index, count: this.segments.length };
  }

  private advance(): void {
    this.index = (this.index + 1) % this.segments.length;
    if (this.index === 0) this.completedLoops++;
    this.holdTimer = 0;
    this.started = false;
  }

  update(sim: VehicleSimulator, dt: number): void {
    const seg = this.segment;
    if (!this.started) {
      this.started = true;
      this.begin(sim, seg);
    }
    const v = sim.speedKmh;
    const err = seg.targetKmh - v;
    const reached = seg.action
      ? true
      : seg.targetKmh === 0
        ? v < 0.5
        : Math.abs(err) < 3 || (this.paddles && err < 0 && err > -8);

    if (reached) {
      this.holdTimer += dt;
      if (seg.cruise && !sim.state.cruiseActive && this.holdTimer > 1)
        sim.setCruise(true, seg.targetKmh);
      if (this.holdTimer >= (seg.holdS ?? 0)) this.advance();
    }

    const aggr = seg.aggression ?? 0.5;
    let throttle = 0;
    let brake = 0;
    if (!sim.state.ready || seg.action) {
      brake = v > 0.5 ? 0.4 : 0.25;
    } else if (seg.targetKmh === 0) {
      // Smooth stop: brake harder as speed increases, light hold at standstill.
      brake = v > 0.5 ? clamp(0.12 + v * 0.006 * (aggr + 0.5), 0, 0.75) : 0.3;
      this.integral = 0.08;
    } else if (err < -5) {
      brake = clamp(-err * 0.012 * (1 + aggr * 2.5), 0, aggr > 0.9 ? 1 : 0.5);
    } else if (sim.state.cruiseActive) {
      throttle = 0; // cruise control holds speed
    } else {
      this.integral = clamp(this.integral + err * dt * 0.006, 0, 0.6);
      throttle = clamp(this.integral + err * 0.035, 0, aggr);
      if (this.paddles && err > 10) throttle = aggr;
    }

    this.throttle += (throttle - this.throttle) * approach(dt, this.paddles ? 0.08 : 0.35);
    this.brake += (brake - this.brake) * approach(dt, this.paddles ? 0.08 : 0.2);
    sim.inputs.throttle = this.throttle;
    sim.inputs.brake = this.brake;
    sim.inputs.curvature = seg.curvature ?? 0;
    sim.inputs.gradient = seg.gradient ?? 0;

    // Indicate before and during the manoeuvre, like a real driver.
    const signalling = seg.indicator !== undefined && this.holdTimer < 4;
    sim.inputs.leftIndicator = signalling && seg.indicator === 'left';
    sim.inputs.rightIndicator = signalling && seg.indicator === 'right';
    sim.body.hazard = signalling && seg.indicator === 'hazard';
    // High beam is a wish: the car only allows it while the low beam is on.
    if (seg.highBeam !== undefined) sim.body.highBeam = seg.highBeam && sim.body.lowBeam;

    this.shiftGap = Math.max(0, this.shiftGap - dt);
    if (this.paddles && this.shiftGap === 0) this.shiftLikeADriver(sim);
  }

  private begin(sim: VehicleSimulator, seg: DriveSegment): void {
    if (!seg.cruise && sim.state.cruiseActive) sim.setCruise(false);
    switch (seg.action) {
      case 'ignitionOn':
        sim.setIgnition(2);
        break;
      case 'ignitionOff':
        sim.setIgnition(0);
        break;
      case 'start':
        sim.start();
        break;
      case 'belt':
        sim.body.seatbelt = true;
        break;
      case 'unbelt':
        sim.body.seatbelt = false;
        break;
    }
  }

  private shiftLikeADriver(sim: VehicleSimulator): void {
    const s = sim.state;
    const e = sim.profile.engine;
    if (!e || !s.ready) return;
    if (sim.mode !== 'manual') sim.setMode('manual');
    if (s.shiftRecommended && s.rpm > e.redlineRpm - 150) {
      sim.shiftUp();
      this.shiftGap = 0.3;
      return;
    }
    // Downshift under braking while the lower gear stays well below redline.
    if (s.brake > 0.2 && s.gear > 1) {
      const p = sim.profile;
      const lower =
        (s.speedMs / (2 * Math.PI * p.wheelRadiusM)) *
        60 *
        p.gearRatios[s.gear - 2]! *
        p.finalDrive;
      if (lower < e.redlineRpm - 1200) {
        sim.shiftDown();
        this.shiftGap = 0.45;
      }
    }
  }
}
