/** Distances the ultrasonic sensors measure, m (null = nothing in range). */
export interface ParkDistances {
  front: [number | null, number | null, number | null];
  rear: [number | null, number | null, number | null];
  left: number | null;
  right: number | null;
}

/** Sector colour level: 0 nothing, 1 far (green), 2 close (yellow), 3 very close (red). */
export function sectorLevel(d: number | null, side = false): number {
  if (d === null) return 0;
  const [red, yellow, green] = side ? [0.3, 0.5, 0.8] : [0.6, 1.0, 1.5];
  return d < red ? 3 : d < yellow ? 2 : d < green ? 1 : 0;
}

/** Off above this speed, km/h; the button works below 10 km/h. */
export const PARK_OFF_KMH = 15;
export const PARK_BUTTON_KMH = 10;

export interface ParkInput {
  reverse: boolean;
  speedKmh: number;
  distances: ParkDistances;
  /** A sensor is dirty or faulty. */
  fault: boolean;
}

export interface ParkOutput {
  /** Seconds between beeps (0 = silent, −1 = continuous tone). */
  beep: number;
  /** The nearest obstacle is in front (higher-pitched beep). */
  front: boolean;
}

/**
 * Park distance control: on automatically in reverse, with the button below
 * 10 km/h, and when creeping up to something in front; off above ~15 km/h.
 * The nearest obstacle sets the beeps: faster as it gets closer, continuous
 * at ~30 cm (20 cm at the sides), front and rear in different pitches.
 */
export class ParkAssist {
  active = false;
  muted = false;
  fault = false;
  readonly out: ParkOutput = { beep: 0, front: false };
  private wasReverse = false;

  toggle(speedKmh: number): void {
    if (speedKmh <= PARK_BUTTON_KMH) {
      this.active = !this.active;
      this.muted = false;
    }
  }

  mute(): void {
    this.muted = !this.muted;
  }

  step(i: ParkInput): ParkOutput {
    const o = this.out;
    this.fault = i.fault;
    if (i.reverse && !this.wasReverse) this.active = true;
    this.wasReverse = i.reverse;
    if (i.speedKmh > PARK_OFF_KMH && !i.reverse) this.active = false;
    // Creeping up to something ahead switches it on by itself.
    const nearFront = Math.min(...i.distances.front.map((d) => d ?? Infinity));
    if (!i.reverse && i.speedKmh > 0.5 && i.speedKmh < PARK_BUTTON_KMH && nearFront < 0.9)
      this.active = true;
    o.beep = 0;
    o.front = false;
    if (!this.active || this.fault || this.muted) return o;

    const front = Math.min(...i.distances.front.map((d) => d ?? Infinity));
    const rear = Math.min(...i.distances.rear.map((d) => d ?? Infinity));
    const side = Math.min(i.distances.left ?? Infinity, i.distances.right ?? Infinity);
    // Only the end the car is moving towards beeps (sides always).
    const ahead = i.reverse ? rear : front;
    o.front = !i.reverse;
    if (ahead < 0.3 || side < 0.2) o.beep = -1;
    else if (ahead < 1.5) o.beep = 0.08 + ((ahead - 0.3) / 1.2) * 0.5;
    return o;
  }
}
