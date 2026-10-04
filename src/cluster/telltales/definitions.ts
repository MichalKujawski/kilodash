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

/** Engine switched off by start-stop: charge and oil lamps stay dark. */
const notAutoStopped: Condition = { not: is(S.StartStopState, '==', 2) };

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
        { all: [is(S.Ignition, '==', 2), is(S.EngineRunning, '==', 0), notAutoStopped] },
        { all: [on(S.EngineRunning), is(S.BatteryVoltage, '<', 12.6)] },
      ],
    },
  },
  {
    id: 'oilPressure',
    icon: 'oilPressure',
    color: 'danger',
    when: {
      any: [
        { all: [is(S.Ignition, '==', 2), is(S.EngineRunning, '==', 0), notAutoStopped] },
        { all: [on(S.EngineRunning), on(S.OilPressureLow)] },
      ],
    },
  },
  {
    id: 'coolantTemp',
    icon: 'coolantTemp',
    color: 'danger',
    when: is(S.CoolantTemp, '>=', 118),
    blink: 'warning',
  },
  { id: 'abs', icon: 'abs', color: 'caution', when: on(S.AbsFault) },
  { id: 'airbag', icon: 'airbag', color: 'danger', when: on(S.AirbagFault) },
  { id: 'brake', icon: 'brake', color: 'danger', when: on(S.BrakeFluidLow) },
  { id: 'steeringFault', icon: 'steeringFault', color: 'caution', when: on(S.PowerSteeringFault) },
  // Seat-belt reminder: steady lamp, flashing during the chime phase (same position).
  {
    id: 'seatbelt',
    icon: 'seatbelt',
    color: 'danger',
    when: { any: [is(S.SeatbeltReminder, '==', 1), is(S.SeatbeltReminder, '==', 3)] },
  },
  {
    id: 'seatbeltFlash',
    icon: 'seatbelt',
    color: 'danger',
    when: is(S.SeatbeltReminder, '==', 2),
    blink: 'warning',
  },
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
        on(S.TpmsWarning),
      ],
    },
  },
  { id: 'tcs', icon: 'tcs', color: 'caution', when: on(S.TCSActive), blink: 'warning' },
  { id: 'escOff', icon: 'escOff', color: 'caution', when: is(S.ESCMode, '>', 0) },
  { id: 'autoHold', icon: 'autoHold', color: 'info', when: is(S.AutoHoldState, '==', 2) },
  {
    id: 'autoHighBeam',
    icon: 'autoHighBeam',
    color: 'info',
    when: { all: [on(S.AutoHighBeamArmed), { not: on(S.HighBeam) }] },
  },
  {
    id: 'wiperAuto',
    icon: 'wiperAuto',
    color: 'info',
    when: { all: [is(S.Wipers, '==', 1), on(S.LowBeam)] },
  },
  { id: 'dpf', icon: 'dpf', color: 'caution', when: is(S.DpfLoad, '>=', 80) },
  {
    id: 'def',
    icon: 'def',
    color: 'caution',
    when: { all: [is(S.DefRange, '<', 2400), is(S.DefRange, '>=', 0)] },
  },
  // Collision warning switched off (it is on again at every start).
  {
    id: 'fcwOff',
    icon: 'collisionOff',
    color: 'caution',
    when: { all: [is(S.FcwState, '==', 0), is(S.Ignition, '>=', 2)] },
  },
  {
    id: 'parkingLights',
    icon: 'parkingLights',
    color: 'info',
    when: { all: [on(S.ParkingLights), { not: on(S.LowBeam) }] },
  },
  { id: 'fogRear', icon: 'fogRear', color: 'caution', when: on(S.FogRear) },
  {
    id: 'glowPlug',
    icon: 'glowPlug',
    color: 'caution',
    when: on(S.GlowPlug),
  },
  { id: 'ice', icon: 'ice', color: 'caution', when: is(S.AmbientTemp, '<=', 3) },
];

export const TELLTALE_BY_ID: ReadonlyMap<string, TelltaleDefinition> = new Map(
  TELLTALES.map((t) => [t.id, t]),
);
