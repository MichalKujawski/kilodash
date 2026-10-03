import type { WidgetFactory } from '../renderer/types';
import { barGauge } from './BarGauge';
import { indicators } from './Indicators';
import { speedometer, tachometer } from './RoundDial';
import { tripPanel } from './TripPanel';

// Factories are heterogeneous in their props; the layout data supplies matching props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFactory = WidgetFactory<any>;

export const WIDGETS: ReadonlyMap<string, AnyFactory> = new Map(
  [speedometer, tachometer, indicators, barGauge, tripPanel].map((f) => [f.type, f as AnyFactory]),
);
