/** VSS-style dot-path identifier, e.g. `Vehicle.Speed`. */
export type SignalId = string;

export type SignalSource = 'obd-standard' | 'obd-manufacturer' | 'can' | 'derived' | 'simulated';

export type SignalQuality = 'live' | 'stale' | 'estimated' | 'unavailable';

export type Unit =
  | 'km/h'
  | 'rpm'
  | 'celsius'
  | 'percent'
  | 'kPa'
  | 'g/s'
  | 'V'
  | 'L/h'
  | 'L/100km'
  | 'L'
  | 'km'
  | 's'
  | 'g'
  | 'kW'
  | 'gear'
  | 'bool'
  | 'enum';

export interface Thresholds {
  low?: number;
  high?: number;
}

export interface SignalDefinition {
  id: SignalId;
  /** i18n key for the display name. */
  nameKey: string;
  unit: Unit;
  min: number;
  max: number;
  /** Typical operating range, used for colouring bars. */
  normal?: [number, number];
  warning?: Thresholds;
  critical?: Thresholds;
  /** Rate at which a healthy source refreshes this signal. Drives stale detection. */
  expectedHz: number;
}

/**
 * One timestamped value. All values are numeric to keep the hot path allocation-free:
 * booleans are 0/1, gears are -1 (R), 0 (N), 1..n.
 */
export interface Sample {
  id: SignalId;
  value: number;
  /** Milliseconds, `performance.now()` clock. */
  ts: number;
  source: SignalSource;
}
