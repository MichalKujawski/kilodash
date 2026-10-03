import { clamp } from '@/core/math';
import { S } from '@/core/signals/catalog';
import type { SignalId } from '@/core/signals/types';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { annulus, DEG, Fade, font, label, polar, tabular, text } from '../renderer/draw';
import type { FrameContext, Rect, StaticContext, Widget, WidgetFactory } from '../renderer/types';
import type { DialTokens, Theme } from '../themes/types';
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
  /** What to show inside the hub. */
  center: 'readout' | 'gear' | 'none';
}

interface Geometry {
  cx: number;
  cy: number;
  r: number;
  /** Inner edge of the bezel = outer edge of the tick band. */
  bandOuter: number;
  bandInner: number;
  hub: number;
  numeralR: number;
}

/**
 * Round gauge built in layers like a physical dial: metallic bezel ring, tick band
 * with three-level tick hierarchy, face, hub ring, filled redline band; plus a
 * tapered emissive needle with an afterglow sweep and numerals that brighten as
 * the needle passes.
 */
export class RoundDial implements Widget {
  private spring = new Spring(0);
  private readout = new ReadoutValue(5);
  private readyFade = new Fade(2.5);
  private shiftFlash = 0;
  private lastFrac = 0;
  private sweepSpeed = 0;

  constructor(
    readonly rect: Rect,
    private props: RoundDialProps,
  ) {}

  private geometry(d: DialTokens): Geometry {
    const cx = this.rect.x + this.rect.w / 2;
    const cy = this.rect.y + this.rect.h / 2;
    const r = Math.min(this.rect.w, this.rect.h) / 2;
    const bandOuter = r * (1 - d.bezel.width);
    const bandInner = bandOuter - r * d.tickBand.width;
    return {
      cx,
      cy,
      r,
      bandOuter,
      bandInner,
      hub: r * d.hub.radius,
      numeralR: r * (1 - d.numerals.inset),
    };
  }

  private frac(v: number): number {
    const p = this.props;
    return (v - p.min) / (p.max - p.min);
  }

  private deg(frac: number, d: DialTokens): number {
    return d.startDeg + frac * d.sweepDeg;
  }

  private numerals(): { value: number; text: string }[] {
    const p = this.props;
    const out: { value: number; text: string }[] = [];
    const step = p.labelStep ?? p.majorStep;
    for (let v = p.min; v <= p.max + 1e-6; v += step) {
      out.push({ value: v, text: String(Math.round(v / (p.labelDivisor ?? 1))) });
    }
    return out;
  }

