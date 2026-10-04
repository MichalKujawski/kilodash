import type { AlertEngine } from '@/core/alerts/AlertEngine';
import type { Flasher } from '@/core/alerts/flasher';
import type { ConsumptionHistory } from '@/core/derived/ConsumptionHistory';
import type { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';
import type { Theme } from '../themes/types';
import type { ClusterRuntime } from './startup';

export const LOGICAL_WIDTH = 1920;
export const LOGICAL_HEIGHT = 720;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Steering-wheel / keyboard navigation keys routed into the cluster. */
export type ClusterKey = 'left' | 'right' | 'up' | 'down' | 'ok' | 'back';

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
  /**
   * Bloom layer in the same logical coordinates. Draw emissive shapes (needles,
   * lit telltales, redline) here as well; it is blurred and added on top. Null in
   * low-power mode.
   */
  emissive: CanvasRenderingContext2D | null;
  /** False when decorative motion must pause (driving lockout, later HMI rules). */
  decorativeMotion: boolean;
  flasher: Flasher;
  /** Start-up / shut-down choreography state. */
  runtime: ClusterRuntime;
  alerts: AlertEngine | null;
  /** Trip-computer consumption history (from the derived engine). */
  history: ConsumptionHistory | null;
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
  /**
   * 'content' widgets fade with the ignition choreography; 'overlay' widgets
   * (telltales) stay at full strength for the bulb check.
   */
  readonly layer?: 'content' | 'overlay';
  /** Handle a navigation key; return true if consumed. */
  onInput?(key: ClusterKey): boolean;
}

export interface WidgetFactory<P = Record<string, unknown>> {
  type: string;
  /** Signals that must be available for this widget to be chosen. */
  requires(props: P): SignalId[];
  create(rect: Rect, props: P, env: VehicleEnv): Widget;
}
