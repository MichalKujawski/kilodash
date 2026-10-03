import { en } from './en';
import { pl } from './pl';

export type Locale = 'en' | 'pl';
export type Dictionary = Record<string, string>;

const DICTS: Record<Locale, Dictionary> = { en, pl };
let current: Locale = 'en';
const listeners = new Set<() => void>();

export function setLocale(l: Locale): void {
  current = l;
  for (const cb of listeners) cb();
}

export function getLocale(): Locale {
  return current;
}

export function onLocaleChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Translate `key`, substituting `{name}` placeholders. Falls back to English,
 * then to the key itself so missing strings are visible.
 */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[current][key] ?? en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
}

export function hasKey(key: string, locale: Locale = current): boolean {
  return key in DICTS[locale];
}