  drawStatic(ctx: CanvasRenderingContext2D, sc: StaticContext): void {
    const t = sc.theme;
    const d = t.dial;
    const g = this.geometry(d);
    const { cx, cy, r } = g;
    const p = this.props;
    const a0 = d.startDeg;
    const a1 = d.startDeg + d.sweepDeg;

    // Face: darkest in the middle, optional faint concentric texture.
    const face = ctx.createRadialGradient(cx, cy, 0, cx, cy, g.bandOuter);
    face.addColorStop(0, d.face.center);
    face.addColorStop(1, d.face.edge);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, cy, g.bandOuter, 0, Math.PI * 2);
    ctx.fill();
    if (d.face.texture > 0) {
      ctx.strokeStyle = `rgba(255,255,255,${d.face.texture})`;
      ctx.lineWidth = 0.6;
      for (let rr = g.hub + 4; rr < g.bandInner; rr += 3.2) {
        ctx.beginPath();
        ctx.arc(cx, cy, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Tick band along the scale, slightly lighter than the face.
    const band = ctx.createRadialGradient(cx, cy, g.bandInner, cx, cy, g.bandOuter);
    band.addColorStop(0, d.tickBand.inner);
    band.addColorStop(1, d.tickBand.outer);
    ctx.fillStyle = band;
    annulus(ctx, cx, cy, g.bandInner, g.bandOuter, a0, a1);
    ctx.fill();
    // Inner shadow on the band's inner edge gives it depth.
    const shade = ctx.createRadialGradient(cx, cy, g.bandInner, cx, cy, g.bandInner + 10);
    shade.addColorStop(0, d.tickBand.shadow);
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    annulus(ctx, cx, cy, g.bandInner, g.bandInner + 10, a0, a1);
    ctx.fill();

    // Redline: a filled band segment inside the tick band.
    if (p.redFrom !== undefined) {
      const ra = this.deg(this.frac(p.redFrom), d);
      ctx.fillStyle = d.redline.band;
      annulus(ctx, cx, cy, g.bandOuter - r * d.tickBand.width * 0.42, g.bandOuter, ra, a1);
      ctx.fill();
    }

    // Ticks: major / mid / minor, from the bezel inward.
    const per = Math.max(1, d.ticks.minorPerMajor);
    const step = p.majorStep / per;
    const count = Math.round((p.max - p.min) / step);
    ctx.lineCap = 'butt';
    for (let i = 0; i <= count; i++) {
      const v = p.min + i * step;
      const isMajor = i % per === 0;
      const isMid = !isMajor && per % 2 === 0 && i % (per / 2) === 0;
      const tok = isMajor ? d.ticks.major : isMid ? d.ticks.mid : d.ticks.minor;
      const deg = this.deg(this.frac(v), d);
      const inRed = p.redFrom !== undefined && v >= p.redFrom;
      const [x0, y0] = polar(cx, cy, g.bandOuter, deg);
      const [x1, y1] = polar(cx, cy, g.bandOuter - r * tok.length, deg);
      ctx.strokeStyle = inRed && isMajor ? 'rgba(255,235,230,0.95)' : tok.color;
      ctx.lineWidth = tok.width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Numerals (dim base; the lit overlay is drawn per frame near the needle).
    const size = Math.round(r * d.numerals.size);
    ctx.font = font(d.numerals.weight, size, t.fonts.numerals);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numerals()) {
      const [x, y] = polar(cx, cy, g.numeralR, this.deg(this.frac(n.value), d));
      const inRed = p.redFrom !== undefined && n.value >= p.redFrom;
      ctx.fillStyle = inRed ? SAFETY_COLORS.danger : d.numerals.color;
      ctx.fillText(n.text, x, y + 1);
    }

    // Hub ring with soft inner shadow; hides the needle pivot.
    ctx.fillStyle = d.hub.fill;
    ctx.beginPath();
    ctx.arc(cx, cy, g.hub, 0, Math.PI * 2);
    ctx.fill();
    const hubShade = ctx.createRadialGradient(cx, cy, g.hub - 16, cx, cy, g.hub);
    hubShade.addColorStop(0, 'rgba(0,0,0,0)');
    hubShade.addColorStop(1, d.hub.shadow);
    ctx.fillStyle = hubShade;
    ctx.fill();
    ctx.strokeStyle = d.hub.ring;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Bezel: metallic gradient around the circumference plus a top-left specular.
    const bw = r * d.bezel.width;
    const metal = ctx.createConicGradient(-Math.PI / 2, cx, cy);
    [d.bezel.dark, d.bezel.light, d.bezel.dark, d.bezel.light, d.bezel.dark].forEach((col, i) =>
      metal.addColorStop(i / 4, col),
    );
    ctx.strokeStyle = metal;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.arc(cx, cy, r - bw / 2, 0, Math.PI * 2);
    ctx.stroke();
    const spec = ctx.createConicGradient(190 * DEG, cx, cy);
    spec.addColorStop(0, 'rgba(255,255,255,0)');
    spec.addColorStop(40 / 360, d.bezel.highlight);
    spec.addColorStop(80 / 360, 'rgba(255,255,255,0)');
    spec.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = spec;
    ctx.lineWidth = Math.max(1, bw * 0.35);
    ctx.beginPath();
    ctx.arc(cx, cy, r - bw * 0.25, 190 * DEG, 270 * DEG);
    ctx.stroke();

    // Unit label in the bottom gap (readout dials show it under the digits instead).
    if (p.center !== 'readout')
      label(ctx, p.unitLabel, cx, cy + r * 0.72, 16, t.fonts.primary, t.text.tertiary, 'center');
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const t = f.theme;
    const d = t.dial;
    const g = this.geometry(d);
    const { cx, cy, r } = g;
    const p = this.props;
    const quality = f.store.quality(p.signal, f.now);
    const available = quality !== 'unavailable';
    const raw = available ? f.store.predicted(p.signal, f.now) : p.min;

    this.spring.config = t.needlePhysics;
    const target = f.runtime.sweep ?? clamp(this.frac(raw), 0, 1);
    const frac = clamp(this.spring.update(target, f.dt), -0.01, 1.015);
    const speed = f.dt > 0 ? Math.abs(frac - this.lastFrac) / f.dt : 0;
    this.sweepSpeed += (speed - this.sweepSpeed) * Math.min(1, f.dt * 8);
    this.lastFrac = frac;
    const deg = this.deg(frac, d);
    // Never freeze silently: a stale needle is dimmed.
    const live = quality === 'live' || quality === 'estimated';
    const alpha = live ? 1 : 0.3;
    const em = f.emissive;

    // Redline glow intensifies as the needle approaches.
    if (p.redFrom !== undefined) {
      const near = clamp(1 - (this.frac(p.redFrom) - frac) / 0.12, 0, 1);
      if (near > 0) {
        const ra = this.deg(this.frac(p.redFrom), d);
        const a1 = d.startDeg + d.sweepDeg;
        for (const c of em ? [ctx, em] : [ctx]) {
          c.globalAlpha = near * (c === ctx ? 0.55 : 1);
          c.fillStyle = d.redline.glow;
          annulus(c, cx, cy, g.bandOuter - r * d.tickBand.width * 0.42, g.bandOuter, ra, a1);
          c.fill();
          c.globalAlpha = 1;
        }
      }
    }

    // Numerals brighten as the needle passes.
    const size = Math.round(r * d.numerals.size);
    ctx.font = font(d.numerals.weight, size, t.fonts.numerals);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const n of this.numerals()) {
      const nd = this.deg(this.frac(n.value), d);
      const k = 1 - Math.abs(nd - deg) / d.numerals.litRangeDeg;
      if (k <= 0) continue;
      const inRed = p.redFrom !== undefined && n.value >= p.redFrom;
      const [x, y] = polar(cx, cy, g.numeralR, nd);
      ctx.globalAlpha = k * alpha;
      ctx.fillStyle = inRed ? '#ff6a5c' : d.numerals.lit;
      ctx.fillText(n.text, x, y + 1);
      if (em) {
        em.globalAlpha = k * 0.35;
        em.font = ctx.font;
        em.textAlign = 'center';
        em.textBaseline = 'middle';
        em.fillStyle = d.numerals.lit;
        em.fillText(n.text, x, y + 1);
        em.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;

    // Afterglow: translucent wedge trailing the needle, stronger while sweeping.
    if (frac > 0.003) {
      const span = Math.min(
        d.needle.afterglowDeg * (0.6 + Math.min(this.sweepSpeed * 3, 1.2)),
        deg - d.startDeg,
      );
      const from = deg - span;
      const grad = ctx.createConicGradient(from * DEG, cx, cy);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(Math.max(0.0001, span / 360), d.needle.afterglow);
      grad.addColorStop(Math.min(1, span / 360 + 0.0001), 'rgba(0,0,0,0)');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      annulus(ctx, cx, cy, g.hub, g.bandOuter, from, deg);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    this.drawNeedle(ctx, em, g, deg, t, alpha);

    if (p.center === 'readout') this.drawReadout(ctx, f, g, raw, available);
    else if (p.center === 'gear') this.drawGear(ctx, f, g);
  }

  private needlePath(
    c: CanvasRenderingContext2D,
    g: Geometry,
    deg: number,
    t: Theme,
    widen = 0,
  ): void {
    const n = t.dial.needle;
    const inner = g.hub - 2;
    const tip = g.bandInner + (g.bandOuter - g.bandInner) * 0.25;
    const baseW = (n.style === 'line' ? 1.6 : n.baseWidth / 2) + widen;
    const tipW = (n.style === 'line' ? 1.6 : n.tipWidth / 2) + widen;
    const [bx, by] = polar(g.cx, g.cy, inner, deg);
    const [tx, ty] = polar(g.cx, g.cy, tip, deg);
    const nx = Math.cos((deg + 90) * DEG);
    const ny = Math.sin((deg + 90) * DEG);
    c.beginPath();
    c.moveTo(bx + nx * baseW, by + ny * baseW);
    c.lineTo(tx + nx * tipW, ty + ny * tipW);
    if (n.style === 'arrow') c.lineTo(...polar(g.cx, g.cy, tip + 12, deg));
    c.lineTo(tx - nx * tipW, ty - ny * tipW);
    c.lineTo(bx - nx * baseW, by - ny * baseW);
    c.closePath();
  }

  private drawNeedle(
    ctx: CanvasRenderingContext2D,
    em: CanvasRenderingContext2D | null,
    g: Geometry,
    deg: number,
    t: Theme,
    alpha: number,
  ): void {
    const n = t.dial.needle;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = n.color;
    this.needlePath(ctx, g, deg, t);
    ctx.fill();
    // Bright core line gives the blade an emissive centre.
    const [bx, by] = polar(g.cx, g.cy, g.hub + 6, deg);
    const [tx, ty] = polar(g.cx, g.cy, g.bandInner, deg);
    ctx.strokeStyle = n.core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (em) {
      em.globalAlpha = alpha;
      em.fillStyle = n.glow;
      this.needlePath(em, g, deg, t, 2);
      em.fill();
      em.globalAlpha = 1;
    }
  }

  private drawReadout(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    g: Geometry,
    raw: number,
    ok: boolean,
  ): void {
    const t = f.theme;
    const shown = this.readout.update(raw, f.dt);
    ctx.font = font(500, 128, t.fonts.primary);
    ctx.fillStyle = t.text.primary;
    ctx.textBaseline = 'alphabetic';
    tabular(ctx, ok ? String(Math.max(0, Math.round(shown))) : '--', g.cx, g.cy + 40, 'center');
    label(
      ctx,
      this.props.unitLabel,
      g.cx,
      g.cy + 76,
      17,
      t.fonts.primary,
      t.text.secondary,
      'center',
    );
  }

  private drawGear(ctx: CanvasRenderingContext2D, f: FrameContext, g: Geometry): void {
    const t = f.theme;
    const st = f.store;
    const { cx, cy, r } = g;

    // Mode and READY labels fade in with the engine.
    const running = !st.has(S.EngineRunning) || st.value(S.EngineRunning) > 0;
    const auto = !st.has(S.SelectedGear) || st.value(S.SelectedGear) === 127;
    const ready = this.readyFade.update(running, f.dt);
    ctx.globalAlpha = ready * 0.9;
    label(ctx, 'Ready', cx, cy + r * 0.6, 14, t.fonts.primary, SAFETY_COLORS.info, 'center');
    ctx.globalAlpha = 1;

    if (!st.has(S.Gear)) {
      text(ctx, auto ? 'D' : 'M', cx, cy + 36, {
        font: font(500, 104, t.fonts.primary),
        color: t.text.primary,
        align: 'center',
      });
      return;
    }
    const gear = Math.round(st.value(S.Gear));
    const gearText = gear < 0 ? 'R' : gear === 0 ? 'N' : String(gear);
    text(ctx, gearText, cx + 14, cy + 38, {
      font: font(500, 108, t.fonts.primary),
      color: t.text.primary,
      align: 'center',
    });
    text(ctx, auto ? 'D' : 'M', cx - 46, cy - 12, {
      font: font(500, 34, t.fonts.primary),
      color: t.text.secondary,
      align: 'center',
    });

    // Shift-up prompt in manual mode.
    const shift = st.value(S.ShiftRequest) > 0;
    this.shiftFlash = shift ? this.shiftFlash + f.dt : 0;
    if (shift && Math.floor(this.shiftFlash * 8) % 2 === 0) {
      const y = cy - 74;
      for (const c of f.emissive ? [ctx, f.emissive] : [ctx]) {
        c.fillStyle = SAFETY_COLORS.caution;
        c.beginPath();
        c.moveTo(cx + 14, y - 14);
        c.lineTo(cx + 30, y + 4);
        c.lineTo(cx - 2, y + 4);
        c.closePath();
        c.fill();
      }
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
