/** Engine start-stop: off (button), ready, auto-stopped, blocked at a stop, manual restart needed. */
export type StartStopState = 'off' | 'ready' | 'stopped' | 'blocked' | 'restartRequired';
export const START_STOP_STATES: StartStopState[] = [
  'off',
  'ready',
  'stopped',
  'blocked',
  'restartRequired',
];

/** Why the engine keeps running at a stop (shown on the vehicle page, not as a fault). */
export type StopBlock =
  | 'none'
  | 'engineCold'
  | 'battery'
  | 'climate'
  | 'gradient'
  | 'steering'
  | 'doorOrBelt'
  | 'filterCleaning';
export const STOP_BLOCKS: StopBlock[] = [
  'none',
  'engineCold',
  'battery',
  'climate',
  'gradient',
  'steering',
  'doorOrBelt',
  'filterCleaning',
];

export interface StartStopInput {
  speedKmh: number;
  brake: number;
  throttle: number;
  /** Auto Hold or ACC stop & go is holding the car (no brake pedal needed). */
  holding: boolean;
  inDrive: boolean;
  engineRunning: boolean;
  coolantC: number;
  /** 12 V battery healthy enough to restart. */
  batteryOk: boolean;
  ambientC: number;
  gradient: number;
  steeringDeg: number;
  doorOpen: boolean;
  beltOn: boolean;
  /** Diesel particulate filter is cleaning itself (needs the engine). */
  filterCleaning: boolean;
  dt: number;
}

export interface StartStopOutput {
  stopEngine: boolean;
  startEngine: boolean;
}

/** Stopped this long before the engine switches off, s. */
const STOP_DELAY_S = 0.6;
/** Climate needs the engine back after this long, s. */
const CLIMATE_LIMIT_S = 180;

/**
 * Engine start-stop as on most modern cars: at a standstill with the brake
 * held (or Auto Hold) the engine switches off; releasing the brake, the
 * accelerator or a system need starts it again. If conditions aren't right
 * the engine keeps running and the reason is shown. Opening the door or
 * unbuckling while stopped means the driver must restart with the button.
 * The button disables it for the trip; it is on again at every start.
 */
export class StartStop {
  enabled = true;
  state: StartStopState = 'ready';
  reason: StopBlock = 'none';
  private stillT = 0;
  private stoppedT = 0;
  private movedSinceStart = false;
  readonly out: StartStopOutput = { stopEngine: false, startEngine: false };

  onIgnition(): void {
    this.enabled = true;
    this.state = 'ready';
    this.movedSinceStart = false;
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  /** Driver restarted with the button (after "restart required"). */
  manualRestart(): void {
    if (this.state === 'restartRequired' || this.state === 'stopped') this.state = 'ready';
  }

  private block(i: StartStopInput): StopBlock {
    if (i.coolantC < 50) return 'engineCold';
    if (!i.batteryOk) return 'battery';
    if (i.ambientC > 30 || i.ambientC < -2) return 'climate';
    if (Math.abs(i.gradient) > 0.12) return 'gradient';
    if (Math.abs(i.steeringDeg) > 120) return 'steering';
    if (i.doorOpen || !i.beltOn) return 'doorOrBelt';
    if (i.filterCleaning) return 'filterCleaning';
    return 'none';
  }

  step(i: StartStopInput): StartStopOutput {
    const o = this.out;
    o.stopEngine = false;
    o.startEngine = false;
    if (i.speedKmh > 8) this.movedSinceStart = true;

    if (this.state === 'stopped' || this.state === 'restartRequired') return this.whileStopped(i);
    if (!this.enabled) {
      this.state = 'off';
      return o;
    }
    const still = i.speedKmh < 0.5 && i.inDrive && (i.brake > 0.15 || i.holding);
    this.stillT = still ? this.stillT + i.dt : 0;
    if (!still || !i.engineRunning) {
      this.state = 'ready';
      this.reason = 'none';
      return o;
    }
    this.reason = this.block(i);
    // The first stop after starting needs the car to have driven off first.
    if (this.reason !== 'none' || !this.movedSinceStart) {
      this.state = 'blocked';
      return o;
    }
    if (this.stillT >= STOP_DELAY_S) {
      this.state = 'stopped';
      this.stoppedT = 0;
      o.stopEngine = true;
    }
    return o;
  }

  private whileStopped(i: StartStopInput): StartStopOutput {
    const o = this.out;
    this.stoppedT += i.dt;
    if (this.state === 'restartRequired') return o;
    // Leaving the car (door open, belt off): no automatic restart for safety.
    if (i.doorOpen || !i.beltOn) {
      this.state = 'restartRequired';
      return o;
    }
    const wantsToGo = i.throttle > 0.03 || (i.brake < 0.08 && !i.holding) || !i.inDrive;
    const systemNeed =
      !i.batteryOk || (this.stoppedT > CLIMATE_LIMIT_S && (i.ambientC > 25 || i.ambientC < 5));
    if (wantsToGo || systemNeed) {
      this.state = 'ready';
      o.startEngine = true;
    }
    return o;
  }
}

export type AutoHoldState = 'off' | 'armed' | 'holding';
export const AUTO_HOLD_STATES: AutoHoldState[] = ['off', 'armed', 'holding'];

/**
 * Auto Hold: once the car has stopped on the brake, it keeps holding after the
 * pedal is released, until the accelerator is pressed. With the door open or
 * the belt off it hands over to the electric parking brake.
 */
export class AutoHold {
  enabled = false;
  state: AutoHoldState = 'off';

