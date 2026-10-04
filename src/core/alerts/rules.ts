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
    // ACC needs more braking than it may use: red, urgent chime until handled.
    id: 'accTakeover',
    severity: 'critical',
    when: on(S.AccTakeover),
    icon: 'acc',
    titleKey: 'alert.accTakeover.title',
    messageKey: 'alert.accTakeover.message',
    repeatChimeS: 1.5,
  },
  {
    id: 'collisionWarning',
    severity: 'critical',
    when: { any: [is(S.FcwState, '==', 3), is(S.FcwState, '==', 4)] },
    icon: 'collision',
    titleKey: 'alert.collisionWarning.title',
    messageKey: 'alert.collisionWarning.message',
    repeatChimeS: 0.8,
  },
  {
    id: 'emergencyBraking',
    severity: 'critical',
    when: { any: [is(S.FcwState, '==', 5), is(S.FcwState, '==', 6)] },
    icon: 'collision',
    titleKey: 'alert.emergencyBraking.title',
    messageKey: 'alert.emergencyBraking.message',
  },
  {
    id: 'distanceWarning',
    severity: 'info',
    when: is(S.FcwState, '==', 2),
    icon: 'distance',
    titleKey: 'alert.distanceWarning.title',
    messageKey: 'alert.distanceWarning.message',
  },
  {
    id: 'fcwUnavailable',
    severity: 'warning',
    when: is(S.FcwState, '==', 7),
    minDurationS: 2,
    icon: 'collision',
    titleKey: 'alert.fcwUnavailable.title',
    messageKey: 'alert.fcwUnavailable.message',
  },
  {
    id: 'blindSpot',
    severity: 'warning',
    when: { any: [is(S.BlindSpotLeft, '==', 2), is(S.BlindSpotRight, '==', 2)] },
    icon: 'blindSpot',
    titleKey: 'alert.blindSpot.title',
    messageKey: 'alert.blindSpot.message',
  },
  {
    id: 'crossTraffic',
    severity: 'warning',
    when: is(S.CrossTraffic, '>=', 1),
    icon: 'crossTraffic',
    titleKey: 'alert.crossTraffic.title',
    messageKey: 'alert.crossTraffic.message',
    repeatChimeS: 1,
  },
  {
    id: 'restartRequired',
    severity: 'warning',
    when: is(S.StartStopState, '==', 4),
    icon: 'startStop',
    titleKey: 'alert.restartRequired.title',
    messageKey: 'alert.restartRequired.message',
  },
  {
    id: 'dpf',
    severity: 'warning',
    when: is(S.DpfLoad, '>=', 80),
    clear: is(S.DpfLoad, '<', 60),
    minDurationS: 2,
    icon: 'dpf',
    titleKey: 'alert.dpf.title',
    messageKey: 'alert.dpf.message',
  },
  {
    id: 'defLow',
    severity: 'warning',
    when: { all: [is(S.DefRange, '<', 2400), is(S.DefRange, '>=', 1000)] },
    minDurationS: 2,
    icon: 'def',
    titleKey: 'alert.defLow.title',
    messageKey: 'alert.defLow.message',
  },
  {
    id: 'defUrgent',
    severity: 'critical',
    when: is(S.DefRange, '<', 1000),
    minDurationS: 2,
    icon: 'def',
    titleKey: 'alert.defUrgent.title',
    messageKey: 'alert.defUrgent.message',
  },
  {
    id: 'handsOff1',
    severity: 'info',
    when: is(S.HandsOffStage, '==', 1),
    icon: 'steering',
    titleKey: 'alert.handsOff1.title',
    messageKey: 'alert.handsOff1.message',
  },
  {
    id: 'handsOff2',
    severity: 'warning',
    when: is(S.HandsOffStage, '==', 2),
    icon: 'steering',
    titleKey: 'alert.handsOff2.title',
    messageKey: 'alert.handsOff2.message',
  },
  {
    id: 'handsOff3',
    severity: 'critical',
    when: is(S.HandsOffStage, '==', 3),
    icon: 'steering',
    titleKey: 'alert.handsOff3.title',
    messageKey: 'alert.handsOff3.message',
    repeatChimeS: 2,
  },
  {
    id: 'emergencyStop',
    severity: 'critical',
    when: is(S.HandsOffStage, '==', 4),
    icon: 'steering',
    titleKey: 'alert.emergencyStop.title',
    messageKey: 'alert.emergencyStop.message',
    repeatChimeS: 3,
  },
  {
    id: 'limiterExceeded',
    severity: 'warning',
    when: on(S.LimiterExceeded),
    icon: 'limiter',
    titleKey: 'alert.limiterExceeded.title',
    messageKey: 'alert.limiterExceeded.message',
  },
  {
    id: 'accDriveOff',
    severity: 'info',
    when: on(S.AccLeadDrivingOff),
    icon: 'acc',
    titleKey: 'alert.accDriveOff.title',
    messageKey: 'alert.accDriveOff.message',
  },
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
    // Reminded every 10 minutes while on reserve.
    repeatChimeS: 600,
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
