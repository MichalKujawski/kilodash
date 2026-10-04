import { describe, expect, it } from 'vitest';
import { VehicleSimulator } from '@/core/datasource/simulator/vehicle';
import { profileById } from '@/profiles';
import type { DriveModeId } from './modes';

const DT = 0.01;
const SUV = profileById('family-suv-2022');
const EV = profileById('ev-2023');

function run(sim: VehicleSimulator, seconds: number, each?: () => void): void {
  for (let i = 0; i < seconds / DT; i++) {
    each?.();
    sim.step(DT);
  }
}

/** Warm car at a steady speed, holding it with a simple pedal controller. */
function cruise(
  mode: DriveModeId,
  kmh: number,
): { sim: VehicleSimulator; fuelLh: number; cda: number } {
  const sim = new VehicleSimulator(SUV);
  sim.driveModes.select(mode);
  sim.state.coolantC = 90;
  sim.state.speedMs = kmh / 3.6;
  let fuel = 0;
  let cda = 0;
  let n = 0;
  run(sim, 30, () => {
    sim.inputs.throttle = Math.max(0, Math.min(1, 0.22 + (kmh - sim.speedKmh) * 0.05));
    if (sim.state.timeS > 15) {
      fuel += sim.state.fuelRateLh;
      cda += sim.state.cylindersOff ? 1 : 0;
      n++;
    }
  });
  return { sim, fuelLh: fuel / n, cda: cda / n };
}

describe('family SUV powertrain by mode', () => {
  it('reaches 100 km/h in about 10 s', () => {
    const sim = new VehicleSimulator(SUV);
    sim.inputs.throttle = 1;
    let t = 0;
    while (sim.speedKmh < 100 && t < 20) {
      sim.step(DT);
      t += DT;
    }
    expect(t).toBeGreaterThan(8.5);
    expect(t).toBeLessThan(11.5);
  });

  it('cruises at 100 km/h in top gear at about 2000 rpm and 5–7 L/h', () => {
    const { sim, fuelLh } = cruise('normal', 100);
    expect(sim.state.gear).toBe(7);
    expect(sim.state.rpm).toBeGreaterThan(1800);
    expect(sim.state.rpm).toBeLessThan(2200);
    expect(fuelLh).toBeGreaterThan(4.5);
    expect(fuelLh).toBeLessThan(7.5);
  });

  it('runs on half its cylinders at a steady 80 km/h, never in Sport', () => {
    expect(cruise('normal', 80).cda).toBeGreaterThan(0.8);
    expect(cruise('sport', 80).cda).toBe(0);
  });

  it('Sport holds lower gears than Normal', () => {
    expect(cruise('sport', 100).sim.state.gear).toBeLessThan(7);
  });

  it('Eco coasts with the foot off: engine idles, any pedal re-engages', () => {
    const { sim } = cruise('eco', 100);
    sim.inputs.throttle = 0;
    run(sim, 3);
    expect(sim.state.coasting).toBe(true);
    expect(sim.state.coupled).toBe(false);
    expect(sim.state.rpm).toBeLessThan(SUV.engine!.idleRpm + 100);
    // Freewheeling loses speed far more slowly than engine braking.
    expect(sim.speedKmh).toBeGreaterThan(90);
    sim.inputs.brake = 0.1;
    run(sim, 0.6);
    expect(sim.state.coasting).toBe(false);
    expect(sim.state.coupled).toBe(true);
    expect(sim.state.rpm).toBeGreaterThan(1300);
  });

  it('Normal does not coast, and Eco never coasts on cruise control', () => {
    const normal = cruise('normal', 100).sim;
    normal.inputs.throttle = 0;
    run(normal, 3);
    expect(normal.state.coasting).toBe(false);
    const eco = cruise('eco', 100).sim;
    eco.state.cruiseActive = true; // what an engaged cruise/ACC sets
    eco.inputs.throttle = 0;
    run(eco, 3);
    expect(eco.state.coasting).toBe(false);
  });

  it('Snow pulls away in second gear', () => {
    const sim = new VehicleSimulator(SUV);
    sim.driveModes.select('snow');
    sim.inputs.throttle = 0.3;
    let lowest = 9;
    run(sim, 4, () => {
      if (sim.state.speedMs > 0.5) lowest = Math.min(lowest, sim.state.gear);
    });
    expect(lowest).toBe(2);
  });

  it('hill descent control holds a crawl on a steep descent in Off-road', () => {
    const sim = new VehicleSimulator(SUV);
    sim.driveModes.select('offroad');
    sim.state.speedMs = 20 / 3.6;
    sim.inputs.gradient = -0.2;
    run(sim, 10);
    expect(sim.state.hdc).toBe(2);
    expect(sim.speedKmh).toBeLessThan(14);
    expect(sim.speedKmh).toBeGreaterThan(3);
  });

  it('resets to Normal at the next start', () => {
    const sim = new VehicleSimulator(SUV);
    sim.driveModes.select('sport');
    sim.setIgnition(0);
    run(sim, 0.1);
    sim.inputs.brake = 1;
    sim.pressStart(true);
    run(sim, 2);
    expect(sim.driveModes.state.current).toBe('normal');
  });
});

describe('EV regeneration', () => {
  function liftOff(level: number, b = false): number {
    const sim = new VehicleSimulator(EV);
    sim.state.speedMs = 80 / 3.6;
    sim.state.regenLevel = level;
    sim.state.evB = b;
    run(sim, 2);
    return sim.speedKmh;
  }

  it('decelerates harder with each paddle level', () => {
    const v = [0, 1, 2, 3].map((l) => liftOff(l));
    for (let i = 1; i < v.length; i++) expect(v[i]!).toBeLessThan(v[i - 1]!);
    expect(liftOff(3, true)).toBeLessThan(v[3]!);
  });

  it('B brings the car to a stop without the brake pedal', () => {
    const sim = new VehicleSimulator(EV);
    sim.state.speedMs = 30 / 3.6;
    sim.state.evB = true;
    run(sim, 10);
    expect(sim.state.speedMs).toBe(0);
  });

  it('reports negative power demand while regenerating', () => {
    const sim = new VehicleSimulator(EV);
    sim.state.speedMs = 80 / 3.6;
    sim.state.regenLevel = 2;
    run(sim, 1);
    expect(sim.state.powerPct).toBeLessThan(-10);
    sim.inputs.throttle = 1;
    run(sim, 1);
    expect(sim.state.powerPct).toBeGreaterThan(60);
  });

  it('Eco caps an EV at 130 km/h', () => {
    const sim = new VehicleSimulator(EV);
    sim.driveModes.select('eco');
    sim.inputs.throttle = 1;
    run(sim, 60);
    expect(sim.speedKmh).toBeLessThan(132);
    expect(sim.speedKmh).toBeGreaterThan(120);
  });
});
