import { Spring } from '@/core/smoothing/spring';
import type { ClusterKey, FrameContext, Rect, Widget, WidgetFactory } from '../../renderer/types';
import { CarPage } from './CarPage';
import { EfficiencyPage } from './EfficiencyPage';
import { MapPage } from './MapPage';
import { TripPage } from './TripPage';
import type { CenterPage } from './types';

export type PageId = 'map' | 'car' | 'trip' | 'efficiency';

const PAGE_FACTORIES: Record<PageId, () => CenterPage> = {
  map: () => new MapPage(),
  car: () => new CarPage(),
  trip: () => new TripPage(),
  efficiency: () => new EfficiencyPage(),
};

export interface CarouselProps {
  pages: PageId[];
  /** Fraction of width faded at the left and right edges (content bleeds under the dials). */
  edgeFade?: number;
  /** Circles (logical coords) the page must not cover, e.g. dial faces drawn underneath. */
  cutouts?: { cx: number; cy: number; r: number }[];
}

/**
 * Centre content zone: pages switched with steering-wheel left/right, sliding
 * horizontally, with soft edges so content appears to sit behind the dials.
 */
export class Carousel implements Widget {
  private pages: CenterPage[];
  private index = 0;
  private pos = new Spring(0, { stiffness: 70, damping: 16 });
  private buffer: HTMLCanvasElement | null = null;
  private bctx: CanvasRenderingContext2D | null = null;
  private mask: HTMLCanvasElement | null = null;

  constructor(
    readonly rect: Rect,
    private props: CarouselProps,
  ) {
    this.pages = props.pages.map((id) => PAGE_FACTORIES[id]());
  }

  get currentPage(): string {
    return this.pages[this.index]?.id ?? '';
  }

  onInput(key: ClusterKey): boolean {
    if (key !== 'left' && key !== 'right') return false;
    this.index = (this.index + (key === 'right' ? 1 : -1) + this.pages.length) % this.pages.length;
    // Take the short way around when wrapping.
    const n = this.pages.length;
    if (Math.abs(this.index - this.pos.value) > n / 2)
      this.pos.snap(this.pos.value + (key === 'right' ? -n : n));
    return true;
  }

  private ensureBuffer(pxScale: number): CanvasRenderingContext2D | null {
    const w = Math.ceil(this.rect.w * pxScale);
    const h = Math.ceil(this.rect.h * pxScale);
    if (!this.buffer) {
      this.buffer = document.createElement('canvas');
      this.bctx = this.buffer.getContext('2d');
    }
    if (this.buffer.width !== w || this.buffer.height !== h) {
      this.buffer.width = w;
      this.buffer.height = h;
    }
    return this.bctx;
  }

  /**
   * Alpha mask: horizontal fade (content bleeds under the dials), vertical fade,
   * and soft holes where dial faces sit. Rebuilt only on resize.
   */
  private ensureMask(pxScale: number): HTMLCanvasElement | null {
    const { x, y, w, h } = this.rect;
    const pw = Math.ceil(w * pxScale);
    const ph = Math.ceil(h * pxScale);
    if (this.mask && this.mask.width === pw && this.mask.height === ph) return this.mask;
    const m = this.mask ?? document.createElement('canvas');
    m.width = pw;
    m.height = ph;
    const c = m.getContext('2d');
    if (!c) return null;
    c.setTransform(pxScale, 0, 0, pxScale, 0, 0);
    const fade = this.props.edgeFade ?? 0.2;
    const gx = c.createLinearGradient(0, 0, w, 0);
    gx.addColorStop(0, 'rgba(0,0,0,0)');
    gx.addColorStop(fade, 'rgba(0,0,0,1)');
    gx.addColorStop(1 - fade, 'rgba(0,0,0,1)');
    gx.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gx;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = 'destination-in';
    const gy = c.createLinearGradient(0, 0, 0, h);
    gy.addColorStop(0, 'rgba(0,0,0,0)');
    gy.addColorStop(0.08, 'rgba(0,0,0,1)');
    gy.addColorStop(0.9, 'rgba(0,0,0,1)');
    gy.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = gy;
    c.fillRect(0, 0, w, h);
    // Keep dial faces (static layer, below us) visible.
    c.globalCompositeOperation = 'destination-out';
    for (const cut of this.props.cutouts ?? []) {
      const lx = cut.cx - x;
      const ly = cut.cy - y;
      const g = c.createRadialGradient(lx, ly, cut.r - 6, lx, ly, cut.r + 10);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(lx - cut.r - 12, ly - cut.r - 12, cut.r * 2 + 24, cut.r * 2 + 24);
    }
    this.mask = m;
    return m;
  }

  draw(ctx: CanvasRenderingContext2D, f: FrameContext): void {
    const { x, y, w, h } = this.rect;
    for (const p of this.pages) p.update?.(f);

    const b = this.ensureBuffer(f.pxScale);
    if (!b || !this.buffer) return;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.clearRect(0, 0, this.buffer.width, this.buffer.height);
    b.setTransform(f.pxScale, 0, 0, f.pxScale, 0, 0);

    const pos = this.pos.update(this.index, f.dt);
    const n = this.pages.length;
    const base = Math.floor(pos);
    for (const k of [base, base + 1]) {
      const offset = (k - pos) * w;
      if (Math.abs(offset) >= w) continue;
      const page = this.pages[((k % n) + n) % n]!;
      b.save();
      b.translate(offset, 0);
      b.beginPath();
      b.rect(0, 0, w, h);
      b.clip();
      page.draw(b, f, w, h);
      b.restore();
    }

    // Soft edges and dial cutouts in a single pass with a precomputed alpha mask.
    const mask = this.ensureMask(f.pxScale);
    if (mask) {
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.globalCompositeOperation = 'destination-in';
      b.drawImage(mask, 0, 0);
      b.globalCompositeOperation = 'source-over';
    }

    // Make room for the start-up logo.
    ctx.globalAlpha = 1 - f.runtime.logoAlpha;
    ctx.drawImage(this.buffer, x, y, w, h);
    ctx.globalAlpha = 1;

    // Page indicator dots.
    const t = f.theme;
    const active = ((Math.round(pos) % n) + n) % n;
    const dotsW = (n - 1) * 16;
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i === active ? t.text.primary : t.text.tertiary;
      ctx.beginPath();
      ctx.arc(x + w / 2 - dotsW / 2 + i * 16, y + h + 8, i === active ? 3.5 : 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const carousel: WidgetFactory<CarouselProps> = {
  type: 'carousel',
  requires: () => [],
  create: (rect, props) => new Carousel(rect, props),
};
