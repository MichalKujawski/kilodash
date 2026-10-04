import type { Route } from '@/core/world/route';
import type { SceneSnapshot } from '@/core/world/scene';
import type { MapTokens } from '../themes/types';
import type { Polygon, RoadLine, Scenery, Vec2 } from './scenery';

/** Camera: pitch down from horizontal, distance behind the car, focal length as a share of height. */
const PITCH = (55 * Math.PI) / 180;
const BACK = 52;
const HEIGHT = BACK * Math.tan(PITCH);
/** How far the map is drawn, m (beyond is lost in the haze). */
const REACH = 520;
const BUILDING_REACH = 240;

interface Cam {
  ex: number;
  ey: number;
  /** Forward (fx, fy) and right (rx, ry) unit vectors of the camera's heading. */
  fx: number;
  fy: number;
  rx: number;
  ry: number;
  cx: number;
  cy: number;
  focal: number;
}

type P = [number, number, number] | null;

/**
 * The navigation map as a tilted 3D scene drawn with Canvas 2D: flat land use,
 * road ribbons, extruded low-poly town buildings shaded by orientation, a
 * glowing route ribbon and floating labels. Perspective from a chase camera
 * pitched ~55° behind the car; far parts fade into haze.
 */
export class Map3D {
  private cam!: Cam;

  constructor(
    private route: Route,
    private scenery: Scenery,
  ) {}

  private cached: { x: number; y: number; polys: Polygon[]; roads: RoadLine[] } | null = null;

  /** Scenery around a point; re-queried only after moving ~25 m (no per-frame garbage). */
  private nearby(x: number, y: number): { polys: Polygon[]; roads: RoadLine[] } {
    const c = this.cached;
    if (c && Math.hypot(x - c.x, y - c.y) < 25) return c;
    const q = this.scenery.query(x, y, REACH * 0.7);
    this.cached = { x, y, ...q };
    return this.cached;
  }

  /** World point (m, height h) → screen x, y and depth (null when behind the camera). */
  private project(x: number, y: number, h = 0): P {
    const c = this.cam;
    const dx = x - c.ex;
    const dy = y - c.ey;
    const a = dx * c.fx + dy * c.fy + BACK; // along, from the camera
    const r = dx * c.rx + dy * c.ry;
    const v = h - HEIGHT;
    const depth = a * Math.cos(PITCH) - v * Math.sin(PITCH);
    if (depth < 4) return null;
    const vert = a * Math.sin(PITCH) + v * Math.cos(PITCH);
    return [c.cx + (c.focal * r) / depth, c.cy - (c.focal * vert) / depth, depth];
  }

