import { clamp } from '../math';

/**
 * Forward collision warning + emergency braking, staged by time to collision:
 * ready → (distance: following too close) → prewarn (chime, brakes prefilled)
 * → acute (brake jolt) → braking (partial, then full) → hold (stopped).
 */
export type FcwStage =
  'off' | 'ready' | 'distance' | 'prewarn' | 'acute' | 'braking' | 'hold' | 'unavailable';
export const FCW_STAGES: FcwStage[] = [
  'off',
  'ready',
  'distance',
  'prewarn',
  'acute',
  'braking',
  'hold',
  'unavailable',
];

/** Warnings work in this speed band, km/h. */
export const FCW_BAND = { min: 30, max: 210 };
/** Distance warning band and time gap, km/h / s. */
export const DISTANCE_WARNING = { min: 60, max: 210, gapS: 0.9, afterS: 3 };
/** City emergency braking brakes without warning in this band, km/h. */
export const CITY_BAND = { min: 5, max: 30 };
/** Time-to-collision thresholds, s. */
export const TTC = { prewarn: 2.6, acute: 1.8, partial: 1.3, full: 0.8, city: 1.0 };
/** Brake pedal equivalent of ~1 g. */
const BRAKE_PER_MS2 = 1 / 10.3;

export interface CollisionInput {
  speedKmh: number;
  lead: { gap: number; speed: number; accel: number } | null;
  driverBrake: number;
  driverThrottle: number;
  /** Radar/camera dirty or blocked. */
  blocked: boolean;
  dt: number;
}

export interface CollisionOutput {
  /** Brake demand 0–1 (AEB or brake assist), null = none. */
  brake: number | null;
  /** Brakes prefilled (shorter response). */
  prefill: boolean;
  /** After an emergency stop from > 50 km/h: hazards on. */
  hazards: boolean;
}

export class CollisionAssist {
  enabled = true;
  stage: FcwStage = 'ready';
  readonly out: CollisionOutput = { brake: null, prefill: false, hazards: false };
  private closeT = 0;
  private joltT = 0;
  private holdT = 0;
  private brakeStartKmh = 0;

  /** On again at every start (EU General Safety Regulation). */
  onIgnition(): void {
    this.enabled = true;
    this.stage = 'ready';
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  step(i: CollisionInput): CollisionOutput {
    const o = this.out;
    o.brake = null;
    o.prefill = false;
    if (!this.enabled) {
      this.stage = 'off';
      return o;
    }
    if (i.blocked) {
      this.stage = 'unavailable';
      return o;
    }
    const v = i.speedKmh / 3.6;
    if (this.stage === 'hold') return this.hold(i);
    // Kickdown overrides an intervention; below walking pace nothing starts (but braking finishes).
    const finishing = this.stage === 'braking' && !!i.lead && v > 0.05;
    if (i.driverThrottle > 0.9 || !i.lead || (v < CITY_BAND.min / 3.6 && !finishing)) {
      this.stage = 'ready';
      this.closeT = 0;
      return o;
    }
    const { gap, speed: vl, accel } = i.lead;
    const closing = v - vl;
    const ttc = closing > 0.1 ? gap / closing : Infinity;
    // Deceleration needed to stop 2 m behind it (plus whatever it is braking with).
    const aReq =
      closing > 0 ? (closing * closing) / (2 * Math.max(gap - 2.5, 0.5)) + Math.max(0, -accel) : 0;
    const kmh = i.speedKmh;
    const inBand = kmh >= FCW_BAND.min && kmh <= FCW_BAND.max;
    const city = kmh >= CITY_BAND.min && kmh < CITY_BAND.max;

    let stage: FcwStage = 'ready';
    if (inBand && ttc < TTC.prewarn && aReq > 2.5) stage = 'prewarn';
    if (inBand && ttc < TTC.acute && aReq > 4) stage = 'acute';
    if ((inBand && ttc < TTC.partial) || (city && ttc < TTC.city)) stage = 'braking';
    // Once braking, keep braking until stopped or the threat is gone (not just out of the band).
    if (this.stage === 'braking' && closing > 0.05 && ttc < 3) stage = 'braking';
    // Following too closely (no danger yet): distance warning after a few seconds.
    const tooClose =
      kmh >= DISTANCE_WARNING.min && kmh <= DISTANCE_WARNING.max && gap / v < DISTANCE_WARNING.gapS;
    this.closeT = tooClose ? this.closeT + i.dt : 0;
    if (stage === 'ready' && this.closeT > DISTANCE_WARNING.afterS) stage = 'distance';

    if (stage === 'acute' && this.stage !== 'acute') this.joltT = 0;
    if (stage === 'braking' && this.stage !== 'braking') this.brakeStartKmh = kmh;
    this.stage = stage;
    o.prefill = stage === 'prewarn' || stage === 'acute' || stage === 'braking';
    if (stage === 'acute') {
      // A short jolt to get the driver's attention (and test the road grip).
      this.joltT += i.dt;
      // Then light pre-braking while the driver reacts.
      o.brake = this.joltT < 0.3 ? 0.35 : Math.max(0.2, i.driverBrake);
    }
    if (stage === 'braking') {
      const full = ttc < TTC.full || (city && ttc < TTC.city);
      const auto = full ? 1 : 0.4;
      // Brake assist: whatever the driver does, brake at least as hard as needed.
      o.brake = clamp(Math.max(auto, aReq * BRAKE_PER_MS2 * 1.35, i.driverBrake), 0, 1);
      if (v < 0.1) {
        this.stage = 'hold';
        this.holdT = 0;
        o.hazards = this.brakeStartKmh > 50;
      }
    } else if (o.prefill && i.driverBrake > 0.05) {
      // The driver is braking but not enough: brake assist tops it up.
      o.brake = clamp(Math.max(i.driverBrake, aReq * BRAKE_PER_MS2 * 1.1), 0, 1);
    }
    return o;
  }

  /** Stopped by AEB: hold briefly so the car doesn't creep into the obstacle. */
  private hold(i: CollisionInput): CollisionOutput {
    const o = this.out;
    this.holdT += i.dt;
    o.brake = 0.5;
    if (this.holdT > 1.5 || i.driverThrottle > 0.2) {
      this.stage = 'ready';
      o.brake = null;
    }
    return o;
  }

  /** Driving off clears the automatic hazards. */
  clearHazards(speedKmh: number): void {
    if (speedKmh > 10) this.out.hazards = false;
  }
}

export type BlindSpotSide = 'none' | 'occupied' | 'warning';
export const BLIND_SPOT_STATES: BlindSpotSide[] = ['none', 'occupied', 'warning'];

/** Blind-spot monitoring works above this speed, km/h. */
export const BSD_MIN_KMH = 15;

export interface SideObject {
  /** +1 = one lane to the left. */
  laneOffset: number;
  /** Ego front bumper to the object's rear, m (negative = beside/behind). */
  dx: number;
  length: number;
  /** Its speed, m/s. */
  v: number;
  oncoming: boolean;
}

/**
 * Blind-spot monitoring: a car alongside or closing fast from behind in the
 * next lane lights the mirror indicator; indicating towards it makes the
 * indicator flash with a chime.
 */
export class BlindSpot {
  enabled = true;
  left: BlindSpotSide = 'none';
  right: BlindSpotSide = 'none';

