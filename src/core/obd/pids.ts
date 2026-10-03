import { S } from '../signals/catalog';
import type { SignalId } from '../signals/types';

/** One decoded value from a PID response. */
export interface DecodedValue {
  id: SignalId;
  value: number;
}

export interface PidDefinition {
  /** Mode 01 PID number. */
  pid: number;
  name: string;
  /** Data bytes in the response. */
  bytes: number;
  signals: SignalId[];
  decode(b: number[]): DecodedValue[];
  /** Inverse of decode; used by the ELM327 emulator. */
  encode(values: Record<SignalId, number>): number[];
}

const u8 = (v: number): number => Math.max(0, Math.min(255, Math.round(v)));
const u16 = (v: number): number[] => {
  const n = Math.max(0, Math.min(65535, Math.round(v)));
  return [(n >> 8) & 0xff, n & 0xff];
};
const word = (b: number[]): number => (b[0] ?? 0) * 256 + (b[1] ?? 0);
const val = (values: Record<SignalId, number>, id: SignalId): number => values[id] ?? 0;

const pct = (pid: number, name: string, id: SignalId): PidDefinition => ({
  pid,
  name,
  bytes: 1,
  signals: [id],
  decode: (b) => [{ id, value: ((b[0] ?? 0) * 100) / 255 }],
  encode: (v) => [u8((val(v, id) * 255) / 100)],
});

const temp = (pid: number, name: string, id: SignalId): PidDefinition => ({
  pid,
  name,
  bytes: 1,
  signals: [id],
  decode: (b) => [{ id, value: (b[0] ?? 0) - 40 }],
  encode: (v) => [u8(val(v, id) + 40)],
});

const raw8 = (pid: number, name: string, id: SignalId): PidDefinition => ({
  pid,
  name,
  bytes: 1,
  signals: [id],
  decode: (b) => [{ id, value: b[0] ?? 0 }],
  encode: (v) => [u8(val(v, id))],
});

/** SAE J1979 Mode 01 PIDs we understand. */
export const PIDS: PidDefinition[] = [
  {
    pid: 0x01,
    name: 'Monitor status since DTCs cleared',
    bytes: 4,
    signals: [S.MIL, S.DTCCount],
    decode: (b) => [
      { id: S.MIL, value: ((b[0] ?? 0) & 0x80) !== 0 ? 1 : 0 },
      { id: S.DTCCount, value: (b[0] ?? 0) & 0x7f },
    ],
    encode: (v) => [(val(v, S.MIL) > 0 ? 0x80 : 0) | (val(v, S.DTCCount) & 0x7f), 0x07, 0xe5, 0x00],
  },
  pct(0x04, 'Calculated engine load', S.EngineLoad),
  temp(0x05, 'Engine coolant temperature', S.CoolantTemp),
  raw8(0x0b, 'Intake manifold absolute pressure', S.MAP),
  {
    pid: 0x0c,
    name: 'Engine speed',
    bytes: 2,
    signals: [S.EngineSpeed],
    decode: (b) => [{ id: S.EngineSpeed, value: word(b) / 4 }],
    encode: (v) => u16(val(v, S.EngineSpeed) * 4),
  },
  raw8(0x0d, 'Vehicle speed', S.Speed),
  temp(0x0f, 'Intake air temperature', S.IntakeTemp),
  {
    pid: 0x10,
    name: 'Mass air flow rate',
    bytes: 2,
    signals: [S.MAF],
    decode: (b) => [{ id: S.MAF, value: word(b) / 100 }],
    encode: (v) => u16(val(v, S.MAF) * 100),
  },
  pct(0x11, 'Throttle position', S.Throttle),
  {
    pid: 0x1f,
    name: 'Run time since engine start',
    bytes: 2,
    signals: [S.RunTime],
    decode: (b) => [{ id: S.RunTime, value: word(b) }],
    encode: (v) => u16(val(v, S.RunTime)),
  },
  pct(0x2f, 'Fuel tank level input', S.FuelLevel),
  raw8(0x33, 'Absolute barometric pressure', S.BarometricPressure),
  {
    pid: 0x42,
    name: 'Control module voltage',
    bytes: 2,
    signals: [S.BatteryVoltage],
    decode: (b) => [{ id: S.BatteryVoltage, value: word(b) / 1000 }],
    encode: (v) => u16(val(v, S.BatteryVoltage) * 1000),
  },
  temp(0x46, 'Ambient air temperature', S.AmbientTemp),
  raw8(0x51, 'Fuel type', S.FuelType),
  pct(0x5b, 'Hybrid battery pack remaining life', S.SoC),
  temp(0x5c, 'Engine oil temperature', S.OilTemp),
  {
    pid: 0x5e,
    name: 'Engine fuel rate',
    bytes: 2,
    signals: [S.FuelRate],
    decode: (b) => [{ id: S.FuelRate, value: word(b) / 20 }],
    encode: (v) => u16(val(v, S.FuelRate) * 20),
  },
  {
    pid: 0xa6,
    name: 'Odometer',
    bytes: 4,
    signals: [S.Odometer],
    decode: (b) => [
      {
        id: S.Odometer,
        value: ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 65536 + word(b.slice(2))) / 10,
      },
    ],
    encode: (v) => {
      const n = Math.round(val(v, S.Odometer) * 10);
      return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
    },
  },
];

export const PID_BY_NUMBER: ReadonlyMap<number, PidDefinition> = new Map(
  PIDS.map((p) => [p.pid, p]),
);

/** PID 0x51 fuel type codes (subset). */
export const FUEL_TYPE_CODES: Record<number, 'petrol' | 'diesel' | 'electric' | 'hybrid'> = {
  1: 'petrol',
  4: 'diesel',
  8: 'electric',
  17: 'hybrid', // hybrid gasoline
  18: 'hybrid', // hybrid diesel... approximated
  20: 'hybrid', // hybrid electric
};

export const FUEL_TYPE_TO_CODE = { petrol: 1, diesel: 4, electric: 8, hybrid: 17 } as const;

/** Signals reachable through a set of supported PIDs. */
export function signalsForPids(pids: Iterable<number>): SignalId[] {
  const out = new Set<SignalId>();
  for (const pid of pids) for (const id of PID_BY_NUMBER.get(pid)?.signals ?? []) out.add(id);
  return [...out];
}

export function parsePidHex(hex: string): number {
  return parseInt(hex, 16);
}
