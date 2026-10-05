import type { LineState } from '@/core/assist/LaneAssist';
import type { VehicleKind } from '@/core/world/traffic';
import type { Rect } from '../renderer/types';
import type { Theme } from '../themes/types';

/** One lane boundary across the view. */
export interface LaneLine {
  /** Lateral position at the car, m to the right of our lane centre. */
  offset: number;
  style: 'solid' | 'dashed' | 'barrier' | 'kerb';
  state: LineState;
  /** Dash pattern length / gap, m. */
  dash: [number, number];
}

export interface LaneObject {
  id: number;
  kind: VehicleKind;
  /** Lateral position, m to the right of our lane centre (before the road's bend). */
  x: number;
  /** Distance ahead of our front bumper to its near end, m (negative = beside/behind). */
  z: number;
  length: number;
  braking: boolean;
  oncoming: boolean;
  /** ACC is following this car. */
  target: boolean;
  /** Collision warning for this car (red). */
  danger: boolean;
}

/**
 * Everything the lane view shows, independent of how it is drawn. Built from
 * the scene snapshot and signals each frame; a Canvas 2D renderer draws it
 * today, a WebGL/Three.js renderer could draw the same model later.
 */
export interface LaneViewModel {
  lines: LaneLine[];
  /** Road surface from the leftmost to the rightmost line. */
  surface: { left: number; right: number };
  /** Our lateral offset in the lane, m (+ = left). */
  lat: number;
  /** Road curvature ahead, sampled every `step` m (1/m, + = right bend). */
  curvature: number[];
  step: number;
  /** Distance driven, m (moves the dashes). */
  s: number;
  objects: LaneObject[];
  /** Assisted driving (ACC + centering): the ego lane is tinted. */
  assisted: boolean;
  /** Centre of the lane we're in (or moving into), m right of our lane centre. */
  laneCentre: number;
  /** Blind-spot zones: 0 clear, 1 occupied (amber), 2 warning (flashing). */
  blindSpot: { left: number; right: number };
  /** Ego car outline colour state. */
  laneChange: boolean;
  /** Our brake lights are on. */
  egoBraking: boolean;
}

export interface LaneSceneRenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    model: LaneViewModel,
    rect: Rect,
    theme: Theme,
    now: number,
  ): void;
}
