import type { SignalStore } from '../signals/store';
import type { SignalId } from '../signals/types';

export type Comparison = '>' | '>=' | '<' | '<=' | '==' | '!=';

/** Declarative condition over signals; usable from JSON. */
export type Condition =
  | { signal: SignalId; op: Comparison; value: number }
  | { any: Condition[] }
  | { all: Condition[] }
  | { not: Condition };

/**
 * Evaluate a condition. A comparison on a signal the vehicle doesn't provide is
 * false — absent data never lights a lamp.
 */
export function evaluate(c: Condition, store: SignalStore): boolean {
  if ('any' in c) return c.any.some((x) => evaluate(x, store));
  if ('all' in c) return c.all.length > 0 && c.all.every((x) => evaluate(x, store));
  if ('not' in c) return !evaluate(c.not, store);
  if (!store.has(c.signal)) return false;
  const v = store.value(c.signal);
  switch (c.op) {
    case '>':
      return v > c.value;
    case '>=':
      return v >= c.value;
    case '<':
      return v < c.value;
    case '<=':
      return v <= c.value;
    case '==':
      return v === c.value;
    case '!=':
      return v !== c.value;
  }
}

/** Shorthand builders for readable rule tables. */
export const is = (signal: SignalId, op: Comparison, value: number): Condition => ({
  signal,
  op,
  value,
});
export const on = (signal: SignalId): Condition => ({ signal, op: '>', value: 0 });
