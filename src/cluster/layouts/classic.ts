import { S } from '@/core/signals/catalog';
import type { LayoutDefinition } from './types';

/** Two large dials (speed left, rpm right) with a centre information display. */
export const classic: LayoutDefinition = {
  id: 'classic',
  nameKey: 'layout.classic',
  slots: [
    {
      id: 'left-dial',
      rect: { x: 50, y: 30, w: 660, h: 660 },
      candidates: [{ type: 'speedometer' }],
    },
    {
      id: 'right-dial',
      rect: { x: 1210, y: 30, w: 660, h: 660 },
      candidates: [{ type: 'tachometer' }],
    },
    {
      id: 'indicators',
      rect: { x: 636, y: 30, w: 648, h: 46 },
      candidates: [{ type: 'indicators' }],
    },
    { id: 'center', rect: { x: 745, y: 26, w: 430, h: 552 }, candidates: [{ type: 'trip-panel' }] },
    {
      id: 'bar-left',
      rect: { x: 750, y: 600, w: 200, h: 60 },
      candidates: [
        { type: 'bar', props: { signal: S.FuelLevel, label: 'Fuel', min: 0, max: 100, unit: '%' } },
      ],
    },
    {
      id: 'bar-right',
      rect: { x: 970, y: 600, w: 200, h: 60 },
      candidates: [
        {
          type: 'bar',
          props: { signal: S.CoolantTemp, label: 'Coolant', min: 50, max: 130, unit: '°C' },
        },
        { type: 'bar', props: { signal: S.OilTemp, label: 'Oil', min: 50, max: 150, unit: '°C' } },
      ],
    },
  ],
};
