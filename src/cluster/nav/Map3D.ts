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
const BUILDING_REACH = 300;

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
    const { polys, roads } = this.scenery.query(centre.x, centre.y, REACH * 0.7);
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
    for (const p of ground) this.flat(ctx, p.points, this.groundColor(p, m), p.shade);
    this.roads(ctx, roads, m);
    this.routeRibbon(ctx, sc, m);
    const buildings = polys
      .filter((p) => (p.kind === 'building' || p.kind === 'parkedCar') && visible(p))
      .map((p) => ({ p, d: this.centreDepth(p) }))
      // Nothing beside or behind the car: it would loom over the bottom edge.
      .filter((b) => b.d > 0 && b.d < BUILDING_REACH + BACK && this.aheadOf(b.p) > 6)
      .sort((a, b) => b.d - a.d);
    for (const { p } of buildings) this.extrude(ctx, p, m);
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

  private flat(
    ctx: CanvasRenderingContext2D,
    points: Vec2[],
    color: string,
    variation: number,
  ): void {
    const pts: [number, number][] = [];
    for (const p of points) {
      const q = this.project(p.x, p.y);
      if (!q) return;
      pts.push([q[0], q[1]]);
    }
    ctx.globalAlpha = 0.8 + variation * 0.2;
    // Land use reads on the dark ground: a touch brighter than the flat map's tokens.
    ctx.fillStyle = shade(color.startsWith('#') ? color : '#202630', 1.9);
    this.path(ctx, pts);
    ctx.fill();
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

  /** A building as a prism: visible walls (lit by orientation), then the roof. */
  private extrude(ctx: CanvasRenderingContext2D, p: Polygon, m: MapTokens): void {
    const car = p.kind === 'parkedCar';
    const height = car ? 1.5 : 7 + p.shade * 15;
    const base: [number, number, number][] = [];
    const top: [number, number, number][] = [];
    for (const pt of p.points) {
      const b = this.project(pt.x, pt.y, 0);
      const t = this.project(pt.x, pt.y, height);
      if (!b || !t) return;
      base.push(b);
      top.push(t);
    }
    const n = base.length;
    const fade = Math.max(0, Math.min(1, 1 - (base[0]![2] - 230) / 160));
    ctx.globalAlpha = fade;
    // Light from the upper left of the screen.
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const b0 = base[i]!;
      const b1 = base[j]!;
      // Back faces wind the other way on screen: skip them.
      const cross = (b1[0] - b0[0]) * (top[i]![1] - b0[1]) - (b1[1] - b0[1]) * (top[i]![0] - b0[0]);
      if (cross >= 0) continue;
      const wx = p.points[j]!.x - p.points[i]!.x;
      const wy = p.points[j]!.y - p.points[i]!.y;
      const len = Math.hypot(wx, wy) || 1;
      const light = 0.9 + 0.7 * ((wy / len) * 0.7 - (wx / len) * 0.7 + 1) * 0.5;
      ctx.fillStyle = shade(car ? m.roadMajor : m.block, light);
      this.path(ctx, [
        [b0[0], b0[1]],
        [b1[0], b1[1]],
        [top[j]![0], top[j]![1]],
        [top[i]![0], top[i]![1]],
      ]);
      ctx.fill();
    }
    ctx.fillStyle = shade(car ? m.roadMajor : m.block, car ? 1.5 : 2.5);
    this.path(
      ctx,
      top.map((q) => [q[0], q[1]]),
    );
    ctx.fill();
    // A faint lit edge along the roof.
    ctx.strokeStyle = 'rgba(200,215,235,0.16)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
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
