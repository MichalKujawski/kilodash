import type { WidgetFactory } from '../renderer/types';
import { carousel } from './center/Carousel';
import { speedometer, tachometer } from './RoundDial';
import { sideGauge } from './SideGauge';
import { bottomStrip, topStrip } from './StatusStrip';
import { telltales } from './Telltales';

// Factories are heterogeneous in their props; the layout data supplies matching props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFactory = WidgetFactory<any>;

export const WIDGETS: ReadonlyMap<string, AnyFactory> = new Map(
  [speedometer, tachometer, sideGauge, telltales, carousel, topStrip, bottomStrip].map((f) => [
    f.type,
    f as AnyFactory,
  ]),
);
