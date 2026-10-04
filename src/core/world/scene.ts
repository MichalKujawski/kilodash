import type { DriveModeState } from '../drive/DriveModeController';
import type { EfficiencyState } from '../drive/efficiency';
import type { LegalLimit, Route } from './route';
import type { Weather, Surface } from './environment';
import type { NavState } from './navigation';
import type { VehicleKind } from './traffic';
import type { RoadKind, Sign } from './types';

/** Another road user relative to the ego car (like a camera/radar object list). */
export interface SceneObject {
  id: number;
  kind: VehicleKind;
  /** Longitudinal distance from the ego front bumper to the object's rear (ahead > 0), m. */
  dx: number;
  /** Lane offset from the ego lane (+1 = one lane to the left). */
  laneOffset: number;
  /** Speed, m/s (oncoming: speed towards us). */
  v: number;
  braking: boolean;
  oncoming: boolean;
  length: number;
}

export type LightState = 'green' | 'amber' | 'red' | 'redAmber';

export interface SceneSnapshot {
  route: Route;
  time: number;
  ego: {
    s: number;
    lane: number;
    lanes: number;
    x: number;
    y: number;
    heading: number;
    /** Lateral offset from the lane centre, m (+ = left). */
    lateral: number;
    direction: 1 | -1;
    /** Still in the starting bay manoeuvre. */
    inBay: boolean;
  };
  road: {
    kind: RoadKind;
    name: string;
    town?: string;
    curvature: number;
    gradient: number;
    elevation: number;
    inTunnel: boolean;
  };
  legal: LegalLimit;
  /** Signs passed in the last few seconds (for the front camera). */
  passedSigns: Sign[];
  objects: SceneObject[];
  /** Vehicle directly ahead in the ego lane. */
  lead: SceneObject | null;
  trafficLight: { distance: number; state: LightState } | null;
  /** Distance to an obstacle ahead/behind at parking speed (wall, parked car), m. */
  obstacleAhead: number | null;
  obstacleBehind: number | null;
  nav: NavState;
  env: {
    hour: number;
    weather: Weather;
    temperatureC: number;
    surface: Surface;
    light: number;
    rain: number;
    wet: boolean;
  };
  /** Driving-mode list / Individual screen state (the car's own UI data). */
  driveModes?: DriveModeState;
  efficiency?: EfficiencyState;
}
