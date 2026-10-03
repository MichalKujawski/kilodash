import type { Unsubscribe } from './datasource/types';

/** Minimal typed listener set. */
export class Emitter<T> {
  private listeners = new Set<(v: T) => void>();

  on(cb: (v: T) => void): Unsubscribe {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emit(v: T): void {
    for (const cb of this.listeners) cb(v);
  }

  get size(): number {
    return this.listeners.size;
  }
}
