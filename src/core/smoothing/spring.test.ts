import { describe, expect, it } from 'vitest';
import { ReadoutValue, Spring } from './spring';

describe('Spring', () => {
  it('converges to the target', () => {
    const s = new Spring(0);
    for (let i = 0; i < 200; i++) s.update(100, 1 / 60);
    expect(s.value).toBeCloseTo(100, 1);
    expect(Math.abs(s.velocity)).toBeLessThan(0.5);
  });

  it('overshoots slightly when underdamped', () => {
    const s = new Spring(0, { stiffness: 200, damping: 12 });
    let max = 0;
    for (let i = 0; i < 120; i++) max = Math.max(max, s.update(100, 1 / 60));
    expect(max).toBeGreaterThan(100);
    expect(max).toBeLessThan(130);
  });

  it('respects the slew limit', () => {
    const s = new Spring(0, { stiffness: 5000, damping: 100, maxVelocity: 50 });
    s.update(1000, 0.1);
    expect(s.value).toBeLessThanOrEqual(5 + 1e-9);
  });

  it('stays stable on a huge frame gap', () => {
    const s = new Spring(0);
    s.update(100, 5);
    expect(Number.isFinite(s.value)).toBe(true);
  });
});

describe('ReadoutValue', () => {
  it('updates at a limited rate', () => {
    const r = new ReadoutValue(5, 0.001);
    const first = r.update(10, 1 / 60);
    expect(first).toBeCloseTo(10);
    // Within 200 ms the shown value must not change.
    expect(r.update(50, 1 / 60)).toBeCloseTo(10);
    let v = 0;
    for (let i = 0; i < 15; i++) v = r.update(50, 1 / 60);
    expect(v).toBeCloseTo(50);
  });
});
