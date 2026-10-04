import { clamp } from '@/core/math';
import type { SignalId } from '@/core/signals/types';
import { Spring } from '@/core/smoothing/spring';
import { annulus, font, polar, text } from '../renderer/draw';
import type { FrameContext, Rect, StaticContext, Widget, WidgetFactory } from '../renderer/types';
import { drawIcon, type IconId } from '../telltales/icons';
import { SAFETY_COLORS } from '../themes/types';

export interface SideGaugeProps {
  signal: SignalId;
  /** Arc centre (usually the neighbouring dial's centre) and radius. */
  cx: number;
  cy: number;
  r: number;
  /** Arc from `fromDeg` (gauge minimum) to `toDeg` (maximum). */
  fromDeg: number;
  toDeg: number;
  /**
   * Value → needle position (0..1) breakpoints, linear in between. Real coolant
   * gauges are damped: the whole normal range sits at the middle mark.
   */
  map: [number, number][];
  /** Red zone, as a gauge fraction [from, to]. */
  red: [number, number];
  /** End markers at min and max, e.g. ["E", "F"] or ["C", "H"]. */
  ends: [string, string];
  icon: IconId;
  /** Tick marks at these fractions (fuel: quarters). */
  ticks?: number[];
  /** Fuel filler side: small arrow beside the pump icon. */
  filler?: 'left' | 'right';
  segments?: number;
}

function mapValue(map: [number, number][], v: number): number {
  if (v <= map[0]![0]) return map[0]![1];
  for (let i = 1; i < map.length; i++) {
    const [x1, y1] = map[i]!;
    if (v <= x1) {
      const [x0, y0] = map[i - 1]!;
      return y0 + ((y1 - y0) * (v - x0)) / (x1 - x0);
    }
  }
  return map[map.length - 1]![1];
}

/** Short curved gauge hugging the outside of a dial (fuel, coolant). */
export class SideGauge implements Widget {
  private spring = new Spring(0, { stiffness: 12, damping: 7 });
  private primed = false;

  constructor(
    readonly rect: Rect,
    private p: SideGaugeProps,
  ) {}

  private angle(frac: number): number {
    return this.p.fromDeg + (this.p.toDeg - this.p.fromDeg) * frac;
  }

  drawStatic(ctx: CanvasRenderingContext2D, sc: StaticContext): void {
    const p = this.p;
    const t = sc.theme;
    const segs = p.segments ?? 16;
    const span = (p.toDeg - p.fromDeg) / segs;
    for (let i = 0; i < segs; i++) {
      const a = this.angle(i / segs);
      const mid = (i + 0.5) / segs;
      const red = mid >= p.red[0] && mid <= p.red[1];
      ctx.fillStyle = red ? 'rgba(255,42,31,0.32)' : t.sideGauge.track;
      const a0 = Math.min(a, a + span) + Math.abs(span) * 0.14;
      const a1 = Math.max(a, a + span) - Math.abs(span) * 0.14;
      annulus(ctx, p.cx, p.cy, p.r - 4, p.r + 4, a0, a1);
      ctx.fill();
    }
    for (const f of p.ticks ?? []) {
      const [x0, y0] = polar(p.cx, p.cy, p.r + 7, this.angle(f));
      const [x1, y1] = polar(p.cx, p.cy, p.r + (f === 0.5 ? 15 : 12), this.angle(f));
      ctx.strokeStyle = t.sideGauge.marker;
      ctx.lineWidth = f === 0.5 ? 2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
    // End markers.
    const outside = p.r + 22;
    for (const [i, frac] of [0, 1].entries()) {
      const [x, y] = polar(p.cx, p.cy, outside, this.angle(frac));
      text(ctx, p.ends[i]!, x, y + 5, {
        font: font(500, 15, t.fonts.primary),
        color: t.text.tertiary,
        align: 'center',
      });
    }
    const [ix, iy] = polar(p.cx, p.cy, outside + 8, this.angle(0.5));
    drawIcon(ctx, p.icon, ix, iy, 20, t.text.tertiary, t.fonts.primary);
    if (p.filler) {
      // Small triangle pointing to the side of the fuel filler flap.
      const dir = p.filler === 'right' ? 1 : -1;
      const ax = ix + dir * 16;
      ctx.fillStyle = t.text.tertiary;
      ctx.beginPath();
      ctx.moveTo(ax + dir * 4, iy);
      ctx.lineTo(ax - dir * 2, iy - 4);
      ctx.lineTo(ax - dir * 2, iy + 4);
      ctx.closePath();
      ctx.fill();
    }
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const p = this.p;
    const t = f.theme;
    const q = f.store.quality(p.signal, f.now);
    if (q === 'unavailable') return;
    const target = clamp(mapValue(p.map, f.store.value(p.signal)), 0, 1);
    if (!this.primed) {
      this.spring.snap(target);
      this.primed = true;
    }
    // Real side gauges are heavily damped (fuel slosh, coolant inertia).
    const frac = this.spring.update(target, f.dt);
    const inRed = frac >= p.red[0] && frac <= p.red[1];
    const color = inRed ? SAFETY_COLORS.danger : t.sideGauge.fill;
    const segs = p.segments ?? 16;
    const span = (p.toDeg - p.fromDeg) / segs;
    ctx.globalAlpha = q === 'stale' ? 0.35 : 1;
    const lit = frac * segs;
    for (let i = 0; i < segs; i++) {
      const k = clamp(lit - i, 0, 1);
      if (k <= 0) break;
      const a = this.angle(i / segs);
      const a0 = Math.min(a, a + span * k) + Math.abs(span) * 0.14;
      const a1 = Math.max(a, a + span * k) - Math.abs(span) * 0.14;
      if (a1 <= a0) continue;
      ctx.fillStyle = color;
      annulus(ctx, p.cx, p.cy, p.r - 3, p.r + 3, a0, a1);
      ctx.fill();
    }
    // Needle marker across the arc.
    const am = this.angle(frac);
    const [x0, y0] = polar(p.cx, p.cy, p.r - 11, am);
    const [x1, y1] = polar(p.cx, p.cy, p.r + 11, am);
    for (const c of f.emissive ? [ctx, f.emissive] : [ctx]) {
      c.strokeStyle = inRed ? SAFETY_COLORS.danger : t.text.primary;
      c.lineWidth = 3;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

export const sideGauge: WidgetFactory<SideGaugeProps> = {
  type: 'side-gauge',
  requires: (p) => [p.signal],
  create: (rect, props) => new SideGauge(rect, props),
};
