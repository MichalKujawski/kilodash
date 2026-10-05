import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MODES } from '@/core/drive/modes';
import { DRIVE_MODE_ORDER } from '@/core/drive/modes';
import { S } from '@/core/signals/catalog';
import type { ClusterSession } from '../session';
import { usePoll } from '../useSignal';

/** Glow colour behind the display when the mode has no accent of its own. */
const NEUTRAL = '110, 140, 190';

function rgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

interface Props {
  session: ClusterSession | null;
  cluster: ReactNode;
  /** Captions / control dock / engineer panels under the display. */
  children?: ReactNode;
  compact?: boolean;
  /** Width reserved on the right for a side panel (Engineer on wide screens), px. */
  side?: number;
}

/** Margin kept between the display and a side panel, px. */
const SIDE_GAP = 64;

/**
 * Make room for a side panel by scaling and shifting the display with a
 * transform: no layout change, so the cluster canvas is never resized
 * (resizing it rebuilds its caches and costs frames).
 */
function useSideFit(side: number) {
  const display = useRef<HTMLDivElement>(null);
  // Display size from a ResizeObserver (transforms don't change it): reading
  // offsetWidth here would force a full layout just as a side panel mounts.
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [vw, setVw] = useState(() => window.innerWidth);
  useEffect(() => {
    const el = display.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setBox({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    const resize = (): void => setVw(window.innerWidth);
    window.addEventListener('resize', resize);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, []);
  const k = side > 0 && box.w > 0 ? Math.min(1, (vw - side - SIDE_GAP) / box.w) : 1;
  const fit = { k, dx: k < 1 || side > 0 ? -side / 2 : 0, dy: -(1 - k) * box.h };
  return { display, fit, vw };
}

/**
 * The first screen: near-black room, a soft glow behind the display tinted by
 * the driving-mode accent, a moulded hood over the display, display edges that
 * fade into black and a faint reflection below. The bottom slot changes with
 * the site mode; the display itself never moves between Watch and Drive.
 */
export function Stage({ session, cluster, children, compact, side = 0 }: Props) {
  usePoll(4);
  const { display, fit, vw } = useSideFit(side);
  const mode = session?.store.has(S.DriveMode)
    ? DRIVE_MODE_ORDER[Math.round(session.store.value(S.DriveMode))]
    : undefined;
  const accent = mode ? MODES[mode].params.accent : null;
  const glow = accent ? rgb(accent) : NEUTRAL;
  return (
    <section
      className={`stage ${compact ? 'is-compact' : ''}`}
      style={{
        ['--glow' as string]: glow,
        ['--fit-k' as string]: fit.k,
        ['--fit-dx' as string]: `${fit.dx}px`,
        ['--fit-dy' as string]: `${fit.dy}px`,
        // The bottom slot (captions, dock) fits the space left of the side panel.
        ['--fit-w' as string]: side > 0 ? `${Math.max(320, vw - side - SIDE_GAP)}px` : 'var(--w)',
      }}
    >
      <div className="stage-glow" aria-hidden />
      <div className="display" ref={display}>
        <svg className="hood" viewBox="0 0 1600 140" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="hood-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#16191e" />
              <stop offset="0.55" stopColor="#0b0c0f" />
              <stop offset="1" stopColor="#050607" />
            </linearGradient>
            <linearGradient id="hood-lip" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="rgba(255,255,255,0)" />
              <stop offset="0.5" stopColor="rgba(255,255,255,0.16)" />
              <stop offset="1" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
          </defs>
          <path
            d="M0 140 C 80 40, 260 8, 800 8 C 1340 8, 1520 40, 1600 140 Z"
            fill="url(#hood-fill)"
          />
          <path
            d="M40 112 C 120 36, 300 10, 800 10 C 1300 10, 1480 36, 1560 112"
            fill="none"
            stroke="url(#hood-lip)"
            strokeWidth="1.5"
          />
        </svg>
        <div className="screen">{cluster}</div>
        <div className="screen-shade" aria-hidden />
        <div className="reflection" aria-hidden />
      </div>
      <div className="bottom-slot">{children}</div>
    </section>
  );
}
