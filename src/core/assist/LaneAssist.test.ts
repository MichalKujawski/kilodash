import { describe, expect, it } from 'vitest';
import { SimulatorSource, WORLD_PLACES } from '@/core/datasource/simulator/SimulatorSource';
import { DEFAULT_PROFILE } from '@/profiles';
import { createRng, SmoothNoise } from '../math';
import { World } from '../world/World';
import { driverSteer, HANDS_OFF, LaneAssist, LINE_AT, type LaneInput } from './LaneAssist';

const DT = 0.01;
const base: LaneInput = {
  speedKmh: 100,
  lat: 0,
  latV: 0,
  lines: { left: true, right: true },
  indicating: null,
  changingLane: false,
  accEngaged: false,
  handsOn: true,
  dt: DT,
};

describe('LaneAssist states', () => {
  it('is ready above 60 km/h with lines, standby below or without lines', () => {
    const a = new LaneAssist();
    a.step(base);
    expect(a.state).toBe('ready');
    a.step({ ...base, speedKmh: 50 });
    expect(a.state).toBe('standby');
    a.step({ ...base, lines: { left: false, right: false } });
    expect(a.state).toBe('standby');
    a.toggle();
    a.step(base);
    expect(a.state).toBe('off');
  });

  it('centres with ACC at any speed and reports assisted driving', () => {
    const a = new LaneAssist();
    const out = a.step({ ...base, speedKmh: 30, accEngaged: true });
    expect(a.state).toBe('centering');
    expect(out.assisted).toBe(true);
    expect(out.left).toBe('assisting');
  });

  it('steers back near a line, but not when indicating towards it', () => {
    const a = new LaneAssist();
    const out = a.step({ ...base, lat: LINE_AT - 0.1, latV: 0.3 });
    expect(out.steer).toBeLessThan(0);
    expect(out.left).toBe('departure');
    const b = new LaneAssist();
    const quiet = b.step({ ...base, lat: LINE_AT - 0.1, latV: 0.3, indicating: 'left' });
    expect(quiet.steer).toBe(0);
    expect(quiet.left).toBe('detected');
  });

  it('escalates hands-off: message, urgent, brake jolt, emergency stop', () => {
    const a = new LaneAssist();
    const at = (t: number): number => {
      let stage = 0;
      for (let s = 0; s < t; s += DT)
        stage = a.step({ ...base, accEngaged: true, handsOn: false }).handsOffStage;
      return stage;
    };
    expect(at(HANDS_OFF.message - 1)).toBe(0);
    expect(at(2)).toBe(1);
    expect(at(HANDS_OFF.urgent - HANDS_OFF.message)).toBe(2);
    let jolted = false;
    for (let s = 0; s < HANDS_OFF.jolt - HANDS_OFF.urgent + 1; s += DT)
      jolted ||= a.step({ ...base, accEngaged: true, handsOn: false }).jolt;
    expect(jolted).toBe(true);
    at(HANDS_OFF.emergency - HANDS_OFF.jolt);
    expect(a.state).toBe('emergency');
    expect(a.out.emergencyDecel).toBeGreaterThan(0);
    // Hands back on: the driver takes over.
    a.step({ ...base, accEngaged: true, handsOn: true });
    expect(a.state).not.toBe('emergency');
    expect(a.out.handsOffStage).toBe(0);
  });
});

describe('lateral control in the world', () => {
  /** 60 s on the Autobahn at 120 km/h with the given driver and assist. */
  function drive(opts: { distracted?: boolean; assist?: boolean; acc?: boolean }): {
    maxLat: number;
    departures: number;
    meanAbs: number;
  } {
    const world = new World({ seed: 5 });
    const mw = WORLD_PLACES.find((p) => p.id === 'motorway')!;
    const seg = world.route.segments.find((s) => s.name === mw.segment)!;
    world.jumpTo(seg.s0 + 300, 0);
    const lane = new LaneAssist();
    if (!opts.assist) lane.toggle();
    const wander = new SmoothNoise(createRng(3), 0.25);
    let maxLat = 0;
    let departures = 0;
    let sum = 0;
    let n = 0;
    let was = false;
    for (let t = 0; t < 60; t += DT) {
      const e = world.ego;
      const out = lane.step({
        ...base,
        speedKmh: 120,
        lat: e.lat,
        latV: e.latV,
        accEngaged: !!opts.acc,
      });
      const human = driverSteer({
        lat: e.lat,
        latV: e.latV,
        handsOn: true,
        distracted: !!opts.distracted,
        wander: wander.next(DT),
      });
      world.step(DT, 120 / 3.6, 1, human * out.driverWeight + out.steer);
      maxLat = Math.max(maxLat, Math.abs(e.lat));
      const dep = out.left === 'departure' || out.right === 'departure';
      if (dep && !was) departures++;
      was = dep;
      sum += Math.abs(e.lat);
      n++;
    }
    return { maxLat, departures, meanAbs: sum / n };
  }

  it('an attentive driver wanders but stays well inside the lane', () => {
    const r = drive({});
    expect(r.maxLat).toBeLessThan(0.6);
    expect(r.maxLat).toBeGreaterThan(0.05);
  });

  it('a distracted driver drifts onto the line without help', () => {
    expect(drive({ distracted: true }).maxLat).toBeGreaterThan(LINE_AT);
  });

  it('lane keeping catches the distracted driver before the wheels cross', () => {
    const r = drive({ distracted: true, assist: true });
    expect(r.departures).toBeGreaterThan(0);
    expect(r.maxLat).toBeLessThan(LINE_AT + 0.15);
  });

  it('lane centering keeps the car near the middle', () => {
    expect(drive({ assist: true, acc: true }).meanAbs).toBeLessThan(0.12);
  });
});

describe('emergency stop in the car', () => {
  it('stops in lane with hazards and the parking brake when the driver stays hands-off', () => {
    let now = 0;
    const src = new SimulatorSource(DEFAULT_PROFILE, {}, () => now);
    src.jumpTo('motorway');
    src.fastForward(30); // Demo drive engages ACC
    src.pressButton('handsOn');
    for (let t = 0; t < 90 && src.sim.state.speedMs > 0.05; t += 1) {
      src.fastForward(1);
      now += 1000;
    }
    expect(src.sim.state.speedMs).toBeLessThan(0.1);
    expect(src.sim.body.hazard).toBe(true);
    expect(src.sim.body.parkingBrake).toBe(true);
    expect(Math.abs(src.scene().ego.lateral)).toBeLessThan(LINE_AT);
  });
});
