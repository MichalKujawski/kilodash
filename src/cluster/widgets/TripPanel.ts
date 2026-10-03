import { S } from '@/core/signals/catalog';
import { clamp } from '@/core/math';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { font, roundRectPath } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';

const INSTANT_MAX_L100 = 20;

function formatDuration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m} min`;
}

function groupThousands(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Centre display: clock, ambient, trip computer and instant consumption. */
export class TripPanel implements Widget {
  private instant = new ReadoutValue(3, 0.4);
  private instantBar = new Spring(0, { stiffness: 25, damping: 10 });

  constructor(readonly rect: Rect) {}

  drawStatic(ctx: CanvasRenderingContext2D, sc: { theme: FrameContext['theme'] }): void {
    const { x, y, w, h } = this.rect;
    const c = sc.theme.colors;
    roundRectPath(ctx, x, y + 70, w, h - 70, 18);
    ctx.fillStyle = c.panel;
    ctx.fill();
    ctx.strokeStyle = c.panelBorder;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { x, y, w } = this.rect;
    const c = f.theme.colors;
    const st = f.store;
    const ui = f.theme.fonts.ui;
    const digital = f.theme.fonts.digital;
    const cx = x + w / 2;

    // Header: clock and outside temperature.
    const d = new Date();
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillStyle = c.text;
    ctx.font = font(500, 40, digital);
    ctx.fillText(
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      cx,
      y + 42,
    );
    if (st.has(S.AmbientTemp)) {
      ctx.textAlign = 'right';
      ctx.fillStyle = c.textDim;
      ctx.font = font(500, 26, digital);
      ctx.fillText(`${Math.round(st.value(S.AmbientTemp))}°C`, x + w - 8, y + 40);
    }

    // Trip computer rows.
    const rows: [string, string][] = [];
    if (st.has(S.Range)) rows.push(['Range', `${Math.round(st.value(S.Range))} km`]);
    else rows.push(['Range', '-- km']);
    if (st.has(S.AverageConsumption))
      rows.push(['Ø Consumption', `${st.value(S.AverageConsumption).toFixed(1)} L/100km`]);
    if (st.has(S.AverageSpeed))
      rows.push(['Ø Speed', `${Math.round(st.value(S.AverageSpeed))} km/h`]);
    if (st.has(S.TripDistance)) rows.push(['Trip', `${st.value(S.TripDistance).toFixed(1)} km`]);
    if (st.has(S.TripDuration)) rows.push(['Drive time', formatDuration(st.value(S.TripDuration))]);

    const top = y + 112;
    const rowH = 50;
    rows.slice(0, 5).forEach(([label, value], i) => {
      const ry = top + i * rowH;
      ctx.textAlign = 'left';
      ctx.fillStyle = c.textMuted;
      ctx.font = font(500, 19, ui);
      ctx.fillText(label.toUpperCase(), x + 28, ry);
      ctx.textAlign = 'right';
      ctx.fillStyle = c.text;
      ctx.font = font(600, 28, digital);
      ctx.fillText(value, x + w - 28, ry + 2);
      if (i < rows.length - 1) {
        ctx.fillStyle = c.panelBorder;
        ctx.fillRect(x + 28, ry + 18, w - 56, 1);
      }
    });

    // Instant consumption bar (L/100km when moving, L/h when stationary).
    if (st.has(S.InstantConsumption)) {
      const by = top + 5 * rowH - 6;
      const v = st.value(S.InstantConsumption);
      const moving = Number.isFinite(v);
      const rate = st.has(S.FuelRate) ? st.value(S.FuelRate) : 0;
      const shown = this.instant.update(moving ? v : rate, f.dt);
      const frac = this.instantBar.update(clamp((moving ? v : 0) / INSTANT_MAX_L100, 0, 1), f.dt);
      ctx.textAlign = 'left';
      ctx.fillStyle = c.textMuted;
      ctx.font = font(500, 17, ui);
      ctx.fillText('INSTANT', x + 28, by);
      ctx.textAlign = 'right';
      ctx.fillStyle = c.textDim;
      ctx.font = font(600, 22, digital);
      ctx.fillText(
        moving ? `${shown.toFixed(1)} L/100km` : `${shown.toFixed(1)} L/h`,
        x + w - 28,
        by,
      );
      const bw = w - 56;
      ctx.fillStyle = c.barTrack;
      ctx.fillRect(x + 28, by + 12, bw, 6);
      ctx.fillStyle = c.accent;
      ctx.fillRect(x + 28, by + 12, bw * frac, 6);
    }

    // Odometer footer.
    if (st.has(S.Odometer)) {
      ctx.textAlign = 'center';
      ctx.fillStyle = c.textMuted;
      ctx.font = font(500, 20, digital);
      ctx.fillText(
        `${groupThousands(st.value(S.Odometer))} km`,
        cx,
        this.rect.y + this.rect.h - 18,
      );
    }
  }
}

export const tripPanel: WidgetFactory = {
  type: 'trip-panel',
  requires: () => [S.Speed],
  create: (rect) => new TripPanel(rect),
};
