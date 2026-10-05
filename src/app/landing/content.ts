/** Landing page copy, kept as data so the component stays layout only. */

export const PITCH = {
  headline: 'A digital instrument cluster that behaves like a real car, built for the web.',
  line: 'Every needle, lamp and warning comes from a simulated car: physics, driver assists and real warning logic, at 60 fps in your browser.',
};

export interface Highlight {
  chapter: string;
  title: string;
  line: string;
  poster: string;
}

export const HIGHLIGHTS: Highlight[] = [
  {
    chapter: 'motorway',
    title: 'Adaptive cruise and lane centering',
    line: 'Follows the car ahead and keeps the lane. A car in the blind spot holds the lane change until it is clear.',
    poster: 'media/posters/motorway.webp',
  },
  {
    chapter: 'safety',
    title: 'Emergency braking, stage by stage',
    line: 'Pre-warning, a red warning with a brake jolt, then automatic braking down to the speed of the car ahead.',
    poster: 'media/posters/safety.webp',
  },
  {
    chapter: 'modes',
    title: 'Drive modes you can feel',
    line: 'Eco lets the car coast; Sport sharpens the throttle and lights the shift lights.',
    poster: 'media/posters/modes.webp',
  },
  {
    chapter: 'parking',
    title: 'Reversing out of a bay',
    line: 'Sensors, camera guide lines that bend with the wheel, and a brake for the car crossing behind.',
    poster: 'media/posters/parking.webp',
  },
];

/** The data path, left to right, as in docs/WALKTHROUGH.md. */
export const PIPELINE = [
  { name: 'Simulator', note: 'Physics, world and traffic, 100 Hz' },
  { name: 'Signal store', note: 'VSS IDs, timestamps, quality' },
  { name: 'Behaviour', note: 'Tested state machines' },
  { name: 'View models', note: 'Plain data per page' },
  { name: 'Renderer', note: 'Canvas, 60 fps' },
];

export const PIPELINE_LINES = [
  'A deterministic simulator produces what a real car reports: speed, revs, temperatures, lamps, radar targets.',
  'Small state machines decide what the car is doing (cruise active, warning, engine stopped), the way a real control unit does.',
  'The cluster only draws that state. Nothing on screen computes anything.',
];

export const DECISIONS = [
  {
    id: 'adr/0001-canvas-renderer-react-for-chrome',
    title: 'Canvas for the cluster, React only around it',
  },
  { id: 'adr/0002-signal-store-vss-ids', title: 'A signal store with VSS IDs and data quality' },
  {
    id: 'adr/0003-behaviour-as-state-machines',
    title: 'Behaviour as small, tested state machines',
  },
  { id: 'adr/0004-deterministic-simulator', title: 'A deterministic simulator, fixed 100 Hz step' },
  {
    id: 'adr/0005-layouts-and-themes-as-data',
    title: 'Layouts and themes as data; safety colours fixed',
  },
  {
    id: 'adr/0006-guided-demo-in-the-live-world',
    title: 'The guided demo runs live, not as a video',
  },
];

export const TECH = [
  'TypeScript',
  'React',
  'Canvas 2D',
  'Vite',
  'Vitest',
  'Playwright',
  'Web Audio',
];
