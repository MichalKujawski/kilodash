import { S } from '@/core/signals/catalog';
import { formatDistance, drawManeuverIcon } from './center/MapPage';
import { Fade, font, label, tabular } from '../renderer/draw';
import type { FrameContext, Rect, Widget, WidgetFactory } from '../renderer/types';
import { MODES, type DriveModeId } from '@/core/drive/modes';
import { drawIcon, type IconId } from '../telltales/icons';
import { modeId } from './driveMode';
import { assistLook } from './speedAssist';
import { drawPlate, drawSign, type SignSpec } from '../telltales/signs';
import { SAFETY_COLORS } from '../themes/types';

function groupThousands(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

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
  private lastIcon: IconId = 'cruise';
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

    // Speed limit as the car recognises it: always visible (EU ISA). Over the
    // limit it flashes, then stays ringed in red while the chime has sounded.
    if (st.has(S.SpeedLimit) && on && st.value(S.SpeedLimit) >= 0) {
      const lim = st.value(S.SpeedLimit);
      const sign: SignSpec = lim > 0 ? { kind: 'limit', value: lim } : { kind: 'endAll' };
      const isa = st.value(S.IsaState);
      const blinkOff = isa === 2 && Math.floor(f.now / 220) % 2 === 1;
      if (isa >= 2 && f.emissive) {
        f.emissive.fillStyle = SAFETY_COLORS.danger;
        f.emissive.beginPath();
        f.emissive.arc(p.sign, y, 31, 0, Math.PI * 2);
        f.emissive.fill();
      }
      drawSign(ctx, sign, p.sign, y, 25, t.fonts.primary, blinkOff ? 0.25 : 1);
      if (isa === 3) {
        ctx.strokeStyle = SAFETY_COLORS.danger;
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.sign, y, 29, 0, Math.PI * 2);
        ctx.stroke();
      }
      const plate = st.value(S.SpeedLimitPlate);
      if (plate > 0) drawPlate(ctx, plate === 1 ? 'wet' : 'time', p.sign, y + 27, 26);
      if (st.value(S.NoOvertaking) > 0)
        drawSign(ctx, { kind: 'noOvertaking' }, p.sign + 56, y, 20, t.fonts.primary);
      const adv = st.value(S.SpeedAdvisory);
      if (lim === 0 && adv > 0) {
        label(ctx, `${adv}`, p.sign + 32, y + 6, 14, t.fonts.primary, t.text.tertiary);
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

    // Cruise/ACC/limiter symbol in its state colour (set speed is in the speedometer).
    const look = assistLook(f);
    const ck = this.cruiseFade.update(look !== null && on, f.dt);
    if (look) this.lastIcon = look.icon;
    if (ck > 0.01) {
      ctx.globalAlpha = ck;
      drawIcon(
        ctx,
        this.lastIcon,
        p.cruise,
        y,
        24,
        look?.color ?? t.text.tertiary,
        t.fonts.primary,
      );
      ctx.globalAlpha = 1;
    }

    // Lane assist: grey standby, green ready/centering, amber while steering
    // back from a line; "assisted driving" symbol with ACC + centering.
    const laneState = st.value(S.LaneAssistState);
    const hands = st.value(S.HandsOffStage);
    if (hands > 0 && on) {
      // Hands-off: the steering wheel takes the assist symbol's place, white then red flashing.
      const flash = hands >= 2 && Math.floor(f.now / 300) % 2 === 1;
      if (!flash)
        drawIcon(
          ctx,
          'steering',
          p.lane,
          y,
          24,
          hands >= 2 ? SAFETY_COLORS.danger : t.text.primary,
          t.fonts.primary,
        );
    } else if (on && st.value(S.LaneAssistEnabled, 1) > 0 && laneState > 0) {
      const departure = st.value(S.LaneLeft) === 3 || st.value(S.LaneRight) === 3;
      const active = this.laneActive.update(laneState >= 2, f.dt);
      const assisted = st.value(S.AssistedDriving) > 0;
      const icon: IconId = assisted ? 'assisted' : 'laneAssist';
      const col = departure ? SAFETY_COLORS.caution : SAFETY_COLORS.info;
      ctx.globalAlpha = 1 - active;
      drawIcon(ctx, icon, p.lane, y, 22, t.text.tertiary, t.fonts.primary);
      ctx.globalAlpha = active;
      drawIcon(ctx, icon, p.lane, y, 22, col, t.fonts.primary);
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
  /** Waiting vehicle messages (acknowledged warnings still active). */
  messages?: number;
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
    ctx.font = font(500, 26, t.fonts.primary);
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
      ctx.font = font(500, 24, t.fonts.primary);
      ctx.fillStyle = ice ? SAFETY_COLORS.caution : t.text.secondary;
      tabular(ctx, `${temp}°C`, p.temp, baseline, 'left');
      if (ice) drawIcon(ctx, 'ice', p.temp - 18, p.y, 20, SAFETY_COLORS.caution, t.fonts.primary);
    }

    if (st.has(S.TripDistance)) {
      label(ctx, 'A', p.trip - 6, baseline - 1, 16, t.fonts.primary, t.text.tertiary, 'right');
      ctx.font = font(500, 23, t.fonts.primary);
      ctx.fillStyle = t.text.secondary;
      tabular(ctx, st.value(S.TripDistance).toFixed(1), p.trip, baseline, 'left');
      label(ctx, 'km', p.trip + 58, baseline - 1, 16, t.fonts.primary, t.text.tertiary);
    }

    // Messages acknowledged but still active: a small triangle with their count.
    const waiting =
      f.alerts?.list().filter((a) => a.acknowledged && a.rule.severity !== 'info') ?? [];
    if (p.messages !== undefined && waiting.length > 0 && f.runtime.phase === 'on') {
      const red = waiting.some((a) => a.rule.severity === 'critical');
      const col = red ? SAFETY_COLORS.danger : SAFETY_COLORS.caution;
      drawIcon(ctx, 'message', p.messages, p.y, 22, col, t.fonts.primary);
      if (waiting.length > 1)
        label(ctx, String(waiting.length), p.messages + 15, baseline - 1, 14, t.fonts.primary, col);
    }

    if (st.has(S.Odometer)) {
      ctx.font = font(500, 23, t.fonts.primary);
      ctx.fillStyle = t.text.secondary;
      tabular(ctx, groupThousands(st.value(S.Odometer)), p.odo - 34, baseline, 'right');
      label(ctx, 'km', p.odo, baseline - 1, 16, t.fonts.primary, t.text.tertiary, 'right');
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
