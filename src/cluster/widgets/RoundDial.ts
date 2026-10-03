import { S } from '@/core/signals/catalog';
import type { SignalId } from '@/core/signals/types';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { clamp } from '@/core/math';
import { DEG, font, glow, noGlow, polar } from '../renderer/draw';
import type { FrameContext, Rect, StaticContext, Widget, WidgetFactory } from '../renderer/types';
import { SAFETY_COLORS } from '../themes/types';

export interface RoundDialProps {
  signal: SignalId;
  min: number;
  max: number;
  majorStep: number;
  /** Numeral spacing; defaults to `majorStep`. */
  labelStep?: number;
  /** Numerals are value / labelDivisor (1000 for a tachometer). */
  labelDivisor?: number;
  redFrom?: number;
  unitLabel: string;
  /** What to show in the dial centre. */
  center: 'readout' | 'gear' | 'none';
}

/** Drawing order inside the needle hub. */
const HUB_RATIO = 0.37;

/**
 * Round gauge with tick ring, numerals, optional redline, spring-damped needle,
 * glowing sweep arc and a centre display (digital readout or gear).
 */
export class RoundDial implements Widget {
  private spring: Spring;
  private readout = new ReadoutValue(5);
  private cx: number;
  private cy: number;
  private r: number;
  private shiftFlash = 0;

  constructor(
    readonly rect: Rect,
    private props: RoundDialProps,
  ) {
    this.cx = rect.x + rect.w / 2;
    this.cy = rect.y + rect.h / 2;
    this.r = Math.min(rect.w, rect.h) / 2 - 12;
    this.spring = new Spring(0);
  }

  private fraction(v: number): number {
    return (v - this.props.min) / (this.props.max - this.props.min);
  }

  private angle(
    fraction: number,
    sc: { theme: { dial: { startDeg: number; sweepDeg: number } } },
  ): number {
    return sc.theme.dial.startDeg + fraction * sc.theme.dial.sweepDeg;
  }

  drawStatic(ctx: CanvasRenderingContext2D, sc: StaticContext): void {
    const { cx, cy, r, props: p } = this;
    const { colors: c, dial, fonts } = sc.theme;
    const a0 = dial.startDeg * DEG;
    const a1 = (dial.startDeg + dial.sweepDeg) * DEG;

    if (dial.filledFace) {
      const face = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r);
      face.addColorStop(0, c.dialFace);
      face.addColorStop(0.85, c.dialFace);
      face.addColorStop(1, c.dialFaceEdge);
      ctx.fillStyle = face;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Outer rim, slightly brighter at the top like a light catching a bezel.
    const rim = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
    rim.addColorStop(0, c.dialRim);
    rim.addColorStop(1, 'rgba(255,255,255,0.03)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();

    // Thin scale track.
    ctx.strokeStyle = c.tickMinor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r - 14, a0, a1);
    ctx.stroke();

    if (p.redFrom !== undefined) {
      const ra = this.angle(this.fraction(p.redFrom), sc) * DEG;
      ctx.strokeStyle = c.redline;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 19, ra, a1);
      ctx.stroke();
    }

    // Ticks.
    const minors = Math.max(1, dial.minorTicks);
    const minorStep = p.majorStep / minors;
    const count = Math.round((p.max - p.min) / minorStep);
    for (let i = 0; i <= count; i++) {
      const v = p.min + i * minorStep;
      const major = i % minors === 0;
      const deg = this.angle(this.fraction(v), sc);
      const red = p.redFrom !== undefined && v >= p.redFrom;
      const outer = r - 14;
      const inner = outer - (major ? 30 : i % (minors / 2) === 0 && minors % 2 === 0 ? 18 : 12);
      const [x0, y0] = polar(cx, cy, outer, deg);
      const [x1, y1] = polar(cx, cy, inner, deg);
      ctx.strokeStyle = red ? c.redline : major ? c.tickMajor : c.tickMinor;
      ctx.lineWidth = major ? 4 : 2;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Numerals.
    const div = p.labelDivisor ?? 1;
    const numSize = Math.round(r * 0.115);
    ctx.font = font(500, numSize, fonts.numeral);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let v = p.min; v <= p.max + 1e-6; v += p.labelStep ?? p.majorStep) {
      const deg = this.angle(this.fraction(v), sc);
      const [x, y] = polar(cx, cy, r - 72, deg);
      const red = p.redFrom !== undefined && v >= p.redFrom;
      ctx.fillStyle = red ? c.redline : c.numeral;
      ctx.fillText(String(Math.round(v / div)), x, y);
    }

    // Centre hub.
    const hubR = r * HUB_RATIO;
    const hub = ctx.createRadialGradient(cx, cy - hubR * 0.4, hubR * 0.1, cx, cy, hubR);
    hub.addColorStop(0, c.dialFaceEdge);
    hub.addColorStop(1, c.needleHub);
    ctx.fillStyle = hub;
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = c.panelBorder;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Unit label in the gap at the bottom of the dial (readout dials show it under the digits).
    if (p.center === 'readout') return;
    ctx.font = font(500, Math.round(r * 0.07), fonts.ui);
    ctx.fillStyle = c.textMuted;
    ctx.fillText(p.unitLabel, cx, cy + r * 0.62);
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { cx, cy, r, props: p } = this;
    const { colors: c, dial, fonts } = f.theme;
    const quality = f.store.quality(p.signal, f.now);
    const available = quality !== 'unavailable';
    const raw = available ? f.store.predicted(p.signal, f.now) : p.min;

    this.spring.config = f.theme.needlePhysics;
    const frac = clamp(this.spring.update(clamp(this.fraction(raw), 0, 1), f.dt), -0.01, 1.015);
    const deg = this.angle(frac, f);
    const a0 = dial.startDeg * DEG;
    const aN = deg * DEG;
    // Never freeze silently: a stale needle is dimmed.
    const alpha = quality === 'live' || quality === 'estimated' ? 1 : 0.3;
    ctx.globalAlpha = alpha;

