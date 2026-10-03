import { S } from '@/core/signals/catalog';
import { Fade, font, label, tabular, text } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { drawIcon } from '../telltales/icons';
import { SAFETY_COLORS } from '../themes/types';

function groupThousands(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/**
 * Top status strip: range, drive mode, assist icons, connectivity. Small, muted,
 * evenly spaced across `rect`.
 */
export class TopStrip implements Widget {
  private cruiseFade = new Fade(5);

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const { x, y, w, h } = this.rect;
    const cy = y + h / 2;
    const slots = [0.08, 0.36, 0.64, 0.92].map((k) => x + w * k);

    // Range.
    const range = st.has(S.Range) ? `${Math.round(st.value(S.Range))}` : '--';
    drawIcon(ctx, 'fuel', slots[0]! - 34, cy - 1, 18, t.text.secondary, t.fonts.primary);
    ctx.font = font(500, 22, t.fonts.primary);
    ctx.fillStyle = t.text.secondary;
    ctx.textBaseline = 'middle';
    const rw = tabular(ctx, range, slots[0]! - 20, cy + 1, 'left');
    label(ctx, 'km', slots[0]! - 14 + rw, cy + 6, 13, t.fonts.primary, t.text.tertiary);

    // Drive mode.
    const auto = !st.has(S.SelectedGear) || st.value(S.SelectedGear) === 127;
    ctx.textBaseline = 'alphabetic';
    label(
      ctx,
      auto ? 'Comfort' : 'Dynamic',
      slots[1]!,
      cy + 6,
      15,
      t.fonts.primary,
      t.text.secondary,
      'center',
    );

    // Assist: lane assist available (muted), cruise control when active (green).
    drawIcon(ctx, 'laneAssist', slots[2]! - 16, cy, 20, t.text.tertiary, t.fonts.primary);
    const cruise = this.cruiseFade.update(st.value(S.CruiseActive) > 0, f.dt);
    if (cruise > 0) {
      ctx.globalAlpha = cruise;
      drawIcon(ctx, 'cruise', slots[2]! + 16, cy, 20, SAFETY_COLORS.info, t.fonts.primary);
      if (st.has(S.CruiseSpeed)) {
        text(ctx, String(Math.round(st.value(S.CruiseSpeed))), slots[2]! + 32, cy + 7, {
          font: font(500, 18, t.fonts.primary),
          color: SAFETY_COLORS.info,
        });
      }
      ctx.globalAlpha = 1;
    }

    // Connectivity placeholder.
    drawIcon(ctx, 'phone', slots[3]! - 14, cy, 17, t.text.tertiary, t.fonts.primary);
    drawIcon(ctx, 'signal', slots[3]! + 12, cy, 16, t.text.tertiary, t.fonts.primary);
  }
}

export interface BottomStripProps {
  clockX: number;
  tempX: number;
  odoX: number;
  y: number;
}

/** Bottom status strip: clock, outside temperature, odometer. */
export class BottomStrip implements Widget {
  constructor(
    readonly rect: Rect,
    private p: BottomStripProps,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const p = this.p;
    const d = new Date();
    ctx.textBaseline = 'alphabetic';
    ctx.font = font(500, 24, t.fonts.primary);
    ctx.fillStyle = t.text.secondary;
    tabular(
      ctx,
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
      p.clockX,
      p.y,
      'left',
    );
    if (st.has(S.AmbientTemp)) {
      const temp = Math.round(st.value(S.AmbientTemp));
      ctx.font = font(500, 22, t.fonts.primary);
      ctx.fillStyle = temp <= 3 ? SAFETY_COLORS.caution : t.text.secondary;
      tabular(ctx, `${temp}°C`, p.tempX, p.y, 'left');
    }
    if (st.has(S.Odometer)) {
      ctx.font = font(500, 20, t.fonts.primary);
      ctx.fillStyle = t.text.tertiary;
      tabular(ctx, groupThousands(st.value(S.Odometer)), p.odoX - 30, p.y, 'right');
      label(ctx, 'km', p.odoX, p.y, 13, t.fonts.primary, t.text.tertiary, 'right');
    }
  }
}

export const topStrip: WidgetFactory = {
  type: 'top-strip',
  requires: () => [],
  create: (rect) => new TopStrip(rect),
};

export const bottomStrip: WidgetFactory<BottomStripProps> = {
  type: 'bottom-strip',
  requires: () => [],
  create: (rect, props) => new BottomStrip(rect, props),
};
