import { S } from '@/core/signals/catalog';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { font, label, polar, tabular } from '../../renderer/draw';
import type { FrameContext } from '../../renderer/types';
import { drawIcon } from '../../telltales/icons';
import { SAFETY_COLORS } from '../../themes/types';
import { pageSurface, valueWithUnit } from './TripPage';
import type { CenterPage } from './types';

const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

/**
 * Off-road page: compass, altitude, front-wheel angle, oil and coolant
 * temperature, hill descent status. Shown on cars with all-wheel drive.
 */
export class OffroadPage implements CenterPage {
  readonly id = 'offroad';
  private compass = new Spring(0, { stiffness: 20, damping: 9 });
  private wheel = new Spring(0, { stiffness: 30, damping: 10 });
  private altitude = new ReadoutValue(2, 1);

  available(f: FrameContext): boolean {
    return f.store.has(S.HillDescent);
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const t = f.theme;
    const st = f.store;
    pageSurface(ctx, f, w, h);
    label(ctx, 'Off-road', w / 2, 58, 16, t.fonts.primary, t.text.tertiary, 'center');

    // Compass rose: the card turns, the lubber line stays at the top.
    const heading = st.value(S.Heading);
    // Unwrap so the spring takes the short way round.
    const cur = this.compass.value;
    const target = cur + ((((heading - cur) % 360) + 540) % 360) - 180;
    const hd = this.compass.update(target, f.dt);
    const cx = w * 0.32;
    const cy = 250;
    const r = 112;
    ctx.strokeStyle = t.panel.divider;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    for (let d = 0; d < 360; d += 15) {
      const a = d - hd - 90;
      const major = d % 45 === 0;
      const [x0, y0] = polar(cx, cy, r - (major ? 14 : 8), a);
      const [x1, y1] = polar(cx, cy, r, a);
      ctx.strokeStyle = major ? t.text.secondary : t.text.tertiary;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      if (major) {
        const [lx, ly] = polar(cx, cy, r - 32, a);
        const p = POINTS[d / 45]!;
        label(
          ctx,
          p,
          lx,
          ly + 6,
          p.length > 1 ? 14 : 18,
          t.fonts.primary,
          p === 'N' ? SAFETY_COLORS.danger : t.text.secondary,
          'center',
        );
      }
    }
    ctx.fillStyle = t.text.primary;
    ctx.beginPath();
    ctx.moveTo(cx, cy - r - 2);
    ctx.lineTo(cx - 7, cy - r - 14);
    ctx.lineTo(cx + 7, cy - r - 14);
    ctx.closePath();
    ctx.fill();
    ctx.font = font(500, 30, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'alphabetic';
    tabular(ctx, `${Math.round(((heading % 360) + 360) % 360)}°`, cx, cy + 11, 'center');

    // Right column: altitude, wheel angle, temperatures.
    const x = w * 0.6;
    label(ctx, 'Altitude', x, 150, 14, t.fonts.primary, t.text.tertiary);
    valueWithUnit(
      ctx,
      String(Math.round(this.altitude.update(st.value(S.Altitude), f.dt))),
      'm',
      x,
      192,
      f,
      36,
    );

    label(ctx, 'Wheel angle', x, 240, 14, t.fonts.primary, t.text.tertiary);
    // Road-wheel angle from the steering wheel (ratio ~15:1).
    const wheelDeg = this.wheel.update(st.value(S.SteeringAngle) / 15, f.dt);
    this.drawWheels(ctx, f, x + 52, 292, wheelDeg);
    valueWithUnit(
      ctx,
      `${wheelDeg >= 0 ? '' : '−'}${Math.abs(wheelDeg).toFixed(0)}`,
      '°',
      x + 120,
      300,
      f,
      28,
    );

    label(ctx, 'Oil', x, 370, 14, t.fonts.primary, t.text.tertiary);
    valueWithUnit(
      ctx,
      st.has(S.OilTemp) ? st.value(S.OilTemp).toFixed(0) : '--',
      '°C',
      x,
      404,
      f,
      28,
    );
    label(ctx, 'Coolant', x + 120, 370, 14, t.fonts.primary, t.text.tertiary);
    valueWithUnit(
      ctx,
      st.has(S.CoolantTemp) ? st.value(S.CoolantTemp).toFixed(0) : '--',
      '°C',
      x + 120,
      404,
      f,
      28,
    );

    // Hill descent control status.
    const hdc = st.value(S.HillDescent);
    const col = hdc > 1 ? SAFETY_COLORS.info : t.text.tertiary;
    drawIcon(ctx, 'hillDescent', cx - 70, 440, 26, col, t.fonts.primary);
    label(
      ctx,
      hdc > 1
        ? 'Hill descent: braking'
        : hdc > 0
          ? 'Hill descent: ready'
          : 'Hill descent from 30 km/h down',
      cx - 48,
      446,
      15,
      t.fonts.primary,
      hdc > 0 ? t.text.secondary : t.text.tertiary,
    );
  }

  /** Top-down front axle with both wheels turned. */
  private drawWheels(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    x: number,
    y: number,
    deg: number,
  ): void {
    const t = f.theme;
    ctx.strokeStyle = t.text.tertiary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 34, y);
    ctx.lineTo(x + 34, y);
    ctx.stroke();
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(x + side * 40, y);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.fillStyle = t.text.secondary;
      ctx.beginPath();
      ctx.roundRect(-6, -16, 12, 32, 4);
      ctx.fill();
      ctx.restore();
    }
  }
}
