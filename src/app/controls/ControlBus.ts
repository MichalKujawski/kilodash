import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import type { ClusterKey } from '@/cluster/renderer/types';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { LightSwitch, WiperMode } from '@/core/datasource/simulator/vehicle';
import type { Action } from './actions';

/** Held longer than this = "hold" (latched indicator, long press), ms. */
export const LONG_PRESS_MS = 450;
/** Keyboard pedals ramp in over this time, s (a foot doesn't jump to the floor). */
const PEDAL_RAMP_S = 0.5;

const LIGHT_ORDER: LightSwitch[] = ['off', 'auto', 'parking', 'low'];
const WIPER_ORDER: WiperMode[] = ['off', 'auto', 'interval', 'slow', 'fast'];

export interface BusHooks {
  renderer: () => ClusterRenderer | null;
  toggleMute?: () => void;
}

/**
 * Turns presses and releases from any input (keyboard, pointer, gamepad) into
 * car actions with real-control semantics: stalk tap vs hold, short vs long
 * presses, momentary flash and washer, pedals that ramp.
 */
export class ControlBus {
  private down = new Map<Action, number>();
  private pedals = { throttle: 0, brake: 0 };
  /** Pedal position set directly by a pointer/gamepad (overrides the key ramp). */
  private analog: { throttle: number | null; brake: number | null } = {
    throttle: null,
    brake: null,
  };
  private timer: ReturnType<typeof setInterval>;
  private last = performance.now();

