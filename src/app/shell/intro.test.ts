import { describe, expect, it } from 'vitest';
import { INTRO_TIMELINE, introPhase } from './intro';

describe('intro', () => {
  it('runs dark → hood → display → chrome → done, inside 4 s', () => {
    expect(introPhase(0)).toBe('dark');
    expect(introPhase(500)).toBe('hood');
    expect(introPhase(2000)).toBe('display');
    expect(introPhase(3300)).toBe('chrome');
    expect(introPhase(3900)).toBe('done');
    expect(INTRO_TIMELINE.at(-1)![1]).toBeLessThanOrEqual(4000);
  });
});
