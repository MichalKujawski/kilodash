import { Emitter } from '../../emitter';
import { S } from '../../signals/catalog';
import type { Sample, SignalId } from '../../signals/types';
import type {
  CapabilityProfile,
  ConnectionStatus,
  DataSource,
  Priority,
  Unsubscribe,
  VehicleInfo,
} from '../types';
import { AutoDriver } from './autodriver';
import type { VehicleProfile } from './profile';
import { VehicleSimulator } from './vehicle';

const STEP_S = 0.01;
const MAX_STEPS_PER_TICK = 25;
/** Emit high-rate signals every N steps (100 Hz / 2 = 50 Hz). */
const HIGH_EVERY = 2;
/** Emit low-rate signals every N steps (10 Hz). */
const LOW_EVERY = 10;
/** Seconds after the last manual input before the autopilot takes over again. */
const AUTOPILOT_RESUME_S = 8;

export interface ManualInput {
  throttle?: number;
  brake?: number;
}

/**
 * Feeds the physics simulator through the standard DataSource interface, so the
 * cluster cannot tell it apart from a real car.
 */
export class SimulatorSource implements DataSource {
  readonly id = 'simulator';
  readonly label = 'Physics simulator';
  readonly sim: VehicleSimulator;
  readonly autodriver = new AutoDriver();
  autopilot = true;

  private samples = new Emitter<Sample>();
  private status = new Emitter<ConnectionStatus>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick = 0;
  private accumulator = 0;
  private stepCount = 0;
  private manualIdle = Infinity;
  private manual: Required<ManualInput> = { throttle: 0, brake: 0 };
  private wanted = new Set<SignalId>();

  constructor(
    readonly profile: VehicleProfile,
    seed = 1,
    private clock: () => number = () => performance.now(),
  ) {
    this.sim = new VehicleSimulator(profile, seed);
    for (const id of profile.signals) this.wanted.add(id);
  }

  async connect(): Promise<void> {
    if (this.timer) return;
    this.status.emit({ state: 'connecting' });
    this.lastTick = this.clock();
    this.timer = setInterval(() => this.tick(), 10);
    this.status.emit({ state: 'connected' });
  }

  async disconnect(): Promise<void> {
    clearInterval(this.timer);
    this.timer = undefined;
    this.status.emit({ state: 'disconnected' });
  }

  async discover(): Promise<CapabilityProfile> {
    const rates: Record<SignalId, number> = {};
    for (const id of this.profile.signals) rates[id] = 50;
    return {
      signals: [...this.profile.signals],
      rates,
      fuelType: this.profile.fuelType,
      protocol: 'Simulated',
      ecuCount: 1,
    };
  }

  async vehicleInfo(): Promise<VehicleInfo> {
    return { protocol: 'Simulated', obdStandard: 'EOBD' };
  }

  subscribe(ids: SignalId[], _priority: Priority): void {
    for (const id of ids) if (this.profile.signals.includes(id)) this.wanted.add(id);
  }

  onSample(cb: (s: Sample) => void): Unsubscribe {
    return this.samples.on(cb);
  }

  onStatus(cb: (s: ConnectionStatus) => void): Unsubscribe {
    return this.status.on(cb);
  }

  /** Driver pedal input from keyboard / UI; pauses the autopilot. */
  setManualInput(input: ManualInput): void {
    Object.assign(this.manual, input);
    this.manualIdle = 0;
  }

  /** Steering-wheel paddle: switches to manual gear selection and pauses the autopilot. */
  paddle(dir: 'up' | 'down'): void {
    this.manualIdle = 0;
    if (dir === 'up') this.sim.shiftUp();
    else this.sim.shiftDown();
  }

  setIndicator(side: 'left' | 'right' | 'off'): void {
    this.manualIdle = 0;
    this.sim.inputs.leftIndicator = side === 'left';
    this.sim.inputs.rightIndicator = side === 'right';
  }

  get isAutopilotActive(): boolean {
    return this.autopilot && this.manualIdle >= AUTOPILOT_RESUME_S;
  }

  /** Advance the simulation by real elapsed time using fixed steps. */
  tick(now = this.clock()): void {
    const elapsed = Math.min((now - this.lastTick) / 1000, MAX_STEPS_PER_TICK * STEP_S);
    this.lastTick = now;
    this.accumulator += elapsed;
    while (this.accumulator >= STEP_S) {
      this.accumulator -= STEP_S;
      this.step();
      this.stepCount++;
      if (this.stepCount % HIGH_EVERY === 0) this.emit(now, this.stepCount % LOW_EVERY === 0);
    }
  }

  private step(): void {
    this.manualIdle += STEP_S;
    if (this.isAutopilotActive) {
      this.autodriver.update(this.sim, STEP_S);
      if (this.sim.mode === 'manual' && this.manualIdle > AUTOPILOT_RESUME_S)
        this.sim.setMode('auto');
    } else {
      this.sim.inputs.throttle = this.manual.throttle;
      this.sim.inputs.brake = this.manual.brake;
    }
    this.sim.step(STEP_S);
  }

  private emit(ts: number, includeLow: boolean): void {
    const st = this.sim.state;
    const put = (id: SignalId, value: number): void => {
      if (this.wanted.has(id)) this.samples.emit({ id, value, ts, source: 'simulated' });
    };
    put(S.Speed, this.sim.speedKmh);
    put(S.EngineSpeed, st.rpm);
    put(S.Throttle, st.throttle * 100);
    put(S.BrakePedal, st.brake * 100);
    put(S.AccelLongitudinal, st.accelG);
    put(S.Gear, st.gear);
    put(S.SelectedGear, this.sim.mode === 'auto' ? 127 : st.gear);
    put(S.ShiftRequest, st.shiftRecommended ? 1 : 0);
    put(S.IndicatorLeft, this.sim.inputs.leftIndicator ? 1 : 0);
    put(S.IndicatorRight, this.sim.inputs.rightIndicator ? 1 : 0);
    put(S.EngineLoad, st.loadPct);
    put(S.MAF, st.mafGs);
    put(S.MAP, st.mapKPa);
    put(S.FuelRate, st.fuelRateLh);
    if (!includeLow) return;
    put(S.CoolantTemp, st.coolantC);
    put(S.OilTemp, st.oilC);
    put(S.IntakeTemp, st.intakeC);
    put(S.AmbientTemp, st.ambientC);
    put(S.FuelLevel, (st.fuelL / this.profile.tankL) * 100);
    put(S.BatteryVoltage, st.voltage);
    put(S.Odometer, st.odometerKm);
    put(S.EngineRunning, st.engineRunning ? 1 : 0);
  }
}
