import { describe, expect, it } from 'vitest';
import { lightState, World } from './World';

function on(world: World, name: string, at: number, lane = 0) {
  world.jumpTo(world.route.segments.find((s) => s.name === name)!.s0 + at, lane);
}

describe('Traffic', () => {
  it('never lets vehicles in the same lane overlap', () => {
    const world = new World({ seed: 3 });
    on(world, 'A 7', 200);
    let worst = Infinity;
    for (let i = 0; i < 6000; i++) {
      world.step(0.02, 33, 1);
      const vs = world.traffic.vehicles.filter((v) => !v.oncoming).sort((a, b) => a.s - b.s);
      for (let a = 0; a < vs.length; a++)
        for (let b = a + 1; b < vs.length; b++) {
          const va = vs[a]!;
          const vb = vs[b]!;
          if (Math.abs(va.lane - vb.lane) < 0.3) worst = Math.min(worst, vb.s - vb.length - va.s);
        }
    }
    expect(worst).toBeGreaterThan(0);
  });

  it('keeps right on the Autobahn: most cars use the right lanes', () => {
    const world = new World({ seed: 4 });
    on(world, 'A 7', 200);
    let right = 0;
    let left = 0;
    for (let i = 0; i < 3000; i++) {
      world.step(0.02, 30, 1);
      for (const v of world.traffic.vehicles) {
        if (v.oncoming) continue;
        if (v.lane < 0.5) right++;
        if (v.lane > 1.5) left++;
      }
    }
    expect(right).toBeGreaterThan(left);
  });

  it('runs a German traffic-light cycle: green, amber, red, red+amber', () => {
    const f = { s: 0, kind: 'trafficLight' as const, phase: 0 };
    expect(lightState(f, 5)).toBe('green');
    expect(lightState(f, 23)).toBe('amber');
    expect(lightState(f, 30)).toBe('red');
    expect(lightState(f, 46)).toBe('redAmber');
  });

  it('reports the vehicle ahead in the ego lane as lead', () => {
    const world = new World({ seed: 1 });
    on(world, 'L 1180', 1300);
    for (let i = 0; i < 500; i++) world.step(0.02, 15, 1);
    const sc = world.snapshot();
    if (sc.lead) {
      expect(sc.lead.dx).toBeGreaterThan(0);
      expect(Math.abs(sc.lead.laneOffset)).toBeLessThan(0.5);
    }
  });
});

describe('Navigation', () => {
  const world = new World();

  it('gives turn-by-turn instructions from the route', () => {
    const kinds = world.nav.maneuvers.map((m) => m.kind);
    expect(kinds).toContain('roundabout');
    expect(kinds).toContain('join');
    expect(kinds).toContain('exit');
    expect(kinds[kinds.length - 1]).toBe('destination');
  });

  it('counts down distance and offers lane guidance for the exit', () => {
    on(world, 'A 7', 8000);
    const nav = world.snapshot().nav;
    expect(nav.current?.kind).toBe('exit');
    expect(nav.current?.exitNumber).toBe(23);
    expect(nav.distance).toBeGreaterThan(1300);
    expect(nav.current?.lanes?.[0]).toBe(true);
    expect(nav.remaining).toBeLessThan(world.route.length);
    expect(nav.timeLeft).toBeGreaterThan(0);
  });
});

describe('Ego in the world', () => {
  it('starts in the bay and reaches the route by reversing', () => {
    const world = new World();
    expect(world.snapshot().ego.inBay).toBe(true);
    for (let i = 0; i < 1000 && world.ego.inBay; i++) world.step(0.02, 1.2, -1);
    expect(world.ego.inBay).toBe(false);
    expect(world.ego.s).toBe(0);
  });

  it('darkens in the tunnel', () => {
    const world = new World({ env: { hour: 12 } });
    on(world, 'A 7', 3590, 0);
    for (let i = 0; i < 100; i++) world.step(0.02, 30, 1);
    expect(world.snapshot().road.inTunnel).toBe(true);
    expect(world.env.light).toBeLessThan(15);
  });
});
