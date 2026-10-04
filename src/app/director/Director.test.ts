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

  it('safety: traffic ahead brakes hard; the car warns, jolts and brakes itself in time', () => {
    const stages = new Set<string>();
    let minGap = Infinity;
    const { src } = play('safety', (s) => {
      stages.add(s.collision.stage);
      const lead = s.scene().lead;
      if (lead) minGap = Math.min(minGap, lead.dx);
    });
    expect([...stages]).toEqual(expect.arrayContaining(['acute', 'braking']));
    expect(minGap).toBeGreaterThan(2);
    expect(src.sim.speedKmh).toBeLessThan(50);
  });

  it('drive modes: Eco, then Sport', () => {
    const seen = new Set<string>();
    play('modes', (s) => seen.add(s.sim.driveModes.state.current));
    expect([...seen]).toEqual(expect.arrayContaining(['eco', 'sport']));
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
    d.start(0);
    const total = CHAPTERS.reduce((a, c) => a + c.duration, 0);
    for (let t = 0; t < total + 1; t += 0.1) {
      d.tick(0.1);
      src.fastForward(0.1);
    }
    expect(d.index).toBe(0);
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
