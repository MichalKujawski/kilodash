import { clamp } from '../math';
import { PedalController, type Pedals } from './PedalController';

/** Adaptive cruise (follows a lead car), plain cruise control, or speed limiter. */
export type AssistFunction = 'acc' | 'cruise' | 'limiter';

/**
 * off → standby (grey, dashes) → active (green) ⇄ overridden (driver's foot,
 * white) → interrupted (brake/cancel: grey, speed kept). `hold`: ACC stopped
 * behind a car (stop & go).
 */
export type AssistState = 'off' | 'standby' | 'active' | 'overridden' | 'interrupted' | 'hold';

export const ASSIST_STATES: AssistState[] = [
  'off',
  'standby',
  'active',
  'overridden',
  'interrupted',
  'hold',
];
export const ASSIST_FUNCTIONS: AssistFunction[] = ['cruise', 'acc', 'limiter'];

/** Time gaps for distance settings 1–5, s (typical ACC range 1.0–2.4 s). */
export const TIME_GAPS = [1.0, 1.3, 1.6, 2.0, 2.4];
/** Lowest set speed for cruise/ACC/limiter, km/h. */
export const MIN_SET_KMH = 30;
/** Plain cruise control disengages below this, km/h. */
const CRUISE_DROP_KMH = 20;
/** Most deceleration ACC will command; more needed = driver must take over, m/s². */
export const ACC_MAX_DECEL = 3.5;
/** Radar range for picking a target, m. */
export const ACC_RANGE_M = 150;
/** Stopped for longer than this, ACC needs RES or the accelerator to drive off, s. */
export const AUTO_RESUME_S = 3;
/** Standstill distance to the car ahead, m. */
const STOP_GAP_M = 4;

export type AccDynamics = 'gentle' | 'normal' | 'dynamic' | 'gentleLargeGap';

const DYNAMICS: Record<AccDynamics, { accel: number; decel: number; gapAdd: number }> = {
  gentle: { accel: 1.0, decel: 1.6, gapAdd: 0 },
  normal: { accel: 1.4, decel: 2.0, gapAdd: 0 },
  dynamic: { accel: 2.0, decel: 2.5, gapAdd: 0 },
  // Snow: slow to accelerate and a longer gap.
  gentleLargeGap: { accel: 0.8, decel: 1.4, gapAdd: 0.5 },
};

export interface AssistInput {
  speedKmh: number;
  driverThrottle: number;
  driverBrake: number;
  /** Selector in D (or the EV's D/B) and drive-ready. */
  canDrive: boolean;
  /** Car directly ahead as seen by the radar. */
  lead: { gap: number; speed: number } | null;
  dt: number;
}

export interface AssistOutput {
  /** Pedals the assist wants (cruise/ACC), merged with the driver's by the car. */
  pedals: Pedals | null;
  /** Limiter: the most throttle allowed. */
  throttleCap: number | null;
  /** ACC cannot brake hard enough: the driver must take over. */
  takeover: boolean;
  /** Limiter: going faster than the set speed (downhill) for over a second. */
  limiterExceeded: boolean;
  /** Stop & go: the car ahead has left, press RES or the accelerator. */
  leadDrivingOff: boolean;
}

/**
 * Longitudinal driver assist: one state machine for adaptive cruise control
 * (with stop & go), plain cruise control and the speed limiter, as found on
 * the right-hand steering-wheel pad of most modern cars.
 */
export class SpeedAssist {
  fn: AssistFunction;
  state: AssistState = 'off';
  setKmh: number | null = null;
  /** ACC distance setting 1–5. */
  distance = 3;
  dynamics: AccDynamics = 'normal';
  /** Last lead gap, m (for the cluster graphic), null without a target. */
  leadGap: number | null = null;
  readonly out: AssistOutput = {
    pedals: null,
    throttleCap: null,
    takeover: false,
    limiterExceeded: false,
    leadDrivingOff: false,
  };
  private pedals = new PedalController();
  private holdT = 0;
  private overT = 0;