    // Sweep arc that trails the needle.
    if (dial.activeArc && frac > 0.002) {
      const grad = ctx.createConicGradient(a0, cx, cy);
      grad.addColorStop(0, c.activeArcStart);
      grad.addColorStop(Math.max(0.0001, (frac * dial.sweepDeg) / 360), c.activeArcEnd);
      grad.addColorStop(1, c.activeArcEnd);
      ctx.strokeStyle = grad;
      ctx.lineWidth = r * 0.11;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 14 - r * 0.055, a0, aN);
      ctx.stroke();
    }

    this.drawNeedle(ctx, f, deg);
    ctx.globalAlpha = 1;

    if (p.center === 'readout') this.drawReadout(ctx, f, raw, available, fonts.digital);
    else if (p.center === 'gear') this.drawGear(ctx, f);
  }

  private drawNeedle(ctx: CanvasRenderingContext2D, f: FrameContext, deg: number): void {
    const { cx, cy, r } = this;
    const c = f.theme.colors;
    const style = f.theme.dial.needle;
    const inner = r * (HUB_RATIO + 0.02);
    const tip = r - 16;
    const [tx, ty] = polar(cx, cy, tip, deg);
    const baseW = style === 'line' ? 3 : 9;
    const tipW = style === 'line' ? 3 : 2.2;
    const [bx, by] = polar(cx, cy, inner, deg);
    const nx = Math.cos((deg + 90) * DEG);
    const ny = Math.sin((deg + 90) * DEG);

    if (!f.lowPower) glow(ctx, c.needleGlow, 18 * f.theme.glow, f.pxScale);
    ctx.fillStyle = c.needle;
    ctx.beginPath();
    ctx.moveTo(bx + nx * baseW, by + ny * baseW);
    ctx.lineTo(tx + nx * tipW, ty + ny * tipW);
    if (style === 'arrow') ctx.lineTo(...polar(cx, cy, tip + 10, deg));
    ctx.lineTo(tx - nx * tipW, ty - ny * tipW);
    ctx.lineTo(bx - nx * baseW, by - ny * baseW);
    ctx.closePath();
    ctx.fill();
    noGlow(ctx);
    // Bright core line gives the blade a lit edge.
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
  }

  private drawReadout(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    raw: number,
    available: boolean,
    family: string,
  ): void {
    const { cx, cy, r } = this;
    const c = f.theme.colors;
    const shown = this.readout.update(raw, f.dt);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = c.text;
    ctx.font = font(600, Math.round(r * 0.3), family);
    ctx.fillText(available ? String(Math.max(0, Math.round(shown))) : '--', cx, cy + 4);
    ctx.font = font(500, Math.round(r * 0.06), f.theme.fonts.ui);
    ctx.fillStyle = c.textDim;
    ctx.fillText(this.props.unitLabel, cx, cy + r * 0.2);
  }

  private drawGear(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { cx, cy, r } = this;
    const c = f.theme.colors;
    const st = f.store;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!st.has(S.Gear)) {
      ctx.font = font(600, Math.round(r * 0.2), f.theme.fonts.digital);
      ctx.fillStyle = c.textMuted;
      ctx.fillText('—', cx, cy);
      return;
    }
    const gear = Math.round(st.value(S.Gear));
    const selected = st.has(S.SelectedGear) ? st.value(S.SelectedGear) : 127;
    const auto = selected === 127;
    const label = gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear);

    ctx.font = font(600, Math.round(r * 0.34), f.theme.fonts.digital);
    ctx.fillStyle = c.text;
    ctx.fillText(label, cx + (auto ? r * 0.06 : 0), cy + 6);
    ctx.font = font(600, Math.round(r * 0.11), f.theme.fonts.digital);
    ctx.fillStyle = c.textDim;
    ctx.fillText(auto ? 'D' : 'M', cx - r * (auto ? 0.15 : 0.16), cy - r * 0.08);

    // Shift-up prompt in manual mode.
    const shift = st.value(S.ShiftRequest) > 0;
    this.shiftFlash = shift ? this.shiftFlash + f.dt : 0;
    if (shift && Math.floor(this.shiftFlash * 8) % 2 === 0) {
      const y = cy - r * 0.24;
      ctx.fillStyle = SAFETY_COLORS.caution;
      ctx.beginPath();
      ctx.moveTo(cx, y - 16);
      ctx.lineTo(cx + 18, y + 4);
      ctx.lineTo(cx - 18, y + 4);
      ctx.closePath();
      ctx.fill();
    }
  }
}

export const speedometer: WidgetFactory<Partial<RoundDialProps>> = {
  type: 'speedometer',
  requires: () => [S.Speed],
  create: (rect, props, env) =>
    new RoundDial(rect, {
      signal: S.Speed,
      min: 0,
      max: env.speedoMaxKmh,
      majorStep: env.speedoMaxKmh > 160 ? 20 : 10,
      labelStep: env.speedoMaxKmh > 200 ? 40 : 20,
      unitLabel: 'km/h',
      center: 'readout',
      ...props,
    }),
};

export const tachometer: WidgetFactory<Partial<RoundDialProps>> = {
  type: 'tachometer',
  requires: () => [S.EngineSpeed],
  create: (rect, props, env) =>
    new RoundDial(rect, {
      signal: S.EngineSpeed,
      min: 0,
      max: env.tachoMaxRpm,
      majorStep: 1000,
      labelDivisor: 1000,
      redFrom: env.redlineRpm,
      unitLabel: '×1000 rpm',
      center: 'gear',
      ...props,
    }),
};
