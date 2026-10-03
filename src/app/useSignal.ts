import { useEffect, useState } from 'react';
import type { SignalStore } from '@/core/signals/store';
import type { SignalId } from '@/core/signals/types';

/**
 * Low-frequency bridge from the signal store into React. Polls at `hz` so React
 * never re-renders at the data rate.
 */
export function useSignal(store: SignalStore, id: SignalId, hz = 4): number | undefined {
  const [value, setValue] = useState<number | undefined>(() =>
    store.has(id) ? store.value(id) : undefined,
  );
  useEffect(() => {
    const t = setInterval(() => setValue(store.has(id) ? store.value(id) : undefined), 1000 / hz);
    return () => clearInterval(t);
  }, [store, id, hz]);
  return value;
}

/** Re-render a component at `hz` and return a getter-friendly tick count. */
export function usePoll(hz = 4): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setN((x) => x + 1), 1000 / hz);
    return () => clearInterval(t);
  }, [hz]);
  return n;
}
