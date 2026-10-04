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
  'acc',
  'limiter',
  'isa',
  'rain',
  'lanes',
  'departure',
  'handsoff',
  'blindspot',
  'aeb',
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
    weather: pose === 'rain' ? 'rain' : 'clear',
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
    case 'acc':
      // ACC following traffic towards the roadworks.
      src.jumpTo('roadworks');
      session.fastForward(45);
      break;
    case 'limiter':
      // Speed limiter set to 50 in town.
      src.jumpTo('town');
      src.assist.pressMain();
      src.assist.switchFunction();
      src.assist.pressSet(false, 50);
      session.fastForward(18);
      break;
    case 'isa':
      // Too fast in town: the speed warning flashes the sign, then chimes.
      src.jumpTo('town');
      src.setAutopilot(false);
      src.setManualInput({ throttle: 0.45 });
      session.fastForward(9);
      break;
    case 'rain':
      // Rain on the Autobahn: the "130 when wet" sign applies and shows its plate.
      src.jumpTo('wetLimit');
      session.fastForward(22);
      break;
    case 'lanes':
      // Autobahn with ACC and lane centering (assisted driving).
      src.jumpTo('motorway');
      session.fastForward(40);
      break;
    case 'departure': {
      // Distracted driver on the rural road: lane keeping steers back from the line.
      src.jumpTo('rural');
      src.pressButton('distracted');
      session.fastForward(15);
      const lo = src.lane.out;
      for (let i = 0; i < 600 && lo.left !== 'departure' && lo.right !== 'departure'; i++)
        session.fastForward(0.05);
      src.paused = true;
      break;
    }
    case 'handsoff':
      // Hands off with assisted driving: second stage, red wheel.
      src.jumpTo('motorway');
      session.fastForward(30);
      src.pressButton('handsOn');
      session.fastForward(27);
      break;
    case 'blindspot': {
      // A car alongside on the left while we indicate left: zone flashes, chime.
      src.jumpTo('motorway');
      session.fastForward(30);
      src.setAutopilot(false);
      const w = src.world;
      w.traffic.spawnAt(w.ego.s - 2, w.ego.lane + 1, src.sim.state.speedMs);
      src.setIndicator('left');
      session.fastForward(0.5);
      src.paused = true;
      break;
    }
    case 'aeb': {
      // Distracted, no ACC, towards the end of the roadworks queue: emergency braking.
      src.pressButton('distracted');
      src.jumpTo('roadworks');
      session.fastForward(4);
      src.assist.switchOff();
      src.setAutopilot(false);
      src.setManualInput({ throttle: 0.35 });
      for (let i = 0; i < 1200 && src.collision.stage !== 'braking'; i++) {
        if (src.assist.state !== 'off') src.assist.switchOff();
        session.fastForward(0.05);
      }
      session.fastForward(0.3);
      src.paused = true;
      break;
    }
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
