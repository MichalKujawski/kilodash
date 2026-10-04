import type { Rect } from '../renderer/types';

export interface WidgetSpec {
  type: string;
  props?: Record<string, unknown>;
}

/** A region of the cluster with an ordered list of widgets to try. */
export interface LayoutSlot {
  id: string;
  rect: Rect;
  /** First candidate whose required signals are available wins. */
  candidates: WidgetSpec[];
}

/**
 * Visible area of the physical display. Everything outside is true black and the
 * edge fades softly (no stroke).
 */
export interface DisplayMask {
  /** Margin from the canvas edge, px. */
  inset: number;
  /** How far the top corners sit below the top centre (gentle arch), px. */
  topArch: number;
  /** How far the bottom centre rises above the bottom corners, px. */
  bottomArch: number;
  /** Extra horizontal inset of the top corners vs the bottom ones (tapered sides), px. */
  taper: number;
  /** Lower corners cut inwards (chamfer), px. 0 = square. */
  bottomChamfer?: number;
}

export interface AmbientGlow {
  x: number;
  y: number;
  r: number;
}

export interface LayoutDefinition {
  id: string;
  nameKey: string;
  mask: DisplayMask;
  /** Soft light pools behind dials. */
  ambient: AmbientGlow[];
  slots: LayoutSlot[];
  /** Where alert popups appear (usually over the centre content). */
  alertRect: Rect;
}
