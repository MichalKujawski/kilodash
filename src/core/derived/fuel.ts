import type { FuelType } from '../datasource/types';

/** Stoichiometric air-fuel ratio and fuel density (g/L). */
export const FUEL_CONSTANTS: Record<'petrol' | 'diesel', { afr: number; densityGL: number }> = {
  petrol: { afr: 14.7, densityGL: 745 },
  diesel: { afr: 14.5, densityGL: 832 },
};

/** Fuel flow (L/h) estimated from mass air flow (g/s), assuming stoichiometric combustion. */
export function fuelRateFromMaf(mafGs: number, fuelType: FuelType): number {
  const k = FUEL_CONSTANTS[fuelType === 'diesel' ? 'diesel' : 'petrol'];
  return (mafGs * 3600) / (k.afr * k.densityGL);
}

/** L/100 km from L/h and km/h; undefined when (almost) stationary. */
export function litresPer100km(fuelRateLh: number, speedKmh: number): number | undefined {
  if (speedKmh < 3) return undefined;
  return (fuelRateLh / speedKmh) * 100;
}
