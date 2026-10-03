import { describe, expect, it } from 'vitest';
import { S } from '../signals/catalog';
import { SignalStore } from '../signals/store';
import { AlertEngine } from './AlertEngine';
import { ALERT_RULES } from './rules';

function setup() {
  let now = 0;
  const store = new SignalStore(() => now);
  const engine = new AlertEngine(store, ALERT_RULES);
  const raised: string[] = [];
  const cleared: string[] = [];
  engine.raised.on((a) => raised.push(a.rule.id));
  engine.cleared.on((r) => cleared.push(r.id));
  const set = (id: string, value: number) =>
    store.write({ id, value, ts: now, source: 'simulated' });
  const advance = (ms: number) => {
    for (let t = 0; t < ms; t += 200) {
      now += 200;
      engine.update(now);
    }
  };
  return { engine, set, advance, raised, cleared, now: () => now };
}

describe('AlertEngine', () => {
  it('raises only after the minimum duration and clears with hysteresis', () => {
    const { set, advance, raised, cleared } = setup();
    set(S.CoolantTemp, 119);
    advance(600);
    expect(raised).toEqual([]);
    advance(600);
    expect(raised).toEqual(['coolantHigh']);
    set(S.CoolantTemp, 115); // below raise threshold but above clear threshold
    advance(1000);
    expect(cleared).toEqual([]);
    set(S.CoolantTemp, 105);
    advance(400);
    expect(cleared).toEqual(['coolantHigh']);
  });

  it('orders by severity and lets the driver acknowledge popups', () => {
    const { engine, set, advance, now } = setup();
    set(S.AmbientTemp, -2);
    set(S.MIL, 1);
    set(S.Seatbelt, 0);
    set(S.Speed, 40);
    advance(1500);
    expect(engine.list().map((a) => a.rule.id)).toEqual(['seatbelt', 'checkEngine', 'ice']);
    expect(engine.current(now())?.rule.id).toBe('seatbelt');
    engine.acknowledge('seatbelt');
    expect(engine.current(now())?.rule.id).toBe('checkEngine');
  });

  it('times out non-critical popups but keeps them active', () => {
    const { engine, set, advance, now } = setup();
    set(S.AmbientTemp, 1);
    advance(1200);
    expect(engine.current(now())?.rule.id).toBe('ice');
    advance(7000);
    expect(engine.current(now())).toBeUndefined();
    expect(engine.isActive('ice')).toBe(true);
  });

  it('never raises on signals the car does not provide', () => {
    const { engine, advance } = setup();
    advance(5000);
    expect(engine.list()).toEqual([]);
  });

  it('repeats the chime for critical reminders', () => {
    const { engine, set, advance } = setup();
    let reminders = 0;
    engine.reminded.on(() => reminders++);
    set(S.Seatbelt, 0);
    set(S.Speed, 50);
    advance(13_000);
    expect(reminders).toBe(2);
  });
});
