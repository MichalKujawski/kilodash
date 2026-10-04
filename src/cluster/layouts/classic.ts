import { S } from '@/core/signals/catalog';
import type { LayoutDefinition } from './types';

/** Dial geometry: ≈560 px dials pushed outwards so the centre window is ≈740 px wide. */
const R = 280;
const LEFT = { cx: 355, cy: 360 };
const RIGHT = { cx: 1565, cy: 360 };
/** Fixed strips (shared by every view). */
const TOP_Y = 46;
const BOTTOM_Y = 670;

/** Telltale row, grouped like real clusters: lights & driver aids left, vehicle warnings right. */
const LEFT_GROUP = [
  'parkingLights',
  'lowBeam',
  'highBeam',
  'fog',
  'fogRear',
  'tcs',
  'escOff',
  'fcwOff',
];
const RIGHT_GROUP = [
  'checkEngine',
  'oilPressure',
  'battery',
  'coolantTemp',
  'abs',
  'airbag',
  'seatbelt',
  'parkingBrake',
  'lowFuel',
  'doorOpen',
  'tpms',
  'glowPlug',
];

/**
 * Classic view: two dials framing a full-height centre window (page carousel),
 * a top strip (indicators, speed limit, assist status, drive mode) and a fixed
 * bottom strip (temperature, trip, clock, odometer, telltales).
 */
export const classic: LayoutDefinition = {
  id: 'classic',
  nameKey: 'layout.classic',
  mask: { inset: 8, topArch: 46, bottomArch: 6, taper: 18, bottomChamfer: 34 },
  alertRect: { x: 700, y: 150, w: 520, h: 262 },
  ambient: [
    { x: LEFT.cx, y: LEFT.cy, r: 420 },
    { x: RIGHT.cx, y: RIGHT.cy, r: 420 },
    { x: 960, y: 330, r: 400 },
  ],
  slots: [
    // Drawn first so the dials sit on top of its faded edges.
    {
      id: 'center',
      rect: { x: 590, y: 66, w: 740, h: 572 },
      candidates: [
        {
          type: 'carousel',
          props: {
            pages: ['map', 'assist', 'car', 'trip', 'efficiency', 'offroad'],
            edgeFade: 0.13,
            cutouts: [
              { ...LEFT, r: R },
              { ...RIGHT, r: R },
            ],
          },
        },
      ],
    },
    {
      id: 'left-dial',
      rect: { x: LEFT.cx - R, y: LEFT.cy - R, w: R * 2, h: R * 2 },
      candidates: [{ type: 'speedometer' }],
    },
    {
      id: 'right-dial',
      rect: { x: RIGHT.cx - R, y: RIGHT.cy - R, w: R * 2, h: R * 2 },
      // Electrified cars show a power meter instead of the tachometer.
      candidates: [{ type: 'power-meter' }, { type: 'tachometer' }],
    },
    {
      id: 'left-side',
      rect: { x: 30, y: 380, w: 120, h: 300 },
      candidates: [
        {
          type: 'side-gauge',
          props: {
            signal: S.FuelLevel,
            ...LEFT,
            r: R + 22,
            fromDeg: 122,
            toDeg: 162,
            map: [
              [0, 0],
              [100, 1],
            ],
            red: [0, 0.1],
            ticks: [0, 0.25, 0.5, 0.75, 1],
            ends: ['E', 'F'],
            icon: 'fuel',
            filler: 'right',
          },
        },
        {
          // Electric cars: traction battery state of charge.
          type: 'side-gauge',
          props: {
            signal: S.SoC,
            ...LEFT,
            r: R + 22,
            fromDeg: 122,
            toDeg: 162,
            map: [
              [0, 0],
              [100, 1],
            ],
            red: [0, 0.1],
            ticks: [0, 0.25, 0.5, 0.75, 1],
            ends: ['0', '100'],
            icon: 'chargeLevel',
          },
        },
      ],
    },
    {
      id: 'right-side',
      rect: { x: 1770, y: 380, w: 120, h: 300 },
      candidates: [
        {
          type: 'side-gauge',
          props: {
            signal: S.CoolantTemp,
            ...RIGHT,
            r: R + 22,
            fromDeg: 58,
            toDeg: 18,
            // Damped like a real gauge: 75–105 °C all read "normal" (middle).
            map: [
              [50, 0],
              [75, 0.5],
              [105, 0.5],
              [130, 1],
            ],
            red: [0.78, 1],
            ticks: [0, 0.5, 1],
            ends: ['C', 'H'],
            icon: 'coolant',
          },
        },
        {
          // Cars without a coolant signal: oil temperature, normal 90–120 °C in the middle.
          type: 'side-gauge',
          props: {
            signal: S.OilTemp,
            ...RIGHT,
            r: R + 22,
            fromDeg: 58,
            toDeg: 18,
            map: [
              [50, 0],
              [90, 0.5],
              [120, 0.5],
              [150, 1],
            ],
            red: [0.8, 1],
            ticks: [0, 0.5, 1],
            ends: ['C', 'H'],
            icon: 'oilPressure',
          },
        },
      ],
    },
    {
      id: 'top-strip',
      rect: { x: 620, y: 24, w: 680, h: 44 },
      candidates: [
        {
          type: 'top-strip',
          props: { y: TOP_Y, sign: 690, nav: 800, cruise: 1100, lane: 1160, mode: 1230 },
        },
      ],
    },
    {
      id: 'bottom-strip',
      rect: { x: 120, y: 650, w: 1680, h: 40 },
      candidates: [
        {
          type: 'bottom-strip',
          props: { y: BOTTOM_Y, temp: 330, trip: 455, clock: 960, odo: 1600 },
        },
      ],
    },
    {
      id: 'drive-mode',
      rect: { x: 660, y: 66, w: 600, h: 572 },
      candidates: [{ type: 'drive-mode-popup' }],
    },
    {
      id: 'telltales',
      rect: { x: 0, y: 0, w: 1920, h: 720 },
      candidates: [
        {
          type: 'telltales',
          props: {
            size: 26,
            items: [
              // Indicator arrows between the dial tops and the centre window.
              { id: 'indicatorLeft', x: 590, y: TOP_Y, size: 34 },
              { id: 'indicatorRight', x: 1330, y: TOP_Y, size: 34 },
              ...LEFT_GROUP.map((id, i) => ({ id, x: 612 + i * 36, y: BOTTOM_Y })),
              ...RIGHT_GROUP.map((id, i) => ({ id, x: 1022 + i * 34, y: BOTTOM_Y })),
            ],
          },
        },
      ],
    },
  ],
};
