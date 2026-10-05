import { describe, expect, it } from 'vitest';
import { DEFAULT_PROFILE } from '@/profiles';
import { SimulatorSource } from '../datasource/simulator/SimulatorSource';

/**
 * Drives the whole route in fast-forward with the Demo driver: from ignition
 * off in the first bay to parked at the destination.
 */
describe('Demo drive over the whole route', () => {
  it('reverses out, obeys limits and lights, keeps its distance and parks', () => {
    let now = 0;
    const src = new SimulatorSource(DEFAULT_PROFILE, { startOff: true }, () => now);
    const sim = src.sim;
    let t = 0;
    let minGap = Infinity;
    let overLimitS = 0;
    let redRun = false;
    let reversed = false;
    let maxKmh = 0;
    let accS = 0;
    let agreeS = 0;
    const fcw: Record<string, number> = {};
    let autoStops = 0;
    let wasStopped = false;
    let lastStage = 'ready';
    let drivingS = 0;
    while (t < 3000 && src.demo.phase !== 'parked') {
      src.fastForward(0.1);
      now += 100;
      t += 0.1;
      const sc = src.scene();
      const kmh = sim.speedKmh;
      maxKmh = Math.max(maxKmh, kmh);
      if (src.assist.controlling) accS += 0.1;
      if (sim.autoStopped && !wasStopped) autoStops++;
      wasStopped = sim.autoStopped;
      const stage = src.collision.stage;
      if (stage !== lastStage) fcw[stage] = (fcw[stage] ?? 0) + 1;
      lastStage = stage;
      if (kmh > 5) {
        drivingS += 0.1;
        if (src.recognized.limit === sc.legal.limit) agreeS += 0.1;
      }
      if (sim.state.direction === -1 && kmh > 0.5) reversed = true;
      if (sc.lead && sc.lead.dx < minGap && !sc.ego.inBay) minGap = sc.lead.dx;
      const limit = sc.legal.limit;
      if (limit !== null && kmh > limit + 8) overLimitS += 0.1;
      if (
        sc.trafficLight &&
        sc.trafficLight.state === 'red' &&
        sc.trafficLight.distance < 1 &&
        kmh > 5
      )
        redRun = true;
    }
    expect(reversed).toBe(true);
    expect(src.demo.phase).toBe('parked');
    expect(redRun).toBe(false);
    // ACC drives a good part of the Autobahn (about 9 km).
    expect(accS).toBeGreaterThan(120);
    // Sign recognition is mostly right, but not always (missed and roadworks signs).
    expect(agreeS / drivingS).toBeGreaterThan(0.85);
    // An attentive driver never needs emergency braking.
    expect(fcw.braking ?? 0).toBe(0);
    // Start-stop switches the engine off at red lights and in the queue.
    expect(autoStops).toBeGreaterThan(0);
    expect(minGap).toBeGreaterThan(1.5);
    expect(overLimitS).toBeLessThan(20);
    expect(maxKmh).toBeGreaterThan(120);
  }, 120_000);
});
