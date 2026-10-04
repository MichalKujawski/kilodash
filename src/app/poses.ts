import type { ClusterSession } from './session';

export const POSES = [
  'idle',
  'city',
  'highway',
  'redline',
  'night',
  'eco',
  'sport',
  'modes',
  'offroad',
] as const;
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
    case 'eco':
      // Eco on the rural road, then the foot comes off: the gearbox freewheels.
      src.sim.driveModes.select('eco');
      src.jumpTo('rural');
      session.fastForward(40);
      src.setAutopilot(false);
      src.setManualInput({ throttle: 0, brake: 0 });
      session.fastForward(3);
      break;
    case 'sport':
      src.sim.driveModes.select('sport');
      src.jumpTo('motorway');
      session.fastForward(60);
      break;
    case 'modes': {
      // Mode list open with Sport highlighted, held open for the screenshot.
      src.jumpTo('motorway');
      session.fastForward(60);
      const dm = src.sim.driveModes;
      dm.pressButton();
      dm.move(1);
      dm.state.popup!.timer = -1e6;
      break;
    }
    case 'offroad':
      src.sim.driveModes.select('offroad');
      src.jumpTo('village');
      session.fastForward(20);
      break;
    case 'redline': {
      src.jumpTo('motorway');
      src.setAutopilot(false);
      const sim = src.sim;
      src.setGearProgram('M');
      src.setManualInput({ throttle: 1 });
      const shiftAt = (src.profile.engine?.limiterRpm ?? 7000) - 300;
      session.fastForward(14, () => {
        if (sim.state.gear < 3 && sim.state.rpm > shiftAt) sim.shiftUp();
      });
      break;
    }
  }
}

export function poseFromUrl(): Pose | undefined {
  const p = new URLSearchParams(window.location.search).get('pose');
  return POSES.find((x) => x === p);
}
