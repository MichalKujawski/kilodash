import type { AlertEngine } from '@/core/alerts/AlertEngine';
import type { SceneSnapshot } from '@/core/world/scene';
import type { SignalStore } from '@/core/signals/store';

/** Which signals each centre page draws from. */
const PAGE_SIGNALS: Record<string, RegExp> = {
  map: /^Vehicle\.(Speed|CurrentLocation)|SpeedLimitInfo\.Limit/,
  assist: /ADAS\.(CruiseControl|LaneKeeping|ForwardCollision|BlindSpot|IsAssistedDriving)/,
  car: /Tire|Door|Hood|Trunk|ECT|EOT|Service\.|LowVoltageBattery|BeltStatus/,
  trip: /TripMeterReading|AverageSpeed|TripDuration|AverageConsumption|Range|TraveledDistance/,
  efficiency:
    /DriveMode|IsCoasting|CylinderDeactivated|InstantConsumption|AverageConsumption|Regeneration|PowerRequest/,
  offroad: /Altitude|Heading|SteeringWheel\.Angle|Acceleration|HillDescent/,
  messages: /^$/,
};

/** Views without centre pages draw their own content. */
const VIEW_SIGNALS: Record<string, RegExp> = {
  assist: PAGE_SIGNALS.assist!,
  sport:
    /^Vehicle\.Speed$|CombustionEngine\.(Speed|Boost|ECT|EOT)|ShiftLight|CurrentGear|Acceleration/,
  reduced: /^Vehicle\.Speed$|SpeedLimitInfo\.Limit|CruiseControl\.(State|SpeedSet)/,
};

const round = (v: number): number =>
  Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100;

/**
 * The data behind what the cluster shows right now: the active view and
 * centre page, and the signals and scene slice that page draws from. Plain
 * JSON: the renderer only ever draws data like this, it computes nothing.
 */
export function viewModel(
  view: string,
  page: string,
  store: SignalStore,
  scene: SceneSnapshot,
  alerts: AlertEngine,
): Record<string, unknown> {
  const re = page ? PAGE_SIGNALS[page] : VIEW_SIGNALS[view];
  const signals: Record<string, number> = {};
  if (re)
    for (const id of store.ids().sort())
      if (re.test(id)) signals[id.replace(/^Vehicle\./, '')] = round(store.value(id));
  const slice: Record<string, unknown> = {};
  if (page === 'map') {
    slice.road = { kind: scene.road.kind, name: scene.road.name, town: scene.road.town };
    slice.nav = scene.nav;
  }
  if (page === 'assist' || (!page && view === 'assist'))
    slice.lead = scene.lead && {
      dx: round(scene.lead.dx),
      kmh: round(scene.lead.v * 3.6),
      lane: scene.lead.laneOffset,
    };
  if (page === 'messages')
    slice.alerts = alerts
      .list()
      .map((a) => ({ id: a.rule.id, severity: a.rule.severity, acknowledged: a.acknowledged }));
  return { view, page: page || '(none: the view draws its own content)', signals, ...slice };
}
