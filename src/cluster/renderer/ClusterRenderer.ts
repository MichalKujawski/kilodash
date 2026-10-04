import { modeAccent } from '../widgets/driveMode';
import type { AlertEngine } from '@/core/alerts/AlertEngine';
import { Flasher } from '@/core/alerts/flasher';
import type { ConsumptionHistory } from '@/core/derived/ConsumptionHistory';
import type { SceneSnapshot } from '@/core/world/scene';
import { S } from '@/core/signals/catalog';
import type { SignalStore } from '@/core/signals/store';
import type { LayoutDefinition } from '../layouts/types';
import { THEME_BY_ID } from '../themes';
import { ensureThemeFonts } from '../themes/fonts';
import type { Theme } from '../themes/types';
import { AnimatedBackdrop, paintStaticBackdrop } from './backdrop';
import { AlertPopup } from '../widgets/system/AlertPopup';
import { StartupOverlay } from '../widgets/system/StartupOverlay';
import { StartupSequence } from './startup';
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
  onFps?: (fps: number, frameMs: number, droppedFrames: number) => void;
  /** Share a flasher so audio ticks stay in phase with the arrows. */
  flasher?: Flasher;
  alerts?: AlertEngine | null;
  history?: ConsumptionHistory | null;
  scene?: () => SceneSnapshot | null;
}

export type NightMode = 'auto' | 'on' | 'off';

