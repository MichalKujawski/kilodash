import { is, on, type Condition } from '@/core/alerts/conditions';
import { S } from '@/core/signals/catalog';
import type { SafetyColor } from '../themes/types';
import type { IconId } from './icons';

export interface TelltaleDefinition {
  id: string;
  icon: IconId;
  /** Convention colour; never themed. */
  color: SafetyColor;
  when: Condition;
  /** Uses the shared flasher (indicators) or a fast warning blink. */
  blink?: 'flasher' | 'warning';
}

const never: Condition = { any: [] };

/** Lamp meanings (ISO 2575 conventions). Positions live in layout data. */
export const TELLTALES: TelltaleDefinition[] = [
  {
    id: 'indicatorLeft',
    icon: 'indicatorLeft',
    color: 'info',
    when: { any: [on(S.IndicatorLeft), on(S.Hazard)] },
    blink: 'flasher',
  },
  {
    id: 'indicatorRight',
    icon: 'indicatorRight',
    color: 'info',
    when: { any: [on(S.IndicatorRight), on(S.Hazard)] },
    blink: 'flasher',
  },
  { id: 'lowBeam', icon: 'lowBeam', color: 'info', when: on(S.LowBeam) },
  { id: 'highBeam', icon: 'highBeam', color: 'highBeam', when: on(S.HighBeam) },
  { id: 'fog', icon: 'fog', color: 'info', when: on(S.FogLight) },
  { id: 'parkingBrake', icon: 'parkingBrake', color: 'danger', when: on(S.ParkingBrake) },
  { id: 'checkEngine', icon: 'checkEngine', color: 'caution', when: on(S.MIL) },
  {
    id: 'battery',
    icon: 'battery',
    color: 'danger',
    when: {
      any: [
        { all: [is(S.Ignition, '==', 2), is(S.EngineRunning, '==', 0)] },
        { all: [on(S.EngineRunning), is(S.BatteryVoltage, '<', 12.6)] },
      ],
    },
  },
  {
    id: 'oilPressure',
    icon: 'oilPressure',
    color: 'danger',
    when: { all: [is(S.Ignition, '==', 2), is(S.EngineRunning, '==', 0)] },
  },
  {
    id: 'coolantTemp',
    icon: 'coolantTemp',
    color: 'danger',
    when: is(S.CoolantTemp, '>=', 118),
    blink: 'warning',
  },
  { id: 'abs', icon: 'abs', color: 'caution', when: never },
  { id: 'airbag', icon: 'airbag', color: 'danger', when: never },
  { id: 'seatbelt', icon: 'seatbelt', color: 'danger', when: is(S.Seatbelt, '==', 0) },
  { id: 'lowFuel', icon: 'lowFuel', color: 'caution', when: is(S.FuelLevel, '<=', 12) },
  {
    id: 'doorOpen',
    icon: 'doorOpen',
    color: 'danger',
    when: {
      any: [
        on(S.DoorFrontLeft),
        on(S.DoorFrontRight),
        on(S.DoorRearLeft),
        on(S.DoorRearRight),
        on(S.Trunk),
      ],
    },
  },
  {
    id: 'tpms',
    icon: 'tpms',
    color: 'caution',
    when: {
      any: [
        is(S.TireFL, '<', 190),
        is(S.TireFR, '<', 190),
        is(S.TireRL, '<', 190),
        is(S.TireRR, '<', 190),
      ],
    },
  },
  { id: 'tcs', icon: 'tcs', color: 'caution', when: on(S.TCSActive), blink: 'warning' },
  {
    id: 'glowPlug',
    icon: 'glowPlug',
    color: 'caution',
    when: { all: [is(S.FuelType, '==', 4), is(S.Ignition, '==', 2), is(S.EngineRunning, '==', 0)] },
  },
  { id: 'ice', icon: 'ice', color: 'caution', when: is(S.AmbientTemp, '<=', 3) },
];

export const TELLTALE_BY_ID: ReadonlyMap<string, TelltaleDefinition> = new Map(
  TELLTALES.map((t) => [t.id, t]),
);
