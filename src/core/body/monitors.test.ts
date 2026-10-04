import { describe, expect, it } from 'vitest';
import {
  BELT_CHIME_S,
  BELT_STATUS_S,
  IndirectTpms,
  SeatbeltReminder,
  ServiceInterval,
  type BeltInput,
} from './monitors';

const DT = 0.5;
const base: BeltInput = {
  ignitionOn: true,
  speedKmh: 0,
  driverBelted: true,
  passenger: { present: false, belted: false },
  rear: ['empty', 'empty', 'empty'],
  dt: DT,
};
const run = (r: SeatbeltReminder, i: Partial<BeltInput>, s: number): void => {
  for (let t = 0; t < s; t += DT) r.step({ ...base, ...i });
};

describe('seat-belt reminder', () => {
  it('lamp first, chime above 25 km/h for 90 s, then a steady lamp', () => {
    const r = new SeatbeltReminder();
    run(r, { driverBelted: false, speedKmh: 10 }, 5);
    expect(r.stage).toBe(1);
    run(r, { driverBelted: false, speedKmh: 40 }, 10);
    expect(r.stage).toBe(2);
    run(r, { driverBelted: false, speedKmh: 40 }, BELT_CHIME_S);
    expect(r.stage).toBe(3);
    run(r, { speedKmh: 40 }, 1);
    expect(r.stage).toBe(0);
  });

  it('includes an occupied passenger seat', () => {
    const r = new SeatbeltReminder();
    run(r, { passenger: { present: true, belted: false } }, 1);
    expect(r.stage).toBe(1);
    run(r, { passenger: { present: false, belted: false } }, 1);
    expect(r.stage).toBe(0);
  });

  it('shows the rear seats for 30 s after start and warns when a rear belt opens on the move', () => {
    const r = new SeatbeltReminder();
    run(r, { rear: ['belted', 'empty', 'belted'] }, 2);
    expect(r.statusVisible).toBe(true);
    run(r, { rear: ['belted', 'empty', 'belted'] }, BELT_STATUS_S);
    expect(r.statusVisible).toBe(false);
    run(r, { rear: ['unbelted', 'empty', 'belted'], speedKmh: 60 }, 2);
    expect(r.statusVisible).toBe(true);
    expect(r.stage).toBe(2);
  });
});

describe('indirect tyre monitoring', () => {
  it('warns once a tyre runs low for a while, cleared by storing pressures', () => {
    const t = new IndirectTpms();
    t.step([240, 240, 240, 240], 80, 1);
    for (let s = 0; s < 5; s++) t.step([240, 240, 240, 180], 80, 1);
    expect(t.warning).toBe(false);
    for (let s = 0; s < 5; s++) t.step([240, 240, 240, 180], 80, 1);
    expect(t.warning).toBe(true);
    t.store([240, 240, 240, 180]);
    t.step([240, 240, 240, 180], 80, 1);
    expect(t.warning).toBe(false);
  });
});

describe('service interval', () => {
  it('is due within 1 000 km or 30 days', () => {
    const s = new ServiceInterval(1500, 200);
    expect(s.due).toBe(false);
    s.drive(600);
    expect(s.due).toBe(true);
    s.reset();
    expect(s.due).toBe(false);
  });
});