  /** Distance ahead of the car along the camera axis (for culling and haze), m. */
  private ahead(x: number, y: number): number {
    const c = this.cam;
    return (x - c.ex) * c.fx + (y - c.ey) * c.fy;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    sc: SceneSnapshot,
    heading: number,
    m: MapTokens,
    w: number,
    h: number,
  ): { x: number; y: number } {
    this.cam = {
      ex: sc.ego.x,
      ey: sc.ego.y,
      fx: Math.cos(heading),
      fy: Math.sin(heading),
      rx: -Math.sin(heading),
      ry: Math.cos(heading),
      cx: w / 2,
      cy: h * 0.74,
      focal: h * 0.44,
    };
    ctx.fillStyle = m.ground;
    ctx.fillRect(0, 0, w, h);
    const c = this.cam;
    const centre = { x: c.ex + c.fx * REACH * 0.4, y: c.ey + c.fy * REACH * 0.4 };
    const { polys, roads } = this.nearby(centre.x, centre.y);
    const visible = (p: Polygon): boolean => {
      const [x0, y0, x1, y1] = p.bbox;
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const d = this.ahead(mx, my);
      return d > -BACK && d < REACH;
    };
    const ground = polys.filter(
      (p) => p.kind !== 'building' && p.kind !== 'parkedCar' && visible(p),
    );
    this.ground(ctx, ground, m);
    this.roads(ctx, roads, m);
    this.routeRibbon(ctx, sc, m);
    const buildings = polys
      .filter((p) => (p.kind === 'building' || p.kind === 'parkedCar') && visible(p))
      .map((p) => ({ p, d: this.centreDepth(p) }))
      // Nothing beside or behind the car: it would loom over the bottom edge.
      .filter((b) => b.d > 0 && b.d < BUILDING_REACH + BACK && this.aheadOf(b.p) > 6)
      .sort((a, b) => b.d - a.d);
    this.buildings(
      ctx,
      buildings.map((x) => x.p),
      m,
    );
    this.labels(ctx, sc, m);
    // Haze: the far map dissolves into the background.
    const horizon = c.cy - c.focal * Math.tan(PITCH);
    const haze = ctx.createLinearGradient(0, Math.max(0, horizon), 0, h * 0.5);
    haze.addColorStop(0, m.ground);
    haze.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, w, h * 0.5);
    const ego = this.project(c.ex, c.ey) ?? [c.cx, c.cy, 1];
    return { x: ego[0], y: ego[1] };
  }

  private aheadOf(p: Polygon): number {
    const [x0, y0, x1, y1] = p.bbox;
    return this.ahead((x0 + x1) / 2, (y0 + y1) / 2);
  }

  private centreDepth(p: Polygon): number {
    const [x0, y0, x1, y1] = p.bbox;
    const q = this.project((x0 + x1) / 2, (y0 + y1) / 2);
    return q ? q[2] : -1;
  }

  private groundColor(p: Polygon, m: MapTokens): string {
    switch (p.kind) {
      case 'field':
        return m.field;
      case 'meadow':
        return m.meadow;
      case 'forest':
      case 'hill':
        return m.forest;
      case 'lot':
        return m.lot;
      default:
        return m.roadMajor;
    }
  }

  private path(ctx: CanvasRenderingContext2D, pts: [number, number][]): void {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
  }

  /** Flat land use, one path per colour. */
  private ground(ctx: CanvasRenderingContext2D, list: Polygon[], m: MapTokens): void {
    const byColour = new Map<string, Path2D>();
    for (const p of list) {
      const pts: [number, number][] = [];
      for (const pt of p.points) {
        const q = this.project(pt.x, pt.y);
        if (!q) break;
        pts.push([q[0], q[1]]);
      }
      if (pts.length !== p.points.length) continue;
      const colour = this.groundColor(p, m);
      let path = byColour.get(colour);
      if (!path) byColour.set(colour, (path = new Path2D()));
      pts.forEach(([x, y], k) => (k === 0 ? path!.moveTo(x, y) : path!.lineTo(x, y)));
      path.closePath();
    }
    ctx.globalAlpha = 0.9;
    for (const [colour, path] of byColour) {
      // Land use reads on the dark ground: a touch brighter than the flat map's tokens.
      ctx.fillStyle = shade(colour.startsWith('#') ? colour : '#202630', 1.9);
      ctx.fill(path);
    }
    ctx.globalAlpha = 1;
  }

  /** Ribbon strip for a polyline, width in metres, as one projected polygon. */
  private ribbon(points: Vec2[], width: number, lift = 0): [number, number][] | null {
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[Math.max(0, i - 1)]!;
      const b = points[Math.min(points.length - 1, i + 1)]!;
      const hd = Math.atan2(b.y - a.y, b.x - a.x);
      const nx = -Math.sin(hd) * (width / 2);
      const ny = Math.cos(hd) * (width / 2);
      const p = points[i]!;
      const l = this.project(p.x - nx, p.y - ny, lift);
      const r = this.project(p.x + nx, p.y + ny, lift);
      if (!l || !r) {
        if (left.length) break;
        continue;
      }
      left.push([l[0], l[1]]);
      right.push([r[0], r[1]]);
    }
    if (left.length < 2) return null;
    return [...left, ...right.reverse()];
  }

  /** Keep only the part of a road near the car (projection cost and haze). */
  private clip(points: Vec2[]): Vec2[] {
    return points.filter((p) => {
      const d = this.ahead(p.x, p.y);
      return d > -BACK * 0.9 && d < REACH;
    });
  }

  private roads(ctx: CanvasRenderingContext2D, roads: RoadLine[], m: MapTokens): void {
    const order = (rd: RoadLine): number =>
      rd.kind === 'minor' ? 0 : rd.kind === 'motorway' ? 2 : 1;
    for (const rd of [...roads].sort((a, b) => order(a) - order(b))) {
      const pts = this.clip(rd.points);
      if (pts.length < 2) continue;
      const edge = this.ribbon(pts, rd.width + 2);
      const body = this.ribbon(pts, rd.width);
      if (!edge || !body) continue;
      ctx.globalAlpha = rd.tunnel ? 0.35 : 1;
      ctx.fillStyle = m.roadEdge;
      this.path(ctx, edge);
      ctx.fill();
      const major = rd.kind === 'motorway' || rd.kind === 'rural' || rd.kind === 'ramp';
      ctx.fillStyle = shade(major ? m.roadMajor : m.road, 1.45);
      this.path(ctx, body);
      ctx.fill();
      if (rd.kind === 'motorway') {
        // Central reservation.
        const median = this.ribbon(pts, 1.6);
        if (median) {
          ctx.fillStyle = m.roadEdge;
          this.path(ctx, median);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  /** The route ahead as a glowing ribbon on our carriageway. */
  private routeRibbon(ctx: CanvasRenderingContext2D, sc: SceneSnapshot, m: MapTokens): void {
    const route = this.route;
    const pts: Vec2[] = [];
    if (sc.ego.inBay) pts.push({ x: sc.ego.x, y: sc.ego.y });
    for (let s = sc.ego.s; s < Math.min(route.length, sc.ego.s + REACH * 1.6); s += 5) {
      const p = route.pointAt(s);
      const seg = route.segmentAt(s);
      const off = seg.kind === 'motorway' ? 1.2 + (seg.lanes * 3.5) / 2 : 0;
      const q = { x: p.x - Math.sin(p.heading) * off, y: p.y + Math.cos(p.heading) * off };
      if (this.ahead(q.x, q.y) > REACH) break;
      pts.push(q);
    }
    if (pts.length < 2) return;
    for (const [width, color, alpha] of [
      [11, m.routeGlow, 0.35],
      [6, m.routeGlow, 0.6],
      [3, m.route, 1],
    ] as const) {
      const strip = this.ribbon(pts, width, 0.2);
      if (!strip) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      this.path(ctx, strip);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Buildings as prisms: visible walls lit by orientation, then roofs. Drawn far
   * to near in 20 m depth bands; inside a band all walls of one light level
   * (and all roofs) are one path, which keeps fill calls in the dozens.
   */
  private buildings(ctx: CanvasRenderingContext2D, list: Polygon[], m: MapTokens): void {
    const LEVELS = 5;
    let band = -1;
    let walls: Path2D[] = [];
    let roofs = new Path2D();
    let cars = new Path2D();
    let alpha = 1;
    const flush = (): void => {
      if (band < 0) return;
      ctx.globalAlpha = alpha;
      walls.forEach((w, k) => {
        ctx.fillStyle = shade(m.block, 0.9 + (0.7 * k) / (LEVELS - 1));
        ctx.fill(w);
      });
      ctx.fillStyle = shade(m.roadMajor, 1.5);
      ctx.fill(cars);
      ctx.fillStyle = shade(m.block, 2.5);
      ctx.fill(roofs);
      ctx.strokeStyle = 'rgba(200,215,235,0.14)';
      ctx.lineWidth = 1;
      ctx.stroke(roofs);
      ctx.globalAlpha = 1;
    };
    for (const p of list) {
      const car = p.kind === 'parkedCar';
      const height = car ? 1.5 : 7 + p.shade * 15;
      const base: [number, number, number][] = [];
      const top: [number, number, number][] = [];
      let ok = true;
      for (const pt of p.points) {
        const bq = this.project(pt.x, pt.y, 0);
        const tq = this.project(pt.x, pt.y, height);
        if (!bq || !tq) {
          ok = false;
          break;
        }
        base.push(bq);
        top.push(tq);
      }
      if (!ok) continue;
      const depth = base[0]![2];
      const b = Math.floor(depth / 20);
      if (b !== band) {
        flush();
        band = b;
        walls = Array.from({ length: LEVELS }, () => new Path2D());
        roofs = new Path2D();
        cars = new Path2D();
        alpha = Math.max(0, Math.min(1, 1 - (depth - 200) / 140));
      }
      const n = base.length;
      if (depth < 190) {
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          const b0 = base[i]!;
          const b1 = base[j]!;
          // Back faces wind the other way on screen: skip them.
          const cross =
            (b1[0] - b0[0]) * (top[i]![1] - b0[1]) - (b1[1] - b0[1]) * (top[i]![0] - b0[0]);
          if (cross >= 0) continue;
          const wx = p.points[j]!.x - p.points[i]!.x;
          const wy = p.points[j]!.y - p.points[i]!.y;
          const len = Math.hypot(wx, wy) || 1;
          // Light from the upper left of the screen.
          const light = ((wy / len) * 0.7 - (wx / len) * 0.7 + 1) * 0.5;
          const target = car ? cars : walls[Math.round(light * (LEVELS - 1))]!;
          target.moveTo(b0[0], b0[1]);
          target.lineTo(b1[0], b1[1]);
          target.lineTo(top[j]![0], top[j]![1]);
          target.lineTo(top[i]![0], top[i]![1]);
          target.closePath();
        }
      }
      const roof = car ? cars : roofs;
      top.forEach((q, k) => (k === 0 ? roof.moveTo(q[0], q[1]) : roof.lineTo(q[0], q[1])));
      roof.closePath();
    }
    flush();
  }

  /** Street and town names floating over the road ahead. */
  private labels(ctx: CanvasRenderingContext2D, sc: SceneSnapshot, m: MapTokens): void {
    const route = this.route;
    const shown = new Set<string>();
    ctx.font = '500 15px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let s = sc.ego.s + 60; s < Math.min(route.length, sc.ego.s + 700); s += 40) {
      const seg = route.segmentAt(s);
      const town = route.townAt(s);
      for (const name of [seg.name, town]) {
        if (!name || shown.has(name) || name === sc.road.name) continue;
        const p = route.pointAt(s);
        const q = this.project(p.x, p.y, 18);
        if (!q || q[2] > 420) continue;
        shown.add(name);
        const big = name === town;
        ctx.font = big ? '600 17px Inter, sans-serif' : '500 14px Inter, sans-serif';
        const tw = ctx.measureText(name).width;
        ctx.fillStyle = 'rgba(5,7,10,0.72)';
        ctx.beginPath();
        ctx.roundRect(q[0] - tw / 2 - 8, q[1] - 12, tw + 16, 24, 12);
        ctx.fill();
        ctx.fillStyle = big ? 'rgba(240,244,250,0.9)' : m.label;
        ctx.fillText(name, q[0], q[1] + 1);
      }
    }
  }
}

/** Scale a #rrggbb colour's brightness. */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}
