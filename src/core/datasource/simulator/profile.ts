import type { SignalId } from '../../signals/types';
import type { FuelType } from '../types';

export type TransmissionType = 'manual' | 'automatic' | 'dct';

export interface EngineSpec {
  displacementL: number;
  idleRpm: number;
  redlineRpm: number;
  limiterRpm: number;
  /** [rpm, Nm] full-load torque curve. */
  torqueCurve: [number, number][];
  /** Peak turbo boost above atmospheric, kPa (0 = naturally aspirated). */
  maxBoostKPa: number;
}

export interface VehicleProfile {
  id: string;
  name: string;
  year: number;
  description: string;
  fuelType: FuelType;
  transmission: TransmissionType;
  massKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  rollingResistance: number;
  wheelRadiusM: number;
  engine: EngineSpec;
  gearRatios: number[];
  finalDrive: number;
  drivetrainEfficiency: number;
  /** Seconds for one gear change. */
  shiftTimeS: number;
  tankL: number;
  /** Top of the speedometer scale, km/h. */
  speedoMaxKmh: number;
  /** Top of the tachometer scale, rpm. */
  tachoMaxRpm: number;
  /** Signals this vehicle exposes (its "supported PIDs"). */
  signals: SignalId[];
}
