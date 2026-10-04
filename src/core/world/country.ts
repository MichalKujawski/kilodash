import type { RoadKind } from './types';

/**
 * Implicit speed limits by road type (km/h), before any sign. `null` = no general
 * limit (German Autobahn), with an advisory speed instead.
 */
export interface CountryRules {
  code: string;
  implicit: Record<RoadKind, number | null>;
  /** Recommended speed where there is no limit. */
  advisory: number | null;
  /** Vehicles drive on the right; overtaking on the left only. */
  keepRight: boolean;
}

export const GERMANY: CountryRules = {
  code: 'DE',
  implicit: { parking: 10, urban: 50, zone30: 30, rural: 100, ramp: 100, motorway: null },
  advisory: 130,
  keepRight: true,
};

export const POLAND: CountryRules = {
  code: 'PL',
  implicit: { parking: 20, urban: 50, zone30: 30, rural: 90, ramp: 90, motorway: 140 },
  advisory: null,
  keepRight: true,
};

export const COUNTRIES: Record<string, CountryRules> = { DE: GERMANY, PL: POLAND };
