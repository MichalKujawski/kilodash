/**
 * Older browsers (Safari < 16, Firefox < 112) lack canvas `roundRect`, which
 * the cluster uses everywhere. This adds it, built from arcs. Only the first
 * radius is honoured, which is all the cluster passes.
 */
type RoundRectTarget = {
  moveTo(x: number, y: number): void;
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number): void;
  closePath(): void;
};

export function roundRectPath(
  p: RoundRectTarget,
  x: number,
  y: number,
  w: number,
  h: number,
  radii: number | DOMPointInit | (number | DOMPointInit)[] = 0,
): void {
  const first = Array.isArray(radii) ? (radii[0] ?? 0) : radii;
  const r0 = typeof first === 'number' ? first : (first.x ?? 0);
  const r = Math.max(0, Math.min(r0, Math.abs(w) / 2, Math.abs(h) / 2));
  p.moveTo(x + r, y);
  p.arcTo(x + w, y, x + w, y + h, r);
  p.arcTo(x + w, y + h, x, y + h, r);
  p.arcTo(x, y + h, x, y, r);
  p.arcTo(x, y, x + w, y, r);
  p.closePath();
}

export function installCanvasPolyfills(): void {
  for (const proto of [
    globalThis.CanvasRenderingContext2D?.prototype,
    globalThis.Path2D?.prototype,
  ]) {
    if (proto && !('roundRect' in proto)) {
      Object.defineProperty(proto, 'roundRect', {
        value(
          this: RoundRectTarget,
          x: number,
          y: number,
          w: number,
          h: number,
          r?: number | number[],
        ) {
          roundRectPath(this, x, y, w, h, r);
        },
        configurable: true,
        writable: true,
      });
    }
  }
}

/** Can this browser run the cluster at all? (2D canvas, animation frames, resize observer.) */
export function canRunCluster(): boolean {
  try {
    return (
      typeof requestAnimationFrame === 'function' &&
      typeof ResizeObserver === 'function' &&
      !!document.createElement('canvas').getContext('2d')
    );
  } catch {
    return false;
  }
}
