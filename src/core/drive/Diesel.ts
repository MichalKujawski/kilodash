/** Diesel systems: glow plugs, particulate filter, diesel exhaust fluid (DEF). */

/** Pre-glow time before a cold start, s (warm engines need almost none). */
export function glowTime(coolantC: number): number {
  return Math.max(0, Math.min(3, (40 - coolantC) / 15));
}

/** Particulate filter load above this asks for a regeneration drive, %. */
export const DPF_WARN = 80;
/** Regeneration needs this speed (motorway/rural), km/h, and starts above this load, %. */
const REGEN_KMH = 60;
const REGEN_FROM = 45;

/**
 * Diesel particulate filter: soot collects, mostly in slow town driving; the
 * engine burns it off (regeneration) when the car runs at a steady higher speed.
 * Short trips keep it from finishing, and the driver is asked to drive on.
 */
export class ParticulateFilter {
  /** Soot load, %. */
  load = 35;
  regenerating = false;

  step(speedKmh: number, engineLoadPct: number, running: boolean, dtS: number): void {
    if (!running) {
      this.regenerating = false;
      return;
    }
    // Soot per second: more at low speed and high load (demo-scaled ×20).
    const soot = (0.0004 + engineLoadPct * 0.00002) * (speedKmh < 50 ? 2 : 1) * 20;
    this.regenerating = this.load > REGEN_FROM && speedKmh > REGEN_KMH;
    if (this.regenerating) this.load = Math.max(5, this.load - 0.03 * 20 * dtS);
    else this.load = Math.min(100, this.load + soot * dtS);
  }
}

/** DEF warnings start at this range, km; "no restart" at 0. */
export const DEF_WARN_KM = 2400;
export const DEF_URGENT_KM = 1000;

/**
 * Diesel exhaust fluid tank: about 1 L per 1 000 km. Warnings from ~2 400 km
 * range; at 0 the engine will not restart (EU emissions rules).
 */
export class ExhaustFluid {
  /** Litres in the tank. */
  litres = 9;
  readonly tankL = 13;
  readonly lPerKm = 1 / 1000;

  get rangeKm(): number {
    return this.litres / this.lPerKm;
  }

  consume(km: number): void {
    this.litres = Math.max(0, this.litres - km * this.lPerKm);
  }

  refill(): void {
    this.litres = this.tankL;
  }

  /** The engine may not start again once empty. */
  get startBlocked(): boolean {
    return this.litres <= 0;
  }
}
