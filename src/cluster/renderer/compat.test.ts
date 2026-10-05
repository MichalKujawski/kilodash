import { describe, expect, it } from 'vitest';
import { roundRectPath } from './compat';

describe('roundRect fallback', () => {
  it('draws four rounded corners, clamping the radius to the box', () => {
    const calls: string[] = [];
    const p = {
      moveTo: (x: number, y: number) => calls.push(`M${x},${y}`),
      arcTo: (_a: number, _b: number, _c: number, _d: number, r: number) => calls.push(`A${r}`),
      closePath: () => calls.push('Z'),
    };
    roundRectPath(p, 0, 0, 20, 10, [30]);
    expect(calls).toEqual(['M5,0', 'A5', 'A5', 'A5', 'A5', 'Z']);
  });
});
