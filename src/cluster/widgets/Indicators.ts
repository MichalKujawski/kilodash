import { S } from '@/core/signals/catalog';
import { glow, noGlow } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { SAFETY_COLORS } from '../themes/types';

/** Indicator period ~80 flashes/min, 55% duty, as on typical flasher relays. */
const PERIOD_MS = 750;
const ON_MS = 420;

/** Green direction-indicator arrows. Blink phase starts when the signal turns on. */
export class Indicators implements Widget {
  private since = { left: -1, right: -1 };

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { x, y, w, h } = this.rect;
    const size = h;
    this.side(ctx, f, 'left', S.IndicatorLeft, x + size / 2, y + h / 2, size, -1);
    this.side(ctx, f, 'right', S.IndicatorRight, x + w - size / 2, y + h / 2, size, 1);
  }

  /** True while the lamp is lit; useful for the audio tick later. */
  lit(side: 'left' | 'right', now: number): boolean {
    const t = this.since[side];
    return t >= 0 && (now - t) % PERIOD_MS < ON_MS;
  }

  private side(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    side: 'left' | 'right',
    id: string,
    cx: number,
    cy: number,
    size: number,
    dir: 1 | -1,
  ): void {
    const active = f.store.value(id) > 0;
    if (!active) this.since[side] = -1;
    else if (this.since[side] < 0) this.since[side] = f.now;
    const lit = this.lit(side, f.now);

    const s = size / 2;
    ctx.beginPath();
    ctx.moveTo(cx + dir * s, cy);
    ctx.lineTo(cx + dir * s * 0.1, cy - s * 0.8);
    ctx.lineTo(cx + dir * s * 0.1, cy - s * 0.32);
    ctx.lineTo(cx - dir * s * 0.9, cy - s * 0.32);
    ctx.lineTo(cx - dir * s * 0.9, cy + s * 0.32);
    ctx.lineTo(cx + dir * s * 0.1, cy + s * 0.32);
    ctx.lineTo(cx + dir * s * 0.1, cy + s * 0.8);
    ctx.closePath();
    if (lit) {
      if (!f.lowPower) glow(ctx, SAFETY_COLORS.info, 22, f.pxScale);
      ctx.fillStyle = SAFETY_COLORS.info;
      ctx.fill();
      noGlow(ctx);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

export const indicators: WidgetFactory = {
  type: 'indicators',
  requires: () => [S.IndicatorLeft, S.IndicatorRight],
  create: (rect) => new Indicators(rect),
};
