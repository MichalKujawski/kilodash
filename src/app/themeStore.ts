import { THEMES } from '@/cluster/themes';
import type { Theme } from '@/cluster/themes/types';
import { parseTheme } from '@/cluster/themes/validate';

const USER_KEY = 'opencluster.userThemes';
const SELECTED_KEY = 'opencluster.theme';

export function loadUserThemes(): Theme[] {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as unknown[];
    return list
      .map((t) => parseTheme(JSON.stringify(t)).theme)
      .filter((t): t is Theme => t !== undefined);
  } catch {
    return [];
  }
}

export function saveUserThemes(themes: Theme[]): void {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(themes));
  } catch {
    // Storage unavailable: user themes last for this visit only.
  }
}

export function loadSelectedThemeId(): string | null {
  try {
    return localStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export function saveSelectedThemeId(id: string): void {
  try {
    localStorage.setItem(SELECTED_KEY, id);
  } catch {
    // ignore
  }
}

export function isBuiltIn(id: string): boolean {
  return THEMES.some((t) => t.id === id);
}

/** Read and write nested theme values by dot path (editor fields). */
export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], obj);
}

export function setPath<T>(obj: T, path: string, value: unknown): T {
  const keys = path.split('.');
  const clone = structuredClone(obj) as Record<string, unknown>;
  let cur = clone;
  for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
  cur[keys[keys.length - 1]!] = value;
  return clone as T;
}

/** `#rrggbb` for colour inputs, from hex or rgb(a) strings. */
export function toHex(color: string): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(color))
    return `#${[...color.slice(1)].map((c) => c + c).join('')}`.toLowerCase();
  const m = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!m) return '#000000';
  return `#${[m[1], m[2], m[3]].map((v) => Math.round(Number(v)).toString(16).padStart(2, '0')).join('')}`;
}

/** Alpha of an rgba() string (1 for hex). */
export function alphaOf(color: string): number {
  const m = color.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/i);
  return m ? Number(m[1]) : 1;
}

/** Apply a picked hex colour, keeping the original alpha. */
export function withHex(original: string, hex: string): string {
  const a = alphaOf(original);
  if (a >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
