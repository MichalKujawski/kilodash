import { classic } from './classic';
import type { LayoutDefinition, LayoutSlot } from './types';

/** Parts every view keeps: strips, telltales and the overlays. */
const SHARED = ['top-strip', 'bottom-strip', 'telltales', 'drive-mode', 'park-view', 'belt-status'];
const shared: LayoutSlot[] = classic.slots.filter((s) => SHARED.includes(s.id));

const base = {
  mask: classic.mask,
  alertRect: classic.alertRect,
};

/** Navigation: the map across the whole width, speed and gear as digital readouts. */
export const navigation: LayoutDefinition = {
  ...base,
  id: 'navigation',
  nameKey: 'layout.navigation',
  ambient: [{ x: 960, y: 340, r: 700 }],
  slots: [
    {
      id: 'center',
      rect: { x: 330, y: 66, w: 1260, h: 572 },
      candidates: [{ type: 'carousel', props: { pages: ['map'], edgeFade: 0.12 } }],
    },
    {
      id: 'speed',
      rect: { x: 60, y: 200, w: 260, h: 260 },
      candidates: [{ type: 'digital-speed', props: { size: 110 } }],
    },
    {
      id: 'gear',
      rect: { x: 1600, y: 200, w: 260, h: 260 },
      candidates: [{ type: 'gear-readout' }],
    },
    ...shared,
  ],
};

/** Reduced: as calm as possible, two large values (+ next turn when guiding). */
export const reduced: LayoutDefinition = {
  ...base,
  id: 'reduced',
  nameKey: 'layout.reduced',
  ambient: [{ x: 960, y: 340, r: 500 }],
  slots: [
    {
      id: 'speed',
      rect: { x: 760, y: 140, w: 400, h: 360 },
      candidates: [{ type: 'digital-speed', props: { size: 180 } }],
    },
    {
      id: 'gear',
      rect: { x: 1260, y: 180, w: 300, h: 280 },
      candidates: [{ type: 'gear-readout' }],
    },
    { id: 'nav', rect: { x: 360, y: 160, w: 320, h: 300 }, candidates: [{ type: 'nav-arrow' }] },
    ...shared,
  ],
};

/** Driver assistance: a wide lane view, speed and gear beside it. */
export const assistView: LayoutDefinition = {
  ...base,
  id: 'assist',
  nameKey: 'layout.assist',
  ambient: [{ x: 960, y: 360, r: 650 }],
  slots: [
    { id: 'lanes', rect: { x: 360, y: 60, w: 1200, h: 580 }, candidates: [{ type: 'lane-view' }] },
    {
      id: 'speed',
      rect: { x: 60, y: 200, w: 280, h: 260 },
      candidates: [{ type: 'digital-speed', props: { size: 110 } }],
    },
    {
      id: 'gear',
      rect: { x: 1580, y: 200, w: 280, h: 260 },
      candidates: [{ type: 'gear-readout' }],
    },
    ...shared,
  ],
};

const TACH = { cx: 960, cy: 360, r: 290 };

/** Sport: one central tachometer with speed and gear, shift lights, performance data. */
export const sport: LayoutDefinition = {
  ...base,
  id: 'sport',
  nameKey: 'layout.sport',
  ambient: [{ x: TACH.cx, y: TACH.cy, r: 460 }],
  slots: [
    {
      id: 'tach',
      rect: { x: TACH.cx - TACH.r, y: TACH.cy - TACH.r, w: TACH.r * 2, h: TACH.r * 2 },
      candidates: [
        { type: 'tachometer', props: { speedInHub: true } },
        { type: 'power-meter', props: { speedInHub: true } },
      ],
    },
    {
      id: 'shift-lights',
      rect: { x: TACH.cx - 120, y: 50, w: 240, h: 9 },
      candidates: [{ type: 'shift-lights' }],
    },
    {
      id: 'panel',
      rect: { x: 230, y: 150, w: 330, h: 330 },
      candidates: [{ type: 'sport-panel' }],
    },
    { id: 'g', rect: { x: 1380, y: 120, w: 300, h: 420 }, candidates: [{ type: 'g-meter' }] },
    ...shared,
  ],
};

export type ViewId = 'classic' | 'navigation' | 'reduced' | 'assist' | 'sport' | 'auto';

/** Order of the View button. "Auto" follows the driving mode. */
export const VIEW_NAMES: Record<ViewId, string> = {
  classic: 'Classic',
  navigation: 'Navigation',
  reduced: 'Reduced',
  assist: 'Driver assistance',
  sport: 'Sport',
  auto: 'Auto view',
};

export const VIEWS: ViewId[] = ['classic', 'navigation', 'reduced', 'assist', 'sport', 'auto'];

export const LAYOUTS: Record<Exclude<ViewId, 'auto'>, LayoutDefinition> = {
  classic,
  navigation,
  reduced,
  assist: assistView,
  sport,
};

/** Auto view: Sport mode → sport view, everything else → classic. */
export function autoLayout(driveMode: number): LayoutDefinition {
  return driveMode === 3 ? sport : classic;
}
