import { S } from '@/core/signals/catalog';
import { font, label, text } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import type { History } from './history';
import type { CenterPage } from './types';

function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Value with a smaller, baseline-aligned unit. */
export function valueWithUnit(
  ctx: CanvasRenderingContext2D,
  value: string,
  unit: string,
  x: number,
  y: number,
  f: FrameContext,
  size = 40,
  align: 'left' | 'center' = 'left',
): void {
  const t = f.theme;
  ctx.font = font(500, size, t.fonts.primary);
  const vw = ctx.measureText(value).width;
  ctx.font = font(500, Math.round(size * 0.42), t.fonts.primary);
  const uw = ctx.measureText(unit).width;
  const total = vw + 6 + uw;
  const x0 = align === 'center' ? x - total / 2 : x;
  text(ctx, value, x0, y, { font: font(500, size, t.fonts.primary), color: t.text.primary });
  text(ctx, unit, x0 + vw + 6, y, {
    font: font(500, Math.round(size * 0.42), t.fonts.primary),
    color: t.text.secondary,
  });
}

/** Trip computer as large values on a 2×2 grid, with a consumption history graph. */
export class TripPage implements CenterPage {
  readonly id = 'trip';

  draw(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    w: number,
    h: number,
    history: History,
  ): void {
    const t = f.theme;
    const st = f.store;
    const fmt = (id: string, digits: number): string =>
      st.has(id) && Number.isFinite(st.value(id)) ? st.value(id).toFixed(digits) : '--';

    const trip = st.has(S.TripDistance) ? st.value(S.TripDistance).toFixed(1) : '--';
    label(
      ctx,
      `Since start · ${trip} km`,
      w / 2,
      58,
      16,
      t.fonts.primary,
      t.text.tertiary,
      'center',
    );

    const tiles: [string, string, string][] = [
      ['Range', fmt(S.Range, 0), 'km'],
      ['Ø Consumption', fmt(S.AverageConsumption, 1), 'L/100km'],
      ['Ø Speed', fmt(S.AverageSpeed, 0), 'km/h'],
      ['Drive time', st.has(S.TripDuration) ? duration(st.value(S.TripDuration)) : '--', 'h'],
    ];
    const colX = [w / 2 - 170, w / 2 + 40];
    const rowY = [130, 232];
    tiles.forEach(([name, value, unit], k) => {
      const x = colX[k % 2]!;
      const y = rowY[Math.floor(k / 2)]!;
      label(ctx, name, x, y, 15, t.fonts.primary, t.text.tertiary);
      valueWithUnit(ctx, value, unit, x, y + 46, f);
    });

    // Consumption history: one bar per 10 s.
    const bars = history.buckets.values();
    const gx = w / 2 - 170;
    const gw = 340;
    const gy = h - 70;
    const gh = 78;
    label(ctx, 'Consumption · last 4 min', gx, gy - gh - 14, 13, t.fonts.primary, t.text.tertiary);
    const max = Math.max(15, ...bars);
    const n = history.buckets.size;
    const bw = gw / n;
    for (let i = 0; i < n; i++) {
      const v = bars[i - (n - bars.length)];
      const x = gx + i * bw;
      ctx.fillStyle = t.panel.surface;
      ctx.fillRect(x + 1.5, gy - gh, bw - 3, gh);
      if (v === undefined) continue;
      const bh = (v / max) * gh;
      ctx.fillStyle = i === n - 1 ? t.text.accent : t.text.secondary;
      ctx.globalAlpha = i === n - 1 ? 1 : 0.55;
      ctx.fillRect(x + 1.5, gy - bh, bw - 3, bh);
      ctx.globalAlpha = 1;
    }
  }
}
