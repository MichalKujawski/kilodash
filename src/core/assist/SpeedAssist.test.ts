import { describe, expect, it } from 'vitest';
import { VehicleSimulator } from '@/core/datasource/simulator/vehicle';
import { profileById } from '@/profiles';
import {
  ACC_MAX_DECEL,
  AUTO_RESUME_S,
  SpeedAssist,
  TIME_GAPS,
  type AssistInput,
} from './SpeedAssist';

const DT = 0.01;
const base: AssistInput = {
  speedKmh: 80,
  driverThrottle: 0,
  driverBrake: 0,
  canDrive: true,
  lead: null,
  dt: DT,
};

describe('SpeedAssist buttons', () => {
  it('off → standby → active at the current speed; SET/RES steps of 1 and 10', () => {
    const a = new SpeedAssist(true);
    a.pressSet(false, 80);
    expect(a.state).toBe('off');
    a.pressMain();
    expect(a.state).toBe('standby');
    a.pressSet(false, 83.4);
    expect(a.state).toBe('active');
    expect(a.setKmh).toBe(83);
    a.pressRes(false, 83);
    expect(a.setKmh).toBe(84);
    a.pressRes(true, 84);
    expect(a.setKmh).toBe(90);
    a.pressRes(true, 90);
    expect(a.setKmh).toBe(100);
    a.pressSet(true, 100);
    expect(a.setKmh).toBe(90);
    a.pressSet(false, 90);
    expect(a.setKmh).toBe(89);
  });

  it('brake interrupts and keeps the speed; RES resumes it', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 100);
    a.step({ ...base, speedKmh: 100, driverBrake: 0.3 });
    expect(a.state).toBe('interrupted');
    expect(a.setKmh).toBe(100);
    a.pressRes(false, 90);
    expect(a.state).toBe('active');
    a.cancel();
    expect(a.state).toBe('interrupted');
    a.pressMain();
    expect(a.state).toBe('off');
    expect(a.setKmh).toBeNull();
  });

  it('the accelerator overrides, releasing it returns to active', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 100);
    a.step({ ...base, speedKmh: 100, driverThrottle: 0.8 });
    expect(a.state).toBe('overridden');
    a.step({ ...base, speedKmh: 100 });
    expect(a.state).toBe('active');
  });

  it('plain cruise needs 30 km/h to engage and drops out below 20', () => {
    const a = new SpeedAssist(false);
    a.pressMain();
    a.pressSet(false, 25);
    expect(a.state).toBe('standby');
    a.pressSet(false, 40);
    expect(a.state).toBe('active');
    a.step({ ...base, speedKmh: 18 });
    expect(a.state).toBe('interrupted');
  });

  it('distance cycles 1–5; long main press swaps to the limiter', () => {
    const a = new SpeedAssist(true);
    expect(a.distance).toBe(3);
    for (let i = 0; i < 3; i++) a.pressDistance();
    expect(a.distance).toBe(1);
    expect(TIME_GAPS).toHaveLength(5);
    a.pressMain();
    a.switchFunction();
    expect(a.fn).toBe('limiter');
    a.switchFunction();
    expect(a.fn).toBe('acc');
  });
});

describe('ACC behaviour', () => {
  it('asks the driver to take over when it would need more than its brake limit', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 120);
    const out = a.step({ ...base, speedKmh: 120, lead: { gap: 15, speed: 0 } });
    expect(out.takeover).toBe(true);
    expect(ACC_MAX_DECEL).toBeGreaterThan(3);
  });

  it('stop & go: holds behind a stopped car, drives off by itself within 3 s', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 50);
    a.step({ ...base, speedKmh: 0, lead: { gap: 4, speed: 0 } });
    expect(a.state).toBe('hold');
    a.step({ ...base, speedKmh: 0, lead: { gap: 5, speed: 2 } });
    expect(a.state).toBe('active');
  });

  it('after a longer stop it waits for RES and flags the car ahead driving off', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 50);
    for (let t = 0; t < AUTO_RESUME_S + 1; t += DT)
      a.step({ ...base, speedKmh: 0, lead: { gap: 4, speed: 0 } });
    const out = a.step({ ...base, speedKmh: 0, lead: { gap: 8, speed: 2 } });
    expect(a.state).toBe('hold');
    expect(out.leadDrivingOff).toBe(true);
    a.pressRes(false, 0);
    expect(a.state).toBe('active');
  });
});

