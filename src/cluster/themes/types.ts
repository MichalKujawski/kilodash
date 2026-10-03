import type { SpringConfig } from '@/core/smoothing/spring';

export type NeedleStyle = 'blade' | 'line' | 'arrow';

/** Text hierarchy and accents. Primary text is never pure white. */
export interface ThemeText {
  primary: string;
  secondary: string;
  tertiary: string;
  accent: string;
}

export interface TickToken {
  /** Length as a fraction of dial radius. */
  length: number;
  /** Stroke width, px at 1920×720. */
  width: number;
  color: string;
}

/** Layered round gauge construction (outside → inside). */
export interface DialTokens {
  /** Start angle in degrees (0 = 3 o'clock, clockwise). */
  startDeg: number;
  sweepDeg: number;
  bezel: {
    /** Ring width as a fraction of radius. */
    width: number;
    /** Metallic gradient around the circumference. */
    dark: string;
    light: string;
    /** Specular highlight at top-left. */
    highlight: string;
  };
  tickBand: {
    width: number;
    inner: string;
    outer: string;
    /** Inner shadow colour at the band's inner edge. */
    shadow: string;
  };
  face: {
    center: string;
    edge: string;
    /** Subtle concentric texture opacity (0 = none). */
    texture: number;
  };
  hub: {
    /** Hub ring radius as a fraction of dial radius. */
    radius: number;
    fill: string;
    ring: string;
    shadow: string;
  };
  ticks: {
    major: TickToken;
    mid: TickToken;
    minor: TickToken;
    /** Minor intervals per major interval (mid tick sits halfway when even). */
    minorPerMajor: number;
  };
  numerals: {
    /** Cap height ≈ size × 0.7; size as a fraction of radius. */
    size: number;
    weight: number;
    color: string;
    /** Colour when the needle is close. */
    lit: string;
    /** Angular distance (deg) over which numerals brighten. */
    litRangeDeg: number;
    /** Distance from the outer edge as a fraction of radius. */
    inset: number;
  };
  redline: {
    band: string;
    glow: string;
  };
  needle: {
    style: NeedleStyle;
    baseWidth: number;
    tipWidth: number;
    color: string;
    /** Bright centre line. */
    core: string;
    glow: string;
    /** Translucent wedge trailing the needle, degrees. */
    afterglowDeg: number;
    afterglow: string;
  };
}

export interface MapTokens {
  ground: string;
  block: string;
  park: string;
  water: string;
  road: string;
  roadMajor: string;
  roadEdge: string;
  route: string;
  routeGlow: string;
  vehicle: string;
  label: string;
}

export interface EffectTokens {
  /** Bloom intensity 0..1 for emissive elements. */
  bloom: number;
  /** Bloom radius in logical px. */
  bloomRadius: number;
  /** Glass reflection strength (max white alpha), 0..0.06. */
  glass: number;
  /** Dither noise alpha, ~0.01–0.02. */
  dither: number;
  /** Soft edge fade of the display mask, logical px. */
  vignette: number;
  /** Ambient glow behind dials. */
  ambient: string;
  /** Idle breathing amplitude of the ambient glow (0.03 = ±3%). */
  ambientBreath: number;
}

export interface Theme {
  id: string;
  name: string;
  background: string;
  text: ThemeText;
  fonts: {
    /** Primary family (labels, values). */
    primary: string;
    /** Dial numerals. */
    numerals: string;
  };
  dial: DialTokens;
  /** Small arc gauges (fuel, coolant). */
  sideGauge: {
    track: string;
    fill: string;
    marker: string;
  };
  panel: {
    /** Very faint surface used behind center pages. */
    surface: string;
    divider: string;
  };
  map: MapTokens;
  /** Charts and efficiency gauges. */
  chart: {
    good: string;
    neutral: string;
    bad: string;
  };
  /** Procedural car illustration. */
  car: {
    paintDark: string;
    paintLight: string;
    glass: string;
    outline: string;
  };
  effects: EffectTokens;
  needlePhysics: SpringConfig;
}

/**
 * Telltale and alert colours. Deliberately not part of `Theme`: safety colours stay
 * identical in every theme (ISO 2575 convention).
 */
export const SAFETY_COLORS = {
  danger: '#ff2a1f',
  caution: '#ffb000',
  info: '#22d36b',
  highBeam: '#2f7bff',
} as const;

export type SafetyColor = keyof typeof SAFETY_COLORS;
