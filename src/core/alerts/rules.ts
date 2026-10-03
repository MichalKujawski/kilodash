import { S } from '../signals/catalog';
import { is, on, type Condition } from './conditions';

export type Severity = 'critical' | 'warning' | 'info';

export interface AlertRule {
  id: string;
  severity: Severity;
  /** Raise when true (for at least `minDurationS`). */
  when: Condition;
  /** Clear when true; defaults to `not when`. Use for hysteresis. */
  clear?: Condition;
  minDurationS?: number;
  /** Telltale icon shown on the popup card. */
  icon: string;
  titleKey: string;
  messageKey: string;
  /** Re-chime every N seconds while active (critical safety reminders). */
  repeatChimeS?: number;
}

const anyDoor: Condition = {
  any: [
    on(S.DoorFrontLeft),
    on(S.DoorFrontRight),
    on(S.DoorRearLeft),
    on(S.DoorRearRight),
    on(S.Trunk),
  ],
};
const anyTireLow = (limit: number): Condition => ({
  any: [
    is(S.TireFL, '<', limit),
    is(S.TireFR, '<', limit),
    is(S.TireRL, '<', limit),
    is(S.TireRR, '<', limit),
  ],
});

/** Data-driven alert rules. Order does not matter; severity decides priority. */
export const ALERT_RULES: AlertRule[] = [
  {
    id: 'coolantHigh',
    severity: 'critical',
    when: is(S.CoolantTemp, '>=', 118),
    clear: is(S.CoolantTemp, '<', 112),
    minDurationS: 1,
    icon: 'coolantTemp',
    titleKey: 'alert.coolantHigh.title',
    messageKey: 'alert.coolantHigh.message',
    repeatChimeS: 20,
  },
  {
    id: 'oilTempHigh',
    severity: 'warning',
    when: is(S.OilTemp, '>=', 135),
    clear: is(S.OilTemp, '<', 128),
    minDurationS: 2,
    icon: 'oilPressure',
    titleKey: 'alert.oilTempHigh.title',
    messageKey: 'alert.oilTempHigh.message',
  },
  {
    id: 'charging',
    severity: 'critical',
    when: { all: [on(S.EngineRunning), is(S.BatteryVoltage, '<', 12.6)] },
    clear: { any: [is(S.BatteryVoltage, '>', 13.2), is(S.EngineRunning, '==', 0)] },
    minDurationS: 3,
    icon: 'battery',
    titleKey: 'alert.charging.title',
    messageKey: 'alert.charging.message',
  },
  {
    id: 'seatbelt',
    severity: 'critical',
    when: { all: [is(S.Seatbelt, '==', 0), is(S.Speed, '>', 15)] },
    clear: { any: [on(S.Seatbelt), is(S.Speed, '<', 5)] },
    icon: 'seatbelt',
    titleKey: 'alert.seatbelt.title',
    messageKey: 'alert.seatbelt.message',
    repeatChimeS: 6,
  },
  {
    id: 'doorOpenMoving',
    severity: 'critical',
    when: { all: [anyDoor, is(S.Speed, '>', 3)] },
    clear: { not: anyDoor },
    icon: 'doorOpen',
    titleKey: 'alert.doorOpenMoving.title',
    messageKey: 'alert.doorOpenMoving.message',
    repeatChimeS: 8,
  },
  {
    id: 'doorOpen',
    severity: 'info',
    when: { all: [anyDoor, { not: is(S.Speed, '>', 3) }] },
    icon: 'doorOpen',
    titleKey: 'alert.doorOpen.title',
    messageKey: 'alert.doorOpen.message',
  },
  {
    id: 'checkEngine',
    severity: 'warning',
    when: on(S.MIL),
    minDurationS: 1,
    icon: 'checkEngine',
    titleKey: 'alert.checkEngine.title',
    messageKey: 'alert.checkEngine.message',
  },
  {
    id: 'lowFuel',
    severity: 'warning',
    when: is(S.FuelLevel, '<=', 12),
    clear: is(S.FuelLevel, '>', 15),
    minDurationS: 3,
    icon: 'lowFuel',
    titleKey: 'alert.lowFuel.title',
    messageKey: 'alert.lowFuel.message',
  },
  {
    id: 'lowBattery',
    severity: 'warning',
    when: { all: [is(S.SoC, '<=', 15), { not: { signal: S.FuelLevel, op: '>=', value: 0 } }] },
    clear: is(S.SoC, '>', 18),
    minDurationS: 3,
    icon: 'battery',
    titleKey: 'alert.lowBattery.title',
    messageKey: 'alert.lowBattery.message',
  },
  {
    id: 'tpms',
    severity: 'warning',
    when: anyTireLow(190),
    clear: { not: anyTireLow(200) },
    minDurationS: 2,
    icon: 'tpms',
    titleKey: 'alert.tpms.title',
    messageKey: 'alert.tpms.message',
  },
  {
    id: 'ice',
    severity: 'info',
    when: is(S.AmbientTemp, '<=', 3),
    clear: is(S.AmbientTemp, '>', 4),
    minDurationS: 1,
    icon: 'ice',
    titleKey: 'alert.ice.title',
    messageKey: 'alert.ice.message',
  },
];
