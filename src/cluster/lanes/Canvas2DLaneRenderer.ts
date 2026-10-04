import { clamp } from '@/core/math';
import type { LineState } from '@/core/assist/LaneAssist';
import type { Rect } from '../renderer/types';
import type { Theme } from '../themes/types';
import { SAFETY_COLORS } from '../themes/types';
import type { LaneLine, LaneObject, LaneSceneRenderer, LaneViewModel } from './types';
import { VIEW_RANGE } from './buildLaneView';

/** Chase camera: behind our front bumper, height, focal length (px), horizon (fraction of height). */
const CAM = { back: 13.1, height: 5.9, focal: 520, horizon: 0.2 };
const NEAR_Z = -8;

interface Size {
  w: number;
  h: number;
}
const SIZES: Record<string, Size> = {
  car: { w: 1.8, h: 1.45 },
  van: { w: 2.0, h: 2.2 },
  truck: { w: 2.55, h: 3.6 },
};

/**
 * Lane view drawn with Canvas 2D: a perspective road from a chase camera,
 * bending with the real road ahead, lane lines coloured by the lane assist,
 * traffic as shaded boxes, our car at the bottom. Swappable for a WebGL
 * renderer through `LaneSceneRenderer`.
 */
export class Canvas2DLaneRenderer implements LaneSceneRenderer {
  private bend: number[] = [];
  private rect: Rect = { x: 0, y: 0, w: 0, h: 0 };

  draw(
    ctx: CanvasRenderingContext2D,
    m: LaneViewModel,
    rect: Rect,
    theme: Theme,
    now: number,
  ): void {
    this.rect = rect;
    this.computeBend(m);
    this.drawSurface(ctx, m);
    for (const line of m.lines) this.drawLine(ctx, m, line, now);
    this.drawBlindSpots(ctx, m, now);
    const objs = [...m.objects].sort((a, b) => b.z - a.z);
    for (const o of objs) if (o.z > 0) this.drawVehicle(ctx, m, o, theme, false);
    this.drawVehicle(
      ctx,
      m,
      {
        id: -1,
        kind: 'car',
        x: -m.lat,
        z: -4.6,
        length: 4.6,
        braking: false,
        oncoming: false,
        target: false,
        danger: false,
      },
      theme,
      true,
    );
    // Cars beside us are drawn over our car only if they are nearer the camera.
    for (const o of objs) if (o.z <= 0) this.drawVehicle(ctx, m, o, theme, false);
  }

  /** Amber zones in the next lanes beside our car (blind-spot monitoring). */
  private drawBlindSpots(ctx: CanvasRenderingContext2D, m: LaneViewModel, now: number): void {
    for (const [state, side] of [
      [m.blindSpot.left, -1],
      [m.blindSpot.right, 1],
    ] as const) {
      if (state === 0) continue;
      if (state === 2 && Math.floor(now / 180) % 2 === 1) continue;
      const centre = m.laneCentre + side * 3.5;
      const g = state === 2 ? 'rgba(255,176,0,0.42)' : 'rgba(255,176,0,0.22)';
      this.strip(ctx, m, centre - 1.5, centre + 1.5, -12, 2, 0, g);
    }
  }

  /** Lateral shift of the road centre at distance z from the bends ahead, m (+ = right). */
  private computeBend(m: LaneViewModel): void {
    this.bend = [0];
    let heading = 0;
    let x = 0;
    for (let i = 0; i < m.curvature.length - 1; i++) {
      heading += m.curvature[i]! * m.step;
      x += heading * m.step;
      this.bend.push(x);
    }
  }

  private bendAt(m: LaneViewModel, z: number): number {
    if (z <= 0) return 0;
    const i = z / m.step;
    const i0 = Math.floor(i);
    const a = this.bend[Math.min(i0, this.bend.length - 1)] ?? 0;
    const b = this.bend[Math.min(i0 + 1, this.bend.length - 1)] ?? a;
    return a + (b - a) * (i - i0);
  }

  /** Project a road point (x m right of our lane centre, height y m, z m ahead) to the screen. */
  private project(m: LaneViewModel, x: number, y: number, z: number): [number, number, number] {
    const r = this.rect;
    const Z = Math.max(0.5, z + CAM.back);
    const X = x + m.lat + this.bendAt(m, z);
    const k = CAM.focal / Z;
    return [r.x + r.w / 2 + X * k, r.y + r.h * CAM.horizon + (CAM.height - y) * k, k];
  }

