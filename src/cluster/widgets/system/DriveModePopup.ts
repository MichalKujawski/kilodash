import {
  INDIVIDUAL_ROWS,
  POPUP_CONFIRM_S,
  type DriveModeState,
} from '@/core/drive/DriveModeController';
import { MODES, type Level } from '@/core/drive/modes';
import { clamp } from '@/core/math';
import { Fade, font, label } from '../../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../../renderer/types';
import { drawIcon, type IconId } from '../../telltales/icons';

const ROW_H = 46;
const W = 400;

const ROW_LABELS: Record<(typeof INDIVIDUAL_ROWS)[number], string> = {
  engine: 'Drive',
  gearbox: 'Gearbox',
  steering: 'Steering',
  dampers: 'Suspension',
  ac: 'Climate',
  acc: 'Cruise control',
  sound: 'Engine sound',
};
const LEVEL_LABELS: Record<Level, string> = { eco: 'Eco', normal: 'Normal', sport: 'Sport' };

/**
 * Driving-mode list in the centre of the cluster, opened by the mode button:
 * the highlight moves with each press (or the scroll wheel), a thin bar runs
 * down until the choice confirms itself. Also hosts the Individual settings
 * screen (parked only). Pure drawing: the state comes from the car.
 */
export class DriveModePopup implements Widget {
  readonly layer = 'overlay' as const;
  private fade = new Fade(9);
  private last: DriveModeState | null = null;

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const st = f.scene?.driveModes;
    const open = !!st && (!!st.popup || !!st.config) && f.runtime.phase === 'on';
    if (open)
      this.last = {
        ...st,
        popup: st.popup && { ...st.popup },
        config: st.config && { ...st.config },
      };
    const k = this.fade.update(open, f.dt);
    if (k <= 0.01 || !this.last) return;
    ctx.globalAlpha = k;
    if (this.last.config) this.drawIndividual(ctx, f, this.last);
    else this.drawList(ctx, f, this.last);
    ctx.globalAlpha = 1;
  }

  private card(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    h: number,
    title: string,
  ): { x: number; y: number } {
    const cx = this.rect.x + this.rect.w / 2;
    const cy = this.rect.y + this.rect.h / 2;
    const x = cx - W / 2;
    const y = cy - h / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(9, 11, 15, 0.96)';
    ctx.beginPath();
    ctx.roundRect(x, y, W, h, 18);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = f.theme.panel.divider;
    ctx.lineWidth = 1;
    ctx.stroke();
    label(ctx, title, cx, y + 34, 16, f.theme.fonts.primary, f.theme.text.tertiary, 'center');
    return { x, y: y + 52 };
  }

  private drawList(ctx: CanvasRenderingContext2D, f: FrameContext, st: DriveModeState): void {
    const t = f.theme;
    const popup = st.popup;
    if (!popup) return;
    const h = 52 + st.available.length * ROW_H + 22;
    const { x, y } = this.card(ctx, f, h, 'Driving mode');
    st.available.forEach((id, i) => {
      const m = MODES[id];
      const ry = y + i * ROW_H;
      const hl = id === popup.highlight;
      const accent = m.params.accent ?? t.text.primary;
      if (hl) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect(x + 12, ry, W - 24, ROW_H - 6, 10);
        ctx.fill();
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.roundRect(x + 12, ry + 8, 4, ROW_H - 22, 2);
        ctx.fill();
      }
      const col = hl ? t.text.primary : t.text.secondary;
      drawIcon(
        ctx,
        m.icon as IconId,
        x + 48,
        ry + 20,
        24,
        hl ? accent : t.text.tertiary,
        t.fonts.primary,
      );
      ctx.font = font(hl ? 600 : 500, 21, t.fonts.primary);
      ctx.fillStyle = col;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(m.label, x + 76, ry + 27);
      if (id === st.current)
        drawIcon(ctx, 'check', x + W - 44, ry + 20, 20, t.text.tertiary, t.fonts.primary);
    });
    // Auto-confirm countdown.
    const left = 1 - clamp(popup.timer / POPUP_CONFIRM_S, 0, 1);
    const by = y + st.available.length * ROW_H + 6;
    ctx.fillStyle = t.panel.divider;
    ctx.fillRect(x + 24, by, W - 48, 2);
    ctx.fillStyle = MODES[popup.highlight].params.accent ?? t.text.secondary;
    ctx.fillRect(x + 24, by, (W - 48) * left, 2);
  }

  private drawIndividual(ctx: CanvasRenderingContext2D, f: FrameContext, st: DriveModeState): void {
    const t = f.theme;
    const row = st.config?.row ?? 0;
    const h = 52 + INDIVIDUAL_ROWS.length * 40 + 40;
    const { x, y } = this.card(ctx, f, h, 'Individual');
    INDIVIDUAL_ROWS.forEach((key, i) => {
      const ry = y + i * 40;
      const hl = i === row;
      if (hl) {
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.beginPath();
        ctx.roundRect(x + 12, ry, W - 24, 34, 8);
        ctx.fill();
      }
      ctx.font = font(hl ? 600 : 500, 17, t.fonts.primary);
      ctx.fillStyle = hl ? t.text.primary : t.text.secondary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(ROW_LABELS[key], x + 28, ry + 23);
      const value = st.individual[key];
      (['eco', 'normal', 'sport'] as Level[]).forEach((lv, j) => {
        const sx = x + 196 + j * 64;
        const on = lv === value;
        ctx.fillStyle = on ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.03)';
        ctx.beginPath();
        ctx.roundRect(sx, ry + 6, 60, 22, 6);
        ctx.fill();
        label(
          ctx,
          LEVEL_LABELS[lv],
          sx + 30,
          ry + 22,
          13,
          t.fonts.primary,
          on ? t.text.primary : t.text.tertiary,
          'center',
        );
      });
    });
    label(
      ctx,
      '◀ ▶ change    OK done',
      x + W / 2,
      y + INDIVIDUAL_ROWS.length * 40 + 24,
      13,
      t.fonts.primary,
      t.text.tertiary,
      'center',
    );
  }
}

export const driveModePopup: WidgetFactory<Record<string, never>> = {
  type: 'drive-mode-popup',
  requires: () => [],
  create: (rect) => new DriveModePopup(rect),
};
