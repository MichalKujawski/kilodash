import { clamp } from '@/core/math';
import { S } from '@/core/signals/catalog';
import { ReadoutValue } from '@/core/smoothing/spring';
import { buildLaneView } from '../lanes/buildLaneView';
import { Canvas2DLaneRenderer } from '../lanes/Canvas2DLaneRenderer';
import { font, label, tabular } from '../renderer/draw';
import type { FrameContext, Rect, VehicleEnv, Widget, WidgetFactory } from '../renderer/types';
import { SAFETY_COLORS } from '../themes/types';
import { drawManeuverIcon, formatDistance } from './center/MapPage';
import { assistLook } from './speedAssist';

/** Large digital speed with unit and the cruise set speed (Navigation, Reduced, Assist views). */
export class DigitalSpeed implements Widget {
  private readout = new ReadoutValue(5);
  constructor(
    readonly rect: Rect,
    private size: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const { x, y, w, h } = this.rect;
    const cx = x + w / 2;
    const v = Math.max(0, Math.round(this.readout.update(f.store.value(S.Speed), f.dt)));
    ctx.font = font(
      500,
      this.size,
      t.fonts.readout === 'segment' ? t.fonts.numerals : t.fonts.readout,
    );
    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'alphabetic';
    tabular(ctx, String(v), cx, y + h * 0.62, 'center');
    label(ctx, 'km/h', cx, y + h * 0.62 + 30, 16, t.fonts.primary, t.text.tertiary, 'center');
    const look = assistLook(f);
    if (look && look.setKmh > 0)
      label(
        ctx,
        `${look.setText}`,
        cx,
        y + h * 0.62 + 58,
        18,
        t.fonts.primary,
        look.color,
        'center',
      );
  }
}

/** Gear (or drive state) with a slim rpm / power bar underneath. */
export class GearReadout implements Widget {
  constructor(
    readonly rect: Rect,
    private maxRpm: number,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const { x, y, w, h } = this.rect;
    const cx = x + w / 2;
    const sel = st.value(S.SelectedGear, 127);
    const gear = Math.round(st.value(S.Gear, 0));
    const prog = ['D', 'S', 'M', 'E', 'B'][st.value(S.GearboxMode)] ?? 'D';
    const txt =
      sel === 126
        ? 'P'
        : sel < 0
          ? 'R'
          : sel === 0
            ? 'N'
            : gear > 0 && st.has(S.Gear)
              ? `${prog}${gear}`
              : prog;
    ctx.font = font(500, 64, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'center';
    ctx.fillText(txt, cx, y + h * 0.55);
    // Engine speed (or power on electric cars) as a thin bar.
    const ev = st.has(S.PowerDemand);
    const frac = ev
      ? clamp(st.value(S.PowerDemand) / 100, -1, 1)
      : clamp(st.value(S.EngineSpeed) / Math.max(1000, this.maxRpm), 0, 1);
    const bw = w * 0.7;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(cx - bw / 2, y + h * 0.66, bw, 5);
    ctx.fillStyle =
      frac < 0 ? SAFETY_COLORS.info : frac > 0.85 && !ev ? SAFETY_COLORS.danger : t.text.secondary;
    if (frac >= 0) ctx.fillRect(cx - bw / 2, y + h * 0.66, bw * frac, 5);
    else ctx.fillRect(cx - bw / 2, y + h * 0.66, bw * -frac * 0.3, 5);
    label(
      ctx,
      ev ? 'power' : 'rpm',
      cx,
      y + h * 0.66 + 26,
      14,
      t.fonts.primary,
      t.text.tertiary,
      'center',
    );
  }
}

/** Big next-turn arrow with distance (Reduced view while guiding). */
export class NavArrow implements Widget {
  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const nav = f.scene?.nav;
    if (!nav?.current || f.runtime.phase !== 'on') return;
    const t = f.theme;
    const { x, y, w, h } = this.rect;
    drawManeuverIcon(ctx, nav.current, x + w / 2, y + h * 0.38, 72, t.text.primary);
    ctx.font = font(500, 30, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(formatDistance(nav.distance), x + w / 2, y + h * 0.75);
    if (nav.road)
      label(
        ctx,
        nav.road,
        x + w / 2,
        y + h * 0.75 + 26,
        15,
        t.fonts.primary,
        t.text.tertiary,
        'center',
      );
  }
}

/** The lane view on its own (Driver assistance view). */
export class LaneViewWidget implements Widget {
  private renderer = new Canvas2DLaneRenderer();
  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const model = buildLaneView(f);
    if (!model) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.rect.x, this.rect.y, this.rect.w, this.rect.h);
    ctx.clip();
    this.renderer.draw(ctx, model, this.rect, f.theme, f.now);
    // Soft fade at the sides and top so the picture sits in the display.
    const r = this.rect;
    for (const [x0, dir] of [
      [r.x, 1],
      [r.x + r.w, -1],
    ] as const) {
      const g = ctx.createLinearGradient(x0, 0, x0 + dir * 140, 0);
      g.addColorStop(0, '#000');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(dir > 0 ? x0 : x0 - 140, r.y, 140, r.h);
    }
    ctx.restore();
  }
}