  constructor(readonly hasAcc: boolean) {
    this.fn = hasAcc ? 'acc' : 'cruise';
  }

  get engaged(): boolean {
    return this.state === 'active' || this.state === 'overridden' || this.state === 'hold';
  }

  /** Controls the car's speed right now (for coasting, signals). */
  get controlling(): boolean {
    return this.fn !== 'limiter' && (this.state === 'active' || this.state === 'hold');
  }

  /** Main button: on (standby) / off. */
  pressMain(): void {
    if (this.state === 'off') this.state = 'standby';
    else this.switchOff();
  }

  /** Long press on the main button: swap between cruise/ACC and the limiter. */
  switchFunction(): void {
    const cruise: AssistFunction = this.hasAcc ? 'acc' : 'cruise';
    this.fn = this.fn === 'limiter' ? cruise : 'limiter';
    this.state = 'standby';
    this.setKmh = null;
  }

  switchOff(): void {
    this.state = 'off';
    this.setKmh = null;
    this.clearOutputs();
  }

  /** SET−: engage at the current speed, or lower the set speed. */
  pressSet(long: boolean, speedKmh: number): void {
    if (this.state === 'off') return;
    if (this.engaged && this.setKmh !== null) {
      this.setKmh = Math.max(
        MIN_SET_KMH,
        long ? Math.ceil(this.setKmh / 10) * 10 - 10 : this.setKmh - 1,
      );
      return;
    }
    const stopAndGo = this.fn === 'acc' && speedKmh < MIN_SET_KMH;
    if (speedKmh < MIN_SET_KMH && this.fn === 'cruise') return;
    this.setKmh = Math.max(MIN_SET_KMH, Math.round(speedKmh));
    this.engage(speedKmh);
    if (stopAndGo && speedKmh < 1) this.state = 'hold';
  }

  /** RES+: resume the stored speed, or raise the set speed; drives off from a hold. */
  pressRes(long: boolean, speedKmh: number): void {
    if (this.state === 'off') return;
    if (this.state === 'hold') {
      this.state = 'active';
      this.holdT = 0;
      this.out.leadDrivingOff = false;
      return;
    }
    if (this.engaged && this.setKmh !== null) {
      this.setKmh = long ? Math.floor(this.setKmh / 10) * 10 + 10 : this.setKmh + 1;
      return;
    }
    if (this.setKmh === null) {
      this.pressSet(false, speedKmh);
      return;
    }
    if (speedKmh < MIN_SET_KMH && this.fn === 'cruise') return;
    this.engage(speedKmh);
  }

  /** Cancel: interrupt, keeping the set speed for RES. */
  cancel(): void {
    if (this.engaged) this.interrupt();
  }

  /** Distance button: cycles 1 → 5 → 1. */
  pressDistance(): void {
    this.distance = (this.distance % TIME_GAPS.length) + 1;
  }

  /** Set the set speed directly (Demo driver, speed-limit adoption). */
  setSpeed(kmh: number): void {
    this.setKmh = Math.max(MIN_SET_KMH, Math.round(kmh));
  }

  private engage(speedKmh: number): void {
    this.state = 'active';
    this.holdT = 0;
    this.pedals.reset(speedKmh / 3.6);
  }

  private interrupt(): void {
    this.state = 'interrupted';
    this.clearOutputs();
  }

  private clearOutputs(): void {
    const o = this.out;
    o.pedals = null;
    o.throttleCap = null;
    o.takeover = false;
    o.limiterExceeded = false;
    o.leadDrivingOff = false;
    this.leadGap = null;
  }

