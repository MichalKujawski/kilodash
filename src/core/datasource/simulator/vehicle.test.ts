import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@/profiles';
import { VehicleSimulator } from './vehicle';

const DT = 0.01;

function run(sim: VehicleSimulator, seconds: number, each?: (sim: VehicleSimulator) => void): void {
  for (let i = 0; i < seconds / DT; i++) {
    sim.step(DT);
    each?.(sim);
  }
}

describe('VehicleSimulator', () => {
  it('idles steadily around the idle speed', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.brake = 1;
    run(sim, 5);
    let min = Infinity;
    let max = 0;
    run(sim, 5, (s) => {
      min = Math.min(min, s.state.rpm);
      max = Math.max(max, s.state.rpm);
    });
    expect(min).toBeGreaterThan(700);
    expect(max).toBeLessThan(900);
    expect(sim.state.speedMs).toBe(0);
  });

  it('accelerates 0-100 km/h in a plausible time for a sports coupe', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.throttle = 1;
    let t = 0;
    while (sim.speedKmh < 100 && t < 20) {
      sim.step(DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(4);
    expect(t).toBeLessThan(8);
    expect(sim.state.gear).toBeGreaterThanOrEqual(3);
  });

  it('upshifts through the gears and never exceeds the limiter by much', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.throttle = 1;
    let maxRpm = 0;
    run(sim, 30, (s) => (maxRpm = Math.max(maxRpm, s.state.rpm)));
    expect(sim.state.gear).toBeGreaterThanOrEqual(5);
    expect(sim.speedKmh).toBeGreaterThan(190);
    expect(sim.speedKmh).toBeLessThan(260);
    expect(maxRpm).toBeLessThan(DEFAULT_PROFILE.engine.limiterRpm + 300);
  });

  it('bounces on the rev limiter in manual mode', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.setMode('manual');
    sim.inputs.throttle = 1;
    const rpms: number[] = [];
    run(sim, 6, (s) => rpms.push(s.state.rpm));
    const tail = rpms.slice(-200);
    const spread = Math.max(...tail) - Math.min(...tail);
    expect(Math.max(...tail)).toBeGreaterThan(DEFAULT_PROFILE.engine.limiterRpm - 100);
    expect(spread).toBeGreaterThan(40);
  });

  it('brakes to a full stop and downshifts to first', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.throttle = 0.7;
    run(sim, 12);
    sim.inputs.throttle = 0;
    sim.inputs.brake = 0.8;
    run(sim, 10);
    expect(sim.state.speedMs).toBe(0);
    expect(sim.state.gear).toBe(1);
    expect(sim.state.rpm).toBeLessThan(1000);
  });

  it('cuts fuel on overrun and burns fuel under load', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.throttle = 0.6;
    run(sim, 10);
    expect(sim.state.fuelRateLh).toBeGreaterThan(5);
    sim.inputs.throttle = 0;
    run(sim, 1);
    expect(sim.state.fuelRateLh).toBe(0);
  });

  it('warms up coolant towards operating temperature', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.inputs.throttle = 0.3;
    run(sim, 120);
    expect(sim.state.coolantC).toBeGreaterThan(85);
    expect(sim.state.coolantC).toBeLessThan(100);
  });

  it('is deterministic for the same seed', () => {
    const a = new VehicleSimulator(DEFAULT_PROFILE, 42);
    const b = new VehicleSimulator(DEFAULT_PROFILE, 42);
    a.inputs.throttle = b.inputs.throttle = 0.5;
    run(a, 10);
    run(b, 10);
    expect(a.state).toEqual(b.state);
  });
});
