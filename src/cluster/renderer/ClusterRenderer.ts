import { Flasher } from '@/core/alerts/flasher';
import { S } from '@/core/signals/catalog';
import type { SignalStore } from '@/core/signals/store';
import type { LayoutDefinition } from '../layouts/types';
import type { Theme } from '../themes/types';
import { maskPath, maskPolygon } from './mask';
import {
  LOGICAL_HEIGHT as H,
  LOGICAL_WIDTH as W,
  type ClusterKey,
  type FrameContext,
  type StaticContext,
  type Widget,
} from './types';

export interface RendererOptions {
  lowPower?: boolean;
  /** Draw the glass reflection layer (dev toggle). */
  glass?: boolean;
  /** Called about twice a second with the measured frame rate. */
  onFps?: (fps: number, frameMs: number) => void;
}

/** Emissive layer resolution relative to the main canvas; low res = cheap, soft bloom. */
const BLOOM_SCALE = 0.25;

function canvas2d(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not supported');
  return [c, ctx];
}

/**
 * Owns the cluster canvas and the requestAnimationFrame loop. Vehicle data is read
 * straight from the SignalStore each frame; React is never involved in a frame.
 *
 * Composition per frame:
 *  1. static layer (background glows, dial faces, ticks) — cached
 *  2. breathing ambient glow
 *  3. widgets (dynamic), which also paint emissive shapes into the bloom layer
 *  4. bloom: emissive layer blurred and added
 *  5. glass reflection + dither noise — cached, optional parallax offset
 *  6. display mask: true black outside, soft vignette edge — cached
 */
