import { S } from '@/core/signals/catalog';
import { Fade } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';

const COUNT = 12;
/** Segment colours from left to right: green, then amber, then red. */
const COLOURS = [...Array(6).fill('#22d36b'), ...Array(4).fill('#ffb000'), '#ff2a1f', '#ff2a1f'];

/**
 * Shift lights (Sport and manual): a row of LEDs over the tachometer that
 * fills in the last ~1 800 rpm before the shift point and flashes when it's
 * time to change up.
 */
export class ShiftLights implements Widget {
  private fade = new Fade(6);

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const v = f.store.value(S.ShiftLight, -1);
    const k = this.fade.update(v >= 0 && f.runtime.phase === 'on', f.dt);
    if (k <= 0.01) return;
    const { x, y, w, h } = this.rect;
    const gap = 5;
    const segW = (w - gap * (COUNT - 1)) / COUNT;
    const flash = v >= 2;
    const flashOn = Math.floor(f.now / 70) % 2 === 0;
    const lit = flash ? COUNT : Math.round(Math.max(0, v) * COUNT);
    for (let i = 0; i < COUNT; i++) {
      const on = flash ? flashOn : i < lit;
      const sx = x + i * (segW + gap);
      ctx.globalAlpha = k;
      ctx.fillStyle = on ? (flash ? '#ff2a1f' : COLOURS[i]!) : 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(sx, y, segW, h, h / 2);
      ctx.fill();
      if (on && f.emissive) {
        f.emissive.globalAlpha = k;
        f.emissive.fillStyle = ctx.fillStyle;
        f.emissive.beginPath();
        f.emissive.roundRect(sx, y, segW, h, h / 2);
        f.emissive.fill();
        f.emissive.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;
  }
}

export const shiftLights: WidgetFactory<Record<string, never>> = {
  type: 'shift-lights',
  requires: () => [S.ShiftLight],
  create: (rect) => new ShiftLights(rect),
};
