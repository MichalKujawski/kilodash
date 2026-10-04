import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClusterKey } from '@/cluster/renderer/types';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { DEFAULT_PROFILE, profileById } from '@/profiles';
import { ControlBus } from './ControlBus';

function setup() {
  const keys: ClusterKey[] = [];
  const source = new SimulatorSource(DEFAULT_PROFILE);
  const renderer = { input: (k: ClusterKey) => keys.push(k) > 0, cycleNightMode: () => 'on' };
  const bus = new ControlBus(source, { renderer: () => renderer as never });
  return { source, bus, keys };
}

describe('ControlBus', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'performance'] }));
  afterEach(() => vi.useRealTimers());

  it('tap = comfort blink (3 flashes), hold = latched indicator', () => {
    const { source, bus } = setup();
    bus.press('indicatorRight');
    vi.advanceTimersByTime(150);
    bus.release('indicatorRight');
    expect(source.sim.indicating('right')).toBe(true);
    expect(source.sim.inputs.rightIndicator).toBe(false);
    for (let i = 0; i < 260; i++) source.sim.step(0.01); // ~2.6 s
    expect(source.sim.indicating('right')).toBe(false);

    bus.press('indicatorLeft');
    vi.advanceTimersByTime(600);
    bus.release('indicatorLeft');
    expect(source.sim.inputs.leftIndicator).toBe(true);
    // A tap against a latched stalk returns it to centre.
    bus.click('indicatorRight');
    expect(source.sim.inputs.leftIndicator).toBe(false);
  });

  it('lifting off the accelerator brings the pedal all the way back to zero', () => {
    const { source, bus } = setup();
    bus.press('throttle');
    vi.advanceTimersByTime(400);
    source.fastForward(0.02);
    expect(source.sim.inputs.throttle).toBeGreaterThan(0.5);
    bus.release('throttle');
    vi.advanceTimersByTime(400);
    source.fastForward(0.02);
    expect(source.sim.inputs.throttle).toBe(0);
  });

  it('distinguishes OK short press from long press', () => {
    const { bus, keys } = setup();
    bus.click('ok');
    bus.press('ok');
    vi.advanceTimersByTime(800);
    bus.release('ok');
    expect(keys).toEqual(['ok', 'okLong']);
  });

  it('ESC: tap switches traction control off, hold selects ESC sport', () => {
    const { source, bus } = setup();
    bus.click('esc');
    expect(source.buttons.esc).toBe('tcsOff');
    bus.click('esc');
    expect(source.buttons.esc).toBe('on');
    bus.press('esc');
    vi.advanceTimersByTime(1000);
    bus.release('esc');
    expect(source.buttons.esc).toBe('sport');
  });

  it('ramps keyboard pedals instead of jumping', () => {
    const { bus } = setup();
    bus.press('throttle');
    vi.advanceTimersByTime(100);
    const early = bus.pedalState.throttle;
    vi.advanceTimersByTime(1200);
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(0.5);
    expect(bus.pedalState.throttle).toBe(1);
    bus.release('throttle');
    vi.advanceTimersByTime(300);
    expect(bus.pedalState.throttle).toBe(0);
  });

  it('starts the engine only with the brake pressed', () => {
    const { source, bus } = setup();
    source.sim.setIgnition(0);
    bus.click('start');
    expect(source.sim.state.ignition).toBe(2);
    expect(source.sim.state.ready).toBe(false);
    bus.setPedal('brake', 1);
    bus.click('start');
    expect(source.sim.state.ignition).toBe(3);
  });

  it('flash is momentary; light switch cycles off → auto → parking → low', () => {
    const { source, bus } = setup();
    bus.press('flash');
    expect(source.sim.body.highBeamFlash).toBe(true);
    bus.release('flash');
    expect(source.sim.body.highBeamFlash).toBe(false);
    source.setLightSwitch('off');
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      bus.click('lightSwitch');
      seen.push(source.sim.body.lightSwitch);
    }
    expect(seen).toEqual(['auto', 'parking', 'low', 'off']);
  });

  it('mode button opens the list; wheel keys go to it until it closes', () => {
    const { source, bus, keys } = setup();
    bus.click('driveMode');
    expect(source.driveModeUiOpen).toBe(true);
    bus.click('scrollDown');
    expect(source.sim.driveModes.state.popup?.highlight).toBe('sport');
    bus.click('ok');
    expect(source.sim.driveModes.state.current).toBe('sport');
    expect(keys).toEqual([]);
    // Closed: the wheel drives the cluster again.
    bus.click('scrollDown');
    expect(keys).toEqual(['down']);
  });

  it('on an EV the paddles set regeneration and S becomes B', () => {
    const source = new SimulatorSource(profileById('ev-2023'));
    const bus = new ControlBus(source, { renderer: () => null });
    const start = source.sim.state.regenLevel;
    bus.click('paddleDown');
    expect(source.sim.state.regenLevel).toBe(start + 1);
    bus.click('gearS');
    expect(source.sim.state.evB).toBe(true);
    bus.dispose();
  });
});
