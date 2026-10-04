import { describe, expect, it } from 'vitest';
import { Route } from './route';
import { DEMO_ROUTE } from './template';
import type { SegmentSpec } from './types';

const dry = { wet: false, hour: 12 };

describe('Route geometry', () => {
  const route = new Route(DEMO_ROUTE);

  it('is about 20 km long and starts in a car park', () => {
    expect(route.length).toBeGreaterThan(18_000);
    expect(route.length).toBeLessThan(24_000);
    expect(route.kindAt(10)).toBe('parking');
    expect(route.kindAt(route.length - 1)).toBe('parking');
  });

  it('integrates a 90° junction turn into a 90° heading change', () => {
    const seg = route.segments.find((s) => s.name === 'Hauptstraße')!;
    const before = route.pointAt(seg.s0 - 1).heading;
    const after = route.pointAt(seg.s0 + 25).heading;
    expect(Math.abs(after - before)).toBeCloseTo(Math.PI / 2, 1);
  });

  it('passes a roundabout second exit with no net heading change', () => {
    const seg = route.segments.find((s) => s.name === 'Waldstraße')!;
    const before = route.pointAt(seg.s0 - 1).heading;
    const after = route.pointAt(seg.s0 + 60).heading;
    expect(after - before).toBeCloseTo(0, 2);
  });

  it('has a tunnel and a roadworks lane drop on the Autobahn', () => {
    const a7 = route.segments.find((s) => s.name === 'A 7')!;
    expect(route.inTunnel(a7.s0 + 4000)).toBe(true);
    expect(route.inTunnel(a7.s0 + 2000)).toBe(false);
    expect(route.lanesAt(a7.s0 + 6200)).toBe(2);
    expect(route.lanesAt(a7.s0 + 1000)).toBe(3);
  });
});

describe('German speed-limit rules', () => {
  const route = new Route(DEMO_ROUTE);
  const at = (name: string, local: number, ctx = dry) =>
    route.legalAt(route.segments.find((s) => s.name === name)!.s0 + local, ctx);

  it('applies implicit limits by place', () => {
    expect(at('Bahnhofstraße', 100).limit).toBe(50);
    expect(at('Lindenweg', 200).limit).toBe(30);
    expect(at('L 1180', 200).limit).toBe(100);
  });

  it('has no limit on the Autobahn but recommends 130', () => {
    const l = at('A 7', 1000);
    expect(l.limit).toBeNull();
    expect(l.advisory).toBe(130);
  });

  it('honours explicit signs, end signs and end of all restrictions', () => {
    expect(at('L 1180', 1300).limit).toBe(70);
    expect(at('L 1180', 1600).limit).toBe(100);
    expect(at('A 7', 3000).limit).toBe(120);
    expect(at('A 7', 4000).limit).toBe(100);
    expect(at('A 7', 5000).limit).toBeNull();
    expect(at('A 7', 6000).limit).toBe(80);
  });

  it('applies time and wet plates only when they apply', () => {
    expect(at('Hauptstraße', 200, { wet: false, hour: 9 }).limit).toBe(30);
    expect(at('Hauptstraße', 200, { wet: false, hour: 20 }).limit).toBe(50);
    expect(at('A 7', 8000, { wet: true, hour: 12 }).limit).toBe(130);
    expect(at('A 7', 8000, dry).limit).toBeNull();
  });

  it('switches to 50 at a town entry and back to 100 after the exit', () => {
    expect(at('L 1180', 2900).limit).toBe(50);
    expect(at('L 1180', 3250).limit).toBe(100);
  });

  it('tracks no-overtaking zones', () => {
    expect(at('L 1180', 2000).noOvertaking).toBe(true);
    expect(at('L 1180', 2500).noOvertaking).toBe(false);
  });

  it('is configurable per country', () => {
    const spec: SegmentSpec[] = [{ kind: 'motorway', name: 'A', length: 100, lanes: 2 }];
    expect(new Route(spec).legalAt(50, dry).limit).toBeNull();
  });
});
