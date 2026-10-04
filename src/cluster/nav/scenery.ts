import { createRng } from '@/core/math';
import type { Route } from '@/core/world/route';
import type { RoadKind } from '@/core/world/types';

export interface Vec2 {
  x: number;
  y: number;
}

export type SceneryKind =
  'building' | 'field' | 'meadow' | 'forest' | 'hill' | 'lot' | 'parkedCar' | 'canopy';

export interface Polygon {
  kind: SceneryKind;
  points: Vec2[];
  /** Shade variation 0..1. */
  shade: number;
  bbox: [number, number, number, number];
}

export interface RoadLine {
  points: Vec2[];
  /** Total paved width, m. */
  width: number;
  kind: RoadKind | 'minor';
  /** Lane count per direction (for markings). */
  lanes: number;
  tunnel?: boolean;
  bbox: [number, number, number, number];
}

/** Paved width per road kind, m (two directions; the Autobahn includes the median). */
export function roadWidth(kind: RoadKind, lanes: number): number {
  switch (kind) {
    case 'motorway':
      return 2 * lanes * 3.5 + 2.4;
    case 'ramp':
      return 5;
    case 'parking':
      return 6;
    case 'rural':
      return 7;
    default:
      return 7.5;
  }
}

function bbox(points: Vec2[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return [x0, y0, x1, y1];
}

/** Grid cell size for spatial lookups, m. */
const CELL = 200;

/**
 * Deterministic map content generated around the route: town buildings and side
 * streets, fields and forests, the Autobahn's twin carriageways, a hill over the
 * tunnel, car parks with parked cars. Indexed in a grid for fast culling.
 */
export class Scenery {
  readonly polygons: Polygon[] = [];
  readonly roads: RoadLine[] = [];
  private grid = new Map<string, { polys: Polygon[]; roads: RoadLine[] }>();

  constructor(private route: Route) {
    const rng = createRng(17);
    this.buildRoads();
    this.buildAlongRoute(rng);
    for (const p of this.polygons) this.index(p.bbox, (c) => c.polys.push(p));
    for (const r of this.roads) this.index(r.bbox, (c) => c.roads.push(r));
  }

  private index(
    b: [number, number, number, number],
    add: (cell: { polys: Polygon[]; roads: RoadLine[] }) => void,
  ): void {
    for (let gx = Math.floor(b[0] / CELL); gx <= Math.floor(b[2] / CELL); gx++) {
      for (let gy = Math.floor(b[1] / CELL); gy <= Math.floor(b[3] / CELL); gy++) {
        const key = `${gx},${gy}`;
        let cell = this.grid.get(key);
        if (!cell) this.grid.set(key, (cell = { polys: [], roads: [] }));
        add(cell);
      }
    }
  }

  /** Polygons and roads touching the square around (x, y). Each item once. */
  query(x: number, y: number, r: number): { polys: Polygon[]; roads: RoadLine[] } {
    const polys = new Set<Polygon>();
    const roads = new Set<RoadLine>();
    for (let gx = Math.floor((x - r) / CELL); gx <= Math.floor((x + r) / CELL); gx++) {
      for (let gy = Math.floor((y - r) / CELL); gy <= Math.floor((y + r) / CELL); gy++) {
        const cell = this.grid.get(`${gx},${gy}`);
        if (!cell) continue;
        for (const p of cell.polys) polys.add(p);
        for (const rd of cell.roads) roads.add(rd);
      }
    }
    return { polys: [...polys], roads: [...roads] };
  }

  /** Point at route position s, offset sideways (+ = right of travel). */
  private at(s: number, side: number): Vec2 & { h: number } {
    const p = this.route.pointAt(s);
    return {
      x: p.x - Math.sin(p.heading) * side,
      y: p.y + Math.cos(p.heading) * side,
      h: p.heading,
    };
  }

  private quad(s0: number, s1: number, side0: number, side1: number): Vec2[] {
    const a = this.at(s0, side0);
    const b = this.at(s1, side0);
    const c = this.at(s1, side1);
    const d = this.at(s0, side1);
    return [a, b, c, d];
  }

  private poly(kind: SceneryKind, points: Vec2[], shade: number): void {
    this.polygons.push({ kind, points, shade, bbox: bbox(points) });
  }

  private road(
    points: Vec2[],
    width: number,
    kind: RoadLine['kind'],
    lanes: number,
    tunnel = false,
  ): void {
    if (points.length < 2) return;
    this.roads.push({
      points,
      width,
      kind,
      lanes,
      tunnel,
      bbox: bbox(points).map((v, i) => v + (i < 2 ? -width : width)) as RoadLine['bbox'],
    });
  }

  private buildRoads(): void {
    const r = this.route;
    for (const seg of r.segments) {
      // Split into tunnel / open pieces so tunnels can be drawn differently.
      const cuts = [seg.s0, seg.s0 + seg.length];
      if (seg.tunnel) cuts.splice(1, 0, seg.s0 + seg.tunnel[0], seg.s0 + seg.tunnel[1]);
      for (let i = 0; i + 1 < cuts.length; i++) {
        const pts: Vec2[] = [];
        for (let s = cuts[i]!; s <= cuts[i + 1]!; s += 4) pts.push(this.at(s, 0));
        pts.push(this.at(cuts[i + 1]!, 0));
        const tunnel = !!seg.tunnel && i === 1;
        this.road(pts, roadWidth(seg.kind, seg.lanes), seg.kind, seg.lanes, tunnel);
      }
    }
    // Continuing streets at junctions: the road we turned off goes on.
    for (const f of r.features) {
      if (f.kind !== 'junction' && f.kind !== 'roundabout') continue;
      const p = r.pointAt(f.s - 2);
      const len = 160;
      this.road(
        [
          { x: p.x, y: p.y },
          { x: p.x + Math.cos(p.heading) * len, y: p.y + Math.sin(p.heading) * len },
        ],
        7,
        'minor',
        1,
      );
      if (f.kind === 'roundabout') {
        const back = r.pointAt(f.s + 19);
        const out = {
          x: back.x + Math.cos(back.heading + Math.PI / 2) * 30,
          y: back.y + Math.sin(back.heading + Math.PI / 2) * 30,
        };
        this.road([{ x: back.x, y: back.y }, out], 7, 'minor', 1);
      }
    }
  }

  private buildAlongRoute(rng: () => number): void {
    const r = this.route;
    const fuel = r.features.filter((f) => f.kind === 'fuelStation');
    const turns = r.features.filter((f) => f.kind === 'junction' || f.kind === 'roundabout');
    const nearTurn = (s: number, d: number): boolean => turns.some((f) => Math.abs(f.s - s) < d);
    let nextSide = 60;
    for (let s = 0; s < r.length;) {
      const seg = r.segmentAt(s);
      const town = r.townAt(s) !== undefined && seg.kind !== 'motorway' && seg.kind !== 'ramp';
      const half = roadWidth(seg.kind, seg.lanes) / 2;
      if (seg.kind === 'parking') {
        s = this.carPark(seg.s0, seg.length, rng);
        continue;
      }
      if (town) {
        const len = 9 + rng() * 10;
        if (s > nextSide && !nearTurn(s, 40)) {
          // A side street to both sides.
          for (const side of [-1, 1]) {
            const a = this.at(s, side * half);
            const b = this.at(s, side * (half + 130));
            this.road([a, b], 6, 'minor', 1);
          }
          nextSide = s + 110 + rng() * 60;
          s += 14;
          continue;
        }
        if (!nearTurn(s, 22)) {
          // Three rows of buildings deep on each side: towns are built up behind the street too.
          for (const side of [-1, 1]) {
            let off = half + 4 + rng() * 4;
            for (let row = 0; row < 3; row++) {
              const depth = 12 + rng() * 9;
              if (rng() > 0.1)
                this.poly(
                  'building',
                  this.quad(s, s + len, side * off, side * (off + depth)),
                  rng(),
                );
              off += depth + 3 + rng() * 3;
            }
          }
        }
        s += len + 1.5 + rng() * 2.5;
      } else {
        const len = 110 + rng() * 140;
        const gap = seg.kind === 'motorway' ? 14 : 8;
        for (const side of [-1, 1]) {
          const roll = rng();
          const kind: SceneryKind = roll < 0.28 ? 'forest' : roll < 0.6 ? 'field' : 'meadow';
          const depth = 60 + rng() * 160;
          this.poly(
            kind,
            this.quad(s, s + len, side * (half + gap), side * (half + gap + depth)),
            rng(),
          );
        }
        s += len + 6 + rng() * 10;
      }
    }
    // Hill over each tunnel.
    for (const seg of r.segments) {
      if (!seg.tunnel) continue;
      const s0 = seg.s0 + seg.tunnel[0] - 40;
      const s1 = seg.s0 + seg.tunnel[1] + 40;
      const pts: Vec2[] = [];
      for (let s = s0; s <= s1; s += 50) pts.push(this.at(s, -140));
      for (let s = s1; s >= s0; s -= 50) pts.push(this.at(s, 140));
      this.poly('hill', pts, 0.5);
    }
    // Fuel station canopy beside the road.
    for (const f of fuel) {
      const half = roadWidth(r.kindAt(f.s), 1) / 2;
      this.poly('canopy', this.quad(f.s - 15, f.s + 15, half + 6, half + 24), 0.5);
    }
  }

  /** A car park: tarmac around the aisle, painted bays with a few parked cars. */
  private carPark(s0: number, length: number, rng: () => number): number {
    this.poly('lot', this.quad(s0, s0 + length, -18, 18), 0.5);
    for (let s = s0 + 4; s < s0 + length - 8; s += 2.6) {
      for (const side of [-1, 1]) {
        // Keep the demo car's own bays free (left of the start, left near the end).
        const ownBay = side < 0 && (s - s0 < 12 || s0 + length - s < 18);
        if (!ownBay && rng() < 0.45)
          this.poly('parkedCar', this.quad(s + 0.3, s + 2.1, side * 4.5, side * 9), rng());
      }
    }
    return s0 + length;
  }
}
