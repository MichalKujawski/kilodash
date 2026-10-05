import { describe, expect, it } from 'vitest';
import { CHAPTERS } from './chapters';

describe('chapter captions', () => {
  it('spotlights stay inside the cluster and finish before their caption ends', () => {
    for (const c of CHAPTERS)
      for (const k of c.captions) {
        if (!k.spotlight) continue;
        const [x, y, r, delay = 0] = k.spotlight;
        expect(x, k.title).toBeGreaterThanOrEqual(0);
        expect(x, k.title).toBeLessThanOrEqual(1920);
        expect(y, k.title).toBeGreaterThanOrEqual(0);
        expect(y, k.title).toBeLessThanOrEqual(720);
        expect(r, k.title).toBeGreaterThan(20);
        // 1.9 s animation after the delay, within the caption's time on screen.
        expect(k.t0 + delay + 1.9, k.title).toBeLessThanOrEqual(k.t1);
      }
  });

  it('captions in a chapter do not overlap in time', () => {
    for (const c of CHAPTERS)
      for (let i = 1; i < c.captions.length; i++)
        expect(c.captions[i]!.t0, c.id).toBeGreaterThanOrEqual(c.captions[i - 1]!.t1);
  });
});
