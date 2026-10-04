import { describe, expect, it } from 'vitest';
import { ConsumptionHistory } from './ConsumptionHistory';

describe('ConsumptionHistory', () => {
  it('fills 0.5 s samples and 5 s bucket averages', () => {
    const h = new ConsumptionHistory();
    for (let i = 0; i < 100; i++) h.update(i < 50 ? 6 : 10, 0.1); // 10 s
    expect(h.recent.values()).toHaveLength(20);
    expect(h.buckets.values()).toEqual([6, 10]);
  });

  it('treats standstill as zero and clamps outliers', () => {
    const h = new ConsumptionHistory();
    for (let i = 0; i < 10; i++) h.update(i < 5 ? Number.NaN : 99, 0.1);
    expect(h.recent.values()).toEqual([0, 40]);
  });

  it('restores a persisted snapshot', () => {
    const h = new ConsumptionHistory();
    h.restore({ buckets: [5, 6, 7], recent: [1, 2] });
    expect(h.snapshot()).toEqual({ buckets: [5, 6, 7], recent: [1, 2] });
  });
});
