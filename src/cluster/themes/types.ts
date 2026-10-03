import type { SpringConfig } from '@/core/smoothing/spring';

export type NeedleStyle = 'blade' | 'line' | 'arrow';

export interface ThemeColors {
  background: string;
  /** Soft radial light behind the dials. */
  backgroundGlow: string;
  dialFace: string;
  dialFaceEdge: string;
  dialRim: string;
  tickMajor: string;
  tickMinor: string;
  numeral: string;
  numeralDim: string;
  needle: string;
  needleGlow: string;
  needleHub: string;
  /** Sweep arc that follows the needle. */
  activeArcStart: string;
  activeArcEnd: string;
  accent: string;
  redline: string;
  text: string;
  textDim: string;
  textMuted: string;
  panel: string;
  panelBorder: string;
  barTrack: string;
  barFill: string;
}

export interface DialStyle {
  needle: NeedleStyle;
  /** Minor ticks per major interval. */
  minorTicks: number;
  /** Start angle in degrees (0 = 3 o'clock, clockwise). */
  startDeg: number;
  sweepDeg: number;
  /** Show the glowing sweep arc behind the needle. */
  activeArc: boolean;
  /** Fill the dial face (true) or leave it open (false). */
  filledFace: boolean;
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: {
    /** Dial numerals. */
    numeral: string;
    /** Labels and body text. */
    ui: string;
    /** Large digital readouts (speed, gear). */
    digital: string;
  };
  /** Glow intensity, 0..1. */
  glow: number;
  dial: DialStyle;
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
