import { describe, expect, it } from 'vitest';
import { VehicleSimulator } from '@/core/datasource/simulator/vehicle';
import { profileById } from '@/profiles';
import { ExhaustFluid, glowTime, ParticulateFilter } from './Diesel';
import { AutoHold, gearAdvice, shiftLight, StartStop, type StartStopInput } from './StartStop';

const DT = 0.05;
const stop: StartStopInput = {
  speedKmh: 0,
  brake: 0.4,
  throttle: 0,
  holding: false,
  inDrive: true,
  engineRunning: true,
  coolantC: 85,
  batteryOk: true,
  ambientC: 18,
  gradient: 0,
  steeringDeg: 0,
  doorOpen: false,
  beltOn: true,
  filterCleaning: false,
  dt: DT,
};

function driveOff(s: StartStop): void {
  s.step({ ...stop, speedKmh: 30, brake: 0 });
}

describe('start-stop', () => {
  it('stops the engine at a standstill on the brake, after the car has moved', () => {
    const s = new StartStop();
    s.step(stop);
    expect(s.state).toBe('blocked'); // not yet driven since the start
    driveOff(s);
    let stopped = false;
    for (let t = 0; t < 1; t += DT) stopped ||= s.step(stop).stopEngine;
    expect(stopped).toBe(true);
    expect(s.state).toBe('stopped');
  });

  it('restarts when the brake is released or the accelerator pressed', () => {
    const s = new StartStop();
    driveOff(s);
    for (let t = 0; t < 1; t += DT) s.step(stop);
    expect(s.step({ ...stop, engineRunning: false, brake: 0 }).startEngine).toBe(true);
    expect(s.state).toBe('ready');
  });

  it('shows why it keeps the engine running', () => {
    const cases: [Partial<StartStopInput>, string][] = [
      [{ coolantC: 40 }, 'engineCold'],
      [{ batteryOk: false }, 'battery'],
      [{ ambientC: 34 }, 'climate'],
      [{ gradient: 0.15 }, 'gradient'],
      [{ steeringDeg: 200 }, 'steering'],
      [{ beltOn: false }, 'doorOrBelt'],
      [{ filterCleaning: true }, 'filterCleaning'],
    ];
    for (const [patch, reason] of cases) {
      const s = new StartStop();
      driveOff(s);
      s.step({ ...stop, ...patch });
      expect(s.state).toBe('blocked');
      expect(s.reason).toBe(reason);
    }
  });

  it('needs the start button if the driver opens the door while stopped', () => {
    const s = new StartStop();
    driveOff(s);
    for (let t = 0; t < 1; t += DT) s.step(stop);
    const out = s.step({ ...stop, engineRunning: false, doorOpen: true, brake: 0 });
    expect(out.startEngine).toBe(false);
    expect(s.state).toBe('restartRequired');
  });

  it('the button disables it; it is back on at the next start', () => {
    const s = new StartStop();
    s.toggle();
    s.step(stop);
    expect(s.state).toBe('off');
    s.onIgnition();
    expect(s.enabled).toBe(true);
  });
});

describe('Auto Hold', () => {
  const at = { speedKmh: 0, brake: 0.3, throttle: 0, inDrive: true, doorOpen: false, beltOn: true };
  it('holds after the brake is released, lets go on the accelerator', () => {
    const h = new AutoHold();
    h.toggle();
    h.step(at);
    expect(h.state).toBe('holding');
    expect(h.step({ ...at, brake: 0 }).brake).toBeGreaterThan(0.2);
    expect(h.step({ ...at, brake: 0, throttle: 0.2 }).brake).toBeNull();
    expect(h.state).toBe('armed');
  });

  it('hands over to the parking brake when the driver unbuckles', () => {
    const h = new AutoHold();
    h.toggle();
    h.step(at);
    expect(h.step({ ...at, brake: 0, beltOn: false }).park).toBe(true);
  });
});

describe('gear advice and shift lights', () => {
  const base = {
    manual: true,
    sport: false,
    gear: 3,
    gears: 6,
    rpm: 2400,
    idleRpm: 800,
    rpmUp: 1700,
    rpmDown: 3400,
    throttle: 0.2,
    redlineRpm: 6500,
  };
  it('advises an early upshift at light load, a downshift when labouring', () => {
    expect(gearAdvice(base)).toEqual({ advice: 'up', gear: 4 });
    expect(gearAdvice({ ...base, rpm: 1000, rpmUp: 700 }).advice).toBe('down');
    expect(gearAdvice({ ...base, throttle: 0.8 }).advice).toBe('none');
  });

  it('is silent in automatic mode and in Sport', () => {
    expect(gearAdvice({ ...base, manual: false }).advice).toBe('none');
    expect(gearAdvice({ ...base, sport: true }).advice).toBe('none');
  });

  it('shift lights fill towards the shift point and then flash', () => {
    expect(shiftLight(3000, 7000)).toBe(0);
    expect(shiftLight(5800, 7000)).toBeCloseTo(0.5, 2);
    expect(shiftLight(6800, 7000)).toBe(2);
  });
});

describe('diesel', () => {
  it('glows longer when cold', () => {
    expect(glowTime(-10)).toBe(3);
    expect(glowTime(80)).toBe(0);
  });

  it('fills the particulate filter in town and cleans it at speed', () => {
    const f = new ParticulateFilter();
    f.load = 60;
    for (let t = 0; t < 120; t++) f.step(30, 30, true, 1);
    const town = f.load;
    expect(town).toBeGreaterThan(60);
    for (let t = 0; t < 120; t++) f.step(110, 40, true, 1);
    expect(f.regenerating || f.load < town).toBe(true);
    expect(f.load).toBeLessThan(town);
  });

  it('exhaust fluid: range from the tank, start blocked when empty', () => {
    const d = new ExhaustFluid();
    d.litres = 2.4;
    expect(d.rangeKm).toBeCloseTo(2400);
    d.consume(3000);
    expect(d.startBlocked).toBe(true);
  });
});

describe('in the car', () => {
  it('auto-stops (rpm to zero, no fuel) and restarts quickly', () => {
    const sim = new VehicleSimulator(profileById('family-suv-2022'));
    sim.inputs.brake = 1;
    for (let i = 0; i < 300; i++) sim.step(0.01);
    sim.autoStop();
    for (let i = 0; i < 200; i++) sim.step(0.01);
    expect(sim.state.rpm).toBeLessThan(50);
    expect(sim.state.fuelRateLh).toBe(0);
    expect(sim.state.ready).toBe(true);
    sim.autoRestart();
    let t = 0;
    while (!sim.state.engineRunning && t < 2) {
      sim.step(0.01);
      t += 0.01;
    }
    expect(t).toBeLessThan(0.5);
  });

  it('a cold diesel waits for the glow plugs before cranking', () => {
    const sim = new VehicleSimulator(profileById('estate-2016'), 1, { ambientC: -10 });
    sim.state.coolantC = -10;
    sim.setIgnition(0);
    sim.setIgnition(2);
    sim.start();
    expect(sim.glowing).toBe(true);
    expect(sim.state.ignition).toBe(2);
    let t = 0;
    while (sim.state.ignition !== 3 && t < 5) {
      sim.step(0.01);
      t += 0.01;
    }
    expect(t).toBeGreaterThan(2.5);
  });
});