  private drawSurface(ctx: CanvasRenderingContext2D, m: LaneViewModel): void {
    const r = this.rect;
    const pts: [number, number][] = [];
    const back: [number, number][] = [];
    for (let z = NEAR_Z; z <= VIEW_RANGE; z += 4) {
      const [lx, ly] = this.project(m, m.surface.left - 0.5, 0, z);
      const [rx, ry] = this.project(m, m.surface.right + 0.5, 0, z);
      pts.push([lx, ly]);
      back.push([rx, ry]);
    }
    const g = ctx.createLinearGradient(0, r.y + r.h * CAM.horizon, 0, r.y + r.h);
    g.addColorStop(0, 'rgba(40,46,56,0)');
    g.addColorStop(0.25, 'rgba(40,46,56,0.35)');
    g.addColorStop(1, 'rgba(52,58,70,0.75)');
    ctx.fillStyle = g;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    for (let i = back.length - 1; i >= 0; i--) ctx.lineTo(back[i]![0], back[i]![1]);
    ctx.closePath();
    ctx.fill();
    if (m.assisted) {
      // Our lane, tinted while assisted driving steers.
      ctx.fillStyle = 'rgba(34,211,107,0.10)';
      ctx.beginPath();
      for (let z = NEAR_Z; z <= 90; z += 4) {
        const [x, y] = this.project(m, m.laneCentre - 1.75, 0, z);
        if (z === NEAR_Z) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      for (let z = 90; z >= NEAR_Z; z -= 4) {
        const [x, y] = this.project(m, m.laneCentre + 1.75, 0, z);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private lineColor(state: LineState, now: number): string {
    switch (state) {
      case 'assisting':
        return SAFETY_COLORS.info;
      case 'departure':
        return Math.floor(now / 160) % 2 === 0 ? SAFETY_COLORS.caution : 'rgba(255,176,0,0.25)';
      case 'none':
        return 'rgba(150,158,170,0.35)';
      default:
        return 'rgba(232,236,242,0.9)';
    }
  }

  /** A painted line as perspective quads; dashes move with the distance driven. */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    m: LaneViewModel,
    l: LaneLine,
    now: number,
  ): void {
    const color = this.lineColor(l.state, now);
    if (l.style === 'barrier') {
      this.strip(
        ctx,
        m,
        l.offset - 0.1,
        l.offset + 0.1,
        NEAR_Z,
        VIEW_RANGE,
        0.75,
        'rgba(120,128,140,0.55)',
      );
      this.strip(ctx, m, l.offset + 0.35, l.offset + 0.5, NEAR_Z, VIEW_RANGE, 0, color);
      return;
    }
    const half = l.style === 'kerb' ? 0.1 : 0.08;
    const lineColor = l.style === 'kerb' ? 'rgba(170,176,186,0.45)' : color;
    if (l.style !== 'dashed') {
      this.strip(ctx, m, l.offset - half, l.offset + half, NEAR_Z, VIEW_RANGE, 0, lineColor);
      return;
    }
    const [on, off] = l.dash;
    const period = on + off;
    const phase = ((m.s % period) + period) % period;
    for (let z0 = NEAR_Z - phase; z0 < VIEW_RANGE; z0 += period) {
      const a = Math.max(NEAR_Z, z0);
      const b = Math.min(VIEW_RANGE, z0 + on);
      if (b > a) this.strip(ctx, m, l.offset - half, l.offset + half, a, b, 0, lineColor);
    }
  }

  /** Ground strip (or a low wall when `height` > 0) between two lateral offsets, from z0 to z1. */
  private strip(
    ctx: CanvasRenderingContext2D,
    m: LaneViewModel,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    height: number,
    color: string,
  ): void {
    const stepZ = 3;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let z = z0; ; z = Math.min(z1, z + stepZ)) {
      const fade = clamp(1 - (z - 70) / 70, 0, 1);
      if (fade <= 0) break;
      const p0 = this.project(m, x0, height, z);
      const p1 = this.project(m, height > 0 ? x0 : x1, 0, z);
      left.push([p0[0], p0[1]]);
      right.push([p1[0], p1[1]]);
      if (z >= z1) break;
    }
    if (left.length < 2) return;
    ctx.fillStyle = color;
    ctx.globalAlpha = 1;
    ctx.beginPath();
    left.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i]![0], right[i]![1]);
    ctx.closePath();
    ctx.fill();
  }

