import type { SignalStore } from '@/core/signals/store';
import type { Theme } from '../themes/types';
import { noGlow } from './draw';
import {
  LOGICAL_HEIGHT,
  LOGICAL_WIDTH,
  type FrameContext,
  type StaticContext,
  type Widget,
} from './types';

export interface RendererOptions {
  lowPower?: boolean;
  /** Called about twice a second with the measured frame rate. */
  onFps?: (fps: number) => void;
}

/**
 * Owns the cluster canvas and the requestAnimationFrame loop. Vehicle data is read
 * straight from the SignalStore each frame; React is never involved in a frame.
 *
 * Layers: (1) a cached static layer with background, dial faces and ticks, re-rendered
 * only when the theme, layout or size changes; (2) dynamic widget drawing per frame.
 */
export class ClusterRenderer {
  private ctx: CanvasRenderingContext2D;
  private staticLayer: HTMLCanvasElement;
  private staticDirty = true;
  private widgets: Widget[] = [];
  private raf = 0;
  private lastFrame = 0;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private dpr = 1;
  private resizeObserver: ResizeObserver;
  private fpsFrames = 0;
  private fpsSince = 0;
  lowPower: boolean;

  constructor(
    private canvas: HTMLCanvasElement,
    private store: SignalStore,
    private theme: Theme,
    private options: RendererOptions = {},
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D not supported');
    this.ctx = ctx;
    this.lowPower = options.lowPower ?? false;
    this.staticLayer = document.createElement('canvas');
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    // Canvas text uses web fonts only once they are loaded; redraw static text then.
    void document.fonts?.ready.then(() => this.invalidate());
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.invalidate();
    void this.loadFonts(theme);
  }

  setWidgets(widgets: Widget[]): void {
    this.widgets = widgets;
    this.invalidate();
  }

  invalidate(): void {
    this.staticDirty = true;
  }

  start(): void {
    if (this.raf) return;
    this.lastFrame = performance.now();
    this.fpsSince = this.lastFrame;
    const loop = (now: number): void => {
      this.raf = requestAnimationFrame(loop);
      this.frame(now);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  destroy(): void {
    this.stop();
    this.resizeObserver.disconnect();
  }

  private async loadFonts(theme: Theme): Promise<void> {
    if (!document.fonts) return;
    const families = [theme.fonts.numeral, theme.fonts.ui, theme.fonts.digital];
    await Promise.allSettled(families.map((f) => document.fonts.load(`600 32px ${f}`)));
    this.invalidate();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1 : 3);
    const w = Math.max(1, Math.round(rect.width * this.dpr));
    const h = Math.max(1, Math.round(rect.height * this.dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // Letterbox the logical 1920×720 surface into whatever box we were given.
    this.scale = Math.min(w / LOGICAL_WIDTH, h / LOGICAL_HEIGHT);
    this.offsetX = (w - LOGICAL_WIDTH * this.scale) / 2;
    this.offsetY = (h - LOGICAL_HEIGHT * this.scale) / 2;
    this.staticLayer.width = Math.ceil(LOGICAL_WIDTH * this.scale);
    this.staticLayer.height = Math.ceil(LOGICAL_HEIGHT * this.scale);
    this.invalidate();
  }

  private renderStatic(): void {
    const ctx = this.staticLayer.getContext('2d');
    if (!ctx) return;
    const t = this.theme;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = t.colors.background;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    // Soft light pools behind the two dial positions and a faint horizon line.
    for (const cx of [380, 1540, 960]) {
      const g = ctx.createRadialGradient(cx, 360, 0, cx, 360, cx === 960 ? 520 : 420);
      g.addColorStop(0, t.colors.backgroundGlow);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    const sc: StaticContext = { theme: t, pxScale: this.scale, lowPower: this.lowPower };
    for (const w of this.widgets) {
      if (!w.drawStatic) continue;
      ctx.save();
      w.drawStatic(ctx, sc);
      ctx.restore();
      noGlow(ctx);
    }
    this.staticDirty = false;
  }

  private frame(now: number): void {
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    if (this.staticDirty) this.renderStatic();

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = this.theme.colors.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.staticLayer, this.offsetX, this.offsetY);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    const frame: FrameContext = {
      now,
      dt,
      store: this.store,
      theme: this.theme,
      pxScale: this.scale,
      lowPower: this.lowPower,
    };
    for (const w of this.widgets) {
      ctx.save();
      w.draw(ctx, frame);
      ctx.restore();
    }
    noGlow(ctx);

    this.fpsFrames++;
    if (now - this.fpsSince >= 500) {
      this.options.onFps?.((this.fpsFrames * 1000) / (now - this.fpsSince));
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  }
}
