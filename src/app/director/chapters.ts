import type { DriveModeId } from '@/core/drive/modes';
import type { Weather } from '@/core/world/environment';
import type { ViewId } from '@/cluster/layouts/views';

/** Where a chapter starts: a named place, a route position, the starting bay or the destination. */
export type ChapterPlace =
  | { place: string; kmh: number; lane?: number }
  | { segment: string; at: number; kmh: number; lane?: number }
  | { bay: true }
  | { destination: number };

export type ChapterEvent =
  | { t: number; do: 'welcome' }
  | { t: number; do: 'acc'; kmh: number }
  | { t: number; do: 'accOff' }
  | { t: number; do: 'view'; view: ViewId }
  | { t: number; do: 'page'; page: string }
  | { t: number; do: 'mode'; mode: DriveModeId }
  | { t: number; do: 'overtake' }
  | { t: number; do: 'passer' }
  | { t: number; do: 'lead'; gap: number; kmh: number }
  | { t: number; do: 'leadBrake'; kmh: number }
  | { t: number; do: 'distracted'; on: boolean }
  | { t: number; do: 'lookAway'; seconds: number }
  | { t: number; do: 'lift'; seconds: number }
  | { t: number; do: 'autoHighBeam' }
  /** The next traffic light turns amber in `in` seconds (then red, as the cycle goes). */
  | { t: number; do: 'redLight'; in: number };

export interface Caption {
  t0: number;
  t1: number;
  /** What happens, in plain language. */
  title: string;
  /** The real-world fact or engineering note. */
  note: string;
  /** Feature doc for "How it works" (docs/features/<doc>.md). */
  doc?: string;
}

export interface Chapter {
  id: string;
  title: string;
  duration: number;
  hour: number;
  weather: Weather;
  temperatureC: number;
  start: ChapterPlace;
  mode?: DriveModeId;
  view?: ViewId;
  page?: string;
  events: ChapterEvent[];
  captions: Caption[];
}

/**
 * The guided demo. Strongest moments first: the first 30 s show the start-up
 * sweep, adaptive cruise, lane centering and a blind-spot warning.
 */