  step(speedKmh: number, objects: SideObject[], indicating: 'left' | 'right' | null): void {
    if (!this.enabled || speedKmh < BSD_MIN_KMH) {
      this.left = this.right = 'none';
      return;
    }
    const v = speedKmh / 3.6;
    const occupied = (side: 1 | -1): boolean =>
      objects.some((o) => {
        if (o.oncoming || Math.abs(o.laneOffset - side) > 0.5) return false;
        // Alongside: from 1 m ahead of our nose to 7 m behind our tail.
        const alongside = o.dx < 1 && o.dx + o.length > -(4.6 + 7);
        // Closing from behind: reaches us within 3 s.
        const closing = o.v - v;
        const fast = o.dx < 0 && o.dx > -60 && closing > 2 && -o.dx / closing < 3;
        return alongside || fast;
      });
    const l = occupied(1);
    const r = occupied(-1);
    this.left = l ? (indicating === 'left' ? 'warning' : 'occupied') : 'none';
    this.right = r ? (indicating === 'right' ? 'warning' : 'occupied') : 'none';
  }
}

export type CrossTrafficState = 'none' | 'warning' | 'braking';
export const CROSS_TRAFFIC_STATES: CrossTrafficState[] = ['none', 'warning', 'braking'];

export interface CrossObject {
  /** Distance along the aisle to our path, m. */
  distance: number;
  /** Speed towards our path, m/s. */
  speed: number;
}

/**
 * Rear cross-traffic alert while reversing out of a parking space: warns when
 * a car will cross behind us within ~3 s, brakes when it's about to.
 */
export class CrossTraffic {
  state: CrossTrafficState = 'none';

  step(reversing: boolean, speedKmh: number, objects: CrossObject[]): number | null {
    if (!reversing || speedKmh > 10) {
      this.state = 'none';
      return null;
    }
    let ttc = Infinity;
    for (const o of objects) if (o.speed > 0.5) ttc = Math.min(ttc, o.distance / o.speed);
    if (ttc < 1.6) {
      this.state = 'braking';
      return 0.6;
    }
    this.state = ttc < 3.5 ? 'warning' : 'none';
    return null;
  }
}
