import type { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';
import type { Theme } from '../themes/types';

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 720;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameContext {
  /** `performance.now()` ms. */
  now: number;
  /** Seconds since the previous frame (clamped). */
  dt: number;
  store: SignalStore;
  theme: Theme;
  /** Device pixels per logical pixel; multiply blur radii by this. */
  pxScale: number;
  lowPower: boolean;
}

export interface StaticContext {
  theme: Theme;
  pxScale: number;
  lowPower: boolean;
}

/** Vehicle facts widgets need to scale themselves (from the profile / user settings). */
export interface VehicleEnv {
  speedoMaxKmh: number;
  tachoMaxRpm: number;
  redlineRpm: number;
  gearCount: number;
  tankL: number;
}

/** A self-contained piece of the cluster. Drawn in logical (1920×720) coordinates. */
export interface Widget {
  readonly rect: Rect;
  /** Static parts (faces, ticks), cached to an offscreen layer and redrawn only on theme/size change. */
  drawStatic?(ctx: CanvasRenderingContext2D, sc: StaticContext): void;
  /** Dynamic parts, every frame. */
  draw(ctx: CanvasRenderingContext2D, frame: FrameContext): void;
}

export interface WidgetFactory<P = Record<string, unknown>> {
  type: string;
  /** Signals that must be available for this widget to be chosen. */
  requires(props: P): SignalId[];
  create(rect: Rect, props: P, env: VehicleEnv): Widget;
}
