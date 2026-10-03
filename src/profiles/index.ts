import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import devFull from './dev-full.json';
import estate from './estate-2016.json';
import ev from './ev-2023.json';
import hatchback from './hatchback-2008.json';
import hybrid from './hybrid-suv-2019.json';
import sportsCoupe from './sports-coupe-2021.json';

/** Fictional, generic vehicles that deliberately expose different capabilities. */
export const PROFILES: VehicleProfile[] = [
  hatchback,
  estate,
  sportsCoupe,
  ev,
  hybrid,
  devFull,
] as unknown as VehicleProfile[];

export const DEFAULT_PROFILE: VehicleProfile = PROFILES[2]!;

export function profileById(id: string): VehicleProfile {
  return PROFILES.find((p) => p.id === id) ?? DEFAULT_PROFILE;
}
