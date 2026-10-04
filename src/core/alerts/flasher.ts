/** Indicator period ~80 flashes/min, ~55% duty, as on typical flasher relays. */
export const FLASH_PERIOD_MS = 750;
export const FLASH_ON_MS = 420;

/**
 * Shared blink phase for lamps. The phase starts when a lamp is switched on, so
 * the first flash is immediate. One instance per cluster keeps the arrows, car
 * view and audio tick in sync.
 */
export class Flasher {
  private since = new Map<string, number>();
  private fast = new Set<string>();

  /** A failed indicator bulb doubles the flash rate on that side (tells the driver). */
  setFast(key: string, fast: boolean): void {
    if (fast) this.fast.add(key);
    else this.fast.delete(key);
  }

  /** Is lamp `key` lit at `now`, given whether its signal is active? */
  lit(key: string, active: boolean, now: number): boolean {
    if (!active) {
      this.since.delete(key);
      return false;
    }
    let t = this.since.get(key);
    if (t === undefined) {
      t = now;
      this.since.set(key, t);
    }
    const k = this.fast.has(key) ? 2 : 1;
    return (now - t) % (FLASH_PERIOD_MS / k) < FLASH_ON_MS / k;
  }
}
