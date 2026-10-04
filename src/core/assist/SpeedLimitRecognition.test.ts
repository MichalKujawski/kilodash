import { describe, expect, it } from 'vitest';
import type { LegalLimit } from '../world/route';
import type { Sign } from '../world/types';
import {
  ISA_ACOUSTIC_S,
  IsaWarning,
  SpeedLimitRecognition,
  type RecognitionInput,
} from './SpeedLimitRecognition';

const map = (limit: number | null, advisory: number | null = null): LegalLimit => ({
  limit,
  advisory,
  noOvertaking: false,
});
const input = (patch: Partial<RecognitionInput> = {}): RecognitionInput => ({
  passed: [],
  map: map(100),
  implicit: { urban: 50, rural: 100 },
  roadChanged: false,
  wet: false,
  hour: 12,
  ...patch,
});
const sign = (g: Partial<Sign> & Pick<Sign, 'kind'>): Sign => ({ s: 0, visibility: 1, ...g });

describe('speed-limit recognition', () => {
  it('uses the map until the camera reads a sign', () => {
    const r = new SpeedLimitRecognition(() => 0);
    expect(r.step(input()).limit).toBe(100);
    expect(r.step(input()).source).toBe('map');
    const read = r.step(input({ passed: [sign({ kind: 'limit', value: 70 })] }));
    expect(read.limit).toBe(70);
    expect(read.source).toBe('camera');
    // Holds while the map still says 100.
    expect(r.step(input()).limit).toBe(70);
  });

  it('sees temporary roadworks signs the map does not know', () => {
    const r = new SpeedLimitRecognition(() => 0);
    r.step(input({ map: map(null, 130) }));
    const out = r.step(
      input({ map: map(null, 130), passed: [sign({ kind: 'limit', value: 80, temporary: true })] }),
    );
    expect(out.limit).toBe(80);
  });

  it('misses signs it cannot read (imperfect on purpose)', () => {
    const r = new SpeedLimitRecognition(() => 0.9);
    const out = r.step(input({ passed: [sign({ kind: 'limit', value: 70, visibility: 0.5 })] }));
    expect(out.limit).toBe(100);
  });

  it('applies a "when wet" plate only when wet, and shows the plate', () => {
    const r = new SpeedLimitRecognition(() => 0);
    const wetSign = sign({ kind: 'limit', value: 130, plate: { kind: 'wet' } });
    const dry = r.step(input({ map: map(null, 130), passed: [wetSign] }));
    expect(dry.limit).toBeNull();
    expect(dry.plate).toBeNull();
    const wet = r.step(input({ map: map(null, 130), wet: true }));
    expect(wet.limit).toBe(130);
    expect(wet.plate).toBe('wet');
  });

  it('applies time plates by the clock', () => {
    const r = new SpeedLimitRecognition(() => 0);
    const school = sign({ kind: 'limit', value: 30, plate: { kind: 'time', from: 7, to: 17 } });
    expect(r.step(input({ map: map(50), passed: [school], hour: 20 })).limit).toBe(50);
    expect(r.step(input({ map: map(50), hour: 8 })).limit).toBe(30);
  });

  it('town signs set implicit limits; end signs and turns fall back to the map', () => {
    const r = new SpeedLimitRecognition(() => 0);
    expect(r.step(input({ passed: [sign({ kind: 'townEntry' })] })).limit).toBe(50);
    expect(
      r.step(input({ map: map(60), passed: [sign({ kind: 'limitEnd', value: 50 })] })).limit,
    ).toBe(60);
    r.step(input({ passed: [sign({ kind: 'limit', value: 30 })] }));
    expect(r.step(input({ map: map(50), roadChanged: true })).limit).toBe(50);
  });

  it('end of all restrictions: no limit, no overtaking ban, advisory shown', () => {
    const r = new SpeedLimitRecognition(() => 0);
    r.step(input({ passed: [sign({ kind: 'noOvertaking' }), sign({ kind: 'limit', value: 80 })] }));
    const out = r.step(input({ map: map(null, 130), passed: [sign({ kind: 'endAll' })] }));
    expect(out.limit).toBeNull();
    expect(out.noOvertaking).toBe(false);
    expect(out.advisory).toBe(130);
  });
});

describe('ISA warning', () => {
  function run(w: IsaWarning, kmh: number, limit: number | null, seconds: number): string {
    for (let t = 0; t < seconds; t += 0.1) w.step(kmh, limit, 0.1);
    return w.level;
  }

  it('flashes first, then sounds once it lasts', () => {
    const w = new IsaWarning();
    expect(run(w, 50, 50, 5)).toBe('ok');
    expect(run(w, 56, 50, 1)).toBe('visual');
    expect(run(w, 56, 50, ISA_ACOUSTIC_S)).toBe('acoustic');
    expect(run(w, 48, 50, 0.2)).toBe('ok');
  });

  it('honours the offset and stays quiet with no limit', () => {
    const w = new IsaWarning();
    w.setOffset(7);
    expect(run(w, 56, 50, 5)).toBe('ok');
    expect(run(w, 58, 50, 1)).toBe('visual');
    expect(run(w, 220, null, 5)).toBe('ok');
  });

  it('can be switched off, and is back on at the next start', () => {
    const w = new IsaWarning();
    w.toggle();
    expect(run(w, 90, 50, 5)).toBe('off');
    w.onIgnition();
    expect(run(w, 90, 50, 1)).toBe('visual');
  });
});
