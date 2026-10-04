import { describe, expect, it } from 'vitest';
import { AutoHighBeam, FATIGUE_EVAL_S, FatigueMonitor, type HighBeamInput } from './lights';
import { ParkAssist, sectorLevel, type ParkDistances } from './ParkAssist';

describe('auto high beam', () => {
  const night: HighBeamInput = {
    enabled: true,
    lowBeamOn: true,
    light: 2,
    speedKmh: 90,
    inTown: false,
    oncoming: null,
    ahead: null,
    dt: 0.1,
  };
  const run = (a: AutoHighBeam, i: Partial<HighBeamInput>, s: number): boolean => {
    let on = false;
    for (let t = 0; t < s; t += 0.1) on = a.step({ ...night, ...i });
    return on;
  };
  it('comes on on an empty dark road, off at once for oncoming traffic', () => {
    const a = new AutoHighBeam();
    expect(run(a, {}, 1)).toBe(false);
    expect(run(a, {}, 1)).toBe(true);
    expect(run(a, { oncoming: 400 }, 0.1)).toBe(false);
    expect(run(a, {}, 1)).toBe(false);
    expect(run(a, {}, 1)).toBe(true);
  });
  it('stays off in towns, in daylight and when slow', () => {
    expect(run(new AutoHighBeam(), { inTown: true }, 3)).toBe(false);
    expect(run(new AutoHighBeam(), { light: 60 }, 3)).toBe(false);
    expect(run(new AutoHighBeam(), { speedKmh: 45 }, 3)).toBe(false);
  });
});

describe('fatigue', () => {
  /** Drive at 120 km/h; `tired` adds a drift-and-jerk every 50 s. */
  function drive(m: FatigueMonitor, seconds: number, tired: boolean): number[] {
    const stages: number[] = [];
    for (let t = 0; t < seconds; t += 0.1) {
      const phase = t % 50;
      let lat = 0.05;
      let latV = 0;
      if (tired && phase > 10 && phase < 13) lat = 0.6; // drifting
      if (tired && phase >= 13 && phase < 13.3) {
        lat = 0.5;
        latV = -0.8; // jerk back
      }
      stages.push(m.step({ speedKmh: 120, engineOn: true, doorOpen: false, lat, latV, dt: 0.1 }));
    }
    return stages;
  }
  it('warns a tired driver after the evaluation time, never an alert one', () => {
    expect(drive(new FatigueMonitor(), FATIGUE_EVAL_S + 120, false)).not.toContain(1);
    const tired = drive(new FatigueMonitor(), FATIGUE_EVAL_S + 120, true);
    expect(tired.indexOf(1) / 10).toBeGreaterThanOrEqual(FATIGUE_EVAL_S - 0.2);
  });
  it('warns twice at most, and a break resets it', () => {
    const m = new FatigueMonitor();
    const all = drive(m, FATIGUE_EVAL_S * 3 + 120, true);
    const starts = all.filter((s, k) => s === 1 && all[k - 1] !== 1).length;
    expect(starts).toBe(2);
    m.step({ speedKmh: 0, engineOn: false, doorOpen: true, lat: 0, latV: 0, dt: 1 });
    expect(m.score).toBe(0);
  });
});

describe('park assist', () => {
  const none: ParkDistances = {
    front: [null, null, null],
    rear: [null, null, null],
    left: null,
    right: null,
  };
  it('comes on in reverse and beeps faster as the gap closes', () => {
    const p = new ParkAssist();
    const far = p.step({
      reverse: true,
      speedKmh: 3,
      distances: { ...none, rear: [null, 1.2, null] },
      fault: false,
    }).beep;
    expect(p.active).toBe(true);
    const near = p.step({
      reverse: true,
      speedKmh: 3,
      distances: { ...none, rear: [null, 0.5, null] },
      fault: false,
    }).beep;
    expect(near).toBeLessThan(far);
    expect(
      p.step({
        reverse: true,
        speedKmh: 3,
        distances: { ...none, rear: [null, 0.25, null] },
        fault: false,
      }).beep,
    ).toBe(-1);
  });
  it('switches off above 15 km/h; the button only works when slow', () => {
    const p = new ParkAssist();
    p.toggle(5);
    expect(p.active).toBe(true);
    p.step({ reverse: false, speedKmh: 20, distances: none, fault: false });
    expect(p.active).toBe(false);
    p.toggle(30);
    expect(p.active).toBe(false);
  });
  it('rates sectors green, yellow, red', () => {
    expect([sectorLevel(1.3), sectorLevel(0.8), sectorLevel(0.4), sectorLevel(null)]).toEqual([
      1, 2, 3, 0,
    ]);
    expect(sectorLevel(0.25, true)).toBe(3);
  });
});
