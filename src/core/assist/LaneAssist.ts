import { clamp } from '../math';

/** How a lane line is shown: not detected (grey), detected (white), steering (green), departure (amber). */
export type LineState = 'none' | 'detected' | 'assisting' | 'departure';
export const LINE_STATES: LineState[] = ['none', 'detected', 'assisting', 'departure'];

/**
 * off: switched off. standby: on but not available (too slow, no lines).
 * ready: lane keeping armed (steps in near a line). centering: keeps the car
 * in the middle (with ACC). emergency: driver unresponsive, stopping in lane.
 */
export type LaneAssistState = 'off' | 'standby' | 'ready' | 'centering' | 'emergency';
export const LANE_ASSIST_STATES: LaneAssistState[] = [
  'off',
  'standby',
  'ready',
  'centering',
  'emergency',
];

/** Lane keeping works from this speed (typical 60–65 km/h). */
export const LKA_MIN_KMH = 60;
/** Half lane width minus half car width: the wheels touch the line here, m. */
export const LINE_AT = 3.5 / 2 - 0.9;
/** Lane keeping steers back when the time to the line drops below this, s. */
const TLC_S = 0.7;
/** …or when closer to the line than this, m. */
const MARGIN_M = 0.18;

/** Hands-off staging, seconds without hands on the wheel. */
export const HANDS_OFF = {
  /** "Take over steering" message, white wheel. */
  message: 15,
  /** Red wheel + chime. */
  urgent: 25,
  /** Brake jolt + louder chime. */
  jolt: 32,
  /** Emergency stop in lane with hazards. */
  emergency: 40,
} as const;

export interface LaneInput {
  speedKmh: number;
  /** Lateral offset from the lane centre, m (+ = left). */
  lat: number;
  /** Lateral speed, m/s (+ = moving left). */
  latV: number;
  /** Lane markings the camera can see on each side. */
  lines: { left: boolean; right: boolean };
  indicating: 'left' | 'right' | null;
  /** Moving into another lane (driver steering across on purpose). */
  changingLane: boolean;
  /** ACC is engaged: lane centering joins in. */
  accEngaged: boolean;
  handsOn: boolean;
  dt: number;
}

export interface LaneOutput {
  /** Steering help as a lateral acceleration, m/s² (+ = to the left). */
  steer: number;
  /** How much of the driver's own steering is still applied (centering lets hands rest). */
  driverWeight: number;
  left: LineState;
  right: LineState;
  /** 0 none, 1 message, 2 red + chime, 3 brake jolt, 4 emergency stop. */
  handsOffStage: number;
  /** Short brake pulse to wake the driver. */
  jolt: boolean;
  /** Emergency stop: decelerate (m/s²) and switch the hazards on. */
  emergencyDecel: number | null;
  /** ACC and lane centering together ("assisted driving"). */
  assisted: boolean;
}

/**
 * Lane keeping and lane centering with hands-off staging, as on mainstream
 * cars: keeping nudges the car back near a line above 60 km/h unless the
 * driver indicates; centering (with ACC) steers continuously; without hands
 * on the wheel the car escalates from a message to an emergency stop.
 */
