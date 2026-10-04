import { clamp } from '@/core/math';
import { S } from '@/core/signals/catalog';
import type { SignalId } from '@/core/signals/types';
import { ReadoutValue, Spring } from '@/core/smoothing/spring';
import { annulus, DEG, Fade, font, label, polar, tabular, text } from '../renderer/draw';
import { canSegment, drawSegments } from '../renderer/segments';
import type { FrameContext, Rect, StaticContext, Widget, WidgetFactory } from '../renderer/types';
import { drawIcon } from '../telltales/icons';
import type { DialTokens, Theme } from '../themes/types';
import { SAFETY_COLORS } from '../themes/types';
import { mapValue } from './SideGauge';
import { modeAccent, modeLabel } from './driveMode';
import { assistLook, drawAccDistance, type AssistLook } from './speedAssist';

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
  /** Non-linear scale: value → dial fraction breakpoints (power meter: charge is compressed). */
  map?: [number, number][];
  /** Coloured scale zones with an optional caption (power meter: CHARGE / ECO / POWER). */
  zones?: { from: number; to: number; color: string; label?: string; labelAt?: number }[];
  /** Explicit numeral positions (default: every `labelStep`). */
  numeralValues?: number[];
  /** Sport view: the digital speed above the gear in the hub. */
  speedInHub?: boolean;
}

/** Rows of text in the open bottom gap, as fractions of the radius below the centre. */
const GAP = { status: 0.62, unit: 0.76, mode: 0.88 };

interface Geometry {
  cx: number;
  cy: number;
  r: number;
  /** Inner edge of the bezel = outer edge of the tick band. */
  bandOuter: number;
  bandInner: number;
  hub: number;
  numeralR: number;
  /** Small-hub dials (classic analogue) put readouts in a window below the pivot. */
  compact: boolean;
}

/** Draw readout text with the theme's readout face (a font, or 7-segment digits). */
export function readoutText(
  ctx: CanvasRenderingContext2D,
  f: FrameContext,
  str: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: 'left' | 'center' | 'right' = 'center',
): number {
  const t = f.theme;
  if (t.fonts.readout === 'segment' && canSegment(str)) {
    return drawSegments(
      ctx,
      str,
      x,
      y,
      size * 0.72,
      color,
      t.dial.segments.ghost,
      align,
      f.emissive,
    );
  }
  const family = t.fonts.readout === 'segment' ? t.fonts.numerals : t.fonts.readout;
  ctx.font = font(500, size, family);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  return tabular(ctx, str, x, y, align);
}

/**
 * Round gauge built in layers like a physical dial: metallic bezel ring, tick band
 * with three-level tick hierarchy, face, hub ring, filled redline band; plus a
 * tapered emissive needle with an afterglow sweep and numerals that brighten as
 * the needle passes. Themes can switch it to an LCD segment bar, radial or
 * italic numerals, rounded ticks, or a classic small-hub needle with a tail.
 */
