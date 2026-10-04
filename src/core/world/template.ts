import type { Arc, SegmentSpec } from './types';

const DEG = Math.PI / 180;

/** A turn of `angle` degrees at a junction, as an arc (right = positive curvature). */
function turn(at: number, dir: 'left' | 'right', radius = 12, angle = 90): Arc {
  const k = (dir === 'right' ? 1 : -1) / radius;
  return { at, length: radius * angle * DEG, curvature: k };
}

/** A gentle bend of `angle` degrees with the given radius. */
function bend(at: number, dir: 'left' | 'right', radius: number, angle: number): Arc {
  return turn(at, dir, radius, angle);
}

/**
 * Germany-style demo route (~21 km, fictional places): leave a station car park
 * in Neustadt, cross town (traffic lights, school-hours 30, a 30 zone, a
 * roundabout), a winding rural road through Altdorf with a slow truck in a
 * no-overtaking stretch, the A 7 Autobahn (unlimited, 120, tunnel, roadworks
 * with a jam, wet-weather limit, sudden braking ahead), exit to Waldheim, past
 * a fuel station, and into a car park.
 */
export const DEMO_ROUTE: SegmentSpec[] = [
  {
    kind: 'parking',
    name: 'Parkplatz am Bahnhof',
    town: 'Neustadt',
    length: 55,
    lanes: 1,
  },
  {
    kind: 'urban',
    name: 'Bahnhofstraße',
    town: 'Neustadt',
    length: 650,
    lanes: 1,
    arcs: [turn(0, 'right', 10), bend(200, 'left', 400, 12)],
    features: [
      { at: 0, kind: 'junction', turn: 'right', name: 'Bahnhofstraße' },
      { at: 380, kind: 'trafficLight', phase: 0 },
    ],
  },
  {
    kind: 'urban',
    name: 'Hauptstraße',
    town: 'Neustadt',
    length: 900,
    lanes: 1,
    arcs: [turn(0, 'left'), bend(520, 'right', 260, 14)],
    signs: [
      { at: 120, kind: 'limit', value: 30, plate: { kind: 'time', from: 7, to: 17 } },
      { at: 330, kind: 'limitEnd', value: 30, visibility: 0.6 },
    ],
    features: [
      { at: 0, kind: 'junction', turn: 'left', name: 'Hauptstraße' },
      { at: 640, kind: 'trafficLight', phase: 14 },
    ],
  },
  {
    kind: 'zone30',
    name: 'Lindenweg',
    town: 'Neustadt',
    length: 520,
    lanes: 1,
    arcs: [turn(0, 'right'), bend(260, 'left', 120, 20)],
    signs: [
      { at: 22, kind: 'zone30Start' },
      { at: 505, kind: 'zone30End' },
    ],
    features: [{ at: 0, kind: 'junction', turn: 'right', name: 'Lindenweg' }],
  },
  {
    kind: 'urban',
    name: 'Schulstraße',
    town: 'Neustadt',
    length: 420,
    lanes: 1,
    arcs: [turn(0, 'right')],
    features: [{ at: 0, kind: 'junction', turn: 'right', name: 'Schulstraße' }],
  },
  {
    kind: 'urban',
    name: 'Waldstraße',
    town: 'Neustadt',
    length: 720,
    lanes: 1,
    // Roundabout (counter-clockwise), second exit: in right, round left, out right.
    arcs: [
      turn(0, 'right', 10, 55),
      turn(9.6, 'left', 15, 110),
      turn(38.4, 'right', 10, 55),
      bend(400, 'right', 300, 10),
    ],
    signs: [{ at: 690, kind: 'townExit', text: 'Neustadt' }],
    features: [{ at: 0, kind: 'roundabout', exit: 2, name: 'Waldstraße' }],
  },
  {
    kind: 'rural',
    name: 'L 1180',
    length: 3600,
    lanes: 1,
    arcs: [
      bend(300, 'right', 450, 25),
      bend(800, 'left', 200, 50),
      bend(1300, 'right', 95, 75),
      bend(1900, 'left', 500, 20),
      bend(2350, 'right', 350, 30),
      bend(3000, 'left', 600, 15),
    ],
    gradient: [
      [0, 0],
      [1600, 0.05],
      [2050, 0.05],
      [2250, 0],
      [2500, -0.06],
      [2900, -0.06],
      [3100, 0],
    ],
    signs: [
      { at: 1150, kind: 'limit', value: 70 },
      { at: 1520, kind: 'limitEnd', value: 70, visibility: 0.7 },
      { at: 1640, kind: 'noOvertaking' },
      { at: 2420, kind: 'noOvertakingEnd' },
      { at: 2700, kind: 'townEntry', text: 'Altdorf' },
      { at: 3180, kind: 'townExit', text: 'Altdorf' },
      { at: 3320, kind: 'limit', value: 70, plate: { kind: 'wet' } },
    ],
    events: [{ at: 1700, kind: 'slowTruck' }],
  },
  {
    kind: 'ramp',
    name: 'A 7 Nordhausen',
    length: 480,
    lanes: 1,
    arcs: [bend(40, 'left', 160, 85)],
    signs: [{ at: 460, kind: 'motorwayStart' }],
    features: [{ at: 0, kind: 'motorwayJoin', turn: 'left', name: 'A 7' }],
  },
  {
    kind: 'motorway',
    name: 'A 7',
    length: 9500,
    lanes: 3,
    arcs: [
      bend(1000, 'right', 1600, 14),
      bend(4100, 'left', 2200, 12),
      bend(7400, 'right', 1300, 18),
    ],
    gradient: [
      [0, 0],
      [1500, 0.02],
      [2600, 0.02],
      [3200, -0.015],
      [5000, 0],
    ],
    tunnel: [3600, 4400],
    laneDrop: [5950, 6950, 2],
    signs: [
      { at: 2500, kind: 'limit', value: 120 },
      { at: 3380, kind: 'tunnel' },
      // Hidden behind a truck at the tunnel portal: the camera never reads it.
      { at: 3400, kind: 'limit', value: 100, visibility: 0 },
      { at: 4650, kind: 'endAll' },
      { at: 5600, kind: 'limit', value: 80, temporary: true },
      { at: 5900, kind: 'noOvertaking', temporary: true, visibility: 0.5 },
      { at: 7050, kind: 'endAll', temporary: true },
      { at: 7600, kind: 'limit', value: 130, plate: { kind: 'wet' } },
      { at: 8450, kind: 'exitAnnounce', value: 1000, text: '23 Waldheim' },
      { at: 8950, kind: 'exitAnnounce', value: 500, text: '23 Waldheim' },
    ],
    features: [{ at: 9420, kind: 'motorwayExit', turn: 'right', exit: 23, name: 'Waldheim' }],
    events: [
      { at: 6150, kind: 'queue', length: 650 },
      { at: 8150, kind: 'hardBrake' },
    ],
  },
  {
    kind: 'ramp',
    name: 'Ausfahrt Waldheim',
    length: 600,
    lanes: 1,
    arcs: [bend(80, 'right', 110, 70)],
    signs: [
      { at: 20, kind: 'motorwayEnd' },
      { at: 60, kind: 'limit', value: 60 },
      { at: 560, kind: 'limitEnd', value: 60 },
    ],
  },
  {
    kind: 'rural',
    name: 'B 27',
    length: 2600,
    lanes: 1,
    arcs: [bend(500, 'left', 700, 25), bend(1500, 'right', 900, 20)],
    signs: [{ at: 2560, kind: 'townEntry', text: 'Waldheim' }],
  },
  {
    kind: 'urban',
    name: 'Marktstraße',
    town: 'Waldheim',
    length: 820,
    lanes: 1,
    arcs: [bend(450, 'left', 300, 15)],
    features: [
      { at: 300, kind: 'trafficLight', phase: 6 },
      { at: 560, kind: 'fuelStation', turn: 'right' },
    ],
  },
  {
    kind: 'urban',
    name: 'Parkstraße',
    town: 'Waldheim',
    length: 300,
    lanes: 1,
    arcs: [turn(0, 'right')],
    features: [{ at: 0, kind: 'junction', turn: 'right', name: 'Parkstraße' }],
  },
  {
    kind: 'parking',
    name: 'Parkplatz Waldheim',
    town: 'Waldheim',
    length: 76,
    lanes: 1,
    // Into the car park, along the aisle, then left into a bay facing a wall.
    arcs: [turn(0, 'left', 10), turn(62, 'left', 5)],
    features: [
      { at: 0, kind: 'junction', turn: 'left', name: 'Parkplatz Waldheim' },
      { at: 75.5, kind: 'destination', name: 'Parkplatz Waldheim' },
    ],
  },
];