/** Display brightness at night (dimmed to avoid glare). */
const NIGHT_BRIGHTNESS = 0.68;
const THEME_FADE_S = 0.7;

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
 *  3. content widgets (dynamic), which also paint emissive shapes into the bloom
 *     layer; faded by the ignition choreography
 *  4. overlay widgets (telltales, start-up logo, alert popups) at full strength
 *  5. bloom: emissive layer blurred and added; night dimming
 *  6. glass reflection + dither noise — cached, optional parallax offset
 *  7. display mask: true black outside, soft vignette edge — cached
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
  /** Frames since the last report that took longer than 1.5 vsync intervals. */
  private dropped = 0;
  private fpsSince = 0;
  private glassOffset = { x: 0, y: 0 };
  private breathT = 0;
  readonly flasher: Flasher;
  readonly startup = new StartupSequence();
  /** Shared UI state between widgets (centre page etc.). */
  readonly ui = { centerPage: 'map' };
  private baseTheme: Theme;
  private fadeLayer: [HTMLCanvasElement, CanvasRenderingContext2D];
  /** Seconds into a theme cross-fade; Infinity when idle. */
  private fadeT = Infinity;
  private backdrop = new AnimatedBackdrop();
  private onFontsLoaded: (() => void) | null = null;
  alerts: AlertEngine | null;
  private system: Widget[] = [];
  nightMode: NightMode = 'auto';
  /** User brightness setting 0.3..1. */
  userBrightness = 1;
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
    this.flasher = options.flasher ?? new Flasher();
    this.alerts = options.alerts ?? null;
    this.baseTheme = theme;
    this.fadeLayer = canvas2d();
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
    // Canvas text uses web fonts only once they are loaded; redraw static text whenever
    // any font finishes loading (theme fonts load on demand).
    void document.fonts?.ready.then(() => this.invalidate());
    this.onFontsLoaded = () => this.invalidate();
    document.fonts?.addEventListener('loadingdone', this.onFontsLoaded);
    void this.loadFonts(theme);
  }

  /** Switch theme with an animated cross-fade (no flicker: the old frame fades out over the new). */
  setTheme(theme: Theme, animate = true): void {
    this.baseTheme = theme;
    this.applyTheme(this.effectiveTheme(), animate);
  }

  get currentTheme(): Theme {
    return this.theme;
  }

  private effectiveTheme(): Theme {
    const night = this.isNight();
    const variant =
      night && this.baseTheme.nightVariant
        ? THEME_BY_ID.get(this.baseTheme.nightVariant)
        : undefined;
    return variant ?? this.baseTheme;
  }

  private applyTheme(theme: Theme, animate: boolean): void {
    if (theme === this.theme) return;
    if (animate && this.canvas.width > 1 && this.raf) {
      const [c, ctx] = this.fadeLayer;
      c.width = this.canvas.width;
      c.height = this.canvas.height;
      ctx.drawImage(this.canvas, 0, 0);
      this.fadeT = 0;
    }
    this.theme = theme;
    this.invalidate();
    void this.loadFonts(theme);
  }

  setLayout(layout: LayoutDefinition, widgets: Widget[]): void {
    this.layout = layout;
    this.widgets = widgets;
    this.system = [new StartupOverlay(), new AlertPopup(layout.alertRect)];
    this.invalidate();
  }

  cycleNightMode(): NightMode {
    this.nightMode = this.nightMode === 'auto' ? 'on' : this.nightMode === 'on' ? 'off' : 'auto';
    return this.nightMode;
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
    for (const w of [...this.system, ...this.widgets]) if (w.onInput?.(key)) return true;
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
    if (this.onFontsLoaded) document.fonts?.removeEventListener('loadingdone', this.onFontsLoaded);
  }

  private async loadFonts(theme: Theme): Promise<void> {
    await ensureThemeFonts(theme);
    if (theme === this.theme) this.invalidate();
  }

  private isNight(): boolean {
    const dark = this.store.has(S.LightIntensity) && this.store.value(S.LightIntensity) < 20;
    return this.nightMode === 'on' || (this.nightMode === 'auto' && dark);
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
    ctx.clearRect(0, 0, W, H);
    // Animated backdrops are painted per frame underneath this layer.
    if (!this.backdrop.isAnimated(t)) paintStaticBackdrop(ctx, t);
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
    color = this.theme.effects.ambient,
  ): void {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
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
  private shakeT = 0;
  private lastFcw = 0;

  /** Content offset for the acute-warning jolt: a 0.4 s decaying shake, px. */
  private shake(dt: number): [number, number] {
    const fcw = this.store.value(S.FcwState);
    if (fcw === 4 && this.lastFcw !== 4) this.shakeT = 0.4;
    this.lastFcw = fcw;
    if (this.shakeT <= 0) return [0, 0];
    this.shakeT -= dt;
    const k = Math.max(0, this.shakeT / 0.4) * 5;
    const t = this.shakeT * 70;
    return [Math.sin(t) * k, Math.cos(t * 1.3) * k * 0.6];
  }
  private modeTint = { color: '', k: 0 };

  /**
   * Driving-mode accent: a faint glow of the mode's colour behind the dials
   * (green in Eco, red in Sport…) that cross-fades over about half a second.
   */
  private paintModeTint(ctx: CanvasRenderingContext2D, dt: number): void {
    const accent = this.store.has(S.DriveMode) ? modeAccent(this.store.value(S.DriveMode)) : null;
    const tint = this.modeTint;
    if (accent && tint.k < 0.02) tint.color = accent;
    const target = accent && accent === tint.color ? 1 : 0;
    tint.k += Math.sign(target - tint.k) * Math.min(Math.abs(target - tint.k), dt * 2);
    if (tint.k <= 0.01 || !tint.color) return;
    for (const g of (this.layout?.ambient ?? []).slice(0, 2)) {
      this.paintAmbient(ctx, g.x, g.y + g.r * 0.35, g.r * 0.85, tint.k * 0.1, tint.color);
    }
  }

  private mark(phase: string): void {
    if (!this.profile) return;
    const t = performance.now();
    this.profile[phase] = (this.profile[phase] ?? 0) * 0.95 + (t - this.markT) * 0.05;
    this.markT = t;
  }

  private drawFrame(now: number): void {
    this.markT = performance.now();
    const interval = now - this.lastFrame;
    if (interval > 25 && this.fpsFrames > 0) this.dropped++;
    const dt = Math.min(interval / 1000, 0.1);
    this.lastFrame = now;
    // Light themes hand over to their night variant when it gets dark.
    this.applyTheme(this.effectiveTheme(), true);
    if (this.staticDirty) this.renderStatic();
    // Acute collision warning: the picture jolts briefly (the glass and mask stay put).
    const [sx, sy] = this.shake(dt);
    const ox = this.offsetX + sx * this.scale;
    const oy = this.offsetY + sy * this.scale;

    const ctx = this.ctx;
    const theme = this.theme;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (this.backdrop.isAnimated(theme)) {
      // Animated backdrop sits under the static layer, which is then drawn with
      // its background cut away (see renderStatic).
      ctx.setTransform(this.scale, 0, 0, this.scale, ox, oy);
      paintStaticBackdrop(ctx, theme);
      this.backdrop.draw(ctx, theme, dt, this.store.value(S.Speed), this.decorativeMotion);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    ctx.drawImage(this.staticLayer[0], ox, oy);
    ctx.setTransform(this.scale, 0, 0, this.scale, ox, oy);

    // Ambient glow breathes gently while parked; paused while driving.
    const idle = this.store.value(S.Speed) < 1 && this.decorativeMotion;
    if (idle) this.breathT += dt;
    const breath = Math.sin(this.breathT * 0.9) * theme.effects.ambientBreath;
    if (breath !== 0) {
      for (const g of this.layout?.ambient ?? []) {
        if (breath > 0) this.paintAmbient(ctx, g.x, g.y, g.r, breath * 4);
      }
    }

    this.paintModeTint(ctx, dt);

    const bloomOn = !this.lowPower && theme.effects.bloom > 0;
    const [ec, ectx] = this.emissive;
    if (bloomOn) {
      ectx.setTransform(1, 0, 0, 1, 0, 0);
      ectx.clearRect(0, 0, ec.width, ec.height);
      const s = this.scale * BLOOM_SCALE;
      ectx.setTransform(s, 0, 0, s, 0, 0);
    }

    // Rear-left bulb failure: the left indicator flashes at double rate.
    this.flasher.setFast('indicatorLeft', this.store.value(S.BulbFailure) > 0);
    const runtime = this.startup.update(this.store, dt);
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
      runtime,
      alerts: this.alerts,
      history: this.options.history ?? null,
      scene: this.options.scene?.() ?? null,
      ui: this.ui,
    };
    this.mark('base');
    const drawAll = (list: Widget[]): void => {
      for (const w of list) {
        ctx.save();
        if (bloomOn) ectx.save();
        w.draw(ctx, frame);
        ctx.restore();
        if (bloomOn) ectx.restore();
        this.mark(w.constructor.name);
      }
    };
    drawAll(this.widgets.filter((w) => w.layer !== 'overlay'));

    // Ignition choreography: fade the content (and its glow) without touching overlays.
    if (runtime.contentAlpha < 1) {
      const k = 1 - runtime.contentAlpha;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(0,0,0,${k})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.restore();
      if (bloomOn) {
        ectx.save();
        ectx.setTransform(1, 0, 0, 1, 0, 0);
        ectx.globalCompositeOperation = 'destination-out';
        ectx.fillStyle = `rgba(0,0,0,${k})`;
        ectx.fillRect(0, 0, ec.width, ec.height);
        ectx.restore();
      }
    }
    drawAll([...this.widgets.filter((w) => w.layer === 'overlay'), ...this.system]);

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
      ctx.drawImage(bc, ox, oy, W * this.scale, H * this.scale);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    this.mark('bloom');
    const targetBrightness = (this.isNight() ? NIGHT_BRIGHTNESS : 1) * this.userBrightness;
    this.brightness += (targetBrightness - this.brightness) * Math.min(1, dt * 1.5);
    if (this.brightness < 0.999) {
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

    // Theme cross-fade: the previous look dissolves over the new one.
    if (this.fadeT < THEME_FADE_S) {
      this.fadeT += dt;
      const k = Math.min(1, this.fadeT / THEME_FADE_S);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - k * k * (3 - 2 * k);
      ctx.drawImage(this.fadeLayer[0], 0, 0);
      ctx.globalAlpha = 1;
    }

    this.fpsFrames++;
    if (now - this.fpsSince >= 500) {
      this.options.onFps?.(
        (this.fpsFrames * 1000) / (now - this.fpsSince),
        this.frameMs,
        this.dropped,
      );
      this.fpsFrames = 0;
      this.dropped = 0;
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
