import { describe, expect, it } from 'vitest';
import { S } from '../signals/catalog';
import { SignalStore } from '../signals/store';
import { evaluate, is, on } from './conditions';

describe('conditions', () => {
  const store = new SignalStore(() => 0);
  store.write({ id: S.FuelLevel, value: 8, ts: 0, source: 'simulated' });
  store.write({ id: S.HighBeam, value: 1, ts: 0, source: 'simulated' });

  it('compares signal values', () => {
    expect(evaluate(is(S.FuelLevel, '<=', 12), store)).toBe(true);
    expect(evaluate(is(S.FuelLevel, '>', 12), store)).toBe(false);
    expect(evaluate(on(S.HighBeam), store)).toBe(true);
  });

  it('treats missing signals as false, even when negated comparisons would pass', () => {
    expect(evaluate(is(S.CoolantTemp, '<', 200), store)).toBe(false);
    expect(evaluate(is(S.CoolantTemp, '!=', 0), store)).toBe(false);
  });

  it('combines with any / all / not', () => {
    expect(evaluate({ any: [on(S.LowBeam), on(S.HighBeam)] }, store)).toBe(true);
    expect(evaluate({ all: [on(S.LowBeam), on(S.HighBeam)] }, store)).toBe(false);
    expect(evaluate({ not: on(S.LowBeam) }, store)).toBe(true);
    expect(evaluate({ all: [] }, store)).toBe(false);
  });
});
