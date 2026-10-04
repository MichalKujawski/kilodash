export interface HighBeamInput {
  /** The driver switched auto high beam on (stalk). */
  enabled: boolean;
  lowBeamOn: boolean;
  /** Ambient light, 0–100 % (headlights matter below ~15 %). */
  light: number;
  speedKmh: number;
  /** Built-up area (town streets, car parks): street lighting, no high beam. */
  inTown: boolean;
  /** Distance to oncoming traffic / the car ahead the camera sees, m (null = none). */
  oncoming: number | null;
  ahead: number | null;
  dt: number;
}

/**
 * Auto high beam: on in the dark outside towns from ~60 km/h when nobody is
 * ahead or coming the other way; off at once when lights appear, back on a
 * moment after they've gone. The green "auto" lamp shows it's armed; the
 * blue high-beam lamp shows when it's actually on.
 */
export class AutoHighBeam {
  armed = false;
  on = false;
  private clearT = 0;

  step(i: HighBeamInput): boolean {
    this.armed = i.enabled && i.lowBeamOn && i.light < 15;
    const fast = this.on ? i.speedKmh > 40 : i.speedKmh > 60;
    const traffic =
      (i.oncoming !== null && i.oncoming < 600) || (i.ahead !== null && i.ahead < 350);
    const ok = this.armed && fast && !i.inTown && !traffic;
    if (!ok) {
      this.on = false;
      this.clearT = 0;
      return false;
    }
    // Wait until the road has been clear for a moment before dazzling again.
    this.clearT += i.dt;
    if (this.clearT > 1.5) this.on = true;
    return this.on;
  }
}

/** Fatigue: active above this speed, km/h; evaluates for this long before warning, s. */
export const FATIGUE_MIN_KMH = 65;
export const FATIGUE_EVAL_S = 15 * 60;
/** A break (stopped, engine off or door opened) of this long resets it, s. */
export const FATIGUE_BREAK_S = 15 * 60;
/** "Consider a break" after this long driving without one, s. */
export const LONG_DRIVE_S = 2 * 3600;

export interface FatigueInput {
  speedKmh: number;
  engineOn: boolean;
  doorOpen: boolean;
  /** Lane position, m, and its rate, m/s. */
  lat: number;
  latV: number;
  dt: number;
}

/**
 * Driver fatigue detection from steering behaviour, like real systems: after
 * ~15 minutes above 65 km/h it looks for the tell-tale pattern of drifting
 * (no corrections) followed by a sharp correction. Warns with a coffee cup
 * and a gong, once more 15 minutes later, then stays quiet. A break resets it.
 * After two hours without a break it suggests one anyway.
 */
export class FatigueMonitor {
  /** 0 none, 1 "take a break" warning, 2 "consider a break" (long drive). */
  stage = 0;
  private activeT = 0;
  private driveT = 0;
  private breakT = 0;
  private events: number[] = [];
  private drifting = 0;
  private warnings = 0;
  private lastWarnT = -Infinity;
  private showT = 0;
  private longShown = false;
  private clock = 0;

  /** Signs of tiredness in the last 5 minutes. */
  get score(): number {
    return this.events.filter((t) => this.clock - t < 300).length;
  }

  step(i: FatigueInput): number {
    this.clock += i.dt;
    const resting = i.speedKmh < 1;
    if (!i.engineOn || i.doorOpen) this.breakT = FATIGUE_BREAK_S;
    this.breakT = resting ? this.breakT + i.dt : 0;
    if (this.breakT >= FATIGUE_BREAK_S) this.reset();
    if (!resting) this.driveT += i.dt;

    if (i.speedKmh > FATIGUE_MIN_KMH) {
      this.activeT += i.dt;
      // Drift: wandering off centre without correcting…
      if (Math.abs(i.lat) > 0.45 && Math.abs(i.latV) < 0.15) this.drifting += i.dt;
      // …then a jerk back: one sign of tiredness.
      if (this.drifting > 1 && Math.abs(i.latV) > 0.45 && Math.sign(i.latV) === -Math.sign(i.lat)) {
        this.events.push(this.clock);
        this.drifting = 0;
      }
      if (Math.abs(i.lat) < 0.2) this.drifting = 0;
    }

    this.showT = Math.max(0, this.showT - i.dt);
    const tired = this.activeT >= FATIGUE_EVAL_S && this.score >= 3;
    const again = this.warnings === 1 && this.clock - this.lastWarnT >= FATIGUE_EVAL_S;
    if (tired && (this.warnings === 0 || again)) {
      this.warnings++;
      this.lastWarnT = this.clock;
      this.showT = 5;
      this.stage = 1;
    } else if (!this.longShown && this.driveT >= LONG_DRIVE_S) {
      this.longShown = true;
      this.showT = 5;
      this.stage = 2;
    }
    if (this.showT <= 0) this.stage = 0;
    return this.stage;
  }

  reset(): void {
    this.activeT = 0;
    this.driveT = 0;
    this.events = [];
    this.warnings = 0;
    this.longShown = false;
  }
}
