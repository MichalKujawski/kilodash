import { S } from '@/core/signals/catalog';
import { formatDistance, drawManeuverIcon } from './center/MapPage';
import { Fade, font, label, tabular } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { MODES, type DriveModeId } from '@/core/drive/modes';
import { drawIcon, type IconId } from '../telltales/icons';
import { modeId } from './driveMode';
import { drawSign, type SignSpec } from '../telltales/signs';
import { SAFETY_COLORS } from '../themes/types';

function groupThousands(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Lane keeping works above this speed (typical systems: 60–65 km/h). */
const LANE_ASSIST_MIN_KMH = 60;

export interface TopStripProps {
  /** x positions of the items, logical px. */
  sign: number;
  nav: number;
  cruise: number;
  lane: number;
  mode: number;
  y: number;
}

/**
 * Top strip: current speed limit (always visible), next-turn mini card when the
 * map isn't on the centre screen, cruise/ACC status, lane-assist status, drive
 * mode. Indicator arrows are telltales placed near each dial top.
 */
export class TopStrip implements Widget {
  private navFade = new Fade(5);
  private cruiseFade = new Fade(5);
  private laneActive = new Fade(3);
  private modeFade = new Fade(4);
  private shownMode: DriveModeId = 'normal';

  constructor(
    readonly rect: Rect,
    private p: TopStripProps,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const p = this.p;
    const y = p.y;
    const sc = f.scene;
    const on = f.runtime.phase === 'on';

    // Speed limit: always visible while driving (EU intelligent speed assistance).
    if (sc && on) {
      const l = sc.legal;
      const sign: SignSpec =
        l.limit !== null ? { kind: 'limit', value: l.limit } : { kind: 'endAll' };
      drawSign(ctx, sign, p.sign, y, 25, t.fonts.primary);
      if (l.noOvertaking)
        drawSign(ctx, { kind: 'noOvertaking' }, p.sign + 56, y, 20, t.fonts.primary);
      if (l.limit === null && l.advisory) {
        label(ctx, `${l.advisory}`, p.sign + 32, y + 6, 14, t.fonts.primary, t.text.tertiary);
      }
    }

    // Next turn when the map isn't showing.
    const showNav = !!sc?.nav.current && f.ui.centerPage !== 'map' && on;
    const nk = this.navFade.update(showNav, f.dt);
    if (nk > 0.01 && sc?.nav.current) {
      ctx.globalAlpha = nk;
      drawManeuverIcon(ctx, sc.nav.current, p.nav, y, 24, t.text.primary);
      ctx.font = font(500, 22, t.fonts.primary);
      ctx.fillStyle = t.text.primary;
      ctx.textBaseline = 'alphabetic';
      tabular(ctx, formatDistance(sc.nav.distance), p.nav + 20, y + 8, 'left');
      ctx.globalAlpha = 1;
    }

    // Cruise/ACC: green with set speed when active, grey when only stored.
    const cruise = st.value(S.CruiseActive) > 0;
    const ck = this.cruiseFade.update(cruise || st.value(S.CruiseSpeed) > 0, f.dt);
    if (ck > 0.01) {
      ctx.globalAlpha = ck;
      const col = cruise ? SAFETY_COLORS.info : t.text.tertiary;
      drawIcon(ctx, 'cruise', p.cruise, y, 22, col, t.fonts.primary);
      ctx.globalAlpha = 1;
    }

    // Lane assist: grey standby, green active above its minimum speed.
    const laneOn = st.value(S.LaneAssistEnabled, 1) > 0;
    if (laneOn && on) {
      const lane = this.laneActive.update(st.value(S.Speed) > LANE_ASSIST_MIN_KMH, f.dt);
      ctx.globalAlpha = 1 - lane;
      drawIcon(ctx, 'laneAssist', p.lane, y, 22, t.text.tertiary, t.fonts.primary);
      ctx.globalAlpha = lane;
      drawIcon(ctx, 'laneAssist', p.lane, y, 22, SAFETY_COLORS.info, t.fonts.primary);
      ctx.globalAlpha = 1;
    }

    // Driving mode symbol: only for modes other than Normal, in the mode's accent.
    const mode = st.has(S.DriveMode) ? modeId(st.value(S.DriveMode)) : 'normal';
    if (mode !== 'normal') this.shownMode = mode;
    const mk = this.modeFade.update(mode !== 'normal' && on, f.dt);
    if (mk > 0.01) {
      const m = MODES[this.shownMode];
      ctx.globalAlpha = mk;
      drawIcon(
        ctx,
        m.icon as IconId,
        p.mode,
        y,
        24,
        m.params.accent ?? t.text.secondary,
        t.fonts.primary,
      );
      ctx.globalAlpha = 1;
    }

    // Hill descent control: grey standby, green while braking.
    const hdc = st.value(S.HillDescent);
    if (hdc > 0 && on) {
      drawIcon(
        ctx,
        'hillDescent',
        p.mode + 44,
        y,
        24,
        hdc > 1 ? SAFETY_COLORS.info : t.text.tertiary,
        t.fonts.primary,
      );
    }
  }
}

export interface BottomStripProps {
  y: number;
  temp: number;
  trip: number;
  clock: number;
  odo: number;
}

/**
 * Fixed bottom strip (every view): outside temperature with ice warning, trip A,
 * clock, odometer. Telltale rows sit between them (layout data).
 */
export class BottomStrip implements Widget {
  constructor(
    readonly rect: Rect,
    private p: BottomStripProps,
  ) {}

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const st = f.store;
    const p = this.p;
    ctx.textBaseline = 'alphabetic';
    const baseline = p.y + 8;

    // The car's clock: world time in the simulator, the device clock otherwise.
    const d = new Date();
    const hour = f.scene ? f.scene.env.hour : d.getHours() + d.getMinutes() / 60;
    const hh = Math.floor(hour);
    const mm = Math.floor((hour - hh) * 60);
    ctx.font = font(500, 24, t.fonts.primary);
    ctx.fillStyle = t.text.secondary;
    tabular(
      ctx,
      `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      p.clock,
      baseline,
      'center',
    );

    if (st.has(S.AmbientTemp)) {
      const temp = Math.round(st.value(S.AmbientTemp));
      // Ice warning below about +4 °C: snowflake and amber temperature.
      const ice = temp <= 3;
      ctx.font = font(500, 22, t.fonts.primary);
      ctx.fillStyle = ice ? SAFETY_COLORS.caution : t.text.secondary;
      tabular(ctx, `${temp}°C`, p.temp, baseline, 'left');
      if (ice) drawIcon(ctx, 'ice', p.temp - 18, p.y, 20, SAFETY_COLORS.caution, t.fonts.primary);
    }

    if (st.has(S.TripDistance)) {
      label(ctx, 'A', p.trip - 6, baseline - 1, 13, t.fonts.primary, t.text.tertiary, 'right');
      ctx.font = font(500, 20, t.fonts.primary);
      ctx.fillStyle = t.text.secondary;
      tabular(ctx, st.value(S.TripDistance).toFixed(1), p.trip, baseline, 'left');
      label(ctx, 'km', p.trip + 50, baseline - 1, 13, t.fonts.primary, t.text.tertiary);
    }

    if (st.has(S.Odometer)) {
      ctx.font = font(500, 20, t.fonts.primary);
      ctx.fillStyle = t.text.tertiary;
      tabular(ctx, groupThousands(st.value(S.Odometer)), p.odo - 30, baseline, 'right');
      label(ctx, 'km', p.odo, baseline - 1, 13, t.fonts.primary, t.text.tertiary, 'right');
    }
  }
}

export const topStrip: WidgetFactory<TopStripProps> = {
  type: 'top-strip',
  requires: () => [],
  create: (rect, props) => new TopStrip(rect, props),
};

export const bottomStrip: WidgetFactory<BottomStripProps> = {
  type: 'bottom-strip',
  requires: () => [],
  create: (rect, props) => new BottomStrip(rect, props),
};
