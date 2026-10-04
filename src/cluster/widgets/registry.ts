import type { WidgetFactory } from '../renderer/types';
import { carousel } from './center/Carousel';
import { powerMeter, speedometer, tachometer } from './RoundDial';
import { shiftLights } from './ShiftLights';
import { sideGauge } from './SideGauge';
import { bottomStrip, topStrip } from './StatusStrip';
import { beltStatus } from './system/BeltStatus';
import { driveModePopup } from './system/DriveModePopup';
import { parkView } from './system/ParkView';
import { telltales } from './Telltales';

// Factories are heterogeneous in their props; the layout data supplies matching props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFactory = WidgetFactory<any>;

export const WIDGETS: ReadonlyMap<string, AnyFactory> = new Map(
  [
    speedometer,
    tachometer,
    powerMeter,
    sideGauge,
    telltales,
    carousel,
    topStrip,
    bottomStrip,
    driveModePopup,
    shiftLights,
    beltStatus,
    parkView,
  ].map((f) => [f.type, f as AnyFactory]),
);
