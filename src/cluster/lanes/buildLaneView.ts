import { LINE_STATES, type LineState } from '@/core/assist/LaneAssist';
import { S } from '@/core/signals/catalog';
import type { FrameContext } from '../renderer/types';
import type { LaneLine, LaneObject, LaneViewModel } from './types';

const W = 3.5;
/** How far ahead the view reaches, m. */
export const VIEW_RANGE = 140;
const STEP = 5;

/** Lane view model from the scene (road, traffic) and the lane-assist signals. */
export function buildLaneView(f: FrameContext): LaneViewModel | null {
  const sc = f.scene;
  if (!sc || sc.ego.inBay) return null;
  const st = f.store;
  const kind = sc.road.kind;
  const lanes = sc.ego.lanes;
  const egoLane = sc.ego.lane;
  const leftState = (LINE_STATES[st.value(S.LaneLeft)] ?? 'none') as LineState;
  const rightState = (LINE_STATES[st.value(S.LaneRight)] ?? 'none') as LineState;
  const near = Math.round(egoLane);
  const lines: LaneLine[] = [];
  const motorway = kind === 'motorway' || kind === 'ramp';
  // Boundary k sits between lane k−1 and lane k (0 = right edge, lanes = left edge).
  for (let k = 0; k <= lanes; k++) {
    const edge = k === 0 || k === lanes;
    const state: LineState = k === near ? rightState : k === near + 1 ? leftState : 'detected';
    lines.push({
      offset: (egoLane - k + 0.5) * W,
      style: edge
        ? k === lanes && motorway
          ? 'barrier'
          : kind === 'urban' && k === 0
            ? 'kerb'
            : 'solid'
        : 'dashed',
      state: edge || k === near || k === near + 1 ? state : 'detected',
      dash: motorway ? [6, 12] : [3, 6],
    });
  }
  // Two-way roads: the oncoming lane on the left of a dashed centre line.
  let leftEdge = (egoLane - lanes + 0.5) * W;
  if (!motorway && kind !== 'parking') {
    const centre = lines[lines.length - 1]!;
    centre.style = 'dashed';
    leftEdge -= W;
    lines.push({
      offset: leftEdge,
      style: kind === 'urban' ? 'kerb' : 'solid',
      state: 'detected',
      dash: [3, 6],
    });
  }
  const curvature: number[] = [];
  for (let d = 0; d <= VIEW_RANGE; d += STEP) curvature.push(sc.route.curvatureAt(sc.ego.s + d));
  const accTarget = st.value(S.AccTargetDistance, -1) >= 0 ? sc.lead?.id : undefined;
  const fcw = st.value(S.FcwState);
  const warning = fcw >= 3 && fcw <= 6;
  const objects: LaneObject[] = sc.objects
    .filter((o) => o.dx > -12 && o.dx < VIEW_RANGE)
    .map((o) => ({
      id: o.id,
      kind: o.kind,
      x: o.oncoming ? leftEdge + W / 2 : -o.laneOffset * W,
      z: o.dx,
      length: o.length,
      braking: o.braking,
      oncoming: o.oncoming,
      target: o.id === accTarget,
      danger: warning && o.id === sc.lead?.id,
    }));
  return {
    lines,
    surface: { left: leftEdge, right: (egoLane + 0.5) * W },
    lat: sc.ego.lateral,
    curvature,
    step: STEP,
    s: sc.ego.s,
    objects,
    assisted: st.value(S.AssistedDriving) > 0,
    laneCentre: (egoLane - near) * W,
    blindSpot: { left: st.value(S.BlindSpotLeft), right: st.value(S.BlindSpotRight) },
    laneChange: Math.abs(egoLane - Math.round(egoLane)) > 0.02,
  };
}