  /** One shaded box: visible side, top, then the rear face (window band on cabins). */
  private box(
    ctx: CanvasRenderingContext2D,
    P: Project,
    hw: number,
    top: number,
    near: number,
    far: number,
    sideX: number,
    shade: (k: number) => string,
    bottom = 0,
  ): void {
    quad(
      ctx,
      P(sideX, bottom, near),
      P(sideX, top, near),
      P(sideX, top, far),
      P(sideX, bottom, far),
      shade(0.45),
    );
    quad(ctx, P(-hw, top, near), P(hw, top, near), P(hw, top, far), P(-hw, top, far), shade(0.08));
    const bl = P(-hw, bottom, near);
    const tr = P(hw, top, near);
    const w = tr[0] - bl[0];
    const h = bl[1] - tr[1];
    const g = ctx.createLinearGradient(0, tr[1], 0, bl[1]);
    g.addColorStop(0, shade(0.15));
    g.addColorStop(1, shade(0.38));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(bl[0], tr[1], w, h, Math.min(w, h) * 0.15);
    ctx.fill();
    if (bottom > 0) {
      // Rear window.
      ctx.fillStyle = shade(0.72);
      ctx.beginPath();
      ctx.roundRect(bl[0] + w * 0.08, tr[1] + h * 0.14, w * 0.84, h * 0.66, Math.min(w, h) * 0.12);
      ctx.fill();
    }
  }

  /** A vehicle as shaded boxes: visible side, roof, then the rear (or front) face. */
  private drawVehicle(
    ctx: CanvasRenderingContext2D,
    m: LaneViewModel,
    o: LaneObject,
    theme: Theme,
    ego: boolean,
  ): void {
    const size = SIZES[o.kind] ?? SIZES.car!;
    const near = o.z;
    const far = o.z + o.length;
    if (near > VIEW_RANGE) return;
    const fade = ego ? 1 : clamp(1 - (near - 80) / 60, 0, 1);
    if (fade <= 0) return;
    const hw = size.w / 2;
    const P = (x: number, y: number, z: number): [number, number] => {
      const p = this.project(m, o.x + x, y, z);
      return [p[0], p[1]];
    };
    const base = ego ? '#c9d0da' : o.danger ? '#e2493c' : o.target ? '#9fd8b6' : '#7d8794';
    const shade = (k: number): string => mix(base, '#0b0d10', k);
    ctx.globalAlpha = fade;
    if (o.target && !ego) {
      // Ground bracket under the car ACC is following.
      const a = P(-hw - 0.3, 0, near - 0.6);
      const b = P(hw + 0.3, 0, near - 0.6);
      ctx.strokeStyle = SAFETY_COLORS.info;
      ctx.lineWidth = Math.max(1.5, (b[0] - a[0]) * 0.05);
      ctx.beginPath();
      ctx.moveTo(a[0], a[1] - 4);
      ctx.lineTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.lineTo(b[0], b[1] - 4);
      ctx.stroke();
    }
    const sideX = o.x + m.lat + this.bendAt(m, near) > 0 ? -hw : hw;
    if (o.kind === 'truck' || o.kind === 'van') {
      this.box(ctx, P, hw, size.h, near, far, sideX, shade);
    } else {
      // Car: a lower body with a narrower, shorter cabin on top.
      const body = size.h * 0.55;
      this.box(ctx, P, hw, body, near, far, sideX, shade);
      const cw = hw * 0.8;
      this.box(
        ctx,
        P,
        cw,
        size.h,
        near + o.length * 0.22,
        far - o.length * 0.3,
        sideX > 0 ? cw : -cw,
        shade,
        body,
      );
    }
    // Lights on the rear (or, oncoming, the front) face.
    const bl = P(-hw, 0, near);
    const tr = P(hw, size.h * 0.55, near);
    const w = tr[0] - bl[0];
    const h = bl[1] - tr[1];
    if (o.oncoming) {
      ctx.fillStyle = 'rgba(255,250,235,0.95)';
      for (const fx of [0.06, 0.76])
        ctx.fillRect(bl[0] + w * fx, tr[1] + h * 0.3, w * 0.18, h * 0.18);
    } else {
      ctx.fillStyle = o.braking ? '#ff3a2a' : '#8a1c16';
      for (const fx of [0.03, 0.79])
        ctx.fillRect(bl[0] + w * fx, tr[1] + h * 0.22, w * 0.18, h * 0.2);
    }
    ctx.globalAlpha = 1;
    void theme;
  }
}

type Project = (x: number, y: number, z: number) => [number, number];

function quad(
  ctx: CanvasRenderingContext2D,
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
  ctx.fill();
}

/** Mix two #rrggbb colours (k = 0 → a, 1 → b). */
function mix(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number): number => (p >> s) & 255;
  const c = (s: number): number => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
