import { describe, expect, it } from 'vitest';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { DEFAULT_PROFILE } from '@/profiles';
import { CHAPTERS } from './chapters';
import { Director } from './Director';

/** Plays one chapter headless, sampling the car every 0.1 s. */
function play(id: string, each: (src: SimulatorSource) => void = () => {}) {
  const now = 0;
  const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => now);
  const d = new Director(src, () => null);
  d.goto(id);
  const start = d.index;
  const steps = Math.round(d.chapter.duration * 10) - 1;
  for (let i = 0; i < steps; i++) {
    d.tick(0.1);
    src.fastForward(0.1);
    each(src);
    expect(d.index).toBe(start);
  }
  return { src, d };
}

describe('Director', () => {
  it('starts with the strongest chapters, in the approved order', () => {
    expect(CHAPTERS.map((c) => c.id)).toEqual([
      'startup',
      'motorway',
      'safety',
      'modes',
      'city',
      'night',
      'menus',
      'parking',
      'shutdown',
    ]);
    // Start-up is short so the motorway moments land inside the first 30 s.
    expect(CHAPTERS[0]!.duration).toBeLessThanOrEqual(5);
  });

  it('motorway: cruise engages, the blind-spot warning shows, then we move a lane left', () => {
    let accActive = false;
    let blindSpot = false;
    const { src } = play('motorway', (s) => {
      accActive ||= s.assist.state === 'active';
      blindSpot ||= s.blindSpot.left === 'warning';
    });
    expect(accActive).toBe(true);
    expect(blindSpot).toBe(true);
    expect(src.world.ego.lane).toBe(1);
  });

  it('motorway works the same in a world that has been running (as on the site)', () => {
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => 0);
    src.startRolling();
    src.fastForward(90); // the site's world has traffic around before the chapter starts
    const d = new Director(src, () => null);
    d.goto('motorway');
    let warned = false;
    for (let i = 0; i < 299; i++) {
      d.tick(0.1);
      src.fastForward(0.1);
      warned ||= src.blindSpot.left === 'warning';
    }
    expect(warned).toBe(true);
    expect(src.world.ego.lane).toBe(1);
  });

  it('safety: warning stages are each on screen, and braking ends matched to the car ahead', () => {
    const now = 0;
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => now);
    const d = new Director(src, () => null);
    d.goto('safety');
    const time: Record<string, number> = {};
    let stage = src.collision.stage;
    let atEnd: { ego: number; lead: number; gap: number } | null = null;
    let minGap = Infinity;
    let driverBrakedBlind = false;
    for (let i = 0; i < Math.round(d.chapter.duration * 20) - 1; i++) {
      d.tick(0.05);
      src.fastForward(0.05);
      const st = src.collision.stage;
      time[st] = (time[st] ?? 0) + 0.05;
      const lead = src.scene().lead;
      if (lead) minGap = Math.min(minGap, lead.dx);
      if (stage === 'braking' && st !== 'braking' && lead)
        atEnd = { ego: src.sim.speedKmh, lead: lead.v * 3.6, gap: lead.dx };
      // Looking away (2.6–9.6 s): no braking from the driver before the system acts.
      if (d.t > 2.6 && d.t < 5 && src.sim.inputs.brake > 0.05) driverBrakedBlind = true;
      stage = st;
    }
    expect(driverBrakedBlind).toBe(false);
    // Long enough to see: pre-warning, then the red warning with the jolt, then braking.
    expect(time.prewarn).toBeGreaterThanOrEqual(0.5);
    expect(time.acute).toBeGreaterThanOrEqual(0.5);
    expect(time.braking).toBeGreaterThanOrEqual(1.5);
    // Emergency braking on a moving target brakes down to its speed, then hands back.
    expect(atEnd).not.toBeNull();
    expect(Math.abs(atEnd!.ego - atEnd!.lead)).toBeLessThanOrEqual(3);
    expect(minGap).toBeGreaterThan(2);
  });

  it('drive modes: Eco, then Sport', () => {
    const seen = new Set<string>();
    play('modes', (s) => seen.add(s.sim.driveModes.state.current));
    expect([...seen]).toEqual(expect.arrayContaining(['eco', 'sport']));
  });

  it('city: the lights turn red as we arrive and start-stop switches the engine off', () => {
    let stopped = false;
    play('city', (s) => {
      stopped ||= s.startStop.state === 'stopped';
    });
    expect(stopped).toBe(true);
  });

  it('shutdown: parks, selects P and switches off within the chapter', () => {
    const { src } = play('shutdown');
    expect(src.sim.state.selector).toBe('P');
    expect(src.sim.state.ignition).toBe(0);
  });

  it('parking: reverses out of the bay', () => {
    let reversed = false;
    play('parking', (s) => {
      reversed ||= s.sim.state.selector === 'R' && s.sim.speedKmh > 1;
    });
    expect(reversed).toBe(true);
  });

  it('every chapter plays without errors, and the last loops back to the first', () => {
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => 0);
    const d = new Director(src, () => null);
    const reached: string[] = [];
    let completed = 0;
    d.onChapter = (id) => reached.push(id);
    d.onCompleted = () => completed++;
    d.start(0);
    const total = CHAPTERS.reduce((a, c) => a + c.duration, 0);
    for (let t = 0; t < total + 1; t += 0.1) {
      d.tick(0.1);
      src.fastForward(0.1);
    }
    expect(d.index).toBe(0);
  });

  it('taking the wheel mid-chapter hands over cleanly: no jump, no script left running', () => {
    for (const [id, at] of [
      ['motorway', 19],
      ['safety', 7],
    ] as const) {
      const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => 0);
      const d = new Director(src, () => null);
      d.goto(id);
      for (let i = 0; i < at * 10; i++) {
        d.tick(0.1);
        src.fastForward(0.1);
      }
      d.toggle(); // paused, then the visitor clicks Take the wheel
      const before = { s: src.world.ego.s, kmh: src.sim.speedKmh, acc: src.assist.state };
      d.release();
      src.fastForward(0.1);
      expect(src.paused, id).toBe(false);
      expect(src.demoDrive, id).toBe(false);
      expect(src.demo.scripted, id).toBe(false);
      expect(src.demo.cruiseAllowed, id).toBe(true);
      expect(src.buttons.distracted, id).toBe(false);
      // Same place, same speed: the world just carries on.
      expect(src.world.ego.s - before.s, id).toBeGreaterThan(0);
      expect(src.world.ego.s - before.s, id).toBeLessThan(5);
      expect(Math.abs(src.sim.speedKmh - before.kmh), id).toBeLessThan(3);
      // Cruise stays as it was (on the motorway it keeps driving for you).
      expect(src.assist.state, id).toBe(before.acc);
      // The Director no longer acts, even if ticked.
      const t = d.t;
      d.tick(5);
      expect(d.t, id).toBe(t);
    }
  });

  it('adopt: the first chapter on load takes the rolling car as it is (no re-placing)', () => {
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => 0);
    src.startRolling();
    src.fastForward(1);
    const s = src.world.ego.s;
    const d = new Director(src, () => null);
    d.adopt(0);
    expect(src.world.ego.s).toBe(s);
    expect(d.chapter.id).toBe('startup');
    d.tick(0.1);
    src.fastForward(0.1);
    expect(d.playing).toBe(true);
    expect(src.world.ego.s).toBeGreaterThan(s);
  });

  it('pausing freezes the simulation; taking the wheel hands over control', () => {
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => 0);
    const d = new Director(src, () => null);
    d.goto('motorway');
    d.toggle();
    expect(src.paused).toBe(true);
    d.tick(1);
    expect(d.t).toBe(0);
    d.release();
    expect(src.paused).toBe(false);
    expect(d.playing).toBe(false);
  });
});
