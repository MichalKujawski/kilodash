import { S } from '@/core/signals/catalog';
import { consumerFuelLh } from '@/core/drive/efficiency';
import { clamp } from '@/core/math';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { annulus, DEG, label, polar } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { drawIcon } from '../../telltales/icons';
import { pageSurface, valueWithUnit } from './TripPage';
import type { CenterPage } from './types';

const MAX_L100 = 20;

/** Instant consumption as an arc gauge with average marker, plus a rolling graph. */
export class EfficiencyPage implements CenterPage {
  readonly id = 'efficiency';
  private spring = new Spring(0, { stiffness: 30, damping: 10 });
  private readout = new ReadoutValue(3, 0.4);

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const t = f.theme;
    const st = f.store;
    const cx = w / 2;
    const cy = 270;
    const r = 150;
    pageSurface(ctx, f, w, h);
    const inst = st.value(S.InstantConsumption, Number.NaN);
    const moving = Number.isFinite(inst);
    const frac = this.spring.update(moving ? clamp(inst / MAX_L100, 0, 1) : 0, f.dt);

    label(ctx, 'Efficiency', cx, 58, 16, t.fonts.primary, t.text.tertiary, 'center');

    // Arc: track, value fill, ticks, average marker.
    ctx.fillStyle = t.sideGauge.track;
    annulus(ctx, cx, cy, r - 7, r + 7, 180, 360);
    ctx.fill();
    const grad = ctx.createConicGradient(Math.PI, cx, cy);
    grad.addColorStop(0, t.chart.good);
    grad.addColorStop(0.25, t.chart.neutral);
    grad.addColorStop(0.5, t.chart.bad);
    ctx.fillStyle = grad;
    annulus(ctx, cx, cy, r - 7, r + 7, 180, 180 + frac * 180);
    ctx.fill();
    for (let v = 0; v <= MAX_L100; v += 5) {
      const a = 180 + (v / MAX_L100) * 180;
      const [x, y] = polar(cx, cy, r + 26, a);
      ctx.font = `500 15px ${t.fonts.primary}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.text.tertiary;
      ctx.fillText(String(v), x, y + 5);
    }
    if (st.has(S.AverageConsumption)) {
      const a = 180 + clamp(st.value(S.AverageConsumption) / MAX_L100, 0, 1) * 180;
      const [x0, y0] = polar(cx, cy, r - 16, a);
      const [x1, y1] = polar(cx, cy, r + 16, a);
      ctx.strokeStyle = t.text.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      label(
        ctx,
        'Ø',
        x0 - Math.cos(a * DEG) * 12,
        y0 - Math.sin(a * DEG) * 12 + 4,
        13,
        t.fonts.primary,
        t.text.secondary,
        'center',
      );
    }

    const rate = st.value(S.FuelRate, 0);
    const shown = this.readout.update(moving ? inst : rate, f.dt);
    valueWithUnit(ctx, shown.toFixed(1), moving ? 'L/100km' : 'L/h', cx, cy - 18, f, 56, 'center');
    label(ctx, 'Instant', cx, cy + 14, 14, t.fonts.primary, t.text.tertiary, 'center');

    // What the powertrain is doing to save fuel right now, else an eco tip.
    const coasting = st.value(S.Coasting) > 0;
    const cda = st.value(S.CylinderDeactivation) > 0;
    const eff = f.scene?.efficiency;
    const status = coasting
      ? 'Coasting, engine at idle'
      : cda
        ? 'Running on half the cylinders'
        : (eff?.tip ?? null);
    if (status) {
      const saving = coasting || cda;
      if (saving) drawIcon(ctx, 'modeEco', cx - 128, cy + 52, 18, t.chart.good, t.fonts.primary);
      label(
        ctx,
        status,
        saving ? cx - 112 : cx,
        cy + 58,
        16,
        t.fonts.primary,
        saving ? t.chart.good : t.text.secondary,
        saving ? 'left' : 'center',
      );
    }

    // Comfort consumers and what they cost.
    if (eff && eff.consumers.length > 0) {
      const top = cy + 92;
      label(ctx, 'Comfort consumers', cx - 170, top, 13, t.fonts.primary, t.text.tertiary);
      eff.consumers.slice(0, 3).forEach((c, i) => {
        const y = top + 22 + i * 20;
        label(ctx, c.label, cx - 170, y, 15, t.fonts.primary, t.text.secondary);
        const lh = consumerFuelLh(c.kW);
        const unit = st.has(S.FuelRate) ? `${lh.toFixed(1)} L/h` : `${c.kW.toFixed(1)} kW`;
        label(ctx, unit, cx + 170, y, 15, t.fonts.primary, t.text.secondary, 'right');
      });
    }

    // Rolling graph of the last minute.
    const vals = f.history?.recent.values() ?? [];
    const gx = cx - 190;
    const gw = 380;
    const gy = h - 40;
    const gh = 70;
    ctx.strokeStyle = t.panel.divider;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + gw, gy);
    ctx.stroke();
    if (vals.length > 1) {
      const n = f.history?.recent.size ?? 120;
      const px = (i: number): number => gx + gw - (vals.length - 1 - i) * (gw / (n - 1));
      const py = (v: number): number => gy - (clamp(v, 0, MAX_L100 * 1.5) / (MAX_L100 * 1.5)) * gh;
      ctx.beginPath();
      vals.forEach((v, i) => (i === 0 ? ctx.moveTo(px(i), py(v)) : ctx.lineTo(px(i), py(v))));
      ctx.strokeStyle = t.chart.bad;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineTo(px(vals.length - 1), gy);
      ctx.lineTo(px(0), gy);
      ctx.closePath();
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = t.chart.bad;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    label(ctx, '60 s', gx, gy + 18, 12, t.fonts.primary, t.text.tertiary);
    label(ctx, 'now', gx + gw, gy + 18, 12, t.fonts.primary, t.text.tertiary, 'right');
  }
}