  toggle(): void {
    this.enabled = !this.enabled;
  }

  /** Returns the brake to hold with, or null. `park` = apply the parking brake. */
  step(i: {
    speedKmh: number;
    brake: number;
    throttle: number;
    inDrive: boolean;
    doorOpen: boolean;
    beltOn: boolean;
  }): { brake: number | null; park: boolean } {
    if (!this.enabled) {
      this.state = 'off';
      return { brake: null, park: false };
    }
    if (this.state === 'holding') {
      if (i.doorOpen || !i.beltOn) {
        this.state = 'armed';
        return { brake: null, park: true };
      }
      if (i.throttle > 0.05 || !i.inDrive) {
        this.state = 'armed';
        return { brake: null, park: false };
      }
      return { brake: 0.35, park: false };
    }
    this.state = 'armed';
    if (i.speedKmh < 0.3 && i.brake > 0.1 && i.inDrive) this.state = 'holding';
    return { brake: null, park: false };
  }
}

export type GearAdvice = 'none' | 'up' | 'down';
export const GEAR_ADVICE: GearAdvice[] = ['none', 'up', 'down'];

/**
 * Gear recommendation for manual gear selection (EU-required on manual cars):
 * shift up early at light load, down when the engine labours. Off in Sport.
 */
export function gearAdvice(i: {
  manual: boolean;
  sport: boolean;
  gear: number;
  gears: number;
  rpm: number;
  idleRpm: number;
  /** Engine speed in the next gear up / down. */
  rpmUp: number;
  rpmDown: number;
  throttle: number;
  redlineRpm: number;
}): { advice: GearAdvice; gear: number } {
  if (!i.manual || i.sport || i.gear < 1) return { advice: 'none', gear: i.gear };
  const upAt = i.throttle > 0.6 ? i.redlineRpm - 800 : i.throttle > 0.3 ? 2800 : 2100;
  if (i.gear < i.gears && i.rpm > upAt && i.rpmUp > i.idleRpm + 450)
    return { advice: 'up', gear: i.gear + 1 };
  if (i.gear > 1 && i.rpm < i.idleRpm + 250 && i.rpmDown < i.redlineRpm - 1000)
    return { advice: 'down', gear: i.gear - 1 };
  return { advice: 'none', gear: i.gear };
}

/**
 * Shift lights (Sport): fill over the last ~1 800 rpm before the shift point,
 * then flash at the shift point. Returns 0–1 fill, or 2 for flashing.
 */
export function shiftLight(rpm: number, redlineRpm: number): number {
  const shiftAt = redlineRpm - 300;
  const from = shiftAt - 1800;
  if (rpm >= shiftAt) return 2;
  return Math.max(0, Math.min(1, (rpm - from) / (shiftAt - from)));
}
