import type { ClusterSession } from './session';

export const POSES = ['idle', 'city', 'highway', 'redline', 'night'] as const;
export type Pose = (typeof POSES)[number];

/**
 * Put the car into a reproducible state for screenshots and visual review
 * (`?pose=highway`): a fixed place in the world at a fixed time of day.
 * Deterministic: fixed seeds, no real clock.
 */
export function applyPose(session: ClusterSession, pose: Pose): void {
  const src = session.source;
  // Start from an empty trip so screenshots don't depend on earlier visits.
  session.resetTrip(true);
  src.setEnvironment({
    realTime: false,
    hour: pose === 'night' ? 22 : 14,
    weather: 'clear',
    temperatureC: 16,
  });
  switch (pose) {
    case 'idle':
      // Parked in the first bay, engine running, selector in P.
      src.parkAtStart();
      src.setAutopilot(false);
      src.sim.setIgnition(2);
      src.sim.start();
      session.fastForward(4);
      break;
    case 'city':
      src.jumpTo('town');
      session.fastForward(18);
      break;
    case 'highway':
      src.jumpTo('motorway');
      session.fastForward(75);
      break;
    case 'night':
      src.jumpTo('rural');
      session.fastForward(45);
      break;
    case 'redline': {
      src.jumpTo('motorway');
      src.setAutopilot(false);
      const sim = src.sim;
      sim.setMode('manual');
      src.setManualInput({ throttle: 1 });
      session.fastForward(14, () => {
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
