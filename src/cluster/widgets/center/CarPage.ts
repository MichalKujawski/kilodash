import { S } from '@/core/signals/catalog';
import { label } from '../../renderer/draw';
import { drawIcon } from '../../telltales/icons';
import type { FrameContext } from '../../renderer/types';
import { SAFETY_COLORS } from '../../themes/types';
import { pageSurface } from './TripPage';
import type { CenterPage } from './types';

const DOORS = [
  { id: S.DoorFrontLeft, name: 'Driver door', side: -1, front: true },
  { id: S.DoorFrontRight, name: 'Passenger door', side: 1, front: true },
  { id: S.DoorRearLeft, name: 'Rear left door', side: -1, front: false },
  { id: S.DoorRearRight, name: 'Rear right door', side: 1, front: false },
] as const;

/** Start-stop block reasons in plain words (index = STOP_BLOCKS). */
const STOP_REASONS = [
  '',
  'engine not warm yet',
  'battery charging',
  'climate needs the engine',
  'steep gradient',
  'steering',
  'door open or belt off',
  'particulate filter cleaning',
];

const TIRES = [
  { id: S.TireFL, side: -1, front: true },
  { id: S.TireFR, side: 1, front: true },
  { id: S.TireRL, side: -1, front: false },
  { id: S.TireRR, side: 1, front: false },
] as const;

/** Procedural top-down car showing doors, lights, indicators and tyre pressures. */
export class CarPage implements CenterPage {
  readonly id = 'car';

