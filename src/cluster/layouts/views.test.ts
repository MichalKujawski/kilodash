import { describe, expect, it } from 'vitest';
import { S } from '@/core/signals/catalog';
import { resolveLayout } from './resolve';
import { autoLayout, LAYOUTS, VIEWS } from './views';

describe('views', () => {
  it('every view keeps the strips and the telltale row', () => {
    for (const layout of Object.values(LAYOUTS)) {
      const ids = layout.slots.map((s) => s.id);
      for (const shared of ['top-strip', 'bottom-strip', 'telltales'])
        expect(ids).toContain(shared);
    }
  });

  it('resolves the main content of every view for a petrol car', () => {
    const have = new Set([S.Speed, S.EngineSpeed, S.FuelLevel, S.CoolantTemp]);
    for (const layout of Object.values(LAYOUTS)) {
      const filled = resolveLayout(layout, have).filter((r) => r.spec !== null);
      expect(filled.length).toBeGreaterThan(3);
    }
  });

  it('Auto view follows the driving mode', () => {
    expect(autoLayout(3).id).toBe('sport');
    expect(autoLayout(2).id).toBe('classic');
    expect(VIEWS).toContain('auto');
  });
});
