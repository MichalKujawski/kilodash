import { describe, expect, it } from 'vitest';
import { Environment } from './environment';

describe('Environment', () => {
  it('is bright at noon and dark at midnight', () => {
    const e = new Environment();
    expect(e.daylight(13)).toBeGreaterThan(60);
    expect(e.daylight(0)).toBeLessThan(10);
    expect(e.daylight(20.5)).toBeLessThan(20);
  });

  it('darkens within about a second in a tunnel', () => {
    const e = new Environment({ hour: 12 });
    for (let i = 0; i < 100; i++) e.step(0.01, false);
    expect(e.light).toBeGreaterThan(60);
    for (let i = 0; i < 100; i++) e.step(0.01, true);
    expect(e.light).toBeLessThan(15);
  });

  it('derives surface and grip from the weather', () => {
    const e = new Environment({ weather: 'rain', temperatureC: 8 });
    expect(e.surface).toBe('wet');
    expect(e.grip).toBeLessThan(1);
    e.set({ weather: 'snow', temperatureC: -3 });
    expect(e.surface).toBe('icy');
    e.set({ surface: 'dry' });
    expect(e.wet).toBe(false);
  });

  it('follows the real clock when asked', () => {
    const e = new Environment({ realTime: true }, () => new Date(2026, 0, 1, 21, 30));
    e.step(0.01, false);
    expect(e.hour).toBeCloseTo(21.5);
  });
});
