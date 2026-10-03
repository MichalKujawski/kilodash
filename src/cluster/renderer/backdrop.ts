import { createRng } from '@/core/math';
import type { Theme } from '../themes/types';
import { LOGICAL_HEIGHT as H, LOGICAL_WIDTH as W } from './types';

let carbon: HTMLCanvasElement | undefined;

/** Procedural carbon-fibre twill tile. */
function carbonTile(dark: string, light: string): HTMLCanvasElement {
  if (carbon) return carbon;
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = dark;
  ctx.fillRect(0, 0, 16, 16);
  for (const [x, y, horizontal] of [
    [0, 0, true],
    [8, 8, true],
    [8, 0, false],
    [0, 8, false],
  ] as const) {
    const g = horizontal
      ? ctx.createLinearGradient(x, y, x, y + 8)
      : ctx.createLinearGradient(x, y, x + 8, y);
    g.addColorStop(0, dark);
    g.addColorStop(0.5, light);
    g.addColorStop(1, dark);
    ctx.fillStyle = g;
    ctx.fillRect(x + 0.5, y + 0.5, 7, 7);
  }
  carbon = c;
  return c;
}

/** Static backdrops, painted into the cached layer. */
export function paintStaticBackdrop(ctx: CanvasRenderingContext2D, t: Theme): void {
  const b = t.backdrop;
  ctx.fillStyle = t.background;
  ctx.fillRect(0, 0, W, H);
  if (b.kind === 'gradient' && b.colors.length >= 2) {
    const g = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, W * 0.7);
    b.colors.forEach((c, i) => g.addColorStop(i / (b.colors.length - 1), c));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else if (b.kind === 'carbon') {
    const p = ctx.createPattern(
      carbonTile(b.colors[0] ?? '#0b0b0c', b.colors[1] ?? '#18181a'),
      'repeat',
    );
    if (p) {
      ctx.fillStyle = p;
      ctx.fillRect(0, 0, W, H);
    }
    // Light falloff so the weave reads as a surface.
    const v = ctx.createRadialGradient(W / 2, H * 0.3, 100, W / 2, H * 0.4, W * 0.65);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);
  } else if (b.kind === 'grid') {
    // Sky gradient behind the animated grid.
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.background);
    g.addColorStop(0.55, b.colors[2] ?? t.background);
    g.addColorStop(1, t.background);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
}

const HORIZON = 360;

interface Particle {
  x: number;
  y: number;
  r: number;
  v: number;
  phase: number;
}

/** Animated backdrops (synthwave grid, drifting particles), painted every frame. */
export class AnimatedBackdrop {
  private distance = 0;
  private t = 0;
  private particles: Particle[];

  constructor() {
    const rng = createRng(11);
    this.particles = Array.from({ length: 46 }, () => ({
      x: rng() * W,
      y: rng() * H,
      r: 0.8 + rng() * 2.2,
      v: 4 + rng() * 10,
      phase: rng() * Math.PI * 2,
    }));
  }

  isAnimated(t: Theme): boolean {
    return t.backdrop.kind === 'grid' || t.backdrop.kind === 'particles';
  }

  draw(
    ctx: CanvasRenderingContext2D,
    t: Theme,
    dt: number,
    speedKmh: number,
    motion: boolean,
  ): void {
    const b = t.backdrop;
    if (motion) this.t += dt;
    if (b.kind === 'grid') {
      this.distance += (speedKmh / 3.6) * dt;
      const line = b.colors[0] ?? 'rgba(255,43,214,0.5)';
      const glow = b.colors[1] ?? 'rgba(0,229,255,0.35)';
      const vx = W / 2;
      // Horizon glow.
      const hg = ctx.createLinearGradient(0, HORIZON - 60, 0, HORIZON + 10);
      hg.addColorStop(0, 'rgba(0,0,0,0)');
      hg.addColorStop(1, glow);
      ctx.fillStyle = hg;
      ctx.fillRect(0, HORIZON - 60, W, 70);
      ctx.strokeStyle = line;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Converging lines.
      for (let k = -14; k <= 14; k++) {
        ctx.moveTo(vx + k * 18, HORIZON);
        ctx.lineTo(vx + k * 260, H);
      }
      // Cross lines moving towards the viewer with the car's speed.
      const spacing = 12;
      const offset = (this.distance % spacing) / spacing;
      for (let i = 0; i < 14; i++) {
        const z = 1 + (i + 1 - offset) * 1.6; // depth units
        const y = HORIZON + (H - HORIZON) * (1.6 / z);
        if (y > H || y < HORIZON) continue;
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
      }
      ctx.stroke();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, HORIZON);
      ctx.lineTo(W, HORIZON);
      ctx.stroke();
    } else if (b.kind === 'particles') {
      for (const p of this.particles) {
        const y = (((p.y - this.t * p.v) % H) + H) % H;
        const a = 0.25 + 0.25 * Math.sin(this.t * 0.8 + p.phase);
        ctx.globalAlpha = a;
        ctx.fillStyle = b.colors[p.r > 2 ? 1 : 0] ?? '#2ee6a6';
        ctx.beginPath();
        ctx.arc(p.x + Math.sin(this.t * 0.3 + p.phase) * 12, y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}
