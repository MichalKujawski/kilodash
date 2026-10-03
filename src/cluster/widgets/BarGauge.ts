import { signalDef } from '@/core/signals/catalog';
import type { SignalId } from '@/core/signals/types';
import { clamp } from '@/core/math';
import { Spring } from '@/core/smoothing/spring';
import { font } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { SAFETY_COLORS } from '../themes/types';

export interface BarGaugeProps {
  signal: SignalId;
  label: string;
  min: number;
  max: number;
  unit: string;
  decimals?: number;
  segments?: number;
}

/** Segmented horizontal bar with label and value; turns amber/red past thresholds. */
export class BarGauge implements Widget {
  private spring = new Spring(0, { stiffness: 30, damping: 11 });

  constructor(
    readonly rect: Rect,
    private props: BarGaugeProps,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { x, y, w, h } = this.rect;
    const p = this.props;
    const c = f.theme.colors;
    const quality = f.store.quality(p.signal, f.now);
    const ok = quality === 'live' || quality === 'estimated';
    const v = f.store.value(p.signal, p.min);
    const frac = this.spring.update(clamp((v - p.min) / (p.max - p.min), 0, 1), f.dt);

    const def = signalDef(p.signal);
    const crit =
      (def?.critical?.high !== undefined && v >= def.critical.high) ||
      (def?.critical?.low !== undefined && v <= def.critical.low);
    const warn =
      (def?.warning?.high !== undefined && v >= def.warning.high) ||
      (def?.warning?.low !== undefined && v <= def.warning.low);
    const color = !ok
      ? c.textMuted
      : crit
        ? SAFETY_COLORS.danger
        : warn
          ? SAFETY_COLORS.caution
          : c.barFill;

    ctx.globalAlpha = ok ? 1 : 0.4;
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(600, 17, f.theme.fonts.ui);
    ctx.fillStyle = c.textMuted;
    ctx.textAlign = 'left';
    ctx.fillText(p.label.toUpperCase(), x, y + 18);
    ctx.textAlign = 'right';
    ctx.fillStyle = crit || warn ? color : c.textDim;
    ctx.font = font(600, 22, f.theme.fonts.digital);
    const valueText = ok ? `${v.toFixed(p.decimals ?? 0)} ${p.unit}` : `-- ${p.unit}`;
    ctx.fillText(valueText, x + w, y + 19);

    const segs = p.segments ?? 16;
    const gap = 3;
    const segW = (w - gap * (segs - 1)) / segs;
    const barY = y + h - 16;
    const lit = frac * segs;
    for (let i = 0; i < segs; i++) {
      const sx = x + i * (segW + gap);
      ctx.fillStyle = c.barTrack;
      ctx.fillRect(sx, barY, segW, 12);
      const fill = clamp(lit - i, 0, 1);
      if (fill > 0) {
        ctx.fillStyle = color;
        ctx.fillRect(sx, barY, segW * fill, 12);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export const barGauge: WidgetFactory<BarGaugeProps> = {
  type: 'bar',
  requires: (p) => [p.signal],
  create: (rect, props) => new BarGauge(rect, props),
};
