export const DEG = Math.PI / 180;

/** Point on a circle; angle in degrees, 0 = 3 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = deg * DEG;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

export function font(weight: number, sizePx: number, family: string): string {
  return `${weight} ${sizePx}px ${family}`;
}

/** Fill an annular sector between radii, angles in degrees. */
export function annulus(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r0: number,
  r1: number,
  a0: number,
  a1: number,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r1, a0 * DEG, a1 * DEG);
  ctx.arc(cx, cy, r0, a1 * DEG, a0 * DEG, true);
  ctx.closePath();
}

type Spaced = CanvasRenderingContext2D & { letterSpacing?: string };

export interface TextStyle {
  font: string;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  /** Letter spacing in px (labels use +6–10%). */
  spacing?: number;
}

export function text(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  s: TextStyle,
): void {
  ctx.font = s.font;
  ctx.fillStyle = s.color;
  ctx.textAlign = s.align ?? 'left';
  ctx.textBaseline = s.baseline ?? 'alphabetic';
  const sc = ctx as Spaced;
  if (s.spacing && 'letterSpacing' in sc) sc.letterSpacing = `${s.spacing}px`;
  ctx.fillText(str, x, y);
  if (s.spacing && 'letterSpacing' in sc) sc.letterSpacing = '0px';
}

/** Small-caps style label: uppercase, tracked, reduced opacity. */
export function label(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  size: number,
  family: string,
  color: string,
  align: CanvasTextAlign = 'left',
): void {
  text(ctx, str.toUpperCase(), x, y, {
    font: font(500, size, family),
    color,
    align,
    spacing: size * 0.08,
  });
}

/**
 * Draw digits in fixed-width cells so numbers don't jitter as they change
 * (canvas has no tabular-nums). Returns the drawn width.
 */
export function tabular(
  ctx: CanvasRenderingContext2D,
  str: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right' = 'left',
): number {
  const cell = ctx.measureText('0').width;
  const widths = [...str].map((ch) => (ch >= '0' && ch <= '9' ? cell : ctx.measureText(ch).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  ctx.textAlign = 'center';
  [...str].forEach((ch, i) => {
    const w = widths[i]!;
    ctx.fillText(ch, cx + w / 2, y);
    cx += w;
  });
  return total;
}

/** Linear fade helper for appear/disappear animations. */
export class Fade {
  value = 0;

  constructor(private speed = 6) {}

  update(target: boolean, dt: number): number {
    const goal = target ? 1 : 0;
    const step = dt * this.speed;
    this.value =
      this.value < goal ? Math.min(goal, this.value + step) : Math.max(goal, this.value - step);
    return this.value;
  }
}
