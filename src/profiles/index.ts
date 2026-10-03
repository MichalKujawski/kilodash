import type { VehicleProfile } from '@/core/datasource/simulator/profile';
import sportsCoupe from './sports-coupe-2021.json';

export const PROFILES: VehicleProfile[] = [sportsCoupe as VehicleProfile];

export const DEFAULT_PROFILE: VehicleProfile = PROFILES[0]!;
