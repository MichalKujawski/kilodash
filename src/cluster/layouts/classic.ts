import { S } from '@/core/signals/catalog';
import type { LayoutDefinition } from './types';

const LEFT = { cx: 420, cy: 392 };
const RIGHT = { cx: 1500, cy: 392 };
const R = 300;

/**
 * Two dials framing a centre page carousel, with side gauges, top and bottom
 * status strips and a fixed telltale row.
 */
export const classic: LayoutDefinition = {
  id: 'classic',
  nameKey: 'layout.classic',
  mask: { inset: 10, topArch: 34, bottomArch: 10, taper: 26 },
  ambient: [
    { x: LEFT.cx, y: LEFT.cy, r: 430 },
    { x: RIGHT.cx, y: RIGHT.cy, r: 430 },
    { x: 960, y: 330, r: 380 },
  ],
  slots: [
    // Drawn first so the dials sit on top of its faded edges.
    {
      id: 'center',
      rect: { x: 610, y: 76, w: 700, h: 520 },
      candidates: [
        {
          type: 'carousel',
          props: {
            pages: ['map', 'car', 'trip', 'efficiency'],
            edgeFade: 0.16,
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
      candidates: [{ type: 'tachometer' }],
    },
    {
      id: 'left-side',
      rect: { x: 60, y: 300, w: 80, h: 300 },
      candidates: [
        {
          type: 'side-gauge',
          props: {
            signal: S.FuelLevel,
            ...LEFT,
            r: R + 26,
            fromDeg: 152,
            toDeg: 208,
            min: 0,
            max: 100,
            red: [0, 10],
            ends: ['E', 'F'],
            icon: 'fuel',
          },
        },
      ],
    },
    {
      id: 'right-side',
      rect: { x: 1780, y: 300, w: 80, h: 300 },
      candidates: [
        {
          type: 'side-gauge',
          props: {
            signal: S.CoolantTemp,
            ...RIGHT,
            r: R + 26,
            fromDeg: 28,
            toDeg: -28,
            min: 50,
            max: 130,
            red: [115, 130],
            ends: ['C', 'H'],
            icon: 'coolant',
          },
        },
        {
          type: 'side-gauge',
          props: {
            signal: S.OilTemp,
            ...RIGHT,
            r: R + 26,
            fromDeg: 28,
            toDeg: -28,
            min: 50,
            max: 150,
            red: [135, 150],
            ends: ['C', 'H'],
            icon: 'oilPressure',
          },
        },
      ],
    },
    {
      id: 'top-strip',
      rect: { x: 700, y: 28, w: 520, h: 36 },
      candidates: [{ type: 'top-strip' }],
    },
    {
      id: 'bottom-strip',
      rect: { x: 700, y: 640, w: 520, h: 60 },
      candidates: [
        { type: 'bottom-strip', props: { clockX: 720, tempX: 806, odoX: 1200, y: 690 } },
      ],
    },
    {
      id: 'telltales',
      rect: { x: 0, y: 0, w: 1920, h: 720 },
      candidates: [
        {
          type: 'telltales',
          props: {
            size: 28,
            items: [
              // Indicator arrows near the top edge of each dial.
              { id: 'indicatorLeft', x: 640, y: 46, size: 36 },
              { id: 'indicatorRight', x: 1280, y: 46, size: 36 },
              // Fixed telltale row, bottom centre.
              { id: 'lowBeam', x: 784, y: 640 },
              { id: 'highBeam', x: 784, y: 640 },
              { id: 'fog', x: 822, y: 640 },
              { id: 'parkingBrake', x: 860, y: 640 },
              { id: 'seatbelt', x: 898, y: 640 },
              { id: 'airbag', x: 936, y: 640 },
              { id: 'abs', x: 974, y: 640 },
              { id: 'tcs', x: 1012, y: 640 },
              { id: 'tpms', x: 1050, y: 640 },
              { id: 'doorOpen', x: 1088, y: 640 },
              { id: 'glowPlug', x: 1126, y: 640 },
              // Engine/electrical warnings inside the tachometer gap.
              { id: 'checkEngine', x: 1450, y: 646 },
              { id: 'oilPressure', x: 1500, y: 646 },
              { id: 'battery', x: 1550, y: 646 },
              { id: 'coolantTemp', x: 1650, y: 618 },
              // Fuel / ice inside the speedometer gap.
              { id: 'lowFuel', x: 395, y: 646 },
              { id: 'ice', x: 445, y: 646 },
            ],
          },
        },
      ],
    },
  ],
};