export class RoundDial implements Widget {
  private spring = new Spring(0);
  private readout = new ReadoutValue(5);
  private readyFade = new Fade(2.5);
  private setFade = new Fade(4);
  private lastLook: AssistLook | null = null;
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
      compact: d.hub.radius < 0.3,
    };
  }

  private frac(v: number): number {
    const p = this.props;
    if (p.map) return mapValue(p.map, v);
    return (v - p.min) / (p.max - p.min);
  }

  private deg(frac: number, d: DialTokens): number {
    return d.startDeg + frac * d.sweepDeg;
  }

  private numerals(): { value: number; text: string }[] {
    const p = this.props;
    const out: { value: number; text: string }[] = [];
    if (p.numeralValues)
      return p.numeralValues.map((v) => ({ value: v, text: String(v / (p.labelDivisor ?? 1)) }));
    const step = p.labelStep ?? p.majorStep;
    for (let v = p.min; v <= p.max + 1e-6; v += step) {
      out.push({ value: v, text: String(Math.round(v / (p.labelDivisor ?? 1))) });
    }
    return out;
  }

  private drawNumeral(
    ctx: CanvasRenderingContext2D,
    t: Theme,
    txt: string,
    deg: number,
    g: Geometry,
    knockout?: string,
  ): void {
    const d = t.dial;
    const size = Math.round(g.r * d.numerals.size);
    ctx.font = `${d.numerals.italic ? 'italic ' : ''}${d.numerals.weight} ${size}px ${t.fonts.numerals}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const [x, y] = polar(g.cx, g.cy, g.numeralR, deg);
    if (d.numerals.orientation === 'radial') {
      ctx.save();
      ctx.translate(x, y);
      // Keep numerals readable: flip the ones in the lower half.
      const a = deg + 90;
      const n = ((a % 360) + 360) % 360;
      ctx.rotate((n > 90 && n < 270 ? a + 180 : a) * DEG);
      if (knockout) this.knockout(ctx, txt, 0, 1, knockout, size);
      ctx.fillText(txt, 0, 1);
      ctx.restore();
    } else {
      if (knockout) this.knockout(ctx, txt, x, y + 1, knockout, size);
      ctx.fillText(txt, x, y + 1);
    }
  }

  /** Outline in the face colour so a numeral stays legible on top of the needle. */
  private knockout(
    ctx: CanvasRenderingContext2D,
    txt: string,
    x: number,
    y: number,
    color: string,
    size: number,
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(3, size * 0.18);
    ctx.lineJoin = 'round';
    ctx.strokeText(txt, x, y);
    ctx.restore();
  }

  drawStatic(ctx: CanvasRenderingContext2D, sc: StaticContext): void {
    const t = sc.theme;
    const d = t.dial;
    const g = this.geometry(d);
    const { cx, cy, r } = g;
    const p = this.props;
    const a0 = d.tickBand.full ? 0 : d.startDeg;
    const a1 = d.tickBand.full ? 360 : d.startDeg + d.sweepDeg;

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

    // Tick band, slightly lighter than the face, with an inner shadow.
    const band = ctx.createRadialGradient(cx, cy, g.bandInner, cx, cy, g.bandOuter);
    band.addColorStop(0, d.tickBand.inner);
    band.addColorStop(1, d.tickBand.outer);
    ctx.fillStyle = band;
    annulus(ctx, cx, cy, g.bandInner, g.bandOuter, a0, a1);
    ctx.fill();
    const shade = ctx.createRadialGradient(cx, cy, g.bandInner, cx, cy, g.bandInner + 10);
    shade.addColorStop(0, d.tickBand.shadow);
    shade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = shade;
    annulus(ctx, cx, cy, g.bandInner, g.bandInner + 10, a0, a1);
    ctx.fill();

    const segmented = d.mode === 'segments';
    // Redline: a filled band segment inside the tick band (segment dials colour their bars instead).
    if (p.redFrom !== undefined && !segmented) {
      const ra = this.deg(this.frac(p.redFrom), d);
      ctx.fillStyle = d.redline.band;
      annulus(
        ctx,
        cx,
        cy,
        g.bandOuter - r * d.tickBand.width * 0.42,
        g.bandOuter,
        ra,
        d.startDeg + d.sweepDeg,
      );
      ctx.fill();
    }
    if (segmented) this.drawSegmentBars(ctx, null, g, d, -1);
    for (const z of p.zones ?? []) {
      const za = this.deg(this.frac(z.from), d);
      const zb = this.deg(this.frac(z.to), d);
      ctx.fillStyle = z.color;
      annulus(ctx, cx, cy, g.bandOuter - r * d.tickBand.width * 0.42, g.bandOuter, za, zb);
      ctx.fill();
      if (z.label) {
        // Captions sit on the numeral ring, between numerals.
        const at = z.labelAt !== undefined ? this.deg(this.frac(z.labelAt), d) : (za + zb) / 2;
        const [lx, ly] = polar(cx, cy, g.numeralR, at);
        label(ctx, z.label, lx, ly + 5, 13, t.fonts.primary, t.text.tertiary, 'center');
      }
    }

    // Ticks: major / mid / minor, from the bezel inward.
    const per = Math.max(1, d.ticks.minorPerMajor);
    const step = p.majorStep / per;
    const count = Math.round((p.max - p.min) / step);
    ctx.lineCap = d.ticks.cap;
    const tickOuter = segmented ? g.bandInner - 4 : g.bandOuter;
    for (let i = 0; i <= count; i++) {
      const v = p.min + i * step;
      const isMajor = i % per === 0;
      const isMid = !isMajor && per % 2 === 0 && i % (per / 2) === 0;
      const tok = isMajor ? d.ticks.major : isMid ? d.ticks.mid : d.ticks.minor;
      if (tok.length <= 0 || tok.width <= 0) continue;
      const deg = this.deg(this.frac(v), d);
      const inRed = p.redFrom !== undefined && v >= p.redFrom;
      const inset = d.ticks.cap === 'round' ? tok.width / 2 + 1 : 0;
      const [x0, y0] = polar(cx, cy, tickOuter - inset, deg);
      const [x1, y1] = polar(cx, cy, tickOuter - r * tok.length - inset, deg);
      ctx.strokeStyle = inRed && isMajor && !segmented ? 'rgba(255,235,230,0.95)' : tok.color;
      ctx.lineWidth = tok.width;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }

    // Numerals (dim base; the lit overlay is drawn per frame near the needle).
    for (const n of this.numerals()) {
      const inRed = p.redFrom !== undefined && n.value >= p.redFrom;
      ctx.fillStyle = inRed ? SAFETY_COLORS.danger : d.numerals.color;
      this.drawNumeral(ctx, t, n.text, this.deg(this.frac(n.value), d), g);
    }

    // Hub ring with soft inner shadow; hides the needle pivot.
    if (!g.compact) {
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
    } else {
      // Analogue dial: a recessed readout window below the pivot.
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.beginPath();
      ctx.roundRect(cx - r * 0.24, cy + r * 0.3, r * 0.48, r * 0.24, 8);
      ctx.fill();
    }

    // Bezel: metallic gradient around the circumference plus a top-left specular.
    const bw = r * d.bezel.width;
    if (bw > 0.5) {
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
    }

    // Unit label in the open bottom gap (analogue dials: above the pivot).
    {
      const y = g.compact ? cy - r * 0.32 : cy + r * GAP.unit;
      label(
        ctx,
        p.unitLabel,
        cx,
        y,
        16,
        t.fonts.primary,
        g.compact ? d.hub.textSecondary : t.text.tertiary,
        'center',
      );
    }
  }

  /** LCD bar segments along the scale; `frac < 0` draws the unlit ghosts only. */
  private drawSegmentBars(
    ctx: CanvasRenderingContext2D,
    em: CanvasRenderingContext2D | null,
    g: Geometry,
    d: DialTokens,
    frac: number,
  ): void {
    const p = this.props;
    const n = d.segments.count;
    const span = d.sweepDeg / n;
    const redFrac = p.redFrom !== undefined ? this.frac(p.redFrom) : 2;
    const r0 = g.bandInner + 3;
    const r1 = g.bandOuter - 3;
    for (let i = 0; i < n; i++) {
      const lit = frac >= 0 && (i + 0.5) / n <= frac;
      if (frac >= 0 && !lit) continue;
      const red = i / n >= redFrac;
      const a = d.startDeg + i * span;
      ctx.fillStyle =
        frac < 0
          ? red
            ? 'rgba(255,60,30,0.10)'
            : d.segments.ghost
          : red
            ? d.redline.glow
            : d.segments.on;
      annulus(ctx, g.cx, g.cy, r0, r1, a + span * 0.14, a + span * 0.86);
      ctx.fill();
      if (lit && em) {
        em.fillStyle = ctx.fillStyle;
        annulus(em, g.cx, g.cy, r0, r1, a + span * 0.14, a + span * 0.86);
        em.fill();
      }
    }
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
    const alpha = live || f.runtime.sweep !== null ? 1 : 0.3;
    const em = f.emissive;
    const segmented = d.mode === 'segments';

    // Redline glow intensifies as the needle approaches.
    if (p.redFrom !== undefined && !segmented) {
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

    if (segmented) {
      ctx.globalAlpha = alpha;
      this.drawSegmentBars(ctx, em, g, d, frac);
      ctx.globalAlpha = 1;
    } else {
      // Afterglow: translucent wedge trailing the needle, stronger while sweeping.
      if (frac > 0.003 && d.needle.afterglowDeg > 0) {
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
        annulus(ctx, cx, cy, g.compact ? r * 0.2 : g.hub, g.bandOuter, from, deg);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      this.drawNeedle(ctx, em, g, deg, t, alpha);
    }

    // Numerals brighten as the needle passes. They are drawn on top of the needle
    // with a face-coloured outline, as digital clusters do, so a resting or
    // passing needle never hides a number.
    for (const n of this.numerals()) {
      const nd = this.deg(this.frac(n.value), d);
      const k = 1 - Math.abs(nd - deg) / d.numerals.litRangeDeg;
      if (k <= 0) continue;
      const inRed = p.redFrom !== undefined && n.value >= p.redFrom;
      ctx.globalAlpha = k * alpha;
      ctx.fillStyle = inRed ? '#ff6a5c' : d.numerals.lit;
      this.drawNumeral(ctx, t, n.text, nd, g, segmented ? undefined : d.face.edge);
      if (em) {
        em.globalAlpha = k * 0.35;
        em.fillStyle = d.numerals.lit;
        this.drawNumeral(em, t, n.text, nd, g);
        em.globalAlpha = 1;
      }
    }
    ctx.globalAlpha = 1;

    if (p.center === 'readout') this.drawReadout(ctx, f, g, raw, available);
    else if (p.center === 'gear') this.drawGear(ctx, f, g);
    if (p.speedInHub) {
      const v = Math.max(0, Math.round(this.readout.update(f.store.value(S.Speed), f.dt)));
      readoutText(ctx, f, String(v), g.cx, g.cy - g.r * 0.3, 64, t.dial.hub.text);
      label(
        ctx,
        'km/h',
        g.cx,
        g.cy - g.r * 0.3 + 20,
        13,
        t.fonts.primary,
        t.text.tertiary,
        'center',
      );
    }
  }

  private needlePath(
    c: CanvasRenderingContext2D,
    g: Geometry,
    deg: number,
    t: Theme,
    widen = 0,
  ): void {
    const n = t.dial.needle;
    const inner = g.compact ? -g.r * n.tail : g.hub - 2;
    const tip = g.bandInner + (g.bandOuter - g.bandInner) * 0.25;
    const baseW = (n.style === 'line' ? n.baseWidth / 3 : n.baseWidth / 2) + widen;
    const tipW = (n.style === 'line' ? n.tipWidth / 2 : n.tipWidth / 2) + widen;
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
    if (g.compact) {
      // Drop shadow under a physical needle.
      ctx.save();
      ctx.translate(3, 5);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      this.needlePath(ctx, g, deg, t);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = n.color;
    this.needlePath(ctx, g, deg, t);
    ctx.fill();
    // Bright core line gives the blade an emissive centre.
    const [bx, by] = polar(g.cx, g.cy, g.compact ? 0 : g.hub + 6, deg);
    const [tx, ty] = polar(g.cx, g.cy, g.bandInner, deg);
    ctx.strokeStyle = n.core;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(tx, ty);
    ctx.stroke();
    if (g.compact) {
      // Chrome centre cap.
      const capR = g.hub;
      const cap = ctx.createRadialGradient(
        g.cx - capR * 0.3,
        g.cy - capR * 0.4,
        1,
        g.cx,
        g.cy,
        capR,
      );
      cap.addColorStop(0, '#ffffff');
      cap.addColorStop(0.5, n.cap);
      cap.addColorStop(1, t.dial.hub.fill);
      ctx.fillStyle = cap;
      ctx.beginPath();
      ctx.arc(g.cx, g.cy, capR, 0, Math.PI * 2);
      ctx.fill();
    }
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
    const d = f.theme.dial;
    const shown = this.readout.update(raw, f.dt);
    const str = ok ? String(Math.max(0, Math.round(shown))) : '--';
    if (g.compact) {
      readoutText(ctx, f, str, g.cx, g.cy + g.r * 0.5, 50, d.hub.text);
      label(
        ctx,
        this.props.unitLabel,
        g.cx,
        g.cy - g.r * 0.32,
        16,
        f.theme.fonts.primary,
        d.hub.textSecondary,
        'center',
      );
      return;
    }
    readoutText(ctx, f, str, g.cx, g.cy + 44, 128, d.hub.text);
    this.drawSetSpeed(ctx, f, g);
  }

  /**
   * Cruise/ACC/limiter in the speedometer: set speed with the system's symbol
   * in the gap, a marker on the scale, and (ACC) the distance graphic in the hub.
   */
  private drawSetSpeed(ctx: CanvasRenderingContext2D, f: FrameContext, g: Geometry): void {
    const look = assistLook(f);
    const k = this.setFade.update(look !== null, f.dt);
    if (k <= 0.01) return;
    if (look) this.lastLook = look;
    const l = this.lastLook;
    if (!l) return;
    const t = f.theme;
    const y = g.cy + g.r * GAP.status;
    ctx.globalAlpha = k;
    drawIcon(ctx, l.icon, g.cx - 34, y - 6, 22, l.color, t.fonts.primary);
    ctx.font = font(500, 22, t.fonts.primary);
    ctx.fillStyle = l.color;
    ctx.textBaseline = 'alphabetic';
    tabular(ctx, l.setText, g.cx - 18, y + 2, 'left');
    if (l.setKmh > 0) this.drawSetMarker(ctx, f, g, l.setKmh, l.color);
    drawAccDistance(ctx, f, l, g.cx, g.cy + g.hub * 0.86);
    ctx.globalAlpha = 1;
  }

  /** Small triangle on the scale at the set speed, pointing at the numerals. */
  private drawSetMarker(
    ctx: CanvasRenderingContext2D,
    f: FrameContext,
    g: Geometry,
    kmh: number,
    color: string,
  ): void {
    const d = f.theme.dial;
    const deg = this.deg(clamp(this.frac(kmh), 0, 1), d);
    const [x0, y0] = polar(g.cx, g.cy, g.bandOuter + 1, deg - 2.2);
    const [x1, y1] = polar(g.cx, g.cy, g.bandOuter + 1, deg + 2.2);
    const [x2, y2] = polar(g.cx, g.cy, g.bandOuter - 13, deg);
    for (const c of f.emissive && color !== f.theme.text.tertiary ? [ctx, f.emissive] : [ctx]) {
      c.fillStyle = color;
      c.beginPath();
      c.moveTo(x0, y0);
      c.lineTo(x1, y1);
      c.lineTo(x2, y2);
      c.closePath();
      c.fill();
    }
  }

  private drawGear(ctx: CanvasRenderingContext2D, f: FrameContext, g: Geometry): void {
    const t = f.theme;
    const d = t.dial;
    const st = f.store;
    const { cx, cy, r } = g;

    // READY fades in with the engine. Start-stop: green "auto stop" while the
    // engine is off at a stop, a grey crossed symbol when it can't stop.
    const ss = st.value(S.StartStopState, 1);
    const autoStopped = ss === 2 || ss === 4;
    const running = !st.has(S.EngineRunning) || st.value(S.EngineRunning) > 0 || autoStopped;
    const auto = !st.has(S.SelectedGear) || st.value(S.SelectedGear) === 127;
    const ready = this.readyFade.update(running && f.runtime.phase === 'on', f.dt);
    const statusY = cy + r * (g.compact ? 0.66 : GAP.status);
    ctx.globalAlpha = ready * 0.9;
    if (autoStopped && !g.compact) {
      const col = ss === 4 ? SAFETY_COLORS.caution : SAFETY_COLORS.info;
      drawIcon(ctx, 'startStop', cx - 40, statusY - 5, 20, col, t.fonts.primary);
      label(ctx, 'Auto stop', cx - 26, statusY, 14, t.fonts.primary, col);
    } else {
      label(ctx, 'Ready', cx, statusY, 14, t.fonts.primary, SAFETY_COLORS.info, 'center');
      if (ss === 3 && !g.compact)
        drawIcon(ctx, 'startStopOff', cx + 50, statusY - 5, 18, t.text.tertiary, t.fonts.primary);
    }
    // Hybrids: "EV" while the engine is off.
    if (!g.compact && st.has(S.PowerDemand) && st.has(S.EngineRunning) && !running) {
      label(
        ctx,
        'EV',
        cx + 54,
        cy + r * GAP.status,
        14,
        t.fonts.primary,
        SAFETY_COLORS.info,
        'center',
      );
    }
    // Driving mode in the gap, tinted with the mode's accent.
    ctx.globalAlpha = ready;
    if (!g.compact && st.has(S.DriveMode)) {
      const mode = st.value(S.DriveMode);
      label(
        ctx,
        modeLabel(mode),
        cx,
        cy + r * GAP.mode,
        15,
        t.fonts.primary,
        modeAccent(mode) ?? t.text.secondary,
        'center',
      );
    }
    ctx.globalAlpha = 1;

    const gearY = g.compact ? cy + r * 0.5 : cy + 38;
    const big = g.compact ? 54 : 108;
    const selected = st.has(S.SelectedGear) ? st.value(S.SelectedGear) : 127;
    const gear = st.has(S.Gear) ? Math.round(st.value(S.Gear)) : null;
    // Selector positions P/R/N show alone.
    const position =
      selected === 126
        ? 'P'
        : selected < 0 || (gear !== null && gear < 0)
          ? 'R'
          : selected === 0
            ? 'N'
            : null;
    if (position) {
      readoutText(ctx, f, position, cx, gearY, big, d.hub.text);
      return;
    }
    const programIdx = st.has(S.GearboxMode) ? st.value(S.GearboxMode) : auto ? 0 : 2;
    const program = ['D', 'S', 'M', 'E', 'B'][programIdx] ?? 'D';
    // Single-speed (EV) or unknown gear: the selector letter alone; EVs add the regen level.
    if (gear === null || st.has(S.RegenLevel)) {
      readoutText(ctx, f, programIdx === 4 ? 'B' : auto ? 'D' : 'M', cx, gearY, big, d.hub.text);
      if (st.has(S.RegenLevel) && programIdx !== 4) this.drawRegen(ctx, f, cx, gearY + 26);
      return;
    }
    // Eco coasting: the clutch is open, so no gear number, only the program letter.
    if (st.value(S.Coasting) > 0) {
      readoutText(ctx, f, program, cx, gearY, big, d.hub.text);
      return;
    }
    readoutText(ctx, f, String(gear), cx + big * 0.13, gearY, big, d.hub.text);
    text(ctx, program, cx - big * 0.43, gearY - big * 0.46, {
      font: font(500, Math.round(big * 0.31), t.fonts.primary),
      color: d.hub.textSecondary,
      align: 'center',
    });

    // Gear advice (manual gear selection): arrow and the gear to choose.
    const advice = st.has(S.GearAdvice)
      ? st.value(S.GearAdvice)
      : st.value(S.ShiftRequest) > 0
        ? 1
        : 0;
    if (advice > 0) {
      const up = advice === 1;
      const ax = cx + big * 0.62;
      const ay = gearY - big * 0.52;
      ctx.fillStyle = t.text.primary;
      ctx.beginPath();
      if (up) {
        ctx.moveTo(ax, ay - 12);
        ctx.lineTo(ax + 10, ay);
        ctx.lineTo(ax - 10, ay);
      } else {
        ctx.moveTo(ax, ay + 12);
        ctx.lineTo(ax + 10, ay);
        ctx.lineTo(ax - 10, ay);
      }
      ctx.closePath();
      ctx.fill();
      if (st.has(S.RecommendedGear))
        label(
          ctx,
          String(st.value(S.RecommendedGear)),
          ax + 16,
          ay + 7,
          20,
          t.fonts.primary,
          t.text.primary,
        );
    }
  }

  /** EV lift-off regeneration level: four short bars, lit up to the level (0 = sailing). */
  private drawRegen(ctx: CanvasRenderingContext2D, f: FrameContext, cx: number, y: number): void {
    const level = Math.round(f.store.value(S.RegenLevel));
    const t = f.theme;
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < level ? SAFETY_COLORS.info : t.text.tertiary;
      ctx.globalAlpha = i < level ? 1 : 0.35;
      ctx.beginPath();
      ctx.roundRect(cx - 27 + i * 19, y, 16, 5, 2.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

/**
 * EV/hybrid power meter in place of the tachometer: the needle rests at 0 a
 * quarter of the way round, swings left into CHARGE while regenerating and
 * right through ECO into POWER.
 */
export const powerMeter: WidgetFactory<Partial<RoundDialProps>> = {
  type: 'power-meter',
  requires: () => [S.PowerDemand],
  create: (rect, props) =>
    new RoundDial(rect, {
      signal: S.PowerDemand,
      min: -100,
      max: 100,
      majorStep: 20,
      map: [
        [-100, 0],
        [0, 0.24],
        [100, 1],
      ],
      numeralValues: [0, 20, 40, 60, 80, 100],
      zones: [
        { from: -100, to: 0, color: 'rgba(60,207,142,0.26)', label: 'CHARGE', labelAt: -50 },
        { from: 0, to: 30, color: 'rgba(120,190,255,0.14)', label: 'ECO', labelAt: 10 },
        { from: 30, to: 100, color: 'rgba(0,0,0,0)', label: 'POWER', labelAt: 90 },
      ],
      unitLabel: '% power',
      center: 'gear',
      ...props,
    }),
};
