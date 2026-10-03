import { approach, clamp } from '../../math';
import type { VehicleSimulator } from './vehicle';

export interface DriveSegment {
  /** Target speed, km/h. */
  targetKmh: number;
  /** Max throttle used to reach the target (0..1). */
  aggression: number;
  /** Seconds to hold once the target is reached. */
  holdS: number;
  indicator?: 'left' | 'right';
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

/** Simple PI "virtual driver" that follows a list of speed targets. */
export class AutoDriver {
  private index = 0;
  private holdTimer = 0;
  private integral = 0.1;
  private throttle = 0;
  private brake = 0;

  constructor(private segments: DriveSegment[] = DEMO_LOOP) {}

  get segment(): DriveSegment {
    return this.segments[this.index]!;
  }

  update(sim: VehicleSimulator, dt: number): void {
    const seg = this.segment;
    const v = sim.speedKmh;
    const err = seg.targetKmh - v;
    const reached = seg.targetKmh === 0 ? v < 0.5 : Math.abs(err) < 3;

    if (reached) {
      this.holdTimer += dt;
      if (this.holdTimer >= seg.holdS) {
        this.index = (this.index + 1) % this.segments.length;
        this.holdTimer = 0;
      }
    }

    let throttle = 0;
    let brake = 0;
    if (seg.targetKmh === 0) {
      // Smooth stop: brake harder as speed increases, light hold at standstill.
      brake = v > 0.5 ? clamp(0.12 + v * 0.006 * (seg.aggression + 0.5), 0, 0.7) : 0.3;
      this.integral = 0.08;
    } else if (err < -6) {
      brake = clamp(-err * 0.012, 0, 0.5);
    } else {
      this.integral = clamp(this.integral + err * dt * 0.006, 0, 0.6);
      throttle = clamp(this.integral + err * 0.035, 0, seg.aggression);
    }

    this.throttle += (throttle - this.throttle) * approach(dt, 0.35);
    this.brake += (brake - this.brake) * approach(dt, 0.2);
    sim.inputs.throttle = this.throttle;
    sim.inputs.brake = this.brake;

    // Indicate shortly before and during the manoeuvre, like a real driver.
    const signalling = seg.indicator !== undefined && this.holdTimer < 4;
    sim.inputs.leftIndicator = signalling && seg.indicator === 'left';
    sim.inputs.rightIndicator = signalling && seg.indicator === 'right';
  }
}
