import { midnight } from './midnight';
import type { Theme } from './types';

const MONO = '"Share Tech Mono", "JetBrains Mono", ui-monospace, monospace';
const AMBER = '#ffa62b';
const GHOST = 'rgba(255, 166, 43, 0.05)';

/** 80s segmented digital display: amber LCD bars and 7-segment digits. */
export const retroLcd: Theme = {
  ...midnight,
  id: 'retro-lcd',
  name: 'Retro LCD',
  background: '#0a0805',
  text: {
    primary: AMBER,
    secondary: 'rgba(255, 166, 43, 0.7)',
    tertiary: 'rgba(255, 166, 43, 0.45)',
    accent: '#ffcf7a',
  },
  fonts: { primary: MONO, numerals: MONO, readout: 'segment', load: ['Share Tech Mono'] },
  backdrop: { kind: 'solid', colors: [] },
  dial: {
    ...midnight.dial,
    mode: 'segments',
    startDeg: 150,
    sweepDeg: 240,
    bezel: { width: 0, dark: '#000', light: '#000', highlight: 'rgba(0,0,0,0)' },
    tickBand: {
      width: 0.16,
      full: false,
      inner: '#0c0905',
      outer: '#0c0905',
      shadow: 'rgba(0,0,0,0)',
    },
    face: { center: '#0a0805', edge: '#0a0805', texture: 0 },
    hub: {
      ...midnight.dial.hub,
      fill: '#0a0805',
      ring: 'rgba(255, 166, 43, 0.25)',
      shadow: 'rgba(0,0,0,0)',
      text: AMBER,
      textSecondary: 'rgba(255, 166, 43, 0.7)',
    },
    ticks: {
      major: { length: 0.05, width: 3, color: AMBER },
      mid: { length: 0, width: 0, color: 'rgba(0,0,0,0)' },
      minor: { length: 0, width: 0, color: 'rgba(0,0,0,0)' },
      minorPerMajor: 2,
      cap: 'butt',
    },
    numerals: {
      ...midnight.dial.numerals,
      size: 0.085,
      weight: 400,
      color: 'rgba(255, 166, 43, 0.75)',
      lit: AMBER,
      inset: 0.3,
    },
    redline: { band: 'rgba(255, 60, 30, 0.6)', glow: 'rgba(255, 60, 30, 0.6)' },
    needle: {
      ...midnight.dial.needle,
      color: AMBER,
      glow: 'rgba(255, 166, 43, 0.8)',
      afterglowDeg: 0,
    },
    segments: { count: 40, on: AMBER, ghost: GHOST },
  },
  sideGauge: { track: GHOST, fill: AMBER, marker: AMBER },
  panel: { surface: 'rgba(255, 166, 43, 0.03)', divider: 'rgba(255, 166, 43, 0.12)' },
  map: {
    ground: '#0a0805',
    block: '#140f07',
    park: '#120f07',
    water: '#0d0a05',
    road: '#2b1d0a',
    roadMajor: '#3d290d',
    roadEdge: '#0a0805',
    route: AMBER,
    routeGlow: 'rgba(255, 166, 43, 0.4)',
    vehicle: '#ffd28a',
    label: 'rgba(255, 166, 43, 0.6)',
  },
  chart: { good: '#c8ff6a', neutral: AMBER, bad: '#ff5a2b' },
  car: {
    paintDark: '#1a1207',
    paintLight: '#3a2a10',
    glass: '#0a0805',
    outline: 'rgba(255, 166, 43, 0.6)',
  },
  effects: {
    ...midnight.effects,
    bloom: 0.7,
    bloomRadius: 10,
    glass: 0.04,
    ambient: 'rgba(255, 140, 20, 0.07)',
    ambientBreath: 0,
  },
  needlePhysics: { stiffness: 400, damping: 40, maxVelocity: 5 },
  sounds: { chime: 'digital' },
};