describe('closed loop with the car', () => {
  /** SUV on a flat road with the assist working the pedals. */
  function drive(
    a: SpeedAssist,
    startKmh: number,
    seconds: number,
    lead: (t: number) => { gap: number; speed: number } | null = () => null,
    gradient = 0,
  ): { sim: VehicleSimulator; minGap: number } {
    const sim = new VehicleSimulator(profileById('family-suv-2022'));
    sim.state.coolantC = 90;
    sim.state.speedMs = startKmh / 3.6;
    sim.inputs.gradient = gradient;
    let leadPos = 60;
    let minGap = Infinity;
    for (let t = 0; t < seconds; t += DT) {
      const l = lead(t);
      let li = null;
      if (l) {
        leadPos += (l.speed - sim.state.speedMs) * DT;
        li = { gap: leadPos, speed: l.speed };
        minGap = Math.min(minGap, leadPos);
      }
      sim.inputs.throttle = 0;
      sim.inputs.brake = 0;
      const out = a.step({ ...base, speedKmh: sim.speedKmh, lead: li });
      if (out.pedals) {
        sim.inputs.throttle = out.pedals.throttle;
        sim.inputs.brake = out.pedals.brake;
      }
      sim.step(DT);
    }
    return { sim, minGap };
  }

  it('cruise holds the set speed within 2 km/h', () => {
    const a = new SpeedAssist(false);
    a.pressMain();
    a.pressSet(false, 100);
    const { sim } = drive(a, 100, 30);
    expect(Math.abs(sim.speedKmh - 100)).toBeLessThan(2);
  });

  it('accelerates to a raised set speed', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 80);
    a.pressRes(true, 80);
    a.pressRes(true, 90);
    const { sim } = drive(a, 80, 40);
    expect(Math.abs(sim.speedKmh - 100)).toBeLessThan(2);
  });

  it('ACC settles behind a slower car at about the chosen time gap', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 130);
    const { sim, minGap } = drive(a, 120, 60, () => ({ gap: 0, speed: 90 / 3.6 }));
    expect(Math.abs(sim.speedKmh - 90)).toBeLessThan(3);
    const expected = 4 + (90 / 3.6) * TIME_GAPS[2]!;
    expect(minGap).toBeGreaterThan(expected * 0.75);
  });

  it('ACC follows a car to a stop and keeps a standstill gap', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.pressSet(false, 60);
    const { sim, minGap } = drive(a, 50, 40, (t) => ({
      gap: 0,
      speed: Math.max(0, 50 / 3.6 - t * 1.5),
    }));
    expect(sim.state.speedMs).toBeLessThan(0.3);
    expect(a.state).toBe('hold');
    expect(minGap).toBeGreaterThan(2.5);
  });

  it('the limiter caps speed; downhill it warns once over the limit', () => {
    const a = new SpeedAssist(true);
    a.pressMain();
    a.switchFunction();
    a.pressSet(false, 60);
    const sim = new VehicleSimulator(profileById('family-suv-2022'));
    sim.state.speedMs = 60 / 3.6;
    for (let t = 0; t < 20; t += DT) {
      const out = a.step({ ...base, speedKmh: sim.speedKmh, driverThrottle: 0.6 });
      sim.inputs.throttle = Math.min(0.6, out.throttleCap ?? 1);
      sim.step(DT);
    }
    expect(sim.speedKmh).toBeLessThan(63);
    expect(sim.speedKmh).toBeGreaterThan(55);
    sim.inputs.gradient = -0.12;
    let warned = false;
    for (let t = 0; t < 20; t += DT) {
      const out = a.step({ ...base, speedKmh: sim.speedKmh, driverThrottle: 0 });
      sim.inputs.throttle = 0;
      sim.step(DT);
      warned ||= out.limiterExceeded;
    }
    expect(warned).toBe(true);
  });
});
