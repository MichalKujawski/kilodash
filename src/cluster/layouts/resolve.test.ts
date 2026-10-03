import { describe, expect, it } from 'vitest';
import { S } from '@/core/signals/catalog';
import { classic } from './classic';
import { resolveLayout } from './resolve';

const pick = (ids: string[]) =>
  Object.fromEntries(resolveLayout(classic, new Set(ids)).map((r) => [r.slotId, r.spec]));

describe('resolveLayout', () => {
  it('fills every slot when all signals exist', () => {
    const r = pick([S.Speed, S.EngineSpeed, S.FuelLevel, S.CoolantTemp]);
    expect(Object.values(r).every((v) => v !== null)).toBe(true);
  });

  it('leaves the fuel gauge out when the car has no fuel level PID', () => {
    expect(pick([S.Speed, S.EngineSpeed])['left-side']).toBeNull();
  });

  it('falls back to oil temperature when coolant is missing', () => {
    expect(pick([S.Speed, S.OilTemp])['right-side']?.props?.signal).toBe(S.OilTemp);
  });

  it('always keeps the telltale row (positions are fixed for safety)', () => {
    expect(pick([])['telltales']?.type).toBe('telltales');
  });
});
