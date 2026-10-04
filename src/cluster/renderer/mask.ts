import type { DisplayMask } from '../layouts/types';
import { LOGICAL_HEIGHT as H, LOGICAL_WIDTH as W } from './types';

const SAMPLES = 48;

/**
 * Polygon outline of the display mask, optionally shrunk by `shrink` px. Edges are
 * sampled quadratic arches; corner softness comes from the vignette blur.
 */
export function maskPolygon(m: DisplayMask, shrink = 0): [number, number][] {
  const i = m.inset + shrink;
  const top = i;
  const bottom = H - i;
  const tl: [number, number] = [i + m.taper, top + m.topArch];
  const tr: [number, number] = [W - i - m.taper, top + m.topArch];
  const br: [number, number] = [W - i, bottom];
  const bl: [number, number] = [i, bottom];
  const pts: [number, number][] = [];
  // Top arch: corners at topArch, centre at `top`.
  for (let k = 0; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    const x = tl[0] + (tr[0] - tl[0]) * t;
    const u = 2 * t - 1;
    pts.push([x, top + m.topArch * u * u]);
  }
  // Right side down, then the lower-right chamfer.
  const c = m.bottomChamfer ?? 0;
  if (c > 0) pts.push([br[0], bottom - c * 1.6]);
  // Bottom arch: centre raised by bottomArch, corners pulled in by the chamfer.
  for (let k = 0; k <= SAMPLES; k++) {
    const t = k / SAMPLES;
    const x = br[0] - c + (bl[0] + c - (br[0] - c)) * t;
    const u = 2 * t - 1;
    pts.push([x, bottom - m.bottomArch * (1 - u * u)]);
  }
  if (c > 0) pts.push([bl[0], bottom - c * 1.6]);
  return pts;
}

export function maskPath(m: DisplayMask, shrink = 0): Path2D {
  const p = new Path2D();
  maskPolygon(m, shrink).forEach(([x, y], k) => (k === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
  p.closePath();
  return p;
}
