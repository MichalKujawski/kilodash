import { midnight } from './midnight';
import type { Theme } from './types';

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Deep-merge `patch` onto `base`, keeping only keys the base theme knows and
 * values of the same type. Unknown keys and wrong types are reported, not merged,
 * so a hand-edited or old theme file can never break the renderer.
 */
export function mergeTheme(base: Theme, patch: Json, problems: string[] = [], path = ''): Theme {
  return mergeValue(base, patch, problems, path) as Theme;
}

function mergeValue(base: Json, patch: Json, problems: string[], path: string): Json {
  if (patch === undefined) return base;
  if (isPlainObject(base)) {
    if (!isPlainObject(patch)) {
      problems.push(`${path || 'theme'}: expected an object`);
      return base;
    }
    const out: Record<string, Json> = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      const p = path ? `${path}.${k}` : k;
      if (!(k in base)) {
        // Optional top-level fields allowed on themes.
        if (path === '' && (k === 'nightVariant' || k === 'author') && typeof v === 'string')
          out[k] = v;
        else if (path === 'fonts' && k === 'load' && Array.isArray(v))
          out[k] = v.filter((x) => typeof x === 'string');
        else problems.push(`${p}: unknown key ignored`);
        continue;
      }
      out[k] = mergeValue(base[k], v, problems, p);
    }
    return out;
  }
  if (Array.isArray(base)) {
    if (!Array.isArray(patch) || !patch.every((x) => typeof x === typeof (base[0] ?? x))) {
      problems.push(`${path}: expected an array`);
      return base;
    }
    return patch;
  }
  if (typeof patch !== typeof base) {
    problems.push(`${path}: expected ${typeof base}, got ${typeof patch}`);
    return base;
  }
  if (typeof patch === 'number' && !Number.isFinite(patch)) {
    problems.push(`${path}: not a finite number`);
    return base;
  }
  return patch;
}

export interface ParsedTheme {
  theme?: Theme;
  problems: string[];
  error?: string;
}

/** Parse exported theme JSON. Missing fields fall back to the Midnight theme. */
export function parseTheme(text: string, fallback: Theme = midnight): ParsedTheme {
  let raw: Json;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { problems: [], error: `Not valid JSON: ${(e as Error).message}` };
  }
  if (!isPlainObject(raw)) return { problems: [], error: 'A theme must be a JSON object' };
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') {
    return { problems: [], error: 'A theme needs a string "id" and "name"' };
  }
  const problems: string[] = [];
  const theme = mergeTheme(fallback, raw, problems);
  return { theme, problems };
}

export function serializeTheme(theme: Theme): string {
  return JSON.stringify(theme, null, 2);
}