  constructor(
    private source: SimulatorSource,
    private hooks: BusHooks,
  ) {
    this.timer = setInterval(() => this.tick(), 20);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  get pedalState(): { throttle: number; brake: number } {
    return {
      throttle: this.analog.throttle ?? this.pedals.throttle,
      brake: this.analog.brake ?? this.pedals.brake,
    };
  }

  isDown(a: Action): boolean {
    return this.down.has(a);
  }

  /** Pedal set by a slider or trigger (null releases it to the keyboard ramp). */
  setPedal(which: 'throttle' | 'brake', value: number | null): void {
    this.analog[which] = value;
    this.applyPedals();
  }

  private applyPedals(): void {
    const p = this.pedalState;
    if (p.throttle > 0 || p.brake > 0 || this.down.has('throttle') || this.down.has('brake')) {
      this.source.setManualInput(p);
    }
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const step = dt / PEDAL_RAMP_S;
    for (const k of ['throttle', 'brake'] as const) {
      const target = this.down.has(k) ? 1 : 0;
      // Release faster than press: lifting a foot is quick.
      this.pedals[k] =
        target > this.pedals[k]
          ? Math.min(1, this.pedals[k] + step)
          : Math.max(0, this.pedals[k] - step * 3);
    }
    const p = this.pedalState;
    if (p.throttle > 0 || p.brake > 0) this.source.setManualInput(p);
    // A held indicator stalk latches after the long-press time.
    for (const side of ['indicatorLeft', 'indicatorRight'] as const) {
      const t = this.down.get(side);
      if (t !== undefined && now - t > LONG_PRESS_MS) {
        this.source.setIndicator(side === 'indicatorLeft' ? 'left' : 'right');
      }
    }
  }

  /** Steering-wheel keys go to the driving-mode list while it is open, else to the cluster. */
  private cluster(key: ClusterKey): void {
    const src = this.source;
    if (src.driveModeUiOpen) {
      const k = key === 'okLong' ? 'ok' : key;
      if (
        (k === 'up' ||
          k === 'down' ||
          k === 'left' ||
          k === 'right' ||
          k === 'ok' ||
          k === 'back') &&
        src.driveModeKey(k)
      )
        return;
    }
    this.hooks.renderer()?.input(key);
  }

  press(a: Action): void {
    if (this.down.has(a)) return;
    this.down.set(a, performance.now());
    const src = this.source;
    const sim = src.sim;
    switch (a) {
      case 'throttle':
      case 'brake':
        this.applyPedals();
        break;
      case 'paddleUp':
        src.paddle('up');
        break;
      case 'paddleDown':
        src.paddle('down');
        break;
      case 'flash':
        src.setFlash(true);
        break;
      case 'washer':
        src.setWasher(true);
        break;
      case 'scrollUp':
        this.cluster('up');
        break;
      case 'scrollDown':
        this.cluster('down');
        break;
      case 'left':
        this.cluster('left');
        break;
      case 'right':
        this.cluster('right');
        break;
      case 'view':
        this.cluster('view');
        break;
      case 'back':
        this.cluster('back');
        break;
      case 'home':
        this.cluster('home');
        break;
      case 'highBeam':
        src.toggleHighBeam();
        break;
      case 'autoHighBeam':
        src.toggleAutoHighBeam();
        break;
      case 'lightSwitch': {
        const i = LIGHT_ORDER.indexOf(sim.body.lightSwitch);
        src.setLightSwitch(LIGHT_ORDER[(i + 1) % LIGHT_ORDER.length]!);
        break;
      }
      case 'wipersUp':
      case 'wipersDown': {
        const i = WIPER_ORDER.indexOf(sim.body.wipers) + (a === 'wipersUp' ? 1 : -1);
        src.setWipers(WIPER_ORDER[Math.max(0, Math.min(WIPER_ORDER.length - 1, i))]!);
        break;
      }
      case 'fog':
        src.toggleFog();
        break;
      case 'fogRear':
        src.toggleFogRear();
        break;
      case 'gearP':
        src.setSelector('P');
        break;
      case 'gearR':
        src.setSelector('R');
        break;
      case 'gearN':
        src.setSelector('N');
        break;
      case 'gearD':
        if (src.setSelector('D')) src.setGearProgram('D');
        break;
      case 'gearS':
        // EVs have B (strong regeneration) where combustion cars have S.
        if (sim.isElectric) src.toggleEvB();
        else if (src.setSelector('D')) src.setGearProgram('S');
        break;
      case 'gearM':
        if (src.setSelector('D')) src.setGearProgram('M');
        break;
      case 'start':
        src.pressStart();
        break;
      case 'hazard':
        src.toggleHazard();
        break;
      case 'startStop':
        src.pressButton('startStopOff');
        break;
      case 'autoHold':
        src.pressButton('autoHold');
        break;
      case 'parkAssist':
        src.pressButton('parkAssist');
        break;
      case 'laneAssist':
        src.pressButton('laneAssist');
        break;

      case 'accCancel':
        src.cancelCruise();
        break;
      case 'volumeUp':
        src.setVolume(src.buttons.volume + 0.1);
        break;
      case 'volumeDown':
        src.setVolume(src.buttons.volume - 0.1);
        break;
      case 'driveMode':
        src.pressDriveMode();
        break;
      case 'demo':
        src.setAutopilot(!src.autopilot);
        break;
      case 'night':
        this.hooks.renderer()?.cycleNightMode();
        break;
      case 'mute':
        this.hooks.toggleMute?.();
        break;
      default:
        break; // acted on at release (tap vs long press)
    }
  }

  release(a: Action): void {
    const t = this.down.get(a);
    if (t === undefined) return;
    this.down.delete(a);
    const long = performance.now() - t > LONG_PRESS_MS;
    const src = this.source;
    switch (a) {
      case 'throttle':
      case 'brake':
        if (!this.down.has('throttle') && !this.down.has('brake'))
          src.setManualInput(this.pedalState);
        break;
      case 'indicatorLeft':
      case 'indicatorRight': {
        const side = a === 'indicatorLeft' ? 'left' : 'right';
        const latched =
          side === 'left' ? src.sim.inputs.leftIndicator : src.sim.inputs.rightIndicator;
        // Tap = comfort blink; tapping against a latched stalk returns it to centre.
        if (!long) {
          if (latched) src.setIndicator('off');
          else if (src.sim.inputs.leftIndicator || src.sim.inputs.rightIndicator)
            src.setIndicator('off');
          else src.tapIndicator(side);
        }
        break;
      }
      case 'flash':
        src.setFlash(false);
        break;
      case 'washer':
        src.setWasher(false);
        break;
      case 'singleWipe':
        src.setWipers(src.sim.body.wipers);
        break;
      case 'ok':
        this.cluster(long ? 'okLong' : 'ok');
        break;
      case 'esc':
        src.pressEsc(long);
        break;
      case 'accMain':
        src.pressCruiseMain(long);
        break;
      case 'accDistance':
        src.pressDistance();
        break;
      case 'accSet':
        src.adjustCruise(-1, long);
        break;
      case 'accRes':
        src.adjustCruise(1, long);
        break;
      default:
        break;
    }
  }

  /** Click on an on-screen control: press then release (short press). */
  click(a: Action): void {
    this.press(a);
    this.release(a);
  }
}
