import { describe, expect, it } from 'vitest';
import {
  coastingAllowed,
  CylinderDeactivation,
  DriveModeController,
  POPUP_CONFIRM_S,
} from './DriveModeController';
import { availableModes, MODES, throttleMap } from './modes';

const awd = { adaptiveDampers: true, awd: true };

describe('drive mode selection', () => {
  it('offers modes from equipment', () => {
    expect(availableModes({})).toEqual(['eco', 'normal', 'sport', 'individual']);
    expect(availableModes(awd)).toEqual([
      'eco',
      'comfort',
      'normal',
      'sport',
      'individual',
      'snow',
      'offroad',
    ]);
    expect(availableModes({ driveModes: false })).toEqual([]);
  });

  it('opens a list, cycles with the button and auto-confirms after ~2 s', () => {
    const c = new DriveModeController(awd);
    c.pressButton();
    expect(c.state.popup?.highlight).toBe('normal');
    c.pressButton();
    c.pressButton();
    expect(c.state.popup?.highlight).toBe('individual');
    c.step(POPUP_CONFIRM_S - 0.1, false);
    expect(c.state.current).toBe('normal');
    c.step(0.2, false);
    expect(c.state.current).toBe('individual');
    expect(c.state.popup).toBeNull();
  });

  it('confirms with OK, opens Individual settings only when parked', () => {
    const c = new DriveModeController(awd);
    c.pressButton();
    c.move(1);
    c.move(1);
    c.ok(false);
    expect(c.state.current).toBe('individual');
    expect(c.state.config).toBeNull();
    c.pressButton();
    c.ok(true);
    expect(c.state.config?.open).toBe(true);
    c.adjust(1);
    expect(c.state.individual.engine).toBe('sport');
    c.step(0.1, false);
    expect(c.state.config).toBeNull();
  });

  it('resets to Normal at ignition unless told to remember', () => {
    const c = new DriveModeController(awd);
    c.select('sport');
    c.onIgnition();
    expect(c.state.current).toBe('normal');
    c.select('eco');
    c.rememberLast = true;
    c.onIgnition();
    expect(c.state.current).toBe('eco');
  });

  it('never coasts in Individual mode', () => {
    const c = new DriveModeController(awd);
    c.select('individual');
    c.state.individual = { ...c.state.individual, gearbox: 'eco' };
    expect(c.params.coasting).toBe(false);
    expect(MODES.eco.params.coasting).toBe(true);
  });
});

describe('coasting rules', () => {
  const ok = {
    modeAllows: true,
    automatic: true,
    inDrive: true,
    cruiseOrAcc: false,
    throttle: 0,
    brake: 0,
    speedKmh: 80,
    gradient: 0,
  };
  it('coasts with pedals released at speed', () => expect(coastingAllowed(ok)).toBe(true));
  it('never with cruise or ACC', () =>
    expect(coastingAllowed({ ...ok, cruiseOrAcc: true })).toBe(false));
  it('not on steep descents, at low speed or with a pedal touched', () => {
    expect(coastingAllowed({ ...ok, gradient: -0.06 })).toBe(false);
    expect(coastingAllowed({ ...ok, speedKmh: 15 })).toBe(false);
    expect(coastingAllowed({ ...ok, brake: 0.1 })).toBe(false);
    expect(coastingAllowed({ ...ok, throttle: 0.1 })).toBe(false);
  });
});

describe('throttle maps and cylinder deactivation', () => {
  it('Eco is duller and Sport sharper than Normal at half pedal', () => {
    expect(throttleMap('eco', 0.5)).toBeLessThan(throttleMap('linear', 0.5));
    expect(throttleMap('sport', 0.5)).toBeGreaterThan(throttleMap('linear', 0.5));
    for (const m of ['eco', 'soft', 'linear', 'sport', 'snow', 'offroad'] as const) {
      expect(throttleMap(m, 0)).toBe(0);
      expect(throttleMap(m, 1)).toBeLessThanOrEqual(1);
    }
  });

  it('deactivates cylinders only after steady light load, never in Sport', () => {
    const cda = new CylinderDeactivation();
    const input = {
      supported: true,
      sportMode: false,
      coolantC: 90,
      rpm: 2000,
      torqueFrac: 0.4,
      gear: 5,
      throttleRate: 0.02,
      coasting: false,
    };
    expect(cda.update(input, 1)).toBe(false);
    expect(cda.update(input, 1)).toBe(true);
    expect(cda.update({ ...input, torqueFrac: 0.9 }, 0.1)).toBe(false);
    const sport = new CylinderDeactivation();
    sport.update({ ...input, sportMode: true }, 3);
    expect(sport.active).toBe(false);
  });
});

describe('comfort consumers and eco tips', () => {
  it('runs the A/C in the heat and heaters in the cold', async () => {
    const { comfortConsumers, consumerFuelLh } = await import('./efficiency');
    const hot = comfortConsumers({ ambientC: 30, ecoClimate: false, lowBeam: false, minutesOn: 5 });
    expect(hot.map((c) => c.id)).toEqual(['ac']);
    const eco = comfortConsumers({ ambientC: 30, ecoClimate: true, lowBeam: false, minutesOn: 5 });
    expect(eco[0]!.kW).toBeLessThan(hot[0]!.kW);
    const cold = comfortConsumers({ ambientC: 0, ecoClimate: false, lowBeam: true, minutesOn: 5 });
    expect(cold.map((c) => c.id)).toEqual(['rearDefrost', 'seatHeating', 'lights']);
    // A 2.6 kW compressor costs a bit over 1 L/h.
    expect(consumerFuelLh(2.64)).toBeGreaterThan(1);
  });

  it('gives tips in a sensible order', async () => {
    const { ecoTip } = await import('./efficiency');
    const base = {
      speedKmh: 90,
      rpm: 2000,
      throttle: 0.2,
      manualGears: false,
      consumersLh: 0,
      coasting: false,
      ecoMode: true,
    };
    expect(ecoTip(base)).toBeNull();
    expect(ecoTip({ ...base, manualGears: true, rpm: 3500 })).toBe('Shift up earlier');
    expect(ecoTip({ ...base, speedKmh: 150 })).toMatch(/10 km\/h/);
    expect(ecoTip({ ...base, ecoMode: false })).toMatch(/Eco mode/);
    expect(ecoTip({ ...base, speedKmh: 150, coasting: true })).toBeNull();
  });
});
