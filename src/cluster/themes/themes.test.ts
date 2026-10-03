import { describe, expect, it } from 'vitest';
import { THEMES } from '.';
import { midnight } from './midnight';
import { mergeTheme, parseTheme, serializeTheme } from './validate';

describe('themes', () => {
  it('ships at least six complete themes with unique ids', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) {
      const problems: string[] = [];
      // Every built-in theme must be a structurally complete theme.
      mergeTheme(midnight, t, problems);
      expect(problems.filter((p) => !p.includes('unknown key'))).toEqual([]);
    }
  });

  it('round-trips through JSON export/import', () => {
    for (const t of THEMES) {
      const parsed = parseTheme(serializeTheme(t));
      expect(parsed.error).toBeUndefined();
      expect(parsed.theme).toEqual(t);
    }
  });

  it('fills missing fields from the fallback and reports bad values', () => {
    const r = parseTheme(
      JSON.stringify({
        id: 'mine',
        name: 'Mine',
        dial: { needle: { color: '#00ff00', baseWidth: 'wide' } },
        bogus: 1,
      }),
    );
    expect(r.theme?.dial.needle.color).toBe('#00ff00');
    expect(r.theme?.dial.needle.baseWidth).toBe(midnight.dial.needle.baseWidth);
    expect(r.theme?.map).toEqual(midnight.map);
    expect(r.problems).toContain('dial.needle.baseWidth: expected number, got string');
    expect(r.problems).toContain('bogus: unknown key ignored');
  });

  it('rejects malformed input', () => {
    expect(parseTheme('{').error).toMatch(/Not valid JSON/);
    expect(parseTheme('[]').error).toBeDefined();
    expect(parseTheme('{"name":"x"}').error).toMatch(/id/);
  });
});
