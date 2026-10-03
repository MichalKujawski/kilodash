import { describe, expect, it } from 'vitest';
import { S } from '../signals/catalog';
import { decodeBitmap, encodeBitmap, hasNextBlock, mergeBitmaps } from './bitmap';
import { decodeDtc, encodeDtc, parseDtcPayload } from './dtc';
import { PID_BY_NUMBER } from './pids';

const dec = (pid: number, bytes: number[]) =>
  Object.fromEntries(
    PID_BY_NUMBER.get(pid)!
      .decode(bytes)
      .map((d) => [d.id, d.value]),
  );

describe('PID decoders (SAE J1979)', () => {
  it.each([
    [0x04, [0xff], S.EngineLoad, 100],
    [0x04, [0x80], S.EngineLoad, (128 * 100) / 255],
    [0x05, [0x7b], S.CoolantTemp, 83],
    [0x0b, [0x65], S.MAP, 101],
    [0x0c, [0x1a, 0xf8], S.EngineSpeed, 1726],
    [0x0d, [0x3c], S.Speed, 60],
    [0x0f, [0x28], S.IntakeTemp, 0],
    [0x10, [0x01, 0xf4], S.MAF, 5],
    [0x11, [0x33], S.Throttle, 20],
    [0x1f, [0x01, 0x2c], S.RunTime, 300],
    [0x2f, [0x80], S.FuelLevel, (128 * 100) / 255],
    [0x33, [0x64], S.BarometricPressure, 100],
    [0x42, [0x37, 0x6e], S.BatteryVoltage, 14.19],
    [0x46, [0x32], S.AmbientTemp, 10],
    [0x51, [0x04], S.FuelType, 4],
    [0x5b, [0xcc], S.SoC, 80],
    [0x5c, [0x82], S.OilTemp, 90],
    [0x5e, [0x00, 0xa0], S.FuelRate, 8],
    [0xa6, [0x00, 0x07, 0x5b, 0xcd], S.Odometer, 48225.3],
  ])('PID %s decodes %j', (pid, bytes, id, expected) => {
    expect(dec(pid, bytes)[id]).toBeCloseTo(expected, 2);
  });

  it('decodes monitor status: MIL bit and DTC count', () => {
    const r = dec(0x01, [0x83, 0x07, 0xe5, 0x00]);
    expect(r[S.MIL]).toBe(1);
    expect(r[S.DTCCount]).toBe(3);
    expect(dec(0x01, [0x00, 0, 0, 0])[S.MIL]).toBe(0);
  });

  it('round-trips encode/decode for every PID', () => {
    const values = {
      [S.EngineSpeed]: 3250,
      [S.Speed]: 87,
      [S.CoolantTemp]: 91,
      [S.MAF]: 23.45,
      [S.BatteryVoltage]: 14.2,
      [S.FuelRate]: 6.5,
      [S.Odometer]: 123456.7,
    };
    for (const pid of [0x0c, 0x0d, 0x05, 0x10, 0x42, 0x5e, 0xa6]) {
      const def = PID_BY_NUMBER.get(pid)!;
      const out = dec(pid, def.encode(values));
      for (const id of def.signals)
        expect(out[id]).toBeCloseTo(values[id as keyof typeof values], 1);
    }
  });
});

describe('supported-PID bitmaps', () => {
  it('decodes the classic 41 00 BE 3E B8 13 example', () => {
    const pids = decodeBitmap(0x00, [0xbe, 0x3e, 0xb8, 0x13]);
    expect(pids).toEqual([
      0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x11, 0x13, 0x14, 0x15,
      0x1c, 0x1f, 0x20,
    ]);
    expect(hasNextBlock([0xbe, 0x3e, 0xb8, 0x13])).toBe(true);
  });

  it('encodes a bitmap that decodes back, with continuation bit', () => {
    const supported = new Set([0x04, 0x05, 0x0c, 0x0d, 0x2f, 0x42]);
    const b0 = encodeBitmap(0x00, supported);
    expect(decodeBitmap(0x00, b0).filter((p) => p !== 0x20)).toEqual([0x04, 0x05, 0x0c, 0x0d]);
    expect(hasNextBlock(b0)).toBe(true);
    const b2 = encodeBitmap(0x20, supported);
    expect(decodeBitmap(0x20, b2).filter((p) => p !== 0x40)).toEqual([0x2f]);
    expect(hasNextBlock(b2)).toBe(true);
    const b4 = encodeBitmap(0x40, supported);
    expect(decodeBitmap(0x40, b4)).toEqual([0x42]);
    expect(hasNextBlock(b4)).toBe(false);
  });

  it('merges bitmaps from multiple ECUs', () => {
    expect(
      mergeBitmaps([
        [0x80, 0, 0, 0],
        [0x01, 0, 0, 0x01],
      ]),
    ).toEqual([0x81, 0, 0, 0x01]);
  });
});

describe('DTCs', () => {
  it.each([
    [[0x01, 0x33], 'P0133'],
    [[0x04, 0x20], 'P0420'],
    [[0x41, 0x23], 'C0123'],
    [[0x81, 0x00], 'B0100'],
    [[0xc1, 0x00], 'U0100'],
    [[0x13, 0x01], 'P1301'],
  ])('decodes %j as %s', ([a, b], code) => {
    expect(decodeDtc(a!, b!)).toBe(code);
    expect(encodeDtc(code)).toEqual([a, b]);
  });

  it('parses a Mode 03 payload and skips padding', () => {
    expect(parseDtcPayload([0x03, 0x01, 0x04, 0x20, 0x00, 0x00])).toEqual(['P0301', 'P0420']);
    expect(parseDtcPayload([0x02, 0x03, 0x01, 0x04, 0x20])).toEqual(['P0301', 'P0420']);
  });
});
