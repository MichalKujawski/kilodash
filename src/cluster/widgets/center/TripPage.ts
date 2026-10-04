import { BUCKET_S } from '@/core/derived/ConsumptionHistory';
import { S } from '@/core/signals/catalog';
import { font, label, tabular, text } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import type { CenterPage } from './types';

function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Width of `str` when drawn with `tabular` in the current font. */
function tabularWidth(ctx: CanvasRenderingContext2D, str: string): number {
  const cell = ctx.measureText('0').width;
  return [...str].reduce(
    (w, ch) => w + (ch >= '0' && ch <= '9' ? cell : ctx.measureText(ch).width),
    0,
  );
}

/** Value (tabular digits) with a smaller, baseline-aligned unit. */
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
  const valueFont = font(500, size, t.fonts.primary);
  const unitFont = font(500, Math.round(size * 0.42), t.fonts.primary);
  ctx.font = valueFont;
  const vw = tabularWidth(ctx, value);
  ctx.font = unitFont;
  const uw = ctx.measureText(unit).width;
  const x0 = align === 'center' ? x - (vw + 6 + uw) / 2 : x;
  ctx.font = valueFont;
  ctx.fillStyle = t.text.primary;
  ctx.textBaseline = 'alphabetic';
  tabular(ctx, value, x0, y, 'left');
  text(ctx, unit, x0 + vw + 6, y, { font: unitFont, color: t.text.secondary });
}

/** A barely visible pool of light behind a page, so no large surface is flat black. */
export function pageSurface(
  ctx: CanvasRenderingContext2D,
  f: FrameContext,
  w: number,
  h: number,
): void {
  const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, w * 0.45);
  g.addColorStop(0, f.theme.panel.surface);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Trip computer as large values on a 2×2 grid, with a consumption history graph. */
export class TripPage implements CenterPage {
  readonly id = 'trip';

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const t = f.theme;
    const st = f.store;
    pageSurface(ctx, f, w, h);
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

    // Consumption history: one bar per bucket; empty slots show only a faint baseline.
    const hist = f.history;
    const n = hist?.buckets.size ?? 24;
    const bars = hist?.buckets.values() ?? [];
    const gx = w / 2 - 170;
    const gw = 340;
    const gy = h - 70;
    const gh = 78;
    const minutes = Math.round((n * BUCKET_S) / 60);
    label(
      ctx,
      `Consumption · last ${minutes} min`,
      gx,
      gy - gh - 14,
      13,
      t.fonts.primary,
      t.text.tertiary,
    );
    const max = Math.max(15, ...bars);
    const bw = gw / n;
    ctx.fillStyle = t.panel.divider;
    ctx.fillRect(gx, gy, gw, 1);
    for (let i = 0; i < n; i++) {
      const v = bars[i - (n - bars.length)];
      if (v === undefined) continue;
      const x = gx + i * bw;
      const bh = Math.max(2, (v / max) * gh);
      const newest = i === n - 1;
      ctx.globalAlpha = newest ? 1 : 0.5;
      ctx.fillStyle = newest ? t.text.accent : t.text.secondary;
      ctx.fillRect(x + 1.5, gy - bh, bw - 3, bh);
      ctx.globalAlpha = 1;
    }
    label(
      ctx,
      `${max.toFixed(0)}`,
      gx + gw + 8,
      gy - gh + 10,
      12,
      t.fonts.primary,
      t.text.tertiary,
    );
  }
}
