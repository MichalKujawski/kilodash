import { t as tr } from '@/core/i18n';
import { DEG, font, label, text } from '../../renderer/draw';
import type { FrameContext, Rect, Widget } from '../../renderer/types';
import { valueWithUnit } from '../center/TripPage';

/** Brand-neutral logo mark: an open gauge ring with a needle. */
export function drawLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  color: string,
  accent: string,
): void {
  ctx.lineCap = 'round';
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 135 * DEG, 405 * DEG);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = r * 0.14;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(-50 * DEG) * r * 0.8, cy + Math.sin(-50 * DEG) * r * 0.8);
  ctx.stroke();
}

function duration(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Logo reveal at start-up and the trip summary card at shut-down. */
export class StartupOverlay implements Widget {
  readonly layer = 'overlay' as const;
  readonly rect: Rect = { x: 0, y: 0, w: 1920, h: 720 };

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const rt = f.runtime;
    const th = f.theme;
    if (rt.logoAlpha > 0.001) {
      ctx.globalAlpha = rt.logoAlpha;
      const lift = (1 - rt.logoAlpha) * 12;
      drawLogo(ctx, 960, 318 + lift, 46, th.text.primary, th.dial.needle.color);
      if (f.emissive) {
        f.emissive.globalAlpha = rt.logoAlpha * 0.7;
        drawLogo(f.emissive, 960, 318 + lift, 46, th.text.secondary, th.dial.needle.glow);
        f.emissive.globalAlpha = 1;
      }
      text(ctx, 'Kilodash', 960, 420 + lift, {
        font: font(400, 34, th.fonts.primary),
        color: th.text.primary,
        align: 'center',
        spacing: 6,
      });
      ctx.globalAlpha = 1;
    }

    const s = rt.summary;
    if (rt.summaryAlpha > 0.001 && s) {
      ctx.globalAlpha = rt.summaryAlpha;
      label(ctx, tr('trip.summary'), 960, 220, 18, th.fonts.primary, th.text.secondary, 'center');
      const cells: [string, string, string][] = [
        [tr('trip.distance'), s.distanceKm !== undefined ? s.distanceKm.toFixed(1) : '--', 'km'],
        [tr('trip.duration'), s.durationS !== undefined ? duration(s.durationS) : '--', 'h'],
        [tr('trip.avgSpeed'), s.avgSpeed !== undefined ? s.avgSpeed.toFixed(0) : '--', 'km/h'],
        [
          tr('trip.avgConsumption'),
          s.avgConsumption !== undefined ? s.avgConsumption.toFixed(1) : '--',
          'L/100km',
        ],
      ];
      cells.forEach(([name, value, unit], i) => {
        const x = 960 + (i % 2 === 0 ? -150 : 150);
        const y = 300 + Math.floor(i / 2) * 110;
        label(ctx, name, x, y, 15, th.fonts.primary, th.text.tertiary, 'center');
        valueWithUnit(ctx, value, unit, x, y + 48, f, 42, 'center');
      });
      ctx.globalAlpha = 1;
    }
  }
}
