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

export interface LayoutDefinition {
  id: string;
  nameKey: string;
  slots: LayoutSlot[];
}
