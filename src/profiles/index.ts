import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import devFull from './dev-full.json';
import estate from './estate-2016.json';
import ev from './ev-2023.json';
import familySuv from './family-suv-2022.json';
import hatchback from './hatchback-2008.json';
import hybrid from './hybrid-suv-2019.json';
import sportsCoupe from './sports-coupe-2021.json';

/** Fictional, generic vehicles that deliberately expose different capabilities. */
export const PROFILES: VehicleProfile[] = [
  familySuv,
  hatchback,
  estate,
  sportsCoupe,
  ev,
  hybrid,
  devFull,
] as unknown as VehicleProfile[];

/** The reference car: every feature of the Midnight experience is tuned on it. */
export const DEFAULT_PROFILE: VehicleProfile = PROFILES[0]!;

export function profileById(id: string): VehicleProfile {
  return PROFILES.find((p) => p.id === id) ?? DEFAULT_PROFILE;
}
