import type { DriveSegment } from './autodriver';

export type ScenarioId = 'city' | 'highway' | 'mountain' | 'track' | 'night' | 'coldStart';

export interface Scenario {
  id: ScenarioId;
  nameKey: string;
  env: { ambientC: number; lightIntensity: number; grip?: number };
  /** Start with the ignition off and run the start-up sequence first. */
  startOff?: boolean;
  /** Engine starts at ambient temperature. */
  cold?: boolean;
  /** Paddle-shifting driver (track). */
  manual?: boolean;
  steps: DriveSegment[];
}

const R = (radiusM: number): number => 1 / radiusM; // right-hand bend
const L = (radiusM: number): number => -1 / radiusM; // left-hand bend

export const SCENARIOS: Scenario[] = [
  {
    id: 'city',
    nameKey: 'scenario.city',
    env: { ambientC: 16, lightIntensity: 85 },
    steps: [
      { targetKmh: 50, aggression: 0.45, holdS: 6 },
      { targetKmh: 0, aggression: 0.5, holdS: 5 },
      { targetKmh: 30, aggression: 0.4, holdS: 1, indicator: 'right' },
      { targetKmh: 20, aggression: 0.3, holdS: 3, curvature: R(14), indicator: 'right' },
      { targetKmh: 50, aggression: 0.5, holdS: 8 },
      { targetKmh: 30, aggression: 0.3, holdS: 1.5, indicator: 'left' },
      { targetKmh: 20, aggression: 0.3, holdS: 3, curvature: L(14), indicator: 'left' },
      { targetKmh: 45, aggression: 0.45, holdS: 6 },
      { targetKmh: 0, aggression: 0.5, holdS: 6 },
    ],
  },
  {
    id: 'highway',
    nameKey: 'scenario.highway',
    env: { ambientC: 19, lightIntensity: 90 },
    steps: [
      { targetKmh: 80, aggression: 0.7, holdS: 1, indicator: 'left' },
      { targetKmh: 120, aggression: 0.8, holdS: 3, curvature: R(900) },
      { targetKmh: 130, aggression: 0.5, holdS: 14, cruise: true },
      { targetKmh: 150, aggression: 1, holdS: 4, indicator: 'left' },
      { targetKmh: 135, aggression: 0.4, holdS: 3, indicator: 'right' },
      { targetKmh: 135, aggression: 0.5, holdS: 14, cruise: true, curvature: L(1200) },
      { targetKmh: 90, aggression: 0.3, holdS: 4, indicator: 'right' },
    ],
  },
  {
    id: 'mountain',
    nameKey: 'scenario.mountain',
    env: { ambientC: 9, lightIntensity: 75 },
    steps: [
      { targetKmh: 70, aggression: 0.6, holdS: 3, gradient: 0.05 },
      { targetKmh: 55, aggression: 0.6, holdS: 4, curvature: R(60), gradient: 0.07 },
      { targetKmh: 65, aggression: 0.6, holdS: 3, curvature: L(80), gradient: 0.06 },
      { targetKmh: 40, aggression: 0.5, holdS: 4, curvature: R(35), gradient: 0.08 },
      { targetKmh: 75, aggression: 0.5, holdS: 3, gradient: -0.07 },
      { targetKmh: 55, aggression: 0.4, holdS: 4, curvature: L(55), gradient: -0.08 },
      { targetKmh: 70, aggression: 0.4, holdS: 4, curvature: R(90), gradient: -0.06 },
      { targetKmh: 45, aggression: 0.4, holdS: 4, curvature: L(40), gradient: -0.07 },
    ],
  },
  {
    id: 'track',
    nameKey: 'scenario.track',
    env: { ambientC: 22, lightIntensity: 95 },
    manual: true,
    steps: [
      { targetKmh: 0, aggression: 1, holdS: 2 },
      { targetKmh: 185, aggression: 1, holdS: 0.3 },
      { targetKmh: 80, aggression: 1, holdS: 2.5, curvature: R(60) },
      { targetKmh: 160, aggression: 1, holdS: 0.3 },
      { targetKmh: 65, aggression: 1, holdS: 2.5, curvature: L(40) },
      { targetKmh: 205, aggression: 1, holdS: 0.5 },
      { targetKmh: 110, aggression: 1, holdS: 3, curvature: R(110) },
      { targetKmh: 150, aggression: 1, holdS: 0.5 },
      { targetKmh: 90, aggression: 1, holdS: 2, curvature: L(70) },
    ],
  },
  {
    id: 'night',
    nameKey: 'scenario.night',
    env: { ambientC: 6, lightIntensity: 3 },
    steps: [
      { targetKmh: 90, aggression: 0.6, holdS: 6, highBeam: true },
      { targetKmh: 90, aggression: 0.5, holdS: 5, highBeam: false },
      { targetKmh: 70, aggression: 0.5, holdS: 5, curvature: R(150), highBeam: true },
      { targetKmh: 100, aggression: 0.6, holdS: 7, highBeam: true },
      { targetKmh: 60, aggression: 0.4, holdS: 4, highBeam: false, indicator: 'right' },
      { targetKmh: 50, aggression: 0.4, holdS: 6 },
    ],
  },
  {
    id: 'coldStart',
    nameKey: 'scenario.coldStart',
    env: { ambientC: -3, lightIntensity: 60, grip: 0.55 },
    startOff: true,
    cold: true,
    steps: [
      { targetKmh: 0, holdS: 1.5, action: 'unbelt' },
      { targetKmh: 0, holdS: 2.5, action: 'ignitionOn' },
      { targetKmh: 0, holdS: 7, action: 'start' },
      { targetKmh: 25, aggression: 0.25, holdS: 4 },
      { targetKmh: 25, holdS: 0.5, action: 'belt' },
      { targetKmh: 45, aggression: 0.3, holdS: 10 },
      { targetKmh: 0, aggression: 0.3, holdS: 4 },
      { targetKmh: 0, holdS: 3, action: 'ignitionOff' },
    ],
  },
];

export const SCENARIO_BY_ID: ReadonlyMap<ScenarioId, Scenario> = new Map(
  SCENARIOS.map((s) => [s.id, s]),
);

/** Start-up prelude used whenever a session begins with the ignition off. */
export const START_SEQUENCE: DriveSegment[] = [
  { targetKmh: 0, holdS: 0.5 },
  { targetKmh: 0, holdS: 0.4, action: 'ignitionOn' },
  { targetKmh: 0, holdS: 1.9, action: 'start' },
];
