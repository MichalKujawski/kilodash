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
    // Information is neutral (white); colour is kept for warnings and dangers.
    const color = a.rule.severity === 'info' ? th.text.primary : COLOR[a.rule.severity];
    ctx.globalAlpha = Math.min(1, k);

    // Card: near-black surface so it reads on any page, thin severity edge on top.
    const card = new Path2D();
    card.roundRect(x, y, w, h, 20);
    // Opaque, with a gentle top-down gradient so the card isn't a flat slab.
    const surface = ctx.createLinearGradient(0, y, 0, y + h);
    surface.addColorStop(0, '#0e1013');
    surface.addColorStop(1, '#050607');
    ctx.fillStyle = surface;
    ctx.fill(card);
    const edge = ctx.createLinearGradient(x, 0, x + w, 0);
    edge.addColorStop(0, 'rgba(0,0,0,0)');
    edge.addColorStop(0.5, color);
    edge.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(x + 30, y, w - 60, 2);

    if (a.rule.icon === 'doorOpen' || a.rule.icon === 'hood') {
      // Doors, boot and bonnet: a small car from above with the open parts in the alert colour.
      drawCarOpenings(ctx, f, x + w / 2, y + 62, SAFETY_COLORS.danger);
    } else drawIcon(ctx, a.rule.icon as IconId, x + w / 2, y + 62, 56, color, th.fonts.primary);
    // Several messages take turns: show which one this is.
    const turn = f.alerts?.showable(f.now).filter((o) => o.rule.severity === a.rule.severity) ?? [];
    if (turn.length > 1) {
      const n = turn.indexOf(a) + 1;
      label(
        ctx,
        `${n}/${turn.length}`,
        x + w - 30,
        y + 34,
        13,
        th.fonts.primary,
        th.text.tertiary,
        'right',
      );
    }
    if (f.emissive && a.rule.icon !== 'doorOpen' && a.rule.icon !== 'hood') {
      f.emissive.globalAlpha = k;
      drawIcon(f.emissive, a.rule.icon as IconId, x + w / 2, y + 62, 58, color, th.fonts.primary);
      f.emissive.globalAlpha = 1;
    }
    const vars = {
      range: f.store.has(S.Range) ? Math.round(f.store.value(S.Range)) : '--',
      ambient: f.store.has(S.AmbientTemp) ? Math.round(f.store.value(S.AmbientTemp)) : '--',
      defRange: f.store.has(S.DefRange) ? Math.round(f.store.value(S.DefRange) / 10) * 10 : '--',
      serviceKm: f.store.has(S.ServiceKm) ? Math.round(f.store.value(S.ServiceKm) / 50) * 50 : '--',
      serviceDays: f.store.has(S.ServiceDays) ? Math.round(f.store.value(S.ServiceDays)) : '--',
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

/** Top view of the car (nose up) with open doors, boot and bonnet drawn in `color`. */
function drawCarOpenings(
  ctx: CanvasRenderingContext2D,
  f: FrameContext,
  cx: number,
  cy: number,
  color: string,
): void {
  const st = f.store;
  const W = 26;
  const L = 60;
  const x = cx - W / 2;
  const y = cy - L / 2;
  ctx.strokeStyle = 'rgba(220,226,234,0.7)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, W, L, 8);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const door = (id: string, side: -1 | 1, front: boolean): void => {
    if (st.value(id) <= 0) return;
    const hy = y + (front ? L * 0.32 : L * 0.56);
    const hx = cx + side * (W / 2);
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + side * 12, hy + 10);
    ctx.stroke();
  };
  door(S.DoorFrontLeft, -1, true);
  door(S.DoorFrontRight, 1, true);
  door(S.DoorRearLeft, -1, false);
  door(S.DoorRearRight, 1, false);
  if (st.value(S.Hood) > 0) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + L * 0.22);
    ctx.lineTo(x + W - 3, y + L * 0.22);
    ctx.lineTo(x + W - 1, y - 6);
    ctx.lineTo(x + 1, y - 6);
    ctx.closePath();
    ctx.stroke();
  }
  if (st.value(S.Trunk) > 0) {
    ctx.beginPath();
    ctx.moveTo(x + 3, y + L * 0.85);
    ctx.lineTo(x + W - 3, y + L * 0.85);
    ctx.lineTo(x + W - 1, y + L + 6);
    ctx.lineTo(x + 1, y + L + 6);
    ctx.closePath();
    ctx.stroke();
  }
}
