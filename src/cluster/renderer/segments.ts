/**
 * Procedural 7-segment display digits (Retro LCD theme). Unlit segments are drawn
 * in a "ghost" colour like a real LCD.
 *
 *   aaa
 *  f   b
 *   ggg
 *  e   c
 *   ddd
 */
const MAP: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
  P: 'abefg',
  R: 'eg',
  N: 'ceg',
  D: 'bcdeg',
  E: 'adefg',
  F: 'aefg',
  H: 'bcefg',
  C: 'adef',
  L: 'def',
  A: 'abcefg',
  U: 'bcdef',
};

export function canSegment(str: string): boolean {
  return [...str.toUpperCase()].every((ch) => ch in MAP || ch === '.');
}

function segmentPath(
  ctx: CanvasRenderingContext2D,
  seg: string,
  x: number,
  y: number,
  w: number,
  h: number,
  t: number,
): void {
  const half = h / 2;
  const g = t * 0.18; // gap between segments
  const hseg = (sx: number, sy: number): void => {
    ctx.moveTo(sx + g + t / 2, sy);
    ctx.lineTo(sx + g + t, sy - t / 2);
    ctx.lineTo(sx + w - g - t, sy - t / 2);
    ctx.lineTo(sx + w - g - t / 2, sy);
    ctx.lineTo(sx + w - g - t, sy + t / 2);
    ctx.lineTo(sx + g + t, sy + t / 2);
    ctx.closePath();
  };
  const vseg = (sx: number, sy: number, len: number): void => {
    ctx.moveTo(sx, sy + g + t / 2);
    ctx.lineTo(sx + t / 2, sy + g + t);
    ctx.lineTo(sx + t / 2, sy + len - g - t);
    ctx.lineTo(sx, sy + len - g - t / 2);
    ctx.lineTo(sx - t / 2, sy + len - g - t);
    ctx.lineTo(sx - t / 2, sy + g + t);
    ctx.closePath();
  };
  const top = y - h;
  switch (seg) {
    case 'a':
      return hseg(x, top + t / 2);
    case 'g':
      return hseg(x, top + half);
    case 'd':
      return hseg(x, y - t / 2);
    case 'f':
      return vseg(x + t / 2, top + t / 2, half - t / 2);
    case 'b':
      return vseg(x + w - t / 2, top + t / 2, half - t / 2);
    case 'e':
      return vseg(x + t / 2, top + half, half - t / 2);
    case 'c':
      return vseg(x + w - t / 2, top + half, half - t / 2);
  }
}

/**
 * Draw `str` as 7-segment digits with the baseline at `y` and cap height `h`.
 * Returns the total width.
 */
export function drawSegments(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  h: number,
  color: string,
  ghost: string,
  align: 'left' | 'center' | 'right' = 'left',
  emissive?: CanvasRenderingContext2D | null,
): number {
  const w = h * 0.52;
  const gap = h * 0.16;
  const t = h * 0.11;
  const chars = [...str.toUpperCase()];
  const total = chars.length * w + (chars.length - 1) * gap;
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  ctx.save();
  // Slight forward slant, as on real LCD glass.
  ctx.transform(1, 0, -0.08, 1, y * 0.08, 0);
  for (const ch of chars) {
    const on = MAP[ch] ?? '';
    for (const seg of 'abcdefg') {
      const lit = on.includes(seg);
      ctx.fillStyle = lit ? color : ghost;
      ctx.beginPath();
      segmentPath(ctx, seg, cx, y, w, h, t);
      ctx.fill();
      if (lit && emissive) {
        emissive.save();
        emissive.transform(1, 0, -0.08, 1, y * 0.08, 0);
        emissive.fillStyle = color;
        emissive.beginPath();
        segmentPath(emissive, seg, cx, y, w, h, t);
        emissive.fill();
        emissive.restore();
      }
    }
    cx += w + gap;
  }
  ctx.restore();
  return total;
}
