import { evaluate } from '@/core/alerts/conditions';
import { Fade } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { TELLTALE_BY_ID } from '../telltales/definitions';
import { drawIcon } from '../telltales/icons';
import { SAFETY_COLORS } from '../themes/types';

export interface TelltalePlacement {
  id: string;
  x: number;
  y: number;
  /** Icon size, px; defaults to the widget's `size`. */
  size?: number;
}

export interface TelltalesProps {
  items: TelltalePlacement[];
  size?: number;
}

/**
 * Telltale lamps at fixed, layout-defined positions. Off = invisible; on = lit in
 * the convention colour with bloom. Positions and colours never change with theme.
 */
export class Telltales implements Widget {
  readonly layer = 'overlay' as const;
  private fades = new Map<string, Fade>();

  constructor(
    readonly rect: Rect,
    private props: TelltalesProps,
  ) {
    for (const it of props.items) this.fades.set(it.id, new Fade(14));
  }

  /** IDs currently lit (for tests / inspector). */
  litIds: string[] = [];

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const lit: string[] = [];
    for (const it of this.props.items) {
      const def = TELLTALE_BY_ID.get(it.id);
      if (!def) continue;
      // Bulb check lights every warning lamp (not the indicators) at start-up.
      const selfTest = f.runtime.selfTest && def.blink !== 'flasher';
      const active = selfTest || evaluate(def.when, f.store);
      let on = active;
      if (def.blink === 'flasher') on = f.flasher.lit(def.id, active, f.now);
      else if (def.blink === 'warning' && active && !selfTest)
        on = Math.floor(f.now / 330) % 2 === 0;
      // Flasher lamps switch hard like a relay; others fade in quickly.
      const fade = this.fades.get(it.id)!;
      // With the ignition off only the hazard flashers can light.
      const powered = f.runtime.phase === 'boot' || f.runtime.phase === 'on';
      if (!powered && def.blink !== 'flasher') on = false;
      const a = def.blink === 'flasher' ? (on ? 1 : 0) : fade.update(on, f.dt);
      if (a <= 0.001) continue;
      lit.push(def.id);
      const color = SAFETY_COLORS[def.color];
      const size = it.size ?? this.props.size ?? 30;
      ctx.globalAlpha = a;
      drawIcon(ctx, def.icon, it.x, it.y, size, color, f.theme.fonts.primary);
      if (f.emissive) {
        f.emissive.globalAlpha = a;
        drawIcon(f.emissive, def.icon, it.x, it.y, size * 1.05, color, f.theme.fonts.primary);
        f.emissive.globalAlpha = 1;
      }
      ctx.globalAlpha = 1;
    }
    this.litIds = lit;
  }
}

export const telltales: WidgetFactory<TelltalesProps> = {
  type: 'telltales',
  requires: () => [],
  create: (rect, props) => new Telltales(rect, props),
};