  step(i: AssistInput): AssistOutput {
    const o = this.out;
    if (this.state === 'off' || this.state === 'standby' || this.state === 'interrupted') {
      this.clearOutputs();
      return o;
    }
    if (this.fn === 'limiter') return this.stepLimiter(i);
    // Brake pedal, leaving D or losing drive-ready interrupts cruise and ACC.
    if (i.driverBrake > 0.05 || !i.canDrive) {
      this.interrupt();
      return o;
    }
    if (this.fn === 'cruise' && i.speedKmh < CRUISE_DROP_KMH) {
      this.interrupt();
      return o;
    }
    const lead = this.fn === 'acc' && i.lead && i.lead.gap < ACC_RANGE_M ? i.lead : null;
    this.leadGap = lead ? lead.gap : null;
    const v = i.speedKmh / 3.6;
    const vSet = (this.setKmh ?? i.speedKmh) / 3.6;
    const dyn = DYNAMICS[this.dynamics];

    // Speed control towards the set speed, gap control towards the lead.
    let a = clamp((vSet - v) * 0.4, -dyn.decel, dyn.accel);
    let wanted = a;
    if (lead) {
      const gapS = TIME_GAPS[this.distance - 1]! + dyn.gapAdd;
      const desired = STOP_GAP_M + v * gapS;
      const aGap = 0.22 * (lead.gap - desired) + 0.75 * (lead.speed - v);
      wanted = Math.min(a, aGap);
      a = Math.min(a, clamp(aGap, -ACC_MAX_DECEL, dyn.accel));
    }
    // More braking needed than ACC is allowed to use: take-over request.
    o.takeover = wanted < -ACC_MAX_DECEL - 0.3 && v > 2;

    // Stop & go.
    if (this.state === 'hold' || (lead && v < 0.3 && lead.speed < 0.5 && a <= 0)) {
      return this.stepHold(i, lead);
    }
    const p = this.pedals.update(v, lead ? Math.min(vSet, lead.speed + 5) : vSet, a, i.dt);
    // The driver's foot wins: overridden while pressing more than the assist.
    this.state = i.driverThrottle > p.throttle + 0.05 ? 'overridden' : 'active';
    o.pedals = p;
    o.throttleCap = null;
    o.limiterExceeded = false;
    return o;
  }

  private stepHold(i: AssistInput, lead: { gap: number; speed: number } | null): AssistOutput {
    const o = this.out;
    if (this.state !== 'hold') {
      this.state = 'hold';
      this.holdT = 0;
    }
    this.holdT += i.dt;
    o.pedals = { throttle: 0, brake: 0.45 };
    const leaving = !lead || lead.speed > 1 || lead.gap > STOP_GAP_M + 4;
    if (leaving && this.holdT < AUTO_RESUME_S) {
      this.state = 'active';
      this.pedals.reset(0, 0.1);
    } else if (leaving) {
      // Waited too long: the driver confirms with RES or the accelerator.
      o.leadDrivingOff = true;
      if (i.driverThrottle > 0.1) this.pressRes(false, 0);
    } else {
      o.leadDrivingOff = false;
    }
    o.takeover = false;
    return o;
  }

  private stepLimiter(i: AssistInput): AssistOutput {
    const o = this.out;
    const set = this.setKmh ?? i.speedKmh;
    // Kickdown (pedal to the floor) overrides the limiter until back below the limit.
    if (i.driverThrottle > 0.95) this.state = 'overridden';
    else if (this.state === 'overridden' && i.speedKmh <= set) this.state = 'active';
    const v = i.speedKmh / 3.6;
    const p = this.pedals.update(v, set / 3.6, clamp((set / 3.6 - v) * 0.5, -1, 1.5), i.dt);
    o.pedals = null;
    o.throttleCap = this.state === 'overridden' ? null : p.throttle;
    // Downhill the limiter can't brake: warn after a second above set + 3 km/h.
    const above = i.speedKmh > set + 3 && this.state === 'active';
    this.overT = above ? this.overT + i.dt : 0;
    o.limiterExceeded = this.overT > 1;
    o.takeover = false;
    return o;
  }
}
