import { midnight } from './midnight';
import type { Theme } from './types';

const ORBITRON = '"Orbitron", "Rajdhani", system-ui, sans-serif';
const RAJDHANI = '"Rajdhani", "Barlow Semi Condensed", system-ui, sans-serif';

/** Synthwave: magenta/cyan glow over a perspective grid road. */
export const neonGrid: Theme = {
  ...midnight,
  id: 'neon-grid',
  name: 'Neon Grid',
  background: '#05020c',
  text: {
    primary: 'rgba(225, 250, 255, 0.95)',
    secondary: 'rgba(120, 230, 255, 0.70)',
    tertiary: 'rgba(160, 120, 255, 0.55)',
    accent: '#ff2bd6',
  },
  fonts: {
    primary: RAJDHANI,
    numerals: ORBITRON,
    readout: ORBITRON,
    load: ['Orbitron:wght@500;700', 'Rajdhani:wght@500;600;700'],
  },
  backdrop: {
    kind: 'grid',
    colors: ['rgba(255, 43, 214, 0.55)', 'rgba(0, 229, 255, 0.35)', '#1a0633'],
  },
  dial: {
    ...midnight.dial,
    sweepDeg: 250,
    startDeg: 145,
    bezel: { width: 0.012, dark: '#3b0a52', light: '#ff2bd6', highlight: 'rgba(0, 229, 255, 0.9)' },
    tickBand: {
      width: 0.13,
      full: true,
      inner: 'rgba(20, 4, 40, 0.9)',
      outer: 'rgba(40, 8, 70, 0.9)',
      shadow: 'rgba(0,0,0,0.6)',
    },
    face: { center: 'rgba(5, 2, 12, 0.94)', edge: 'rgba(18, 5, 36, 0.94)', texture: 0 },
    hub: {
      radius: 0.5,
      fill: '#06020e',
      ring: 'rgba(0, 229, 255, 0.55)',
      shadow: 'rgba(80, 0, 120, 0.6)',
      text: 'rgba(225, 250, 255, 0.98)',
      textSecondary: 'rgba(0, 229, 255, 0.75)',
    },
    ticks: {
      major: { length: 0.09, width: 3, color: '#00e5ff' },
      mid: { length: 0.06, width: 2, color: 'rgba(0, 229, 255, 0.6)' },
      minor: { length: 0.04, width: 1.4, color: 'rgba(255, 43, 214, 0.55)' },
      minorPerMajor: 4,
      cap: 'round',
    },
    numerals: {
      ...midnight.dial.numerals,
      size: 0.085,
      weight: 500,
      color: 'rgba(0, 229, 255, 0.7)',
      lit: '#ffffff',
      orientation: 'radial',
    },
    redline: { band: 'rgba(255, 43, 214, 0.75)', glow: 'rgba(255, 43, 214, 1)' },
    needle: {
      ...midnight.dial.needle,
      style: 'line',
      color: '#ff2bd6',
      core: '#ffd6f6',
      glow: 'rgba(255, 43, 214, 1)',
      afterglowDeg: 30,
      afterglow: 'rgba(255, 43, 214, 0.35)',
    },
    segments: { count: 60, on: '#ff2bd6', ghost: 'rgba(255,43,214,0.06)' },
  },
  sideGauge: { track: 'rgba(160, 120, 255, 0.18)', fill: '#00e5ff', marker: '#ff2bd6' },
  panel: { surface: 'rgba(160, 80, 255, 0.05)', divider: 'rgba(0, 229, 255, 0.15)' },
  map: {
    ...midnight.map,
    ground: '#070214',
    block: '#120626',
    park: '#0a1a24',
    water: '#04122a',
    road: '#2a0f4a',
    roadMajor: '#45166e',
    roadEdge: '#0a0318',
    route: '#00e5ff',
    routeGlow: 'rgba(0, 229, 255, 0.7)',
    vehicle: '#ff2bd6',
    label: 'rgba(0, 229, 255, 0.7)',
  },
  chart: { good: '#00e5ff', neutral: '#d7c2ff', bad: '#ff2bd6' },
  car: {
    paintDark: '#1a0633',
    paintLight: '#4b1a7a',
    glass: '#05020c',
    outline: 'rgba(0, 229, 255, 0.6)',
  },
  effects: {
    ...midnight.effects,
    bloom: 1,
    bloomRadius: 18,
    glass: 0.025,
    ambient: 'rgba(160, 30, 200, 0.22)',
  },
  needlePhysics: { stiffness: 190, damping: 18, maxVelocity: 3 },
  sounds: { chime: 'digital' },
};
