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
    const world = src.world;
    const sim = src.sim;
    let t = 0;
    let minGap = Infinity;
    let overLimitS = 0;
    let redRun = false;
    let reversed = false;
    let maxKmh = 0;
    let accS = 0;
    let agreeS = 0;
    let drivingS = 0;
    let takeovers = 0;
    let wasTakeover = false;
    let lastLog = 0;
    const log: string[] = [];
    while (t < 3000 && src.demo.phase !== 'parked') {
      src.fastForward(0.1);
      now += 100;
      t += 0.1;
      const sc = src.scene();
      const kmh = sim.speedKmh;
      maxKmh = Math.max(maxKmh, kmh);
      if (src.assist.controlling) accS += 0.1;
      if (kmh > 5) {
        drivingS += 0.1;
        if (src.recognized.limit === sc.legal.limit) agreeS += 0.1;
      }
      if (src.assist.out.takeover && !wasTakeover) takeovers++;
      wasTakeover = src.assist.out.takeover;
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
      if (t - lastLog >= 60) {
        lastLog = t;
        log.push(
          `${t.toFixed(0)}s s=${sc.ego.s.toFixed(0)} ${sc.road.name} ${kmh.toFixed(0)}km/h lim=${limit} lane=${sc.ego.lane.toFixed(1)} gear=${sim.state.gear} phase=${src.demo.phase}`,
        );
      }
    }
    console.log(log.join('\n'));
    console.log({
      t: t.toFixed(0),
      minGap: minGap.toFixed(1),
      overLimitS: overLimitS.toFixed(1),
      maxKmh: maxKmh.toFixed(0),
      accS: accS.toFixed(0),
      recognitionAgreement: (agreeS / drivingS).toFixed(3),
      takeovers,
      redRun,
      reversed,
      phase: src.demo.phase,
      s: world.ego.s.toFixed(0),
      length: world.route.length.toFixed(0),
    });
    expect(reversed).toBe(true);
    expect(src.demo.phase).toBe('parked');
    expect(redRun).toBe(false);
    // ACC drives a good part of the Autobahn (about 9 km).
    expect(accS).toBeGreaterThan(120);
    // Sign recognition is mostly right, but not always (missed and roadworks signs).
    expect(agreeS / drivingS).toBeGreaterThan(0.85);
    expect(minGap).toBeGreaterThan(1.5);
    expect(overLimitS).toBeLessThan(20);
    expect(maxKmh).toBeGreaterThan(120);
  }, 120_000);
});