/** Sport view side panel: power, torque, boost, oil temperature as bars. */
export class SportPanel implements Widget {
  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const { x, y, w } = this.rect;
    const load = st.value(S.EngineLoad, 0);
    const rows: [string, number, string][] = [
      [
        'Power',
        clamp((load / 100) * (st.value(S.EngineSpeed) / 6000), 0, 1),
        `${Math.round(clamp((load / 100) * (st.value(S.EngineSpeed) / 6000), 0, 1) * 100)} %`,
      ],
      ['Torque', clamp(load / 100, 0, 1), `${Math.round(load)} %`],
      [
        'Boost',
        clamp(st.value(S.Boost, 0) / 120, 0, 1),
        `${(st.value(S.Boost, 0) / 100).toFixed(2)} bar`,
      ],
      [
        'Oil',
        clamp((st.value(S.OilTemp, 20) - 40) / 100, 0, 1),
        `${Math.round(st.value(S.OilTemp, 0))} °C`,
      ],
    ];
    rows.forEach(([name, frac, val], i) => {
      const ry = y + 30 + i * 74;
      label(ctx, name, x, ry, 14, t.fonts.primary, t.text.tertiary);
      label(ctx, val, x + w, ry, 18, t.fonts.primary, t.text.primary, 'right');
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, ry + 14, w, 6);
      ctx.fillStyle = frac > 0.9 ? SAFETY_COLORS.danger : t.text.secondary;
      ctx.fillRect(x, ry + 14, w * frac, 6);
    });
  }
}

/** Sport view: G-meter (dot moves with acceleration, peak ring) and a lap timer. */
export class GMeter implements Widget {
  private peak = 0;
  private lapStart = -1;
  constructor(readonly rect: Rect) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const { x, y, w } = this.rect;
    const cx = x + w / 2;
    const cy = y + 120;
    const r = 90;
    ctx.strokeStyle = t.panel.divider;
    ctx.lineWidth = 1.5;
    for (const k of [0.5, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * k, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();
    const gx = clamp(st.value(S.AccelLateral, 0), -1, 1);
    const gy = clamp(st.value(S.AccelLongitudinal, 0), -1, 1);
    const g = Math.hypot(gx, gy);
    this.peak = Math.max(this.peak * 0.999, g);
    ctx.strokeStyle = 'rgba(255,59,47,0.5)';
    ctx.beginPath();
    ctx.arc(cx, cy, r * clamp(this.peak, 0, 1), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = SAFETY_COLORS.danger;
    ctx.beginPath();
    ctx.arc(cx + gx * r, cy - gy * r, 7, 0, Math.PI * 2);
    ctx.fill();
    label(ctx, `${g.toFixed(2)} g`, cx, cy + r + 30, 20, t.fonts.primary, t.text.primary, 'center');
    // Lap timer: runs from when the view appeared.
    if (this.lapStart < 0) this.lapStart = f.now;
    const s = (f.now - this.lapStart) / 1000;
    const txt = `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
    label(ctx, 'Lap', cx, cy + r + 66, 13, t.fonts.primary, t.text.tertiary, 'center');
    ctx.font = font(500, 28, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textAlign = 'center';
    tabular(ctx, txt, cx, cy + r + 98, 'center');
  }
}

const simple = <T extends Widget>(
  type: string,
  make: (r: Rect, p: { size?: number }, env: VehicleEnv) => T,
  requires: string[] = [],
): WidgetFactory<{ size?: number }> => ({
  type,
  requires: () => requires,
  create: (rect, props, env) => make(rect, props ?? {}, env),
});

export const viewWidgets = [
  simple('digital-speed', (r, p) => new DigitalSpeed(r, p.size ?? 120), [S.Speed]),
  simple('gear-readout', (r, _p, env) => new GearReadout(r, env.tachoMaxRpm)),
  simple('nav-arrow', (r) => new NavArrow(r)),
  simple('lane-view', (r) => new LaneViewWidget(r)),
  simple('sport-panel', (r) => new SportPanel(r)),
  simple('g-meter', (r) => new GMeter(r)),
];
