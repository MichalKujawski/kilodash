import type { Maneuver } from '@/core/world/navigation';
import type { Route } from '@/core/world/route';
import type { SceneSnapshot } from '@/core/world/scene';
import { font, label, tabular, text } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { Map3D } from '../../nav/Map3D';
import { Scenery } from '../../nav/scenery';
import type { CenterPage } from './types';

/** City raster cache: radius around the vehicle (m) and resolution (px/m). */

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
  private route: Route | null = null;
  private map: Map3D | null = null;
  private camHeading = 0;
  private primed = false;

  update(f: FrameContext): void {
    const sc = f.scene;
    if (!sc) return;
    if (sc.route !== this.route) {
      const route = sc.route;
      this.route = route;
      this.map = null;
      // Generating the whole route's scenery takes ~15 ms (60 ms on a phone): do it when the
      // browser is idle after start-up, not inside a frame. Until then, the guidance shows alone.
      whenIdle(() => {
        if (this.route === route) this.map = new Map3D(route, new Scenery(route));
      });
    }
    if (!this.primed) {
      this.camHeading = sc.ego.heading;
      this.primed = true;
    }
    // The camera follows the car's heading with a little lag, like a chase camera.
    this.camHeading += wrap(sc.ego.heading - this.camHeading) * Math.min(1, f.dt * 2.2);
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const m = f.theme.map;
    const t = f.theme;
    const sc = f.scene;
    if (!sc || !this.map) {
      ctx.fillStyle = m.ground;
      ctx.fillRect(0, 0, w, h);
      // A route whose scenery is still being built (a moment after start-up) shows plain ground.
      if (!sc)
        label(ctx, 'No map data', w / 2, h / 2, 16, t.fonts.primary, t.text.tertiary, 'center');
      return;
    }
    const ego = this.map.draw(ctx, sc, this.camHeading, m, w, h);

    // Our car: a glowing arrow lying on the road.
    ctx.save();
    ctx.translate(ego.x, ego.y);
    ctx.rotate(wrap(sc.ego.heading - this.camHeading));
    ctx.scale(1, 0.62);
    const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 34);
    halo.addColorStop(0, 'rgba(63,167,255,0.35)');
    halo.addColorStop(1, 'rgba(63,167,255,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = m.vehicle;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(13, 13);
    ctx.lineTo(0, 5);
    ctx.lineTo(-13, 13);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    this.drawGuidance(ctx, f, sc, w, h);
    label(ctx, sc.road.name, ego.x, ego.y + 44, 16, t.fonts.primary, m.label, 'center');
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

function whenIdle(run: () => void): void {
  const ric = (
    globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }
  ).requestIdleCallback;
  if (ric) ric(run, { timeout: 400 });
  else setTimeout(run, 1);
}
