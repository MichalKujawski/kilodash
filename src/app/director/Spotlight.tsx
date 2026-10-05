import type { CSSProperties } from 'react';
import type { DirectorState } from './Director';

/** Cluster coordinate space (the classic layout is 1920×720). */
const W = 1920;
const H = 720;

/**
 * Spotlight: when a caption talks about something on the cluster, the rest
 * dims slightly and a soft ring marks it, for under 2 s. Pure CSS over the
 * display (no canvas work); keyed by caption, so each one plays once. Off with
 * `?spotlight=0` and for visitors who prefer reduced motion.
 */
export function Spotlight({ state }: { state: DirectorState | null }) {
  const c = state?.caption;
  if (!c?.spotlight || !state) return null;
  const [x, y, r, delay = 0] = c.spotlight;
  const style = {
    '--sx': `${(x / W) * 100}%`,
    '--sy': `${(y / H) * 100}%`,
    '--sr': `${(r / W) * 100}cqw`,
    animationDelay: `${delay}s`,
  } as CSSProperties;
  return (
    <div key={`${state.chapter.id}-${c.t0}`} className="spotlight" style={style} aria-hidden />
  );
}