export class ClusterRenderer {
  private ctx: CanvasRenderingContext2D;
  private staticLayer: [HTMLCanvasElement, CanvasRenderingContext2D];
  private overlayLayer: [HTMLCanvasElement, CanvasRenderingContext2D];
  private glassLayer: [HTMLCanvasElement, CanvasRenderingContext2D];
  private mergedLayer: [HTMLCanvasElement, CanvasRenderingContext2D];
  private emissive: [HTMLCanvasElement, CanvasRenderingContext2D];
  private bloomBlur: [HTMLCanvasElement, CanvasRenderingContext2D];
  private staticDirty = true;
  private widgets: Widget[] = [];
  private layout: LayoutDefinition | null = null;
  private raf = 0;
  private lastFrame = 0;
  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private resizeObserver: ResizeObserver;
  private fpsFrames = 0;
  private fpsSince = 0;
  private glassOffset = { x: 0, y: 0 };
  private breathT = 0;
  readonly flasher = new Flasher();
  lowPower: boolean;
  glass: boolean;
  /** Global brightness multiplier (night mode dims the display). */
  brightness = 1;
  decorativeMotion = true;
  /** When set, per-phase CPU times (ms, averaged) are collected here. */
  profile: Record<string, number> | null = null;
  /** Exponential average of CPU time spent per frame, ms. */
  frameMs = 0;

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
    this.glass = options.glass ?? true;
    this.staticLayer = canvas2d();
    this.overlayLayer = canvas2d();
    this.glassLayer = canvas2d();
    this.mergedLayer = canvas2d();
    this.emissive = canvas2d();
    this.bloomBlur = canvas2d();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
    // Canvas text uses web fonts only once they are loaded; redraw static text then.
    void document.fonts?.ready.then(() => this.invalidate());
    void this.loadFonts(theme);
  }

  setTheme(theme: Theme): void {
    this.theme = theme;
    this.invalidate();
    void this.loadFonts(theme);
  }

  setLayout(layout: LayoutDefinition, widgets: Widget[]): void {
    this.layout = layout;
    this.widgets = widgets;
    this.invalidate();
  }

  setLowPower(on: boolean): void {
    this.lowPower = on;
    this.resize();
  }

  setGlass(on: boolean): void {
    this.glass = on;
    this.invalidate();
  }

  /** Parallax offset of the glass reflection, logical px (keep within a few px). */
  setGlassOffset(x: number, y: number): void {
    this.glassOffset = { x, y };
  }

  /** Route a steering-wheel key to the first widget that consumes it. */
  input(key: ClusterKey): boolean {
    for (const w of this.widgets) if (w.onInput?.(key)) return true;
    return false;
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
    const families = [theme.fonts.primary, theme.fonts.numerals];
    const loads = families.flatMap((f) =>
      [400, 500, 600].map((w) => document.fonts.load(`${w} 32px ${f}`)),
    );
    await Promise.allSettled(loads);
    this.invalidate();
  }

  private resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.lowPower ? 1 : 3);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // Letterbox the logical 1920×720 surface into whatever box we were given.
    this.scale = Math.min(w / W, h / H);
    this.offsetX = (w - W * this.scale) / 2;
    this.offsetY = (h - H * this.scale) / 2;
    const lw = Math.ceil(W * this.scale);
    const lh = Math.ceil(H * this.scale);
    for (const [c] of [this.staticLayer, this.overlayLayer, this.glassLayer, this.mergedLayer]) {
      c.width = lw;
      c.height = lh;
    }
    for (const [c] of [this.emissive, this.bloomBlur]) {
      c.width = Math.max(1, Math.ceil(lw * BLOOM_SCALE));
      c.height = Math.max(1, Math.ceil(lh * BLOOM_SCALE));
    }
    this.invalidate();
  }

  private renderStatic(): void {
    const [, ctx] = this.staticLayer;
    const t = this.theme;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = t.background;
    ctx.fillRect(0, 0, W, H);
    for (const g of this.layout?.ambient ?? []) this.paintAmbient(ctx, g.x, g.y, g.r, 1);

    const sc: StaticContext = { theme: t, pxScale: this.scale, lowPower: this.lowPower };
    for (const w of this.widgets) {
      if (!w.drawStatic) continue;
      ctx.save();
      w.drawStatic(ctx, sc);
      ctx.restore();
    }
    this.renderOverlay();
    const [mc, mctx] = this.mergedLayer;
    mctx.setTransform(1, 0, 0, 1, 0, 0);
    mctx.clearRect(0, 0, mc.width, mc.height);
    if (this.glass && !this.lowPower) mctx.drawImage(this.glassLayer[0], 0, 0);
    mctx.drawImage(this.overlayLayer[0], 0, 0);
    this.staticDirty = false;
  }

  private paintAmbient(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    r: number,
    alpha: number,
  ): void {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, this.theme.effects.ambient);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  /** Mask (true black outside, soft fade inside the edge), glass reflection and dither. */
  private renderOverlay(): void {
    const [, ctx] = this.overlayLayer;
    const [gc, gctx] = this.glassLayer;
    const fx = this.theme.effects;
    for (const [cv, cx] of [this.overlayLayer, this.glassLayer]) {
      cx.setTransform(1, 0, 0, 1, 0, 0);
      cx.clearRect(0, 0, cv.width, cv.height);
    }
    if (!this.layout) return;
    const mask = this.layout.mask;

    // 1. Black everywhere, then punch out the mask with a blurred edge.
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const blur = fx.vignette / 2;
    const supportsFilter = 'filter' in ctx && !this.lowPower;
    if (supportsFilter) ctx.filter = `blur(${blur * this.scale}px)`;
    ctx.fill(maskPath(mask, supportsFilter ? blur : 0));
    ctx.filter = 'none';
    ctx.globalCompositeOperation = 'source-over';

    if (!this.glass || this.lowPower) return;

    // 2. Glass: faint diagonal reflection and a top-edge highlight.
    gctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    const refl = gctx.createLinearGradient(0, 0, W * 0.55, H * 1.1);
    refl.addColorStop(0, `rgba(255,255,255,${fx.glass})`);
    refl.addColorStop(0.32, 'rgba(255,255,255,0)');
    refl.addColorStop(0.58, 'rgba(255,255,255,0)');
    refl.addColorStop(0.64, `rgba(255,255,255,${fx.glass * 0.45})`);
    refl.addColorStop(0.7, 'rgba(255,255,255,0)');
    gctx.fillStyle = refl;
    gctx.fillRect(0, 0, W, H);

    const top = maskPolygon(mask, fx.vignette * 0.55).slice(0, 49);
    const edge = gctx.createLinearGradient(top[0]![0], 0, top[top.length - 1]![0], 0);
    edge.addColorStop(0, 'rgba(255,255,255,0)');
    edge.addColorStop(0.5, `rgba(255,255,255,${fx.glass * 1.6})`);
    edge.addColorStop(1, 'rgba(255,255,255,0)');
    gctx.strokeStyle = edge;
    gctx.lineWidth = 1.2;
    gctx.beginPath();
    top.forEach(([x, y], k) => (k === 0 ? gctx.moveTo(x, y) : gctx.lineTo(x, y)));
    gctx.stroke();

    // 3. Dither: tiny luminance noise breaks up gradient banding.
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    const pattern = gctx.createPattern(noiseTile(), 'repeat');
    if (pattern) {
      gctx.globalAlpha = fx.dither;
      gctx.fillStyle = pattern;
      gctx.fillRect(0, 0, gc.width, gc.height);
      gctx.globalAlpha = 1;
    }
  }

  private frame(now: number): void {
    const t0 = performance.now();
    this.drawFrame(now);
    this.frameMs += (performance.now() - t0 - this.frameMs) * 0.05;
  }

  private markT = 0;

  private mark(phase: string): void {
    if (!this.profile) return;
    const t = performance.now();
    this.profile[phase] = (this.profile[phase] ?? 0) * 0.95 + (t - this.markT) * 0.05;
    this.markT = t;
  }

  private drawFrame(now: number): void {
    this.markT = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    if (this.staticDirty) this.renderStatic();

    const ctx = this.ctx;
    const theme = this.theme;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.drawImage(this.staticLayer[0], this.offsetX, this.offsetY);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.offsetX, this.offsetY);

    // Ambient glow breathes gently while parked; paused while driving.
    const idle = this.store.value(S.Speed) < 1 && this.decorativeMotion;
    if (idle) this.breathT += dt;
    const breath = Math.sin(this.breathT * 0.9) * theme.effects.ambientBreath;
    if (breath !== 0) {
      for (const g of this.layout?.ambient ?? []) {
        if (breath > 0) this.paintAmbient(ctx, g.x, g.y, g.r, breath * 4);
      }
    }

    const bloomOn = !this.lowPower && theme.effects.bloom > 0;
    const [ec, ectx] = this.emissive;
    if (bloomOn) {
      ectx.setTransform(1, 0, 0, 1, 0, 0);
      ectx.clearRect(0, 0, ec.width, ec.height);
      const s = this.scale * BLOOM_SCALE;
      ectx.setTransform(s, 0, 0, s, 0, 0);
    }

    const frame: FrameContext = {
      now,
      dt,
      store: this.store,
      theme,
      pxScale: this.scale,
      lowPower: this.lowPower,
      emissive: bloomOn ? ectx : null,
      decorativeMotion: this.decorativeMotion,
      flasher: this.flasher,
    };
    this.mark('base');
    for (const w of this.widgets) {
      ctx.save();
      if (bloomOn) ectx.save();
      w.draw(ctx, frame);
      ctx.restore();
      if (bloomOn) ectx.restore();
      this.mark(w.constructor.name);
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (bloomOn) {
      const [bc, bctx] = this.bloomBlur;
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.clearRect(0, 0, bc.width, bc.height);
      bctx.filter = `blur(${Math.max(1, theme.effects.bloomRadius * this.scale * BLOOM_SCALE * 0.5)}px)`;
      bctx.drawImage(ec, 0, 0);
      bctx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = theme.effects.bloom;
      ctx.drawImage(bc, this.offsetX, this.offsetY, W * this.scale, H * this.scale);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    this.mark('bloom');
    if (this.brightness < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - this.brightness})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Glass moves with parallax under a fixed display mask; without parallax the
    // pre-merged layer saves one full-screen composite.
    const o = this.glassOffset;
    if (o.x === 0 && o.y === 0) {
      ctx.drawImage(this.mergedLayer[0], this.offsetX, this.offsetY);
    } else {
      if (this.glass && !this.lowPower) {
        ctx.drawImage(
          this.glassLayer[0],
          this.offsetX + o.x * this.scale,
          this.offsetY + o.y * this.scale,
        );
      }
      ctx.drawImage(this.overlayLayer[0], this.offsetX, this.offsetY);
    }
    this.mark('overlay');

    this.fpsFrames++;
    if (now - this.fpsSince >= 500) {
      this.options.onFps?.((this.fpsFrames * 1000) / (now - this.fpsSince), this.frameMs);
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  }
}

let noise: HTMLCanvasElement | undefined;

/** 128×128 tile of random black/white pixels used for dithering. */
function noiseTile(): HTMLCanvasElement {
  if (noise) return noise;
  const [c, ctx] = canvas2d();
  c.width = c.height = 128;
  const img = ctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.floor(Math.random() * 255);
  }
  ctx.putImageData(img, 0, 0);
  noise = c;
  return c;
}
