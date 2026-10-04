/** Driving modes (generic names; availability depends on equipment). */
export type DriveModeId =
  'eco' | 'comfort' | 'normal' | 'sport' | 'individual' | 'snow' | 'offroad';

/** Signal encoding of the driving mode (Vehicle.Powertrain.DriveMode). */
export const DRIVE_MODE_ORDER: DriveModeId[] = [
  'eco',
  'comfort',
  'normal',
  'sport',
  'individual',
  'snow',
  'offroad',
];

export type ThrottleMap = 'eco' | 'soft' | 'linear' | 'sport' | 'snow' | 'offroad';
export type GearboxProgram = 'E' | 'D' | 'S' | 'snow' | 'offroad';
export type Level = 'eco' | 'normal' | 'sport';

/** Everything a mode changes, consumed by the simulator and the cluster. */
export interface ModeParams {
  throttle: ThrottleMap;
  gearbox: GearboxProgram;
  /** Freewheeling with the clutch open when the pedals are released (dual-clutch/automatic). */
  coasting: boolean;
  steering: 'light' | 'medium' | 'heavy';
  dampers: 'soft' | 'normal' | 'firm';
  ac: 'eco' | 'normal';
  acc: 'gentle' | 'normal' | 'dynamic' | 'gentleLargeGap';
  sound: 'quiet' | 'normal' | 'loud';
  esc: 'normal' | 'lowGrip' | 'offroad';
  /** Cluster accent colour; null keeps the theme's own. */
  accent: string | null;
  autoView: 'classic' | 'classicEfficiency' | 'sport' | 'offroad';
  /** EV only: fraction of motor power available, top speed cap. */
  evPower: number;
  evTopSpeedKmh: number | null;
}

export interface ModeDefinition {
  id: DriveModeId;
  label: string;
  /** Icon id in the telltale/icon set. */
  icon: string;
  params: ModeParams;
}

const base: ModeParams = {
  throttle: 'linear',
  gearbox: 'D',
  coasting: false,
  steering: 'medium',
  dampers: 'normal',
  ac: 'normal',
  acc: 'normal',
  sound: 'normal',
  esc: 'normal',
  accent: null,
  autoView: 'classic',
  evPower: 1,
  evTopSpeedKmh: null,
};

/** Mode table (see docs/features/drive-modes.md for the research behind it). */
export const MODES: Record<DriveModeId, ModeDefinition> = {
  eco: {
    id: 'eco',
    label: 'Eco',
    icon: 'modeEco',
    params: {
      ...base,
      throttle: 'eco',
      gearbox: 'E',
      coasting: true,
      steering: 'light',
      ac: 'eco',
      acc: 'gentle',
      sound: 'quiet',
      accent: '#3ccf8e',
      autoView: 'classicEfficiency',
      evPower: 0.6,
      evTopSpeedKmh: 130,
    },
  },
  comfort: {
    id: 'comfort',
    label: 'Comfort',
    icon: 'modeComfort',
    params: {
      ...base,
      throttle: 'soft',
      steering: 'light',
      dampers: 'soft',
      acc: 'gentle',
      sound: 'quiet',
    },
  },
  normal: { id: 'normal', label: 'Normal', icon: 'modeNormal', params: { ...base } },
  sport: {
    id: 'sport',
    label: 'Sport',
    icon: 'modeSport',
    params: {
      ...base,
      throttle: 'sport',
      gearbox: 'S',
      steering: 'heavy',
      dampers: 'firm',
      acc: 'dynamic',
      sound: 'loud',
      accent: '#ff3b2f',
      autoView: 'sport',
    },
  },
  individual: {
    id: 'individual',
    label: 'Individual',
    icon: 'modeIndividual',
    params: { ...base },
  },
  snow: {
    id: 'snow',
    label: 'Snow',
    icon: 'modeSnow',
    params: {
      ...base,
      throttle: 'snow',
      gearbox: 'snow',
      acc: 'gentleLargeGap',
      esc: 'lowGrip',
      accent: '#7cc6ff',
    },
  },
  offroad: {
    id: 'offroad',
    label: 'Off-road',
    icon: 'modeOffroad',
    params: {
      ...base,
      throttle: 'offroad',
      gearbox: 'offroad',
      steering: 'light',
      esc: 'offroad',
      accent: '#e0a040',
      autoView: 'offroad',
    },
  },
};

/** Individual mode: each subsystem set separately. Coasting is never used in Individual. */
export interface IndividualSettings {
  engine: Level;
  gearbox: Level;
  steering: Level;
  dampers: Level;
  ac: Level;
  acc: Level;
  sound: Level;
}

export const DEFAULT_INDIVIDUAL: IndividualSettings = {
  engine: 'normal',
  gearbox: 'normal',
  steering: 'normal',
  dampers: 'normal',
  ac: 'normal',
  acc: 'normal',
  sound: 'normal',
};

export function individualParams(s: IndividualSettings): ModeParams {
  const pick = <T>(l: Level, eco: T, normal: T, sport: T): T =>
    l === 'eco' ? eco : l === 'sport' ? sport : normal;
  return {
    ...base,
    throttle: pick<ThrottleMap>(s.engine, 'eco', 'linear', 'sport'),
    gearbox: pick<GearboxProgram>(s.gearbox, 'E', 'D', 'S'),
    coasting: false,
    steering: pick(s.steering, 'light', 'medium', 'heavy'),
    dampers: pick(s.dampers, 'soft', 'normal', 'firm'),
    ac: s.ac === 'eco' ? 'eco' : 'normal',
    acc: pick(s.acc, 'gentle', 'normal', 'dynamic'),
    sound: pick(s.sound, 'quiet', 'normal', 'loud'),
  };
}

/** Pedal position → torque request (0..1). */
export function throttleMap(map: ThrottleMap, pedal: number): number {
  const p = Math.max(0, Math.min(1, pedal));
  switch (map) {
    case 'eco':
      return 0.85 * Math.pow(p, 1.5) + 0.15 * Math.pow(p, 4);
    case 'soft':
      return Math.pow(p, 1.2);
    case 'sport':
      return 1 - Math.pow(1 - p, 1.7);
    case 'snow':
      return 0.7 * Math.pow(p, 1.8);
    case 'offroad':
      return Math.pow(p, 1.6);
    default:
      return p;
  }
}

/** Modes a car offers, from its equipment. */
export function availableModes(eq: {
  adaptiveDampers?: boolean;
  awd?: boolean;
  driveModes?: boolean;
}): DriveModeId[] {
  if (eq.driveModes === false) return [];
  const list: DriveModeId[] = ['eco'];
  if (eq.adaptiveDampers) list.push('comfort');
  list.push('normal', 'sport', 'individual');
  if (eq.awd) list.push('snow', 'offroad');
  return list;
}
