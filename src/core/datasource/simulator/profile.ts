import type { SignalId } from '../../signals/types';
import type { FuelType } from '../types';

export type TransmissionType = 'manual' | 'automatic' | 'dct' | 'single-speed' | 'ecvt';
export type DriveType = 'fwd' | 'rwd' | 'awd';

export interface EngineSpec {
  displacementL: number;
  cylinders: number;
  idleRpm: number;
  redlineRpm: number;
  limiterRpm: number;
  /** [rpm, Nm] full-load torque curve. */
  torqueCurve: [number, number][];
  /** Peak turbo boost above atmospheric, kPa (0 = naturally aspirated). */
  maxBoostKPa: number;
  /** Runs on half its cylinders at light load. */
  cylinderDeactivation?: boolean;
}

/** Optional equipment that changes what the car (and its cluster) offers. */
export interface Equipment {
  /** Drive mode selection (default true). */
  driveModes?: boolean;
  /** Adaptive dampers: adds Comfort mode. */
  adaptiveDampers?: boolean;
  startStop?: boolean;
  /** Auto Hold button (default: on automatic cars). */
  autoHold?: boolean;
  /** Adaptive cruise control with stop & go (radar). Without it: plain cruise control. */
  acc?: boolean;
}

export interface ElectricSpec {
  batteryKWh: number;
  motorPowerKW: number;
  motorTorqueNm: number;
  regenPowerKW: number;
  /** Hybrid only: above this speed the engine always runs. */
  evMaxKmh?: number;
}

export interface VehicleProfile {
  id: string;
  name: string;
  year: number;
  description: string;
  fuelType: FuelType;
  transmission: TransmissionType;
  drive: DriveType;
  massKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  rollingResistance: number;
  wheelRadiusM: number;
  wheelbaseM: number;
  steeringRatio: number;
  engine?: EngineSpec;
  electric?: ElectricSpec;
  gearRatios: number[];
  finalDrive: number;
  drivetrainEfficiency: number;
  /** Seconds for one gear change. */
  shiftTimeS: number;
  /** Fuel tank, L (0 for EVs). */
  tankL: number;
  /** Top of the speedometer scale, km/h. */
  speedoMaxKmh: number;
  /** Top of the tachometer scale, rpm. */
  tachoMaxRpm: number;
  /** Tyre pressure monitoring fitted. */
  tpms: boolean;
  equipment?: Equipment;
  /** Mode 01 PIDs the engine ECU answers (hex, e.g. "0C"). Drives the supported-PID bitmaps. */
  obdPids: string[];
  /** Extra signals available through a manufacturer signalset (Mode 22, OBDb-style). */
  manufacturerSignals?: SignalId[];
  vin: string;
}
