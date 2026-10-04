import { clamp, lerp } from '@/core/math';
import type { Maneuver } from '@/core/world/navigation';
import type { Route } from '@/core/world/route';
import type { SceneSnapshot } from '@/core/world/scene';
import { font, label, tabular, text } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { Scenery, type Polygon, type RoadLine } from '../../nav/scenery';
import type { MapTokens } from '../../themes/types';
import type { CenterPage } from './types';

const PITCH = 0.56;
/** City raster cache: radius around the vehicle (m) and resolution (px/m). */
const CACHE_RADIUS = 800;
const CACHE_RES = 1.4;
const SLICES = 4;
const LAYERS = ['blocks', 'outlines', 'surfaces'] as const;
type Layer = (typeof LAYERS)[number];
const STEPS = SLICES * LAYERS.length;

interface MapRaster {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  origin: { x: number; y: number };
  theme: unknown;
  pxScale: number;
}

/** Wrap an angle difference into (-π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Manoeuvre pictogram centred at (x, y). */
export function drawManeuverIcon(
  ctx: CanvasRenderingContext2D,
  m: Maneuver | null,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(m?.kind === 'turnLeft' ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const head = (hx: number, hy: number, angle: number): void => {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(-3.5, -5.5);
    ctx.lineTo(-3.5, 5.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  ctx.beginPath();
  switch (m?.kind) {
    case 'turnLeft':
    case 'turnRight':
      ctx.moveTo(-5, 11);
      ctx.lineTo(-5, -1);
      ctx.quadraticCurveTo(-5, -5, -1, -5);
      ctx.lineTo(5, -5);
      ctx.stroke();
      head(7, -5, 0);
      break;
    case 'roundabout':
      ctx.arc(0, -1, 5.5, 0, Math.PI * 2);
      ctx.moveTo(0, 12);
      ctx.lineTo(0, 4.5);
      ctx.moveTo(0, -6.5);
      ctx.lineTo(0, -11);
      ctx.stroke();
      head(0, -12, -Math.PI / 2);
      break;
    case 'exit':
      ctx.moveTo(-4, 12);
      ctx.lineTo(-4, -10);
      ctx.moveTo(-4, 4);
      ctx.quadraticCurveTo(-4, -2, 4, -6);
      ctx.stroke();
      head(6, -7, -0.5);
      break;
    case 'join':
      ctx.moveTo(6, 12);
      ctx.quadraticCurveTo(6, 2, -2, -4);
      ctx.moveTo(-6, 12);
      ctx.lineTo(-6, -8);
      ctx.stroke();
      head(-3, -6, -2.4);
      break;
    case 'destination':
      ctx.moveTo(-4, 12);
      ctx.lineTo(-4, -11);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, -11);
      ctx.lineTo(8, -7);
      ctx.lineTo(-4, -3);
      ctx.closePath();
      ctx.fill();
      break;
    default:
      ctx.moveTo(0, 12);
      ctx.lineTo(0, -6);
      ctx.stroke();
      head(0, -8, -Math.PI / 2);
  }
  ctx.restore();
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(m >= 10_000 ? 0 : 1)} km`;
  return `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

function clock(hours: number): string {
  const h = Math.floor(((hours % 24) + 24) % 24);
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Navigation map of the world the car drives through, seen from a tilted chase
 * camera: scenery generated around the route, the route ahead, the next
 * manoeuvre with lane guidance, current road and arrival time.
 */
export class MapPage implements CenterPage {
  readonly id = 'map';
  private scenery: Scenery | null = null;
  private route: Route | null = null;
  private camHeading = 0;
  private zoom = 1.6;
  private cache: MapRaster | null = null;
  private next: (MapRaster & { step: number }) | null = null;
  private spare: HTMLCanvasElement | null = null;
  private primed = false;

  update(f: FrameContext): void {
    const sc = f.scene;
    if (!sc) return;
    if (sc.route !== this.route) {
      this.route = sc.route;
      this.scenery = new Scenery(sc.route);
      this.cache = null;
      this.next = null;
    }
    if (!this.primed) {
      this.camHeading = sc.ego.heading;
      this.primed = true;
    }
    const kmh = Math.abs(f.store.value('Vehicle.Speed'));
    this.camHeading += wrap(sc.ego.heading - this.camHeading) * Math.min(1, f.dt * 2.2);
    const targetZoom = sc.road.kind === 'parking' ? 3.2 : lerp(1.9, 0.95, clamp(kmh / 130, 0, 1));
    this.zoom += (targetZoom - this.zoom) * Math.min(1, f.dt * 0.6);
  }

  private newRaster(
    origin: { x: number; y: number },
    f: FrameContext,
    reuse?: HTMLCanvasElement,
  ): MapRaster | null {
    const pxScale = Math.min(f.pxScale, 1.5);
    const size = Math.ceil(CACHE_RADIUS * 2 * CACHE_RES * pxScale);
    const canvas = reuse ?? document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = f.theme.map.ground;
    ctx.fillRect(0, 0, size, size);
    return { canvas, ctx, origin: { ...origin }, theme: f.theme, pxScale };
  }

  private renderStep(r: MapRaster, step: number, f: FrameContext): void {
    const k = CACHE_RES * r.pxScale;
    const size = r.canvas.width;
    const band = size / SLICES;
    const slice = step % SLICES;
    r.ctx.save();
    r.ctx.setTransform(1, 0, 0, 1, 0, 0);
    r.ctx.beginPath();
    r.ctx.rect(0, slice * band, size, band + 1);
    r.ctx.clip();
    r.ctx.setTransform(
      k,
      0,
      0,
      k,
      -(r.origin.x - CACHE_RADIUS) * k,
      -(r.origin.y - CACHE_RADIUS) * k,
    );
    const y0 = r.origin.y - CACHE_RADIUS + (slice * band) / k;
    this.drawWorld(
      r.ctx,
      r.origin.x,
      y0 + band / k / 2,
      LAYERS[Math.floor(step / SLICES)]!,
      f.theme.map,
      band / k,
    );
    r.ctx.restore();
  }

  /**
   * Keep a raster of the map around the vehicle. The first is built at once;
   * later ones are built in slices over ~12 frames into a back buffer and swapped
   * in before the vehicle reaches the edge, so no frame is ever long.
   */
  private ensureCache(x: number, y: number, reach: number, f: FrameContext): void {
    const c = this.cache;
    const pos = { x, y };
    if (
      !c ||
      c.theme !== f.theme ||
      c.pxScale !== Math.min(f.pxScale, 1.5) ||
      Math.hypot(x - c.origin.x, y - c.origin.y) > CACHE_RADIUS - reach * 0.6
    ) {
      const r = this.newRaster(pos, f, c?.canvas);
      if (!r) return;
      for (let st = 0; st < STEPS; st++) this.renderStep(r, st, f);
      this.cache = r;
      this.next = null;
      return;
    }
    if (!this.next && Math.hypot(x - c.origin.x, y - c.origin.y) > (CACHE_RADIUS - reach) * 0.5) {
      const r = this.newRaster(pos, f, this.spare ?? undefined);
      this.spare = null;
      if (r) this.next = { ...r, step: 0 };
    }
    if (this.next) {
      this.renderStep(this.next, this.next.step++, f);
      if (this.next.step >= STEPS) {
        const n = this.next;
        this.spare = c.canvas;
        this.cache = {
          canvas: n.canvas,
          ctx: n.ctx,
          origin: n.origin,
          theme: n.theme,
          pxScale: n.pxScale,
        };
        this.next = null;
      }
    }
  }

  private polyColor(p: Polygon, m: MapTokens): string {
    switch (p.kind) {
      case 'building':
        return m.block;
      case 'field':
        return m.field;
      case 'meadow':
        return m.meadow;
      case 'forest':
      case 'hill':
        return m.forest;
      case 'lot':
        return m.lot;
      case 'canopy':
        return m.roadMajor;
      case 'parkedCar':
        return m.road;
    }
  }

  /** One layer of the map in the band around (cx, cy), world coordinates. */
  private drawWorld(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    layer: Layer,
    m: MapTokens,
    bandH: number,
  ): void {
    if (!this.scenery) return;
    const r = Math.max(CACHE_RADIUS, bandH);
    const { polys, roads } = this.scenery.query(cx, cy, r);
    if (layer === 'blocks') {
      for (const p of polys) {
        ctx.globalAlpha =
          p.kind === 'building'
            ? 0.7 + p.shade * 0.3
            : p.kind === 'hill'
              ? 0.9
              : 0.75 + p.shade * 0.25;
        ctx.fillStyle = this.polyColor(p, m);
        ctx.beginPath();
        p.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return;
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const order = (rd: RoadLine): number =>
      rd.kind === 'minor' ? 0 : rd.kind === 'motorway' ? 2 : 1;
    for (const rd of [...roads].sort((a, b) => order(a) - order(b))) {
      const path = (): void => {
        ctx.beginPath();
        rd.points.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      };
      if (layer === 'outlines') {
        ctx.setLineDash(rd.tunnel ? [8, 6] : []);
        ctx.strokeStyle = rd.tunnel ? m.label : m.roadEdge;
        ctx.lineWidth = rd.width + (rd.tunnel ? 1 : 3);
        path();
        ctx.stroke();
        ctx.setLineDash([]);
        continue;
      }
      const major = rd.kind === 'motorway' || rd.kind === 'rural' || rd.kind === 'ramp';
      ctx.globalAlpha = rd.tunnel ? 0.45 : 1;
      ctx.strokeStyle = major ? m.roadMajor : m.road;
      ctx.lineWidth = rd.width;
      path();
      ctx.stroke();
      // Markings: median and dashed lane lines on the Autobahn, centre line on two-way roads.
      if (rd.kind === 'motorway') {
        ctx.strokeStyle = m.roadEdge;
        ctx.lineWidth = 2.4;
        path();
        ctx.stroke();
      }
      if (rd.kind !== 'minor' && rd.kind !== 'parking' && rd.kind !== 'ramp') {
        ctx.strokeStyle = m.marking;
        ctx.lineWidth = 0.35;
        ctx.setLineDash([6, 9]);
        if (rd.kind === 'motorway') {
          for (const side of [-1, 1]) {
            for (let l = 1; l < rd.lanes; l++) this.offsetPath(ctx, rd, side * (1.2 + l * 3.5));
          }
        } else {
          path();
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      ctx.globalAlpha = 1;
    }
  }

  private offsetPath(ctx: CanvasRenderingContext2D, rd: RoadLine, off: number): void {
    ctx.beginPath();
    for (let i = 0; i < rd.points.length; i++) {
      const a = rd.points[Math.max(0, i - 1)]!;
      const b = rd.points[Math.min(rd.points.length - 1, i + 1)]!;
      const h = Math.atan2(b.y - a.y, b.x - a.x);
      const p = rd.points[i]!;
      const x = p.x - Math.sin(h) * off;
      const y = p.y + Math.cos(h) * off;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const m = f.theme.map;
    const t = f.theme;
    ctx.fillStyle = m.ground;
    ctx.fillRect(0, 0, w, h);
    const sc = f.scene;
    if (!sc || !this.route) {
      label(ctx, 'No map data', w / 2, h / 2, 16, t.fonts.primary, t.text.tertiary, 'center');
      return;
    }
    const z = this.zoom;
    const ax = w / 2;
    const ay = h * 0.72;
    const reach = Math.min(Math.max(w / 2, (h * 0.45) / PITCH) / z, CACHE_RADIUS * 0.6);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(1, PITCH);
    ctx.rotate(-this.camHeading - Math.PI / 2);
    ctx.scale(z, z);
    ctx.translate(-sc.ego.x, -sc.ego.y);

    this.ensureCache(sc.ego.x, sc.ego.y, reach, f);
    const cache = this.cache;
    if (cache) {
      const k = CACHE_RES * cache.pxScale;
      const sx = Math.max(0, (sc.ego.x - reach - (cache.origin.x - CACHE_RADIUS)) * k);
      const sy = Math.max(0, (sc.ego.y - reach - (cache.origin.y - CACHE_RADIUS)) * k);
      const sw = Math.min(cache.canvas.width - sx, reach * 2 * k);
      const sh = Math.min(cache.canvas.height - sy, reach * 2 * k);
      const wx = cache.origin.x - CACHE_RADIUS + sx / k;
      const wy = cache.origin.y - CACHE_RADIUS + sy / k;
      if (sw > 0 && sh > 0) ctx.drawImage(cache.canvas, sx, sy, sw, sh, wx, wy, sw / k, sh / k);
    }
    this.drawRoute(ctx, sc, m, z);
    ctx.restore();

    // Depth fog: fully opaque at the top so the edge of the drawn area never shows.
    const fog = ctx.createLinearGradient(0, 0, 0, h * 0.56);
    fog.addColorStop(0, t.background);
    fog.addColorStop(0.42, t.background);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h * 0.56);

    // Vehicle chevron.
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(wrap(sc.ego.heading - this.camHeading));
    ctx.fillStyle = 'rgba(63,167,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 24, 24 * PITCH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.vehicle;
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(12, 11);
    ctx.lineTo(0, 4);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.drawGuidance(ctx, f, sc, w, h);
    label(ctx, sc.road.name, ax, ay + 50, 16, t.fonts.primary, m.label, 'center');
  }

  /** Route line ahead (from the bay, then along the road), with a soft glow. */
  private drawRoute(
    ctx: CanvasRenderingContext2D,
    sc: SceneSnapshot,
    m: MapTokens,
    z: number,
  ): void {
    const route = this.route!;
    const pts: { x: number; y: number }[] = [];
    if (sc.ego.inBay) pts.push({ x: sc.ego.x, y: sc.ego.y });
    // On the Autobahn the line follows our carriageway, not the median.
    const along = (s: number): { x: number; y: number } => {
      const p = route.pointAt(s);
      const seg = route.segmentAt(s);
      const off = seg.kind === 'motorway' ? 1.2 + (seg.lanes * 3.5) / 2 : 0;
      return { x: p.x - Math.sin(p.heading) * off, y: p.y + Math.cos(p.heading) * off };
    };
    for (let s = sc.ego.s; s < Math.min(route.length, sc.ego.s + 2500); s += 6) pts.push(along(s));
    pts.push(along(Math.min(route.length, sc.ego.s + 2500)));
    for (const [col, width, alpha] of [
      [m.routeGlow, 16 / z + 8, 0.35],
      [m.route, 6, 1],
    ] as const) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = col;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Next manoeuvre card, lane guidance and arrival time. */
  private drawGuidance(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    sc: SceneSnapshot,
    w: number,
    h: number,
  ): void {
    const t = f.theme;
    const nav = sc.nav;
    const m = nav.current;
    if (m) {
      drawManeuverIcon(ctx, m, 150, 92, 40, t.text.primary);
      ctx.font = font(500, 36, t.fonts.primary);
      ctx.fillStyle = t.text.primary;
      ctx.textBaseline = 'alphabetic';
      tabular(ctx, formatDistance(nav.distance), 186, 104, 'left');
      const what =
        m.kind === 'exit'
          ? `Exit ${m.exitNumber ?? ''} ${m.road}`
          : m.kind === 'roundabout'
            ? `${m.roundaboutExit}. exit · ${m.road}`
            : m.kind === 'destination'
              ? m.road
              : m.road;
      text(ctx, what, 186, 130, { font: font(400, 19, t.fonts.primary), color: t.text.secondary });
      // Lane guidance for exits: one arrow per lane, the lanes to use highlighted.
      if (m.lanes && nav.distance < 1600) {
        const n = m.lanes.length;
        for (let i = 0; i < n; i++) {
          const use = m.lanes[i]!;
          const x = 186 + (n - 1 - i) * 26;
          ctx.globalAlpha = use ? 1 : 0.35;
          drawManeuverIcon(
            ctx,
            use && i === 0 ? { ...m, kind: 'exit' } : null,
            x + 8,
            158,
            18,
            t.text.primary,
          );
        }
        ctx.globalAlpha = 1;
      }
    }
    const eta = clock(sc.env.hour + nav.timeLeft / 3600);
    label(
      ctx,
      `${eta} · ${formatDistance(nav.remaining)}`,
      w - 150,
      h - 38,
      15,
      t.fonts.primary,
      t.text.secondary,
      'right',
    );
  }
}
