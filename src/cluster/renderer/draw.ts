export const DEG = Math.PI / 180;

/** Point on a circle; angle in degrees, 0 = 3 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = deg * DEG;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Apply a glow (canvas shadow). Blur is in device pixels, so scale it. */
export function glow(
  ctx: CanvasRenderingContext2D,
  color: string,
  blur: number,
  pxScale: number,
): void {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur * pxScale;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

export function noGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
}

export function font(weight: number, sizePx: number, family: string): string {
  return `${weight} ${sizePx}px ${family}`;
}
