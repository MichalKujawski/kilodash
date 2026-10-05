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
  'autostop',
  'advice',
  'shiftlights',
  'diesel',
  'belts',
  'door',
  'service',
  'messages',
  'reverse',
  'parking',
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
      src.setDemoDrive(false);
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
      src.setDemoDrive(false);
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
      src.setDemoDrive(false);
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
      src.setDemoDrive(false);
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
      src.setDemoDrive(false);
      src.setManualInput({ throttle: 0.35 });
      for (let i = 0; i < 1200 && src.collision.stage !== 'braking'; i++) {
        if (src.assist.state !== 'off') src.assist.switchOff();
        session.fastForward(0.05);
      }
      session.fastForward(0.3);
      src.paused = true;
      break;
    }
    case 'autostop':
      // Warm engine, Auto Hold on, stopped at a red light: engine off, green A.
      src.pressButton('autoHold');
      src.jumpTo('town');
      src.sim.state.coolantC = 88;
      for (let i = 0; i < 1200 && !src.sim.autoStopped; i++) session.fastForward(0.1);
      session.fastForward(1);
      src.paused = true;
      break;
    case 'advice': {
      // Manual gear selection, gentle acceleration: "shift up" advice.
      src.jumpTo('rural');
      session.fastForward(10);
      src.setDemoDrive(false);
      src.setGearProgram('M');
      src.setManualInput({ throttle: 0.25 });
      session.fastForward(1);
      const sim = src.sim;
      for (let i = 0; i < 300 && sim.state.rpm < 2300; i++) session.fastForward(0.05);
      src.paused = true;
      break;
    }
    case 'shiftlights': {
      // Sport, manual, full throttle: the shift lights fill and flash.
      src.sim.driveModes.select('sport');
      src.jumpTo('motorway');
      session.fastForward(5);
      src.setDemoDrive(false);
      src.setGearProgram('M');
      const sim = src.sim;
      // A clear lane ahead for the run up to the shift point.
      const w = src.world;
      w.traffic.vehicles = w.traffic.vehicles.filter(
        (v) => v.oncoming || Math.abs(v.lane - w.ego.lane) > 0.5 || v.s < w.ego.s,
      );
      while (sim.state.gear > 3) sim.shiftDown();
      src.setManualInput({ throttle: 1 });
      const e = src.profile.engine!;
      for (let i = 0; i < 400 && sim.state.rpm < e.redlineRpm - 700; i++) session.fastForward(0.02);
      src.paused = true;
      break;
    }
    case 'diesel':
      // 2016 estate (use ?car=estate-2016): particulate filter full in town.
      src.jumpTo('town');
      src.setDieselDemo('dpf');
      session.fastForward(8);
      break;
    case 'belts':
      // Driving in town; a rear passenger unbuckles: status card + reminder.
      src.jumpTo('town');
      src.setPassenger(true, true);
      src.setRearSeat(0, 'belted');
      src.setRearSeat(2, 'belted');
      session.fastForward(40);
      src.setRearSeat(0, 'unbelted');
      session.fastForward(1);
      src.paused = true;
      break;
    case 'door':
      // Parked, engine running, driver's door and boot open.
      src.parkAtStart();
      src.setDemoDrive(false);
      src.sim.setIgnition(2);
      src.sim.start();
      session.fastForward(4);
      src.setFault('doorOpen', true);
      src.sim.body.trunk = true;
      session.fastForward(1.5);
      break;
    case 'service':
      // Start of the day with a service due soon.
      src.setService('soon');
      src.parkAtStart();
      src.setDemoDrive(false);
      src.sim.setIgnition(2);
      src.sim.start();
      session.fastForward(4);
      break;
    case 'messages':
      // Two yellow warnings taking turns.
      src.jumpTo('rural');
      session.fastForward(20);
      src.setFault('washerFluid', true);
      src.setFault('brakePads', true);
      session.fastForward(1);
      src.paused = true;
      break;
    case 'reverse':
      // Reversing out of the bay as a car comes along the aisle.
      src.parkAtStart();
      for (let i = 0; i < 300 && src.crossTraffic.state === 'none'; i++) session.fastForward(0.1);
      src.paused = true;
      break;
    case 'parking':
      // Creeping into the destination bay towards the wall.
      src.world.jumpTo(src.world.route.length - 9, 0);
      src.demo.resume(src.sim);
      src.sim.state.speedMs = 1.5;
      for (let i = 0; i < 100 && (src.scene().park.front[1] ?? 9) > 0.7; i++)
        session.fastForward(0.1);
      src.paused = true;
      break;
    case 'redline': {
      src.jumpTo('motorway');
      src.setDemoDrive(false);
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
