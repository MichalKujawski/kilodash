import { midnight } from './midnight';
import type { Theme } from './types';

const RAJDHANI = '"Rajdhani", "Barlow Semi Condensed", system-ui, sans-serif';

/** Carbon fibre, yellow and red, aggressive ticks and a stiff needle. */
export const racing: Theme = {
  ...midnight,
  id: 'racing',
  name: 'Racing',
  background: '#050505',
  text: {
    primary: 'rgba(255, 255, 255, 0.95)',
    secondary: 'rgba(255, 214, 0, 0.75)',
    tertiary: 'rgba(255, 255, 255, 0.45)',
    accent: '#ffd600',
  },
  fonts: {
    primary: RAJDHANI,
    numerals: RAJDHANI,
    readout: RAJDHANI,
    load: ['Rajdhani:wght@500;600;700'],
  },
  backdrop: { kind: 'carbon', colors: ['#0b0b0c', '#18181a'] },
  dial: {
    ...midnight.dial,
    startDeg: 150,
    sweepDeg: 240,
    bezel: {
      width: 0.028,
      dark: '#1a1a1a',
      light: '#ffd600',
      highlight: 'rgba(255, 255, 255, 0.6)',
    },
    tickBand: {
      width: 0.16,
      full: false,
      inner: '#111112',
      outer: '#232325',
      shadow: 'rgba(0, 0, 0, 0.8)',
    },
    face: { center: '#060606', edge: '#121213', texture: 0 },
    hub: {
      ...midnight.dial.hub,
      ring: 'rgba(255, 214, 0, 0.45)',
      text: '#ffffff',
      textSecondary: 'rgba(255, 214, 0, 0.85)',
    },
    ticks: {
      major: { length: 0.12, width: 5, color: '#ffffff' },
      mid: { length: 0.08, width: 3, color: 'rgba(255, 214, 0, 0.9)' },
      minor: { length: 0.05, width: 2, color: 'rgba(255, 255, 255, 0.45)' },
      minorPerMajor: 4,
      cap: 'butt',
    },
    numerals: {
      ...midnight.dial.numerals,
      size: 0.12,
      weight: 700,
      color: 'rgba(255, 255, 255, 0.8)',
      lit: '#ffd600',
      italic: true,
    },
    redline: { band: 'rgba(230, 20, 10, 0.95)', glow: 'rgba(255, 30, 10, 1)' },
    needle: {
      ...midnight.dial.needle,
      style: 'arrow',
      baseWidth: 12,
      tipWidth: 3,
      color: '#ffd600',
      core: '#fff6c2',
      glow: 'rgba(255, 200, 0, 0.9)',
      afterglowDeg: 14,
      afterglow: 'rgba(255, 214, 0, 0.28)',
    },
    segments: { count: 48, on: '#ffd600', ghost: 'rgba(255,255,255,0.05)' },
  },
  sideGauge: { track: 'rgba(255, 255, 255, 0.12)', fill: '#ffd600', marker: '#ff2a1f' },
  panel: { surface: 'rgba(255, 214, 0, 0.03)', divider: 'rgba(255, 255, 255, 0.08)' },
  map: {
    ...midnight.map,
    route: '#ffd600',
    routeGlow: 'rgba(255, 214, 0, 0.5)',
    vehicle: '#ffffff',
  },
  chart: { good: '#ffd600', neutral: '#ffffff', bad: '#ff2a1f' },
  car: {
    paintDark: '#191919',
    paintLight: '#3d3d3d',
    glass: '#060606',
    outline: 'rgba(255, 214, 0, 0.55)',
  },
  effects: { ...midnight.effects, bloom: 0.75, ambient: 'rgba(255, 180, 0, 0.08)' },
  needlePhysics: { stiffness: 320, damping: 30, maxVelocity: 4 },
  sounds: { chime: 'digital' },
};
