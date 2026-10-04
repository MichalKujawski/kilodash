import type { RoadKind } from '@/core/world/types';

/** Roads where cruise control makes sense: rural roads, ramps and the motorway. */
const FAST_ROADS: RoadKind[] = ['rural', 'ramp', 'motorway'];
/** Below this, even on a fast road, nobody reaches for cruise (jam, roadworks), km/h. */
const CRUISE_MIN_KMH = 30;

/**
 * The cruise buttons are always on the wheel, like a real car; they light up
 * where cruise is useful (or while it is on, so it can always be switched off).
 */
export function cruiseLit(road: RoadKind, speedKmh: number, cruiseOn: boolean): boolean {
  return cruiseOn || (FAST_ROADS.includes(road) && speedKmh >= CRUISE_MIN_KMH);
}

/** What the console's contextual button offers right now. */
export type ConsoleAction = 'start' | 'driveMode';

/** Engine off (e.g. after Shutdown): the start button replaces the drive-mode button. */
export function consoleAction(ready: boolean): ConsoleAction {
  return ready ? 'driveMode' : 'start';
}
