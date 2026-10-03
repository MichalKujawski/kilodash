import type { Sample, SignalId } from '../signals/types';

export type Priority = 'high' | 'medium' | 'low';

export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid';

export type ConnectionState = 'disconnected' | 'connecting' | 'scanning' | 'connected' | 'error';

export interface ConnectionStatus {
  state: ConnectionState;
  message?: string;
}

export interface CapabilityProfile {
  /** Signals the vehicle provides directly. */
  signals: SignalId[];
  /** Achievable refresh rate per signal, Hz (estimate). */
  rates: Record<SignalId, number>;
  fuelType: FuelType;
  protocol?: string;
  vin?: string;
  ecuCount: number;
}

export interface DTC {
  code: string;
  description?: string;
}

export interface VehicleInfo {
  vin?: string;
  protocol?: string;
  obdStandard?: string;
}

export type Unsubscribe = () => void;

export interface DataSource {
  id: string;
  label: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  /** Discover what this vehicle offers. */
  discover(): Promise<CapabilityProfile>;
  subscribe(ids: SignalId[], priority: Priority): void;
  onSample(cb: (s: Sample) => void): Unsubscribe;
  onStatus(cb: (s: ConnectionStatus) => void): Unsubscribe;
  readDTCs?(): Promise<DTC[]>;
  vehicleInfo?(): Promise<VehicleInfo>;
}
