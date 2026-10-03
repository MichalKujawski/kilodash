import { S } from '@/core/signals/catalog';
import { clamp, lerp } from '@/core/math';
import { font, label, tabular, text } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { ProceduralCity, RouteFollower, type TurnDirection, type Vec2 } from '../../nav/procMap';
import type { CenterPage } from './types';

const PITCH = 0.56;
/** City raster cache: radius around the vehicle (m) and resolution (px/m). */
const CACHE_RADIUS = 800;
const CACHE_RES = 1.2;
const SLICES = 4;
const LAYERS = ['blocks', 'outlines', 'surfaces'] as const;
type Layer = (typeof LAYERS)[number];
const STEPS = SLICES * LAYERS.length;

interface MapRaster {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  origin: Vec2;
  theme: unknown;
  pxScale: number;
}

function quad(ctx: CanvasRenderingContext2D, a: Vec2, b: Vec2, c: Vec2, d: Vec2): void {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.lineTo(c.x, c.y);
  ctx.lineTo(d.x, d.y);
  ctx.closePath();
  ctx.fill();
}

function lotCenter(lot: Vec2[]): Vec2 {
  return {
    x: lot.reduce((s, p) => s + p.x, 0) / lot.length,
    y: lot.reduce((s, p) => s + p.y, 0) / lot.length,
  };
}

