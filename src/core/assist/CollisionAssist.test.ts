import { describe, expect, it } from 'vitest';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { VehicleSimulator } from '@/core/datasource/simulator/vehicle';
import { DEFAULT_PROFILE } from '@/profiles';
import { BlindSpot, CollisionAssist, CrossTraffic, type CollisionInput } from './CollisionAssist';

const DT = 0.01;
const base: CollisionInput = {
  speedKmh: 100,
  lead: null,
  driverBrake: 0,
  driverThrottle: 0,
  blocked: false,
  dt: DT,
};
const lead = (gap: number, kmh: number, accel = 0) => ({ gap, speed: kmh / 3.6, accel });

describe('collision warning and emergency braking stages', () => {
  it('stays quiet when following at a safe distance', () => {
    const c = new CollisionAssist();
    c.step({ ...base, lead: lead(60, 100) });
    expect(c.stage).toBe('ready');
    expect(c.out.brake).toBeNull();
  });

  it('warns about following too closely after 3 s', () => {
    const c = new CollisionAssist();
    for (let t = 0; t < 2.5; t += DT) c.step({ ...base, lead: lead(20, 100) });
    expect(c.stage).toBe('ready');
    for (let t = 0; t < 1; t += DT) c.step({ ...base, lead: lead(20, 100) });
    expect(c.stage).toBe('distance');
  });

  it('escalates with time to collision: prewarn, acute jolt, braking', () => {
    const c = new CollisionAssist();
    c.step({ ...base, lead: lead(55, 40) }); // 60 km/h closing, TTC 3.3 s
    expect(c.stage).toBe('ready');
    c.step({ ...base, lead: lead(38, 40) }); // TTC 2.3 s
    expect(c.stage).toBe('prewarn');
    expect(c.out.prefill).toBe(true);
    c.step({ ...base, lead: lead(28, 40) }); // TTC 1.7 s
    expect(c.stage).toBe('acute');
    expect(c.out.brake).toBeGreaterThan(0.3);
    c.step({ ...base, lead: lead(18, 40) }); // TTC 1.1 s
    expect(c.stage).toBe('braking');
    c.step({ ...base, lead: lead(12, 40) }); // TTC 0.7 s
    expect(c.out.brake).toBe(1);
  });

  it('brakes in the city without a warning first', () => {
    const c = new CollisionAssist();
    c.step({ ...base, speedKmh: 25, lead: lead(6, 0) });
    expect(c.stage).toBe('braking');
  });

  it('kickdown overrides; switching off and sensors blocked are reported', () => {
    const c = new CollisionAssist();
    c.step({ ...base, lead: lead(18, 40), driverThrottle: 1 });
    expect(c.stage).toBe('ready');
    c.step({ ...base, blocked: true });
    expect(c.stage).toBe('unavailable');
    c.toggle();
    c.step(base);
    expect(c.stage).toBe('off');
    c.onIgnition();
    expect(c.enabled).toBe(true);
  });
});

describe('blind spot and cross traffic', () => {
  const car = { length: 4.6, oncoming: false };
  it('lights for a car alongside, warns when indicating towards it', () => {
    const b = new BlindSpot();
    b.step(100, [{ ...car, laneOffset: 1, dx: -3, v: 100 / 3.6 }], null);
    expect(b.left).toBe('occupied');
    expect(b.right).toBe('none');
    b.step(100, [{ ...car, laneOffset: 1, dx: -3, v: 100 / 3.6 }], 'left');
    expect(b.left).toBe('warning');
  });

  it('lights for a fast car closing from behind, not a slow one far back', () => {
    const b = new BlindSpot();
    b.step(100, [{ ...car, laneOffset: -1, dx: -30, v: 140 / 3.6 }], null);
    expect(b.right).toBe('occupied');
    b.step(100, [{ ...car, laneOffset: -1, dx: -50, v: 102 / 3.6 }], null);
    expect(b.right).toBe('none');
    b.step(10, [{ ...car, laneOffset: 1, dx: -3, v: 3 }], null);
    expect(b.left).toBe('none');
  });

  it('cross traffic: warns, then brakes when a car is about to pass behind', () => {
    const x = new CrossTraffic();
    expect(x.step(true, 3, [{ distance: 12, speed: 4 }])).toBeNull();
    expect(x.state).toBe('warning');
    expect(x.step(true, 3, [{ distance: 5, speed: 4 }])).toBeGreaterThan(0);
    expect(x.state).toBe('braking');
    x.step(false, 3, [{ distance: 5, speed: 4 }]);
    expect(x.state).toBe('none');
  });
});

describe('in the car', () => {
  /** Nobody brakes; a stopped car 80 m ahead. Returns the impact speed (0 = stopped short). */
  function towardsStoppedCar(kmh: number): { impactKmh: number; stoppedGap: number } {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.state.coolantC = 90;
    sim.state.speedMs = kmh / 3.6;
    const c = new CollisionAssist();
    let gap = 80;
    for (let t = 0; t < 30; t += DT) {
      const out = c.step({ ...base, speedKmh: sim.speedKmh, lead: lead(gap, 0) });
      sim.inputs.throttle = out.brake === null ? 0.25 : 0;
      sim.inputs.brake = out.brake ?? 0;
      sim.step(DT);
      gap -= sim.state.speedMs * DT;
      if (gap <= 0) return { impactKmh: sim.speedKmh, stoppedGap: 0 };
      if (sim.state.speedMs < 0.05 && t > 1) return { impactKmh: 0, stoppedGap: gap };
    }
    return { impactKmh: 0, stoppedGap: gap };
  }

  it('stops short of a stopped car from 50 km/h', () => {
    const r = towardsStoppedCar(50);
    expect(r.impactKmh).toBe(0);
    expect(r.stoppedGap).toBeGreaterThan(0.3);
  });

  it('on a slower moving car it brakes down to its speed, then hands back', () => {
    const sim = new VehicleSimulator(DEFAULT_PROFILE);
    sim.state.coolantC = 90;
    sim.state.speedMs = 100 / 3.6;
    const c = new CollisionAssist();
    const vl = 40 / 3.6;
    let gap = 45;
    let released: { ego: number; gap: number } | null = null;
    for (let t = 0; t < 15 && !released; t += DT) {
      const out = c.step({ ...base, speedKmh: sim.speedKmh, lead: lead(gap, 40) });
      sim.inputs.throttle = out.brake === null ? 0.3 : 0;
      sim.inputs.brake = out.brake ?? 0;
      const was = c.stage;
      sim.step(DT);
      gap -= (sim.state.speedMs - vl) * DT;
      expect(gap).toBeGreaterThan(0);
      if (t > 1 && was !== 'braking' && sim.speedKmh < 60) released = { ego: sim.speedKmh, gap };
    }
    expect(released).not.toBeNull();
    expect(Math.abs(released!.ego - 40)).toBeLessThanOrEqual(3);
  });

  it('from 100 km/h it at least cuts the impact speed by more than a third', () => {
    expect(towardsStoppedCar(100).impactKmh).toBeLessThan(65);
  });

  it('rear cross traffic stops the car reversing out of the bay', () => {
    let now = 0;
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => now);
    let warned = false;
    let braked = false;
    for (let t = 0; t < 30 && src.world.ego.inBay; t += 0.1) {
      src.fastForward(0.1);
      now += 100;
      warned ||= src.crossTraffic.state === 'warning';
      braked ||= src.crossTraffic.state === 'braking';
    }
    expect(warned).toBe(true);
    expect(braked).toBe(true);
  });
});