export class LaneAssist {
  enabled = true;
  state: LaneAssistState = 'standby';
  readonly out: LaneOutput = {
    steer: 0,
    driverWeight: 1,
    left: 'none',
    right: 'none',
    handsOffStage: 0,
    jolt: false,
    emergencyDecel: null,
    assisted: false,
  };
  private handsOffT = 0;
  private joltT = 0;
  private interveneSide: 'left' | 'right' | null = null;
  private interveneT = 0;

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) this.reset();
  }

  /** Back to normal (ignition, driver takes over after an emergency stop). */
  reset(): void {
    this.handsOffT = 0;
    this.joltT = 0;
    this.interveneSide = null;
    if (this.state === 'emergency') this.state = 'standby';
  }

  step(i: LaneInput): LaneOutput {
    const o = this.out;
    o.jolt = false;
    o.emergencyDecel = null;
    if (!this.enabled) {
      this.state = 'off';
      return this.idle(i);
    }
    if (this.state === 'emergency') return this.emergency(i);

    const lines = i.lines.left || i.lines.right;
    const centering = i.accEngaged && lines;
    const keeping = lines && i.speedKmh >= LKA_MIN_KMH;
    this.state = centering ? 'centering' : keeping ? 'ready' : 'standby';
    o.assisted = centering;
    o.left = i.lines.left ? (centering ? 'assisting' : 'detected') : 'none';
    o.right = i.lines.right ? (centering ? 'assisting' : 'detected') : 'none';
    o.steer = 0;
    o.driverWeight = 1;

    if (centering && !i.changingLane) {
      // Continuous centering: a soft spring to the lane middle.
      o.steer = -0.9 * i.lat - 1.6 * i.latV;
      o.driverWeight = 0.25;
    }
    if ((centering || keeping) && !i.changingLane) this.keepInLane(i);
    else this.interveneSide = null;

    this.handsOff(i, centering || this.interveneSide !== null || keeping);
    return o;
  }

  /** Steer back when about to touch a line the driver isn't indicating towards. */
  private keepInLane(i: LaneInput): void {
    const o = this.out;
    const toLeft = LINE_AT - i.lat;
    const toRight = LINE_AT + i.lat;
    const tlcLeft = i.latV > 0.01 ? toLeft / i.latV : Infinity;
    const tlcRight = i.latV < -0.01 ? toRight / -i.latV : Infinity;
    let side: 'left' | 'right' | null = null;
    if (i.lines.left && (tlcLeft < TLC_S || toLeft < MARGIN_M) && i.indicating !== 'left')
      side = 'left';
    if (i.lines.right && (tlcRight < TLC_S || toRight < MARGIN_M) && i.indicating !== 'right')
      side = 'right';
    if (side) {
      this.interveneSide = side;
      this.interveneT = 0.8;
    } else {
      this.interveneT -= i.dt;
      if (this.interveneT <= 0) this.interveneSide = null;
    }
    if (this.interveneSide) {
      // A firm push back towards the middle (about 0.25 g at most), then release.
      const push = this.interveneSide === 'left' ? -1 : 1;
      o.steer = clamp(push * 2.2 - 1.2 * i.latV, -2.5, 2.5);
      if (this.interveneSide === 'left') o.left = 'departure';
      else o.right = 'departure';
    }
  }

  private handsOff(i: LaneInput, active: boolean): void {
    const o = this.out;
    if (i.handsOn || !active) {
      this.handsOffT = 0;
      o.handsOffStage = 0;
      return;
    }
    this.handsOffT += i.dt;
    const t = this.handsOffT;
    o.handsOffStage =
      t >= HANDS_OFF.emergency
        ? 4
        : t >= HANDS_OFF.jolt
          ? 3
          : t >= HANDS_OFF.urgent
            ? 2
            : t >= HANDS_OFF.message
              ? 1
              : 0;
    if (o.handsOffStage === 3) {
      // One short brake jolt at the start of stage 3.
      this.joltT += i.dt;
      o.jolt = this.joltT < 0.35;
    }
    if (o.handsOffStage === 4) this.state = 'emergency';
  }

  /** Driver unresponsive: keep the lane, slow to a stop, hazards on. */
  private emergency(i: LaneInput): LaneOutput {
    const o = this.out;
    if (i.handsOn) {
      // The driver is back: hand over.
      this.reset();
      o.handsOffStage = 0;
      return o;
    }
    o.handsOffStage = 4;
    o.steer = -0.9 * i.lat - 1.6 * i.latV;
    o.driverWeight = 0;
    o.left = i.lines.left ? 'assisting' : 'none';
    o.right = i.lines.right ? 'assisting' : 'none';
    o.emergencyDecel = i.speedKmh > 40 ? 2.5 : 1.5;
    o.assisted = false;
    return o;
  }

  private idle(i: LaneInput): LaneOutput {
    const o = this.out;
    o.steer = 0;
    o.driverWeight = 1;
    o.left = 'none';
    o.right = 'none';
    o.handsOffStage = 0;
    o.assisted = false;
    this.handsOffT = 0;
    void i;
    return o;
  }
}

export interface DriverSteerInput {
  lat: number;
  latV: number;
  handsOn: boolean;
  distracted: boolean;
  /** Smooth noise −1…1 (the driver's natural wander). */
  wander: number;
  /** Tired driver: a micro-sleep (no steering), then a startled over-correction. */
  asleep?: boolean;
  startled?: boolean;
}

/**
 * The human driver's lateral control: a PD controller on the lane position
 * with a natural wander of about ±0.25 m. Distracted drivers react weakly and
 * late, so the car drifts towards the lines. Hands off: no steering at all.
 */
export function driverSteer(i: DriverSteerInput): number {
  if (!i.handsOn || i.asleep) return 0;
  if (i.startled) return -2.6 * i.lat - 1.2 * i.latV;
  const k = i.distracted ? 0.08 : 0.9;
  const d = i.distracted ? 0.2 : 1.7;
  const wander = i.wander * (i.distracted ? 0.35 : 0.22);
  return -k * (i.lat - wander) - d * i.latV;
}
