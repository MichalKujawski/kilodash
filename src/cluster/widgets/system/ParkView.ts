import { sectorLevel } from '@/core/body/ParkAssist';
import { S } from '@/core/signals/catalog';
import { annulus, Fade, label } from '../../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../../renderer/types';
import { SAFETY_COLORS } from '../../themes/types';

const LEVEL = [
  'rgba(255,255,255,0.06)',
  SAFETY_COLORS.info,
  SAFETY_COLORS.caution,
  SAFETY_COLORS.danger,
];
const dist = (f: FrameContext, id: string): number | null => {
  const v = f.store.value(id, -1);
  return v < 0 ? null : v;
};

/**
 * Park distance view: our car from above with sensor sectors (green, yellow,
 * red) and, in reverse, the rear camera with static distance lines and
 * steering-dependent path lines.
 */
export class ParkView implements Widget {
  readonly layer = 'overlay' as const;
  private fade = new Fade(6);

  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const on = f.store.value(S.ParkAssistState) > 0 && f.runtime.phase === 'on';
    const k = this.fade.update(on, f.dt);
    if (k <= 0.01) return;
    const reverse = f.store.value(S.SelectedGear) === -1;
    ctx.globalAlpha = k;
    const { x, y, w, h } = this.rect;
    ctx.fillStyle = '#040507';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 18);
    ctx.fill();
    if (reverse) {
      this.camera(ctx, f, { x: x + 16, y: y + 16, w: w - 220, h: h - 32 });
      this.topDown(ctx, f, x + w - 100, y + h / 2, 0.8);
    } else this.topDown(ctx, f, x + w / 2, y + h / 2, 1.2);
    if (f.store.value(S.ParkAssistState) === 2)
      label(
        ctx,
        'Sensor dirty',
        x + w / 2,
        y + h - 18,
        14,
        f.theme.fonts.primary,
        SAFETY_COLORS.caution,
        'center',
      );
    ctx.globalAlpha = 1;
  }

  private topDown(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    cx: number,
    cy: number,
    s: number,
  ): void {
    const W = 56 * s;
    const L = 120 * s;
    ctx.fillStyle = '#c9d0da';
    ctx.beginPath();
    ctx.roundRect(cx - W / 2, cy - L / 2, W, L, 14 * s);
    ctx.fill();
    ctx.fillStyle = '#2a3038';
    ctx.beginPath();
    ctx.roundRect(cx - W * 0.38, cy - L * 0.18, W * 0.76, L * 0.42, 8 * s);
    ctx.fill();
    // Front and rear sectors: three wedges each, the bar sits nearer the car the closer the obstacle.
    const ends: [number, string[]][] = [
      [-1, [S.ParkFrontLeft, S.ParkFrontCentre, S.ParkFrontRight]],
      [1, [S.ParkRearLeft, S.ParkRearCentre, S.ParkRearRight]],
    ];
    for (const [dir, ids] of ends) {
      const ey = cy + dir * L * 0.42;
      ids.forEach((id, i) => {
        const d = dist(f, id);
        const lvl = sectorLevel(d);
        const base = dir < 0 ? -90 : 90;
        const a0 = base - 42 + i * 28;
        const r = W * 0.62 + Math.min(d ?? 1.5, 1.5) * 40 * s;
        ctx.fillStyle = LEVEL[lvl]!;
        annulus(ctx, cx, ey, r, r + 9 * s, a0 + 2, a0 + 26);
        ctx.fill();
      });
    }
    for (const [id, side] of [
      [S.ParkLeft, -1],
      [S.ParkRight, 1],
    ] as const) {
      const lvl = sectorLevel(dist(f, id), true);
      ctx.fillStyle = LEVEL[lvl]!;
      ctx.fillRect(
        cx + side * (W / 2 + 10 * s) - (side < 0 ? 7 * s : 0),
        cy - L * 0.3,
        7 * s,
        L * 0.6,
      );
    }
  }

  /** Rear camera: ground, parking lines, neighbours, guide lines (mirrored like a mirror). */
  private camera(ctx: CanvasRenderingContext2D, f: FrameContext, r: Rect): void {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, 12);
    ctx.clip();
    const g = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
    g.addColorStop(0, '#3a3f45');
    g.addColorStop(0.3, '#2b2f34');
    g.addColorStop(1, '#4a4f55');
    ctx.fillStyle = g;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    const hor = r.y + r.h * 0.22;
    const P = (xm: number, zm: number): [number, number] => {
      const Z = zm + 0.6;
      return [r.x + r.w / 2 + (xm * r.w * 0.42) / Z, hor + (r.h * 0.62) / Z];
    };
    const line = (pts: [number, number][], color: string, width: number): void => {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)));
      ctx.stroke();
    };
    // Bay lines and the cars parked beside us.
    for (const sx of [-1.35, 1.35]) line([P(sx, 0.2), P(sx, 3)], 'rgba(240,240,235,0.7)', 3);
    for (const [id, sx] of [
      [S.ParkLeft, -2.7],
      [S.ParkRight, 2.7],
    ] as const) {
      if (dist(f, id) === null) continue;
      const [ax, ay] = P(sx - 0.9 * Math.sign(sx), 0.3);
      const [bx, by] = P(sx + 0.9 * Math.sign(sx), 2.8);
      ctx.fillStyle = 'rgba(20,22,26,0.85)';
      ctx.fillRect(Math.min(ax, bx), by - 40, Math.abs(bx - ax), ay - by + 40);
    }
    // A car crossing behind.
    const rear = dist(f, S.ParkRearCentre);
    if (rear !== null && f.store.value(S.CrossTraffic) > 0) {
      const [ax, ay] = P(-1.6, rear + 1.2);
      const [bx] = P(1.6, rear + 1.2);
      ctx.fillStyle = '#55606c';
      ctx.fillRect(ax, ay - 70, bx - ax, 70);
    }
    // Static distance lines: red to 0.5 m, yellow to 1 m, green to 2.5 m.
    for (const sx of [-0.95, 0.95]) {
      line([P(sx, 0.2), P(sx, 0.5)], SAFETY_COLORS.danger, 4);
      line([P(sx, 0.5), P(sx, 1)], SAFETY_COLORS.caution, 4);
      line([P(sx, 1), P(sx, 2.5)], SAFETY_COLORS.info, 4);
    }
    for (const [z, c] of [
      [0.5, SAFETY_COLORS.danger],
      [1, SAFETY_COLORS.caution],
      [2, SAFETY_COLORS.info],
    ] as const) {
      line([P(-0.95, z), P(-0.6, z)], c, 3);
      line([P(0.6, z), P(0.95, z)], c, 3);
    }
    // Path lines bend with the steering (road-wheel angle ≈ wheel / 15, wheelbase 2.7 m).
    const delta = (f.store.value(S.SteeringAngle) / 15) * (Math.PI / 180);
    const kappa = Math.tan(delta) / 2.7;
    for (const sx of [-0.95, 0.95]) {
      const pts: [number, number][] = [];
      for (let z = 0.2; z <= 3; z += 0.2) pts.push(P(sx - (kappa * z * z) / 2, z));
      line(pts, 'rgba(255,214,90,0.9)', 2.5);
    }
    ctx.restore();
  }
}

export const parkView: WidgetFactory<Record<string, never>> = {
  type: 'park-view',
  requires: () => [S.ParkAssistState],
  create: (rect) => new ParkView(rect),
};
