import type { Severity } from '@/core/alerts/rules';
import { t as tr } from '@/core/i18n';
import { label } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { drawIcon, type IconId } from '../../telltales/icons';
import { SAFETY_COLORS } from '../../themes/types';
import { pageSurface } from './TripPage';
import type { CenterPage } from './types';

const COLOR: Record<Severity, string> = {
  critical: SAFETY_COLORS.danger,
  warning: SAFETY_COLORS.caution,
  info: SAFETY_COLORS.info,
};

/** "Vehicle messages": every active message, most important first. */
export class MessagesPage implements CenterPage {
  readonly id = 'messages';

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const t = f.theme;
    pageSurface(ctx, f, w, h);
    label(ctx, 'Vehicle messages', w / 2, 58, 16, t.fonts.primary, t.text.tertiary, 'center');
    const list = f.alerts?.list() ?? [];
    if (list.length === 0) {
      label(ctx, 'No messages', w / 2, h / 2, 20, t.fonts.primary, t.text.secondary, 'center');
      return;
    }
    const vars = { range: '--', ambient: '--', defRange: '--', serviceKm: '--', serviceDays: '--' };
    list.slice(0, 7).forEach((a, i) => {
      const y = 110 + i * 58;
      const x = w / 2 - 210;
      drawIcon(ctx, a.rule.icon as IconId, x + 18, y, 30, COLOR[a.rule.severity], t.fonts.primary);
      label(ctx, tr(a.rule.titleKey, vars), x + 52, y + 7, 19, t.fonts.primary, t.text.primary);
      ctx.fillStyle = t.panel.divider;
      ctx.fillRect(x, y + 28, 420, 1);
    });
    if (list.length > 7)
      label(
        ctx,
        `+${list.length - 7} more`,
        w / 2,
        110 + 7 * 58,
        14,
        t.fonts.primary,
        t.text.tertiary,
        'center',
      );
  }
}
