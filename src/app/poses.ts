import { AutoDriver } from '@/core/datasource/simulator/autodriver';
import type { ClusterSession } from './session';

export const POSES = ['idle', 'city', 'highway', 'redline', 'night'] as const;
export type Pose = (typeof POSES)[number];

const hold = (targetKmh: number, aggression = 0.6): AutoDriver =>
  new AutoDriver([{ targetKmh, aggression, holdS: 1e9 }]);

/**
 * Put the simulator into a reproducible state for screenshots and visual review
 * (`?pose=highway`). Uses the fixed default seed, so runs are deterministic.
 */
export function applyPose(session: ClusterSession, pose: Pose): void {
  const src = session.source;
  src.setAttract(false);
  // Start from an empty trip so screenshots don't depend on earlier visits.
  session.resetTrip(true);
  switch (pose) {
    case 'idle':
      src.autodriver = hold(0);
      session.fastForward(20);
      break;
    case 'city':
      src.autodriver = hold(50, 0.5);
      session.fastForward(45);
      break;
    case 'highway':
      src.autodriver = hold(130, 0.7);
      session.fastForward(70);
      break;
    case 'night':
      src.setNight(true);
      src.autodriver = hold(70, 0.5);
      session.fastForward(50);
      break;
    case 'redline': {
      src.setAutopilot(false);
      const sim = src.sim;
      sim.setMode('manual');
      sim.inputs.throttle = 1;
      src.setManualInput({ throttle: 1 });
      session.fastForward(15, () => {
        if (sim.state.gear < 3 && sim.state.rpm > 6900) sim.shiftUp();
      });
      break;
    }
  }
}

export function poseFromUrl(): Pose | undefined {
  const p = new URLSearchParams(window.location.search).get('pose');
  return POSES.find((x) => x === p);
}
