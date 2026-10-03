export interface SpringConfig {
  /** Angular frequency-like stiffness, 1/s². Higher = snappier. */
  stiffness: number;
  /** Damping coefficient, 1/s. ~2·sqrt(stiffness) is critically damped. */
  damping: number;
  /** Maximum speed in value units per second (stepper-motor slew limit). */
  maxVelocity?: number;
}

export const DEFAULT_NEEDLE: SpringConfig = { stiffness: 140, damping: 20, maxVelocity: Infinity };

const MAX_STEP = 1 / 240;

/**
 * Spring–damper follower that gives needles physical inertia, like a stepper-motor
 * gauge: slight overshoot on sudden changes, smooth sweep otherwise.
 */
export class Spring {
  value: number;
  velocity = 0;
  config: SpringConfig;

  constructor(initial = 0, config: SpringConfig = DEFAULT_NEEDLE) {
    this.value = initial;
    this.config = config;
  }

  /** Advance by `dt` seconds towards `target`. Sub-steps for stability on long frames. */
  update(target: number, dt: number): number {
    const { stiffness, damping, maxVelocity = Infinity } = this.config;
    let remaining = Math.min(dt, 0.25);
    while (remaining > 0) {
      const h = Math.min(remaining, MAX_STEP);
      const accel = stiffness * (target - this.value) - damping * this.velocity;
      this.velocity += accel * h;
      if (this.velocity > maxVelocity) this.velocity = maxVelocity;
      else if (this.velocity < -maxVelocity) this.velocity = -maxVelocity;
      this.value += this.velocity * h;
      remaining -= h;
    }
    return this.value;
  }

  snap(value: number): void {
    this.value = value;
    this.velocity = 0;
  }
}

/**
 * A number for digital readouts: exponentially smoothed, and only republished at
 * `hz` so digits stay readable instead of flickering.
 */
export class ReadoutValue {
  private smoothed: number | undefined;
  private shown = 0;
  private sinceUpdate = Infinity;

  constructor(
    private hz = 5,
    private timeConstant = 0.15,
  ) {}

  update(raw: number, dt: number): number {
    if (this.smoothed === undefined) this.smoothed = raw;
    const k = 1 - Math.exp(-dt / this.timeConstant);
    this.smoothed += (raw - this.smoothed) * k;
    this.sinceUpdate += dt;
    if (this.sinceUpdate >= 1 / this.hz) {
      this.sinceUpdate = 0;
      this.shown = this.smoothed;
    }
    return this.shown;
  }
}
