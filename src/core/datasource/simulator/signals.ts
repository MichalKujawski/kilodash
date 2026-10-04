import { BODY_SIGNALS, S } from '../../signals/catalog';
import type { SignalId, SignalSource } from '../../signals/types';
import { parsePidHex, signalsForPids } from '../../obd/pids';
import type { VehicleProfile } from './profile';

export interface ProfileSignal {
  id: SignalId;
  source: SignalSource;
}

/**
 * What a simulated vehicle exposes and through which channel:
 * - standard OBD PIDs (from its supported-PID list),
 * - manufacturer signals (Mode 22 signalset),
 * - body/chassis signals from passive CAN (indicators, doors, lights…).
 */
export function profileSignals(p: VehicleProfile): ProfileSignal[] {
  const out = new Map<SignalId, SignalSource>();
  for (const id of signalsForPids(p.obdPids.map(parsePidHex))) out.set(id, 'obd-standard');
  for (const id of p.manufacturerSignals ?? []) out.set(id, 'obd-manufacturer');
  const can: SignalId[] = [...BODY_SIGNALS, S.AccelLongitudinal, S.BrakePedal];
  if (p.engine) can.push(S.EngineRunning);
  const modes = p.equipment?.driveModes !== false;
  if (!modes) can.splice(can.indexOf(S.DriveMode), 1);
  const stepped = p.transmission === 'dct' || p.transmission === 'automatic';
  if (modes && stepped && p.engine && !p.electric) can.push(S.Coasting);
  if (p.engine?.cylinderDeactivation) can.push(S.CylinderDeactivation);
  if (p.drive === 'awd' && modes) can.push(S.HillDescent);
  if (p.electric) can.push(S.PowerDemand);
  if (p.equipment?.acc)
    can.push(S.AccDistance, S.AccTargetDistance, S.AccTakeover, S.AccLeadDrivingOff);
  if (p.electric && !p.engine) can.push(S.RegenLevel);
  if (p.tpms) can.push(S.TireFL, S.TireFR, S.TireRL, S.TireRR);
  for (const id of can) if (!out.has(id)) out.set(id, 'can');
  return [...out].map(([id, source]) => ({ id, source }));
}

export function obdPidNumbers(p: VehicleProfile): number[] {
  return p.obdPids.map(parsePidHex);
}
