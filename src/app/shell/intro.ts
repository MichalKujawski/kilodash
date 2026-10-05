import { useCallback, useEffect, useState } from 'react';

/**
 * First-visit intro, ≤ 4 s: black → the hood lights up → the display wakes
 * with the start-up sweep → header and captions fade in → Watch.
 */
export type IntroPhase = 'dark' | 'hood' | 'display' | 'chrome' | 'done';

/** Phase start times, ms (the whole intro stays under 4 s). */
export const INTRO_TIMELINE: [IntroPhase, number][] = [
  ['dark', 0],
  ['hood', 250],
  ['display', 1000],
  ['chrome', 3100],
  ['done', 3800],
];

export function introPhase(ms: number): IntroPhase {
  let phase: IntroPhase = 'dark';
  for (const [p, at] of INTRO_TIMELINE) if (ms >= at) phase = p;
  return phase;
}

const SEEN_KEY = 'twindial.intro.seen';

function seen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return true; // no storage (private mode): don't replay it on every load
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Show it? Only on a plain first visit: not for deep links, recordings or reduced motion. */
export function shouldPlayIntro(params: URLSearchParams): boolean {
  const deepLink = ['chapter', 'mode', 'pose', 'kiosk', 'record'].some((k) => params.has(k));
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  return !deepLink && !reduced && !seen();
}

/** Runs the intro timeline; any key or click (or the Skip button) ends it. */
export function useIntro(play: boolean): { phase: IntroPhase; skip: () => void } {
  const [phase, setPhase] = useState<IntroPhase>(play ? 'dark' : 'done');
  const skip = useCallback(() => {
    setPhase('done');
    markSeen();
  }, []);
  useEffect(() => {
    if (!play) return;
    const timers = INTRO_TIMELINE.slice(1).map(([p, at]) =>
      window.setTimeout(() => {
        setPhase((cur) => (cur === 'done' ? cur : p));
        if (p === 'done') markSeen();
      }, at),
    );
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [play, skip]);
  return { phase, skip };
}
