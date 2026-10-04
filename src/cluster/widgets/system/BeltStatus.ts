import { S } from '@/core/signals/catalog';
import { Fade, label } from '../../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../../renderer/types';
import { SAFETY_COLORS } from '../../themes/types';

/**
 * Seat-belt status after the start (and when a rear belt changes): the five
 * seats from above, belted (white with a tick), unbelted (red) or empty (dim).
 */
export class BeltStatus implements Widget {
  readonly layer = 'overlay' as const;
  private fade = new Fade(5);

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const st = f.store;
    const show = st.value(S.BeltStatusVisible) > 0 && f.runtime.phase === 'on';
    const k = this.fade.update(show, f.dt);
    if (k <= 0.01) return;
    const t = f.theme;
    const { x, y, w, h } = this.rect;
    ctx.globalAlpha = k;
    ctx.fillStyle = 'rgba(10,12,16,0.92)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = t.panel.divider;
    ctx.stroke();
    label(ctx, 'Seat belts', x + w / 2, y + 22, 13, t.fonts.primary, t.text.tertiary, 'center');
    const driver = st.value(S.Seatbelt, 1) > 0 ? 1 : 2;
    const rows: number[][] = [
      [driver, st.value(S.BeltPassenger)],
      [st.value(S.BeltRearLeft), st.value(S.BeltRearMiddle), st.value(S.BeltRearRight)],
    ];
    const seatW = 30;
    const seatH = 26;
    rows.forEach((row, r) => {
      const rowY = y + 38 + r * (seatH + 10);
      const total = row.length * seatW + (row.length - 1) * 12;
      row.forEach((state, i) => {
        const sx = x + w / 2 - total / 2 + i * (seatW + 12);
        const col =
          state === 1
            ? t.text.primary
            : state === 2
              ? SAFETY_COLORS.danger
              : 'rgba(255,255,255,0.12)';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.roundRect(sx, rowY, seatW, seatH, 6);
        ctx.fill();
        if (state === 1) {
          ctx.strokeStyle = '#0b0d10';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(sx + 9, rowY + 13);
          ctx.lineTo(sx + 13, rowY + 18);
          ctx.lineTo(sx + 21, rowY + 8);
          ctx.stroke();
        }
      });
    });
    ctx.globalAlpha = 1;
  }
}

export const beltStatus: WidgetFactory<Record<string, never>> = {
  type: 'belt-status',
  requires: () => [S.BeltStatusVisible],
  create: (rect) => new BeltStatus(rect),
};
