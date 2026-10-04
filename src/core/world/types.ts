/** Kind of road a route segment is on. Drives implicit limits, lanes, scenery and assist behaviour. */
export type RoadKind = 'parking' | 'urban' | 'zone30' | 'rural' | 'ramp' | 'motorway';

/** One arc of constant curvature (1/m, positive = right-hand bend) along a segment. */
export interface Arc {
  /** Start, metres from the segment start. */
  at: number;
  length: number;
  curvature: number;
}

export type SignKind =
  | 'limit'
  | 'limitEnd'
  | 'endAll'
  | 'noOvertaking'
  | 'noOvertakingEnd'
  | 'townEntry'
  | 'townExit'
  | 'zone30Start'
  | 'zone30End'
  | 'motorwayStart'
  | 'motorwayEnd'
  | 'tunnel'
  | 'exitAnnounce';

/** Supplementary plate under a sign. */
export type Plate = { kind: 'wet' } | { kind: 'time'; from: number; to: number };

export interface Sign {
  /** Route position, m. */
  s: number;
  kind: SignKind;
  value?: number;
  text?: string;
  plate?: Plate;
  /** Temporary (roadworks) sign: yellow background in Germany. */
  temporary?: boolean;
  /** Probability the front camera reads it (obstructed or dirty signs are lower). */
  visibility: number;
}

export type FeatureKind =
  | 'trafficLight'
  | 'junction'
  | 'roundabout'
  | 'fuelStation'
  | 'motorwayJoin'
  | 'motorwayExit'
  | 'destination';

export interface Feature {
  s: number;
  kind: FeatureKind;
  /** Turn direction for junctions / ramps. */
  turn?: 'left' | 'right' | 'straight';
  /** Roundabout exit number. */
  exit?: number;
  /** Road name after the manoeuvre, or exit name. */
  name?: string;
  /** Traffic light timing phase offset, s. */
  phase?: number;
}

/** Scripted traffic situations placed on the route. */
export type EventKind = 'slowTruck' | 'queue' | 'hardBrake';

export interface RouteEvent {
  s: number;
  kind: EventKind;
  /** Length of the affected stretch (queue), m. */
  length?: number;
}

/** Data for one segment of the route template. */
export interface SegmentSpec {
  kind: RoadKind;
  name: string;
  length: number;
  /** Lanes in the direction of travel. */
  lanes: number;
  town?: string;
  arcs?: Arc[];
  /** [position m, gradient rise/run] points, linear in between. */
  gradient?: [number, number][];
  tunnel?: [number, number];
  /** Signs, features and events with `at` relative to the segment start. */
  signs?: (Omit<Sign, 's' | 'visibility'> & { at: number; visibility?: number })[];
  features?: (Omit<Feature, 's'> & { at: number })[];
  events?: (Omit<RouteEvent, 's'> & { at: number })[];
  /** Lanes reduced from this point (roadworks), relative [from, to, lanes]. */
  laneDrop?: [number, number, number];
}

export interface Segment extends Omit<SegmentSpec, 'signs' | 'features' | 'events'> {
  index: number;
  /** Absolute start position on the route, m. */
  s0: number;
}

/** Sampled route geometry. */
export interface RoutePoint {
  s: number;
  x: number;
  y: number;
  heading: number;
  curvature: number;
  gradient: number;
  elevation: number;
}
