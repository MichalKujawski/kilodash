import { approach, clamp } from '../math';

export interface Pedals {
  throttle: number;
  brake: number;
}

/**
 * Turns a wanted acceleration into pedal positions: a speed reference that
 * integrates the acceleration, tracked by a PI controller (like a driver, or
 * a cruise ECU, pressing a bit more until the car does what is wanted).
 * Used by the Demo driver and by the speed assists.
 */
export class PedalController {
  private vRef = 0;
  private integral = 0;
  readonly out: Pedals = { throttle: 0, brake: 0 };

  /** Start tracking from the current speed (no jump on engagement). */
  reset(v: number, integral = 0.15): void {
    this.vRef = v;
    this.integral = integral;
  }

  /**
   * @param v current speed, m/s
   * @param v0 speed not to exceed, m/s
   * @param aWanted wanted acceleration, m/s²
   */
  update(v: number, v0: number, aWanted: number, dt: number): Pedals {
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
    this.out.throttle += (throttle - this.out.throttle) * approach(dt, 0.12);
    this.out.brake += (brake - this.out.brake) * approach(dt, 0.08);
    return this.out;
  }
}