export const CHAPTERS: Chapter[] = [
  {
    id: 'startup',
    title: 'Start-up',
    duration: 4,
    hour: 13.5,
    weather: 'clear',
    temperatureC: 18,
    start: { place: 'ramp', kmh: 50 },
    events: [{ t: 0, do: 'welcome' }],
    captions: [
      {
        t0: 0,
        t1: 4,
        title: 'A digital instrument cluster, simulated end to end.',
        note: 'Every needle and lamp is driven by a physics model of a real car.',
      },
    ],
  },
  {
    id: 'motorway',
    title: 'Motorway',
    duration: 30,
    hour: 13.6,
    weather: 'clear',
    temperatureC: 18,
    start: { place: 'motorway', kmh: 105, lane: 0 },
    events: [
      { t: 0.2, do: 'lead', gap: 75, kmh: 108 },
      { t: 1, do: 'acc', kmh: 120 },
      { t: 9, do: 'view', view: 'assist' },
      { t: 15.5, do: 'passer' },
      { t: 18, do: 'overtake' },
    ],
    captions: [
      {
        t0: 0.5,
        t1: 9,
        title: 'Adaptive cruise keeps the speed and the distance by itself.',
        note: 'It follows the car ahead, braking and accelerating like real radar cruise.',
        doc: 'speed-assist',
      },
      {
        t0: 9,
        t1: 18,
        title: 'Lane centering keeps the car in the middle of its lane.',
        note: 'Green lines mean the car is steering. This is the driver-assistance view.',
        doc: 'lane-assist',
      },
      {
        t0: 18,
        t1: 30,
        title: 'A car in the blind spot: the warning flashes as we indicate.',
        note: 'The car waits until the lane is clear, then moves over.',
        doc: 'collision-assist',
      },
    ],
  },
  {
    id: 'safety',
    title: 'Safety',
    duration: 15,
    hour: 13.7,
    weather: 'clear',
    temperatureC: 18,
    start: { segment: 'A 7', at: 1500, kmh: 112, lane: 0 },
    // Stay in the driver-assistance view so the car ahead is in sight.
    view: 'assist',
    events: [
      { t: 0, do: 'accOff' },
      { t: 0, do: 'distracted', on: true },
      { t: 0.1, do: 'lead', gap: 70, kmh: 100 },
      { t: 2.6, do: 'lookAway', seconds: 7 },
      { t: 3, do: 'leadBrake', kmh: 40 },
      { t: 12, do: 'distracted', on: false },
    ],
    captions: [
      {
        t0: 0,
        t1: 3,
        title: 'The driver looks away for a moment.',
        note: 'A distracted driver, simulated: eyes down, foot steady on the pedal.',
      },
      {
        t0: 3,
        t1: 11,
        title: 'Traffic ahead brakes hard. Warning, brake jolt, then automatic braking.',
        note: 'Staged by time to collision, as emergency braking systems do.',
        doc: 'collision-assist',
      },
      {
        t0: 11,
        t1: 15,
        title: 'Collision avoided. The driver looks up and takes over.',
        note: 'Emergency braking is on at every start, as EU rules require.',
        doc: 'collision-assist',
      },
    ],
  },
  {
    id: 'modes',
    title: 'Drive modes',
    duration: 20,
    hour: 14,
    weather: 'clear',
    temperatureC: 18,
    start: { place: 'rural', kmh: 85 },
    events: [
      { t: 0.5, do: 'mode', mode: 'eco' },
      { t: 3.5, do: 'lift', seconds: 4 },
      { t: 10, do: 'mode', mode: 'sport' },
      { t: 12.5, do: 'view', view: 'sport' },
    ],
    captions: [
      {
        t0: 0.5,
        t1: 10,
        title: 'Eco: the gearbox lets the car roll freely when you lift off.',
        note: 'Coasting: engine at idle, no engine braking, less fuel.',
        doc: 'drive-modes',
      },
      {
        t0: 10,
        t1: 20,
        title: 'Sport: sharper throttle, shift lights and red accents.',
        note: 'The page around the display takes on the mode colour too.',
        doc: 'drive-modes',
      },
    ],
  },
  {
    id: 'city',
    title: 'City',
    duration: 25,
    hour: 14.2,
    weather: 'clear',
    temperatureC: 18,
    // 180 m before the lights on Bahnhofstraße, which turn red as we arrive.
    start: { segment: 'Bahnhofstraße', at: 200, kmh: 45 },
    events: [{ t: 0.2, do: 'redLight', in: 9 }],
    captions: [
      {
        t0: 0,
        t1: 12,
        title: 'In town the speed limit is read from the signs.',
        note: 'Camera and map together, sometimes imperfect, like in real cars.',
        doc: 'speed-limits',
      },
      {
        t0: 12,
        t1: 25,
        title: 'At a red light the engine switches itself off.',
        note: 'Start-stop shows why when it has to keep running.',
        doc: 'powertrain-helpers',
      },
    ],
  },
  {
    id: 'night',
    title: 'Night',
    duration: 15,
    hour: 22.5,
    weather: 'clear',
    temperatureC: 12,
    start: { place: 'tunnel', kmh: 100 },
    events: [{ t: 0, do: 'autoHighBeam' }],
    captions: [
      {
        t0: 0,
        t1: 7,
        title: 'At night the lights come on by themselves and the display dims.',
        note: 'Auto high beam steps back for other cars.',
        doc: 'parking-lights-fatigue',
      },
      {
        t0: 7,
        t1: 15,
        title: 'Into the tunnel: the light sensor reacts within a second.',
        note: 'The speed limit changes too, read from the sign at the portal.',
      },
    ],
  },
  {
    id: 'menus',
    title: 'Menus',
    duration: 15,
    hour: 14.5,
    weather: 'clear',
    temperatureC: 18,
    start: { place: 'rural', kmh: 85 },
    events: [
      { t: 1, do: 'page', page: 'trip' },
      { t: 4.5, do: 'page', page: 'efficiency' },
      { t: 8, do: 'page', page: 'car' },
      { t: 11.5, do: 'view', view: 'navigation' },
    ],
    captions: [
      {
        t0: 0.5,
        t1: 11.5,
        title: 'Pages on the steering wheel: trip, efficiency, vehicle status.',
        note: 'Scrolled with the wheel, the way you would in the car.',
      },
      {
        t0: 11.5,
        t1: 15,
        title: 'The View button changes the whole layout.',
        note: 'Classic, navigation, reduced, driver assistance, sport.',
        doc: 'views',
      },
    ],
  },
  {
    id: 'parking',
    title: 'Parking',
    duration: 20,
    hour: 15,
    weather: 'clear',
    temperatureC: 18,
    start: { bay: true },
    events: [],
    captions: [
      {
        t0: 0,
        t1: 20,
        title: 'Reversing out: sensors, camera lines and cross traffic.',
        note: 'The car brakes on its own for the car crossing behind.',
        doc: 'parking-lights-fatigue',
      },
    ],
  },
  {
    id: 'shutdown',
    title: 'Shutdown',
    duration: 14,
    hour: 15.5,
    weather: 'clear',
    temperatureC: 18,
    // The last metres into the space: park, P, ignition off, trip summary.
    start: { destination: 10 },
    events: [],
    captions: [
      {
        t0: 0,
        t1: 14,
        title: 'Parked. A trip summary, then standby.',
        note: 'That is the drive. Take the wheel, or see how it works.',
      },
    ],
  },
];

export const TOTAL_S = CHAPTERS.reduce((a, c) => a + c.duration, 0);
