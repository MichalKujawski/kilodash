import { useEffect, useState } from 'react';
import type { Director, DirectorState } from './Director';

/**
 * Runs the Director against wall-clock time and polls its state a few times a
 * second for the captions (the cluster itself never waits on React).
 */
export function useDirector(director: Director | null, active: boolean): DirectorState | null {
  const [state, setState] = useState<DirectorState | null>(null);
  useEffect(() => {
    if (!director || !active) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      // A hidden tab pauses timers; don't fire a whole chapter's events at once on return.
      director.tick(Math.min((now - last) / 1000, 0.25));
      last = now;
      setState(director.state);
    }, 100);
    return () => window.clearInterval(id);
  }, [director, active]);
  return active ? state : null;
}
