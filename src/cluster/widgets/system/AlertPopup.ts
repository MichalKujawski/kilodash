import { POPUP_MS, type ActiveAlert } from '@/core/alerts/AlertEngine';
import type { Severity } from '@/core/alerts/rules';
import { t as tr } from '@/core/i18n';
import { S } from '@/core/signals/catalog';
import { Spring } from '@/core/smoothing/spring';
import { font, label, text } from '../../renderer/draw';
import type { ClusterKey, FrameContext, Rect, Widget } from '../../renderer/types';
import { drawIcon, type IconId } from '../../telltales/icons';
import { SAFETY_COLORS } from '../../themes/types';

const COLOR: Record<Severity, string> = {
  critical: SAFETY_COLORS.danger,
  warning: SAFETY_COLORS.caution,
  info: SAFETY_COLORS.info,
};

/** Wrap text into lines that fit `maxWidth`. */
function wrap(ctx: CanvasRenderingContext2D, str: string, maxWidth: number): string[] {
  const words = str.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Popup card for the highest-priority alert: severity-coloured icon, title,
 * message with the recommended action. Slides in over the centre content;
 * steering-wheel OK dismisses it (critical alerts remain listed and lit).
 */
export class AlertPopup implements Widget {
  readonly layer = 'overlay' as const;
  private shown: ActiveAlert | null = null;
  private anim = new Spring(0, { stiffness: 120, damping: 18 });

  constructor(readonly rect: Rect) {}

  onInput(key: ClusterKey): boolean {
    if ((key === 'ok' || key === 'back') && this.shown && this.anim.value > 0.5) {
      this.alertsRef?.acknowledge(this.shown.rule.id);
      return true;
    }
    return false;
  }

  private alertsRef: FrameContext['alerts'] = null;

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    this.alertsRef = f.alerts;
    const cur = f.runtime.phase === 'on' ? f.alerts?.current(f.now) : undefined;
    if (cur && cur !== this.shown && this.anim.value < 0.05) this.shown = cur;
    const target = cur && cur === this.shown ? 1 : 0;
    const k = this.anim.update(target, f.dt);
    if (k < 0.01 || !this.shown) {
      if (!cur) this.shown = null;
      return;
    }
    const a = this.shown;
    const th = f.theme;
    const { x, w, h } = this.rect;
    const y = this.rect.y + (1 - k) * 24;
    const color = COLOR[a.rule.severity];
    ctx.globalAlpha = Math.min(1, k);

    // Card: near-black surface so it reads on any page, thin severity edge on top.
    const card = new Path2D();
    card.roundRect(x, y, w, h, 20);
    ctx.fillStyle = 'rgb(6, 7, 9)';
    ctx.fill(card);
    const edge = ctx.createLinearGradient(x, 0, x + w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.5, color);
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(x + 30, y, w - 60, 2);

    drawIcon(ctx, a.rule.icon as IconId, x + w / 2, y + 62, 56, color, th.fonts.primary);
    if (f.emissive) {
      f.emissive.globalAlpha = k;
      drawIcon(f.emissive, a.rule.icon as IconId, x + w / 2, y + 62, 58, color, th.fonts.primary);
      f.emissive.globalAlpha = 1;
    }
    const vars = {
      range: f.store.has(S.Range) ? Math.round(f.store.value(S.Range)) : '--',
      ambient: f.store.has(S.AmbientTemp) ? Math.round(f.store.value(S.AmbientTemp)) : '--',
    };
    text(ctx, tr(a.rule.titleKey, vars), x + w / 2, y + 136, {
      font: font(500, 30, th.fonts.primary),
      color: th.text.primary,
      align: 'center',
    });
    ctx.font = font(400, 21, th.fonts.primary);
    wrap(ctx, tr(a.rule.messageKey, vars), w - 80)
      .slice(0, 3)
      .forEach((line, i) => {
        text(ctx, line, x + w / 2, y + 176 + i * 28, {
          font: font(400, 21, th.fonts.primary),
          color: th.text.secondary,
          align: 'center',
        });
      });
    if (POPUP_MS[a.rule.severity] !== Infinity || a.rule.severity === 'critical') {
      label(ctx, 'OK', x + w / 2, y + h - 22, 13, th.fonts.primary, th.text.tertiary, 'center');
    }
    ctx.globalAlpha = 1;
  }
}
