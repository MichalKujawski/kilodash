import { describe, expect, it } from 'vitest';
import { profileById } from '@/profiles';
import { VehicleSimulator } from './vehicle';

const DT = 0.01;
const COUPE = profileById('sports-coupe-2021');

function run(sim: VehicleSimulator, seconds: number, each?: (sim: VehicleSimulator) => void): void {
  for (let i = 0; i < seconds / DT; i++) {
    sim.step(DT);
    each?.(sim);
  }
}

describe('VehicleSimulator', () => {
  it('idles steadily around the idle speed', () => {
    const sim = new VehicleSimulator(COUPE);
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
    const sim = new VehicleSimulator(COUPE);
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
    const sim = new VehicleSimulator(COUPE);
    sim.inputs.throttle = 1;
    let maxRpm = 0;
    run(sim, 30, (s) => (maxRpm = Math.max(maxRpm, s.state.rpm)));
    expect(sim.state.gear).toBeGreaterThanOrEqual(5);
    expect(sim.speedKmh).toBeGreaterThan(190);
    expect(sim.speedKmh).toBeLessThan(260);
    expect(maxRpm).toBeLessThan(COUPE.engine!.limiterRpm + 300);
  });

  it('bounces on the rev limiter in manual mode', () => {
    const sim = new VehicleSimulator(COUPE);
    sim.setMode('manual');
    sim.inputs.throttle = 1;
    const rpms: number[] = [];
    run(sim, 6, (s) => rpms.push(s.state.rpm));
    const tail = rpms.slice(-200);
    const spread = Math.max(...tail) - Math.min(...tail);
    expect(Math.max(...tail)).toBeGreaterThan(COUPE.engine!.limiterRpm - 100);
    expect(spread).toBeGreaterThan(40);
  });

  it('brakes to a full stop and downshifts to first', () => {
    const sim = new VehicleSimulator(COUPE);
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
    const sim = new VehicleSimulator(COUPE);
    sim.inputs.throttle = 0.6;
    run(sim, 10);
    expect(sim.state.fuelRateLh).toBeGreaterThan(5);
    sim.inputs.throttle = 0;
    run(sim, 1);
    expect(sim.state.fuelRateLh).toBe(0);
  });

  it('warms up coolant towards operating temperature', () => {
    const sim = new VehicleSimulator(COUPE);
    sim.inputs.throttle = 0.3;
    run(sim, 120);
    expect(sim.state.coolantC).toBeGreaterThan(85);
    expect(sim.state.coolantC).toBeLessThan(100);
  });

  it('is deterministic for the same seed', () => {
    const a = new VehicleSimulator(COUPE, 42);
    const b = new VehicleSimulator(COUPE, 42);
    a.inputs.throttle = b.inputs.throttle = 0.5;
    run(a, 10);
    run(b, 10);
    expect(a.state).toEqual(b.state);
  });
});

describe('VehicleSimulator: ignition, faults, chassis', () => {
  it('cranks with a voltage dip, then idles high when cold', () => {
    const sim = new VehicleSimulator(COUPE, 1, { ambientC: -5 });
    sim.state.coolantC = -5;
    sim.setIgnition(0);
    run(sim, 1);
    expect(sim.state.rpm).toBeLessThan(50);
    sim.start();
    let minVolts = 99;
    let crankRpm = 0;
    run(sim, 0.6, (s) => {
      minVolts = Math.min(minVolts, s.state.voltage);
      crankRpm = Math.max(crankRpm, s.state.rpm);
    });
    expect(sim.state.ignition).toBe(3);
    expect(minVolts).toBeLessThan(11);
    expect(crankRpm).toBeLessThan(400);
    sim.inputs.brake = 1;
    run(sim, 6);
    expect(sim.state.engineRunning).toBe(true);
    expect(sim.state.rpm).toBeGreaterThan(COUPE.engine!.idleRpm + 150);
  });

  it('engages traction control on a hard launch on ice and ABS on hard braking', () => {
    const sim = new VehicleSimulator(COUPE, 1, { grip: 0.35 });
    sim.inputs.throttle = 1;
    let tcs = false;
    run(sim, 3, (s) => (tcs ||= s.state.tcs));
    expect(tcs).toBe(true);
    sim.inputs.throttle = 0;
    sim.inputs.brake = 1;
    let abs = false;
    run(sim, 1, (s) => (abs ||= s.state.abs));
    expect(abs).toBe(true);
  });

  it('produces lateral g from road curvature, limited by grip', () => {
    const sim = new VehicleSimulator(COUPE);
    sim.inputs.throttle = 0.5;
    run(sim, 8);
    sim.inputs.curvature = 1 / 50;
    run(sim, 3);
    expect(sim.state.latG).toBeGreaterThan(0.3);
    expect(sim.state.latG).toBeLessThanOrEqual(0.98);
    expect(sim.state.steeringDeg).toBeGreaterThan(20);
  });

  it('turns faults into DTCs, lamps and symptoms', () => {
    const sim = new VehicleSimulator(COUPE);
    sim.injectFault('checkEngine');
    sim.injectFault('lowTire');
    run(sim, 30);
    expect(sim.dtcs().map((d) => d.code)).toEqual(['P0301', 'P0420', 'C0750']);
    expect(sim.state.mil).toBe(true);
    expect(sim.state.tires[3]).toBeLessThan(190);
    sim.clearFault('checkEngine');
    run(sim, 0.1);
    expect(sim.state.mil).toBe(false);
  });

  it('overheats when the cooling fault is injected', () => {
    const sim = new VehicleSimulator(COUPE);
    sim.injectFault('overheat');
    sim.inputs.throttle = 0.3;
    run(sim, 120);
    expect(sim.state.coolantC).toBeGreaterThan(118);
  });
});

describe('Electric and hybrid powertrains', () => {
  it('EV: accelerates, regenerates when lifting off, drains and recovers charge', () => {
    const ev = profileById('ev-2023');
    const sim = new VehicleSimulator(ev);
    expect(sim.isElectric).toBe(true);
    const soc0 = sim.state.soc;
    sim.inputs.throttle = 1;
    let t = 0;
    while (sim.speedKmh < 100 && t < 15) {
      sim.step(DT);
      t += DT;
    }
    expect(t).toBeLessThan(10);
    expect(sim.state.powerKW).toBeGreaterThan(100);
    expect(sim.state.soc).toBeLessThan(soc0);
    sim.inputs.throttle = 0;
    run(sim, 1);
    expect(sim.state.powerKW).toBeLessThan(0);
    expect(sim.state.rpm).toBeGreaterThan(0);
  });

  it('hybrid: drives away on electric power, starts the engine under load', () => {
    const hy = profileById('hybrid-suv-2019');
    const sim = new VehicleSimulator(hy);
    sim.state.coolantC = 80;
    sim.inputs.throttle = 0.15;
    run(sim, 4);
    expect(sim.speedKmh).toBeGreaterThan(5);
    expect(sim.state.engineRunning).toBe(false);
    sim.inputs.throttle = 1;
    run(sim, 3);
    expect(sim.state.engineRunning).toBe(true);
    expect(sim.state.fuelRateLh).toBeGreaterThan(1);
  });
});
