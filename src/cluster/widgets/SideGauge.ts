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
  /** Arc from `fromDeg` (value = min) to `toDeg` (value = max). */
  fromDeg: number;
  toDeg: number;
  min: number;
  max: number;
  /** Values inside this range are drawn in the danger colour. */
  red: [number, number];
  /** End markers at min and max, e.g. ["E", "F"] or ["C", "H"]. */
  ends: [string, string];
  icon: IconId;
  segments?: number;
}

/** Short curved gauge hugging the outside of a dial (fuel, coolant). */
export class SideGauge implements Widget {
  private spring = new Spring(0, { stiffness: 20, damping: 9 });

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
    const segs = p.segments ?? 14;
    const span = (p.toDeg - p.fromDeg) / segs;
    for (let i = 0; i < segs; i++) {
      const a = this.angle(i / segs);
      const v = p.min + ((i + 0.5) / segs) * (p.max - p.min);
      const red = v >= p.red[0] && v <= p.red[1];
      ctx.fillStyle = red ? 'rgba(255,42,31,0.28)' : t.sideGauge.track;
      const a0 = Math.min(a, a + span) + Math.abs(span) * 0.12;
      const a1 = Math.max(a, a + span) - Math.abs(span) * 0.12;
      annulus(ctx, p.cx, p.cy, p.r - 5, p.r + 5, a0, a1);
      ctx.fill();
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
    const [ix, iy] = polar(p.cx, p.cy, outside + 6, this.angle(0.5));
    drawIcon(ctx, p.icon, ix, iy, 20, t.text.tertiary, t.fonts.primary);
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const p = this.p;
    const t = f.theme;
    const q = f.store.quality(p.signal, f.now);
    if (q === 'unavailable') return;
    const v = f.store.value(p.signal);
    const frac = this.spring.update(clamp((v - p.min) / (p.max - p.min), 0, 1), f.dt);
    const inRed = v >= p.red[0] && v <= p.red[1];
    const color = inRed ? SAFETY_COLORS.danger : t.sideGauge.fill;
    const segs = p.segments ?? 14;
    const span = (p.toDeg - p.fromDeg) / segs;
    ctx.globalAlpha = q === 'stale' ? 0.35 : 1;
    // Lit segments up to the value.
    const lit = frac * segs;
    for (let i = 0; i < segs; i++) {
      const k = clamp(lit - i, 0, 1);
      if (k <= 0) break;
      const a = this.angle(i / segs);
      const a0 = Math.min(a, a + span * k) + Math.abs(span) * 0.12;
      const a1 = Math.max(a, a + span * k) - Math.abs(span) * 0.12;
      if (a1 <= a0) continue;
      ctx.fillStyle = color;
      annulus(ctx, p.cx, p.cy, p.r - 4, p.r + 4, a0, a1);
      ctx.fill();
    }
    // Small needle marker across the arc.
    const am = this.angle(frac);
    const [x0, y0] = polar(p.cx, p.cy, p.r - 11, am);
    const [x1, y1] = polar(p.cx, p.cy, p.r + 11, am);
    for (const c of f.emissive ? [ctx, f.emissive] : [ctx]) {
      c.strokeStyle = inRed ? SAFETY_COLORS.danger : t.dial.needle.color;
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