/** Wrap an angle difference into (-π, π]. */
function wrap(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

export function drawTurnArrow(
  ctx: CanvasRenderingContext2D,
  dir: TurnDirection,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir === 'left' ? -s : s, s);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (dir === 'straight') {
    ctx.moveTo(0, 10);
    ctx.lineTo(0, -6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -4);
    ctx.lineTo(0, -11);
    ctx.lineTo(6, -4);
    ctx.closePath();
  } else {
    ctx.moveTo(-5, 11);
    ctx.lineTo(-5, -1);
    ctx.quadraticCurveTo(-5, -5, -1, -5);
    ctx.lineTo(5, -5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(4, -11);
    ctx.lineTo(11, -5);
    ctx.lineTo(4, 1);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.max(10, Math.round(m / 10) * 10)} m`;
}

/**
 * Procedural navigation map: a dark street grid seen from a tilted chase camera,
 * moving with the simulated speed, with route line, next turn and street label.
 */
export class MapPage implements CenterPage {
  readonly id = 'map';
  readonly city = new ProceduralCity(7);
  readonly route = new RouteFollower(this.city, 3);
  private camHeading = this.route.heading;
  private zoom = 1.5;
  /** Raster on screen. */
  private cache: MapRaster | null = null;
  /** Raster being built progressively, one slice per frame. */
  private next: (MapRaster & { step: number }) | null = null;

  update(f: FrameContext): void {
    const kmh = f.store.value(S.Speed);
    this.route.advance((kmh / 3.6) * f.dt);
    this.camHeading += wrap(this.route.heading - this.camHeading) * Math.min(1, f.dt * 1.6);
    this.zoom += (lerp(1.5, 0.95, clamp(kmh / 130, 0, 1)) - this.zoom) * Math.min(1, f.dt * 0.6);
  }

  private newRaster(origin: Vec2, f: FrameContext, reuse?: HTMLCanvasElement): MapRaster | null {
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
    r.ctx.setTransform(
      k,
      0,
      0,
      k,
      -(r.origin.x - CACHE_RADIUS) * k,
      -(r.origin.y - CACHE_RADIUS) * k,
    );
    const layer = LAYERS[Math.floor(step / SLICES)]!;
    this.drawWorld(r.ctx, r.origin, CACHE_RADIUS, f, layer, step % SLICES);
  }

  /**
   * Keep a city raster around the vehicle. The first one is built at once; later
   * ones are built in slices over ~12 frames into a back buffer and swapped in
   * well before the vehicle reaches the edge, so there is never a long frame.
   */
  private ensureCache(pos: Vec2, reach: number, f: FrameContext): void {
    const c = this.cache;
    if (!c || c.theme !== f.theme || c.pxScale !== Math.min(f.pxScale, 1.5)) {
      const r = this.newRaster(pos, f, c?.canvas);
      if (!r) return;
      for (let st = 0; st < STEPS; st++) this.renderStep(r, st, f);
      this.cache = r;
      this.next = null;
      return;
    }
    const moved = Math.hypot(pos.x - c.origin.x, pos.y - c.origin.y);
    if (!this.next && moved > (CACHE_RADIUS - reach) * 0.5) {
      const r = this.newRaster(pos, f, this.spare ?? undefined);
      this.spare = null;
      if (r) this.next = { ...r, step: 0 };
    }
    if (this.next) {
      this.renderStep(this.next, this.next.step++, f);
      if (this.next.step >= STEPS) {
        this.spare = c.canvas;
        const n = this.next;
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

  private spare: HTMLCanvasElement | null = null;

  /**
   * One layer of one horizontal slice of the city around `center` (world metres),
   * into a world-space context. Layers are drawn in order across all slices so
   * road outlines never overdraw road surfaces at slice boundaries.
   */
  private drawWorld(
    ctx: CanvasRenderingContext2D,
    center: Vec2,
    reach: number,
    f: FrameContext,
    layer: Layer,
    slice: number,
  ): void {
    const m = f.theme.map;
    const city = this.city;
    const sp = city.spacing;
    const ci = Math.round(center.x / sp);
    const cj = Math.round(center.y / sp);
    const span = Math.ceil(reach / sp) + 1;
    const i0 = Math.max(0, ci - span);
    const i1 = Math.min(city.n - 1, ci + span);
    const jMin = Math.max(0, cj - span);
    const jMax = Math.min(city.n - 1, cj + span);
    const rows = jMax - jMin + 1;
    const j0 = jMin + Math.floor((rows * slice) / SLICES);
    const j1 = jMin + Math.floor((rows * (slice + 1)) / SLICES) - 1;

    if (layer === 'blocks') {
      for (let i = i0; i < i1; i++) {
        for (let j = j0; j <= Math.min(j1, jMax - 1); j++) {
          const kind = city.blocks[i]![j]!;
          const a = city.node(i, j);
          const b = city.node(i + 1, j);
          const c = city.node(i + 1, j + 1);
          const d = city.node(i, j + 1);
          const mx = (a.x + b.x + c.x + d.x) / 4;
          const my = (a.y + b.y + c.y + d.y) / 4;
          const k = kind === 'water' ? 0.98 : 0.8;
          const q = [a, b, c, d].map((p) => ({ x: mx + (p.x - mx) * k, y: my + (p.y - my) * k }));
          if (kind !== 'building') {
            ctx.fillStyle = kind === 'water' ? m.water : m.park;
            quad(ctx, q[0]!, q[1]!, q[2]!, q[3]!);
            continue;
          }
          // Split each block into four lots with slightly different shades.
          const mid = (p: Vec2, r: Vec2): Vec2 => ({ x: (p.x + r.x) / 2, y: (p.y + r.y) / 2 });
          const [p0, p1, p2, p3] = q as [Vec2, Vec2, Vec2, Vec2];
          const m01 = mid(p0, p1);
          const m12 = mid(p1, p2);
          const m23 = mid(p2, p3);
          const m30 = mid(p3, p0);
          const cc = { x: mx, y: my };
          const lots: Vec2[][] = [
            [p0, m01, cc, m30],
            [m01, p1, m12, cc],
            [cc, m12, p2, m23],
            [m30, cc, m23, p3],
          ];
          ctx.fillStyle = m.block;
          lots.forEach((lot, n) => {
            const lc = lotCenter(lot);
            const shrink = lot.map((p) => ({
              x: p.x + (lc.x - p.x) * 0.1,
              y: p.y + (lc.y - p.y) * 0.1,
            }));
            ctx.globalAlpha = 0.65 + (((i * 7 + j * 13 + n * 5) % 7) / 7) * 0.35;
            quad(ctx, shrink[0]!, shrink[1]!, shrink[2]!, shrink[3]!);
          });
          ctx.globalAlpha = 1;
        }
      }
      return;
    }

    // Roads: dark outline layer, then surface; major streets wider and brighter.
    const outline = layer === 'outlines';
    ctx.lineCap = 'round';
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const p = city.node(i, j);
        const edges: [number, number, boolean][] = [];
        if (i < i1) edges.push([i + 1, j, city.rows[j]!.major]);
        if (j < jMax) edges.push([i, j + 1, city.cols[i]!.major]);
        for (const [ni, nj, major] of edges) {
          const q = city.node(ni, nj);
          const width = major ? 17 : 11;
          ctx.strokeStyle = outline ? m.roadEdge : major ? m.roadMajor : m.road;
          ctx.lineWidth = outline ? width + 4 : width;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const m = f.theme.map;
    const t = f.theme;
    ctx.fillStyle = m.ground;
    ctx.fillRect(0, 0, w, h);

    const pos = this.route.position;
    const z = this.zoom;
    const ax = w / 2;
    const ay = h * 0.72;
    // Visible distance from the vehicle (the top third is fogged anyway).
    const reach = Math.min(Math.max(w / 2, (h * 0.45) / PITCH) / z, CACHE_RADIUS * 0.6);

    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(1, PITCH);
    ctx.rotate(-this.camHeading - Math.PI / 2);
    ctx.scale(z, z);
    ctx.translate(-pos.x, -pos.y);

    // City raster: re-rendered only after moving far; transformed every frame.
    this.ensureCache(pos, reach, f);
    const cache = this.cache;
    if (cache) {
      // Only the part of the raster within reach of the vehicle.
      const k = CACHE_RES * cache.pxScale;
      const sx = Math.max(0, (pos.x - reach - (cache.origin.x - CACHE_RADIUS)) * k);
      const sy = Math.max(0, (pos.y - reach - (cache.origin.y - CACHE_RADIUS)) * k);
      const sw = Math.min(cache.canvas.width - sx, reach * 2 * k);
      const sh = Math.min(cache.canvas.height - sy, reach * 2 * k);
      const wx = cache.origin.x - CACHE_RADIUS + sx / k;
      const wy = cache.origin.y - CACHE_RADIUS + sy / k;
      if (sw > 0 && sh > 0) ctx.drawImage(cache.canvas, sx, sy, sw, sh, wx, wy, sw / k, sh / k);
    }

    // Route ahead, with a soft glow underneath.
    const pts = this.route.ahead(7);
    for (const [col, width] of [
      [m.routeGlow, 18 / z + 10],
      [m.route, 7],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.globalAlpha = col === m.routeGlow ? 0.35 : 1;
      ctx.lineWidth = width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach((p, k) => (k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Depth fog towards the horizon.
    // Fully opaque at the top so the edge of the drawn area never shows.
    const fog = ctx.createLinearGradient(0, 0, 0, h * 0.56);
    fog.addColorStop(0, t.background);
    fog.addColorStop(0.42, t.background);
    fog.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, w, h * 0.56);

    // Vehicle chevron.
    ctx.save();
    ctx.translate(ax, ay);
    ctx.fillStyle = 'rgba(63,167,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 4, 26, 26 * PITCH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.vehicle;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(13, 12);
    ctx.lineTo(0, 5);
    ctx.lineTo(-13, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Next turn card (top-left) and current street (under the vehicle).
    const turn = this.route.nextTurn();
    drawTurnArrow(ctx, turn.direction, 150, 92, 40, t.text.primary);
    ctx.font = font(500, 36, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'alphabetic';
    tabular(ctx, formatDistance(turn.distanceM), 186, 104, 'left');
    text(ctx, turn.street, 186, 130, {
      font: font(400, 19, t.fonts.primary),
      color: t.text.secondary,
    });
    label(ctx, this.route.street, ax, ay + 52, 16, t.fonts.primary, m.label, 'center');
  }
}
