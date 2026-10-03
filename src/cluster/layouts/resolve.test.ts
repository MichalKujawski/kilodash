import { describe, expect, it } from 'vitest';
import { S } from '@/core/signals/catalog';
import { classic } from './classic';
import { resolveLayout } from './resolve';

const pick = (ids: string[]) =>
  Object.fromEntries(
    resolveLayout(classic, new Set(ids)).map((r) => [r.slotId, r.spec?.type ?? null]),
  );

describe('resolveLayout', () => {
  it('fills every slot when all signals exist', () => {
    const r = pick([
      S.Speed,
      S.EngineSpeed,
      S.FuelLevel,
      S.CoolantTemp,
      S.IndicatorLeft,
      S.IndicatorRight,
    ]);
    expect(Object.values(r).every((v) => v !== null)).toBe(true);
  });

  it('leaves the fuel slot empty when the car has no fuel level PID', () => {
    expect(pick([S.Speed, S.EngineSpeed])['bar-left']).toBeNull();
  });

  it('falls back to oil temperature when coolant is missing', () => {
    const r = resolveLayout(classic, new Set([S.Speed, S.OilTemp]));
    const right = r.find((x) => x.slotId === 'bar-right');
    expect(right?.spec?.props?.signal).toBe(S.OilTemp);
  });
});