  draw(ctx: CanvasRenderingContext2D, f: FrameContext, w: number, h: number): void {
    const t = f.theme;
    const st = f.store;
    const cx = w / 2;
    const cy = h * 0.5;
    const L = h * 0.6;
    const W = L * 0.44;
    const top = cy - L / 2;
    const on = (id: string): boolean => st.value(id) > 0;
    pageSurface(ctx, f, w, h);

    label(ctx, 'Vehicle status', cx, 58, 16, t.fonts.primary, t.text.tertiary, 'center');

    // Headlight beams.
    const low = on(S.LowBeam);
    const high = on(S.HighBeam);
    if (low || high) {
      const reach = high ? L * 0.75 : L * 0.42;
      const g = ctx.createLinearGradient(0, top, 0, top - reach);
      g.addColorStop(0, high ? 'rgba(150,190,255,0.35)' : 'rgba(255,250,235,0.28)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + s * W * 0.32, top + 8);
        ctx.lineTo(cx + s * W * (high ? 1.0 : 0.75), top - reach);
        ctx.lineTo(cx + s * W * (high ? -0.1 : 0.05), top - reach);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Shadow.
    const shadow = ctx.createRadialGradient(cx, cy, L * 0.1, cx, cy, L * 0.62);
    shadow.addColorStop(0, 'rgba(0,0,0,0.55)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(cx - L, cy - L, L * 2, L * 2);

    // Wheels.
    ctx.fillStyle = '#050607';
    for (const tire of TIRES) {
      const x = cx + tire.side * W * 0.47 - W * 0.09;
      const y = cy + (tire.front ? -L * 0.3 : L * 0.27) - L * 0.075;
      ctx.beginPath();
      ctx.roundRect(x, y, W * 0.18, L * 0.15, 6);
      ctx.fill();
    }

    // Body.
    const body = new Path2D();
    body.moveTo(cx - W * 0.36, top + 6);
    body.quadraticCurveTo(cx, top - 8, cx + W * 0.36, top + 6);
    body.quadraticCurveTo(cx + W * 0.5, top + L * 0.06, cx + W * 0.5, top + L * 0.2);
    body.lineTo(cx + W * 0.5, top + L * 0.86);
    body.quadraticCurveTo(cx + W * 0.48, top + L, cx + W * 0.3, top + L);
    body.lineTo(cx - W * 0.3, top + L);
    body.quadraticCurveTo(cx - W * 0.48, top + L, cx - W * 0.5, top + L * 0.86);
    body.lineTo(cx - W * 0.5, top + L * 0.2);
    body.quadraticCurveTo(cx - W * 0.5, top + L * 0.06, cx - W * 0.36, top + 6);
    const paint = ctx.createLinearGradient(cx - W / 2, 0, cx + W / 2, 0);
    paint.addColorStop(0, t.car.paintDark);
    paint.addColorStop(0.5, t.car.paintLight);
    paint.addColorStop(1, t.car.paintDark);
    ctx.fillStyle = paint;
    ctx.fill(body);
    ctx.strokeStyle = t.car.outline;
    ctx.lineWidth = 1.5;
    ctx.stroke(body);

    // Glass: windscreen, roof, rear window.
    ctx.fillStyle = t.car.glass;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.4, top + L * 0.3);
    ctx.quadraticCurveTo(cx, top + L * 0.2, cx + W * 0.4, top + L * 0.3);
    ctx.lineTo(cx + W * 0.36, top + L * 0.42);
    ctx.lineTo(cx - W * 0.36, top + L * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(cx - W * 0.36, top + L * 0.43, W * 0.72, L * 0.3);
    ctx.fillStyle = t.car.glass;
    ctx.beginPath();
    ctx.moveTo(cx - W * 0.36, top + L * 0.74);
    ctx.lineTo(cx + W * 0.36, top + L * 0.74);
    ctx.lineTo(cx + W * 0.32, top + L * 0.84);
    ctx.lineTo(cx - W * 0.32, top + L * 0.84);
    ctx.closePath();
    ctx.fill();

    // Doors: seams, or the door swung open in the danger colour.
    let openName: string | undefined;
    for (const d of DOORS) {
      const hingeY = top + (d.front ? L * 0.34 : L * 0.55);
      const len = L * 0.2;
      const x = cx + d.side * W * 0.5;
      if (on(d.id)) {
        openName ??= d.name;
        ctx.strokeStyle = SAFETY_COLORS.danger;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, hingeY);
        ctx.lineTo(x + d.side * len * Math.sin(0.7), hingeY + len * Math.cos(0.7));
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - d.side * 3, hingeY + len);
        ctx.lineTo(x - d.side * W * 0.06, hingeY + len);
        ctx.stroke();
      }
    }

    // Lamps: headlights and blinking indicators at the corners.
    ctx.fillStyle = low || high ? 'rgba(255,250,235,0.95)' : 'rgba(255,255,255,0.25)';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + s * W * 0.3, top + 10, W * 0.08, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const hazard = on(S.Hazard);
    for (const [key, sig, s] of [
      ['indicatorLeft', S.IndicatorLeft, -1],
      ['indicatorRight', S.IndicatorRight, 1],
    ] as const) {
      if (!f.flasher.lit(key, on(sig) || hazard, f.now)) continue;
      ctx.fillStyle = SAFETY_COLORS.caution;
      for (const y of [top + 14, top + L - 8]) {
        ctx.beginPath();
        ctx.arc(cx + s * W * 0.46, y, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Tyre pressures.
    for (const tire of TIRES) {
      if (!st.has(tire.id)) continue;
      const kpa = st.value(tire.id);
      const x = cx + tire.side * W * 0.82;
      const y = cy + (tire.front ? -L * 0.3 : L * 0.27) + 6;
      ctx.font = `500 26px ${t.fonts.primary}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = kpa < 190 ? SAFETY_COLORS.caution : t.text.primary;
      ctx.fillText((kpa / 100).toFixed(1), x, y);
      label(ctx, 'bar', x, y + 20, 13, t.fonts.primary, t.text.tertiary, 'center');
    }

    // Start-stop not available at this stop: the reason (information, not a fault).
    const ss = st.value(S.StartStopState, 1);
    if (ss === 3 || ss === 0) {
      const why = ss === 0 ? 'switched off' : (STOP_REASONS[st.value(S.StartStopReason)] ?? '');
      drawIcon(ctx, 'startStopOff', cx - 150, h - 64, 18, t.text.tertiary, t.fonts.primary);
      label(ctx, `Start-stop: ${why}`, cx - 134, h - 58, 14, t.fonts.primary, t.text.tertiary);
    }

    const status = openName ? `${openName} open` : 'All doors closed';
    label(
      ctx,
      status,
      cx,
      h - 34,
      16,
      t.fonts.primary,
      openName ? SAFETY_COLORS.danger : t.text.secondary,
      'center',
    );
  }
}
