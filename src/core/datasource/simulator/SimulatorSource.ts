import { Emitter } from '../../emitter';
import { S } from '../../signals/catalog';
import type { Sample, SignalId, SignalSource } from '../../signals/types';
import { FUEL_TYPE_TO_CODE } from '../../obd/pids';
import type {
  CapabilityProfile,
  ConnectionStatus,
  DataSource,
  DTC,
  Priority,
  Unsubscribe,
  VehicleInfo,
} from '../types';
import { AutoDriver } from './autodriver';
import type { VehicleProfile } from './profile';
import { SCENARIO_BY_ID, SCENARIOS, START_SEQUENCE, type ScenarioId } from './scenarios';
import { profileSignals } from './signals';
import { VehicleSimulator, type FaultKind } from './vehicle';

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

export interface SimulatorOptions {
  seed?: number;
  /** Begin with the ignition off and play the start-up sequence. */
  startOff?: boolean;
  scenario?: ScenarioId;
  /** Cycle through all scenarios (demo attract mode). */
  attract?: boolean;
}

/**
 * Feeds the physics simulator through the standard DataSource interface, so the
 * cluster cannot tell it apart from a real car. Each signal is tagged with the
 * channel a real car would deliver it on (standard PID, manufacturer PID, CAN).
 */
export class SimulatorSource implements DataSource {
  readonly id = 'simulator';
  readonly label = 'Physics simulator';
  sim: VehicleSimulator;
  autodriver: AutoDriver;
  autopilot = true;
  attract: boolean;
  scenario: ScenarioId;
  /** Dark outside override (screenshots); scenarios set light themselves. */
  night = false;

  private samples = new Emitter<Sample>();
  private status = new Emitter<ConnectionStatus>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick = 0;
  private accumulator = 0;
  private stepCount = 0;
  private manualIdle = Infinity;
  private manual: Required<ManualInput> = { throttle: 0, brake: 0 };
  private sources = new Map<SignalId, SignalSource>();
  private wanted = new Set<SignalId>();
  private prelude: AutoDriver | null = null;

  constructor(
    readonly profile: VehicleProfile,
    options: SimulatorOptions = {},
    private clock: () => number = () => performance.now(),
  ) {
    this.sim = new VehicleSimulator(profile, options.seed ?? 1);
    for (const s of profileSignals(profile)) {
      this.sources.set(s.id, s.source);
      this.wanted.add(s.id);
    }
    this.attract = options.attract ?? false;
    this.scenario = options.scenario ?? 'city';
    this.autodriver = new AutoDriver();
    this.applyScenario(this.scenario, options.startOff ?? false);
  }

  // --- DataSource -----------------------------------------------------------

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
    for (const id of this.sources.keys()) rates[id] = 50;
    return {
      signals: [...this.sources.keys()],
      rates,
      fuelType: this.profile.fuelType,
      protocol: 'Simulated (ISO 15765-4 CAN 11/500)',
      vin: this.profile.vin,
      ecuCount: this.profile.electric && this.profile.engine ? 2 : 1,
    };
  }

  async vehicleInfo(): Promise<VehicleInfo> {
    return {
      vin: this.profile.vin,
      protocol: 'ISO 15765-4 CAN (11 bit, 500 kbaud)',
      obdStandard: 'EOBD',
    };
  }

  async readDTCs(): Promise<DTC[]> {
    return this.sim.dtcs();
  }

  subscribe(ids: SignalId[], _priority: Priority): void {
    for (const id of ids) if (this.sources.has(id)) this.wanted.add(id);
  }

  onSample(cb: (s: Sample) => void): Unsubscribe {
    return this.samples.on(cb);
  }

  onStatus(cb: (s: ConnectionStatus) => void): Unsubscribe {
    return this.status.on(cb);
  }

  // --- Scenarios ------------------------------------------------------------

  /** Switch scenario; the environment changes, the car keeps its state. */
  setScenario(id: ScenarioId, options: { attract?: boolean } = {}): void {
    this.attract = options.attract ?? false;
    this.applyScenario(id, false);
  }

  private applyScenario(id: ScenarioId, forceStartOff: boolean): void {
    const sc = SCENARIO_BY_ID.get(id)!;
    this.scenario = id;
    const env = this.sim.env;
    env.ambientC = sc.env.ambientC;
    env.lightIntensity = sc.env.lightIntensity;
    env.grip = sc.env.grip ?? 1;
    if (sc.cold) {
      const s = this.sim.state;
      s.coolantC = s.oilC = s.ambientC = sc.env.ambientC;
      s.batteryTempC = sc.env.ambientC;
    }
    this.sim.body.seatbelt = true; // the driver buckles up (cold start unbuckles itself)
    this.sim.body.highBeam = false;
    this.autodriver = new AutoDriver(sc.steps);
    this.autodriver.paddles = !!sc.manual;
    if (!sc.manual && this.sim.mode === 'manual') this.sim.setMode('auto');
    this.sim.inputs.curvature = 0;
    this.sim.inputs.gradient = 0;
    if ((sc.startOff || forceStartOff) && !sc.steps.some((st) => st.action === 'ignitionOn')) {
      this.sim.setIgnition(0);
      this.prelude = new AutoDriver(START_SEQUENCE);
    } else if (sc.startOff) {
      this.sim.setIgnition(0);
      this.prelude = null;
    } else {
      this.prelude = null;
      if (!this.sim.state.ready) this.prelude = new AutoDriver(START_SEQUENCE);
    }
  }

  // --- Driver controls --------------------------------------------------------

  /** Driver pedal input from keyboard / UI; pauses the autopilot. */
  setManualInput(input: ManualInput): void {
    Object.assign(this.manual, input);
    this.touch();
  }

  /** Steering-wheel paddle: switches to manual gear selection and pauses the autopilot. */
  paddle(dir: 'up' | 'down'): void {
    this.touch();
    if (dir === 'up') this.sim.shiftUp();
    else this.sim.shiftDown();
  }

  setIndicator(side: 'left' | 'right' | 'off'): void {
    this.touch();
    this.sim.inputs.leftIndicator = side === 'left';
    this.sim.inputs.rightIndicator = side === 'right';
  }

  toggleHazard(): void {
    this.sim.body.hazard = !this.sim.body.hazard;
  }

  toggleHighBeam(): void {
    const b = this.sim.body;
    if (!b.lowBeam) b.lowBeamForced = true;
    b.highBeam = !b.highBeam;
  }

  toggleFog(): void {
    this.sim.body.fog = !this.sim.body.fog;
  }

  toggleCruise(): void {
    this.sim.setCruise(!this.sim.state.cruiseActive);
  }

  /** Key: off → on (self-test) → start; running → off. */
  toggleIgnition(): void {
    const s = this.sim.state;
    this.touch();
    if (s.ready || s.ignition >= 2) {
      if (s.ready) this.sim.setIgnition(0);
      else this.sim.start();
    } else this.sim.setIgnition(2);
  }

  setNight(on: boolean): void {
    this.night = on;
  }

  setAttract(on: boolean): void {
    this.attract = on;
  }

  setAutopilot(on: boolean): void {
    this.autopilot = on;
  }

  refuel(): void {
    this.sim.refuel();
  }

  setFault(kind: FaultKind, on: boolean): void {
    if (on) this.sim.injectFault(kind);
    else this.sim.clearFault(kind);
  }

  private touch(): void {
    this.manualIdle = 0;
  }

  get isAutopilotActive(): boolean {
    return this.autopilot && this.manualIdle >= AUTOPILOT_RESUME_S;
  }

  // --- Simulation loop --------------------------------------------------------

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

  /** Run the simulation `seconds` ahead instantly (tests, screenshots), then publish. */
  fastForward(seconds: number, each?: () => void): void {
    for (let i = 0; i < seconds / STEP_S; i++) {
      this.step();
      each?.();
    }
    this.emit(this.clock(), true);
  }

  private step(): void {
    this.manualIdle += STEP_S;
    if (this.night) this.sim.env.lightIntensity = 3;
    if (this.prelude) {
      this.prelude.update(this.sim, STEP_S);
      if (this.prelude.completedLoops > 0) this.prelude = null;
    } else if (this.isAutopilotActive) {
      this.autodriver.update(this.sim, STEP_S);
      if (this.attract && this.autodriver.completedLoops > 0) this.nextScenario();
    } else {
      this.sim.inputs.throttle = this.manual.throttle;
      this.sim.inputs.brake = this.manual.brake;
      this.sim.inputs.curvature = 0;
      this.sim.inputs.gradient = 0;
    }
    this.sim.step(STEP_S);
  }

  private nextScenario(): void {
    const order: ScenarioId[] = SCENARIOS.map((s) => s.id).filter((id) => id !== 'coldStart');
    const next = order[(order.indexOf(this.scenario) + 1) % order.length]!;
    this.applyScenario(next, false);
  }

  private emit(ts: number, includeLow: boolean): void {
    const sim = this.sim;
    const st = sim.state;
    const b = sim.body;
    const put = (id: SignalId, value: number): void => {
      if (!this.wanted.has(id)) return;
      this.samples.emit({ id, value, ts, source: this.sources.get(id) ?? 'simulated' });
    };
    const on = st.ignition >= 2;
    const flag = (v: boolean): number => (v ? 1 : 0);
    // OBD only answers with the ignition on.
    if (on) {
      put(S.Speed, sim.speedKmh);
      put(S.EngineSpeed, st.rpm);
      put(S.Throttle, st.throttle * 100);
      put(S.EngineLoad, st.loadPct);
      put(S.MAF, st.mafGs);
      put(S.MAP, st.mapKPa);
      put(S.FuelRate, st.fuelRateLh);
      put(S.Gear, st.gear);
      put(S.SelectedGear, sim.isElectric || sim.mode === 'auto' ? 127 : st.gear);
      put(S.ShiftRequest, flag(st.shiftRecommended));
      put(S.TractionPower, st.powerKW);
    }
    put(S.AccelLongitudinal, st.accelG);
    put(S.AccelLateral, st.latG);
    put(S.SteeringAngle, st.steeringDeg);
    put(S.BrakePedal, st.brake * 100);
    put(S.Ignition, st.ignition);
    put(S.IndicatorLeft, flag(sim.inputs.leftIndicator && on));
    put(S.IndicatorRight, flag(sim.inputs.rightIndicator && on));
    put(S.Hazard, flag(b.hazard));
    put(S.TCSActive, flag(st.tcs));
    put(S.ABSActive, flag(st.abs));
    put(S.CruiseActive, flag(st.cruiseActive));
    put(S.CruiseSpeed, st.cruiseSetKmh);
    if (!includeLow) return;
    if (on) {
      put(S.CoolantTemp, st.coolantC);
      put(S.OilTemp, st.oilC);
      put(S.IntakeTemp, st.intakeC);
      put(S.AmbientTemp, st.ambientC);
      put(S.FuelLevel, this.profile.tankL > 0 ? (st.fuelL / this.profile.tankL) * 100 : 0);
      put(S.BatteryVoltage, st.voltage);
      put(S.Odometer, st.odometerKm);
      put(S.RunTime, st.runTimeS);
      put(S.BarometricPressure, st.baroKPa);
      put(S.MIL, flag(st.mil));
      put(S.DTCCount, sim.dtcs().length);
      put(S.FuelType, FUEL_TYPE_TO_CODE[this.profile.fuelType]);
      put(S.SoC, st.soc);
      put(S.BatteryTemp, st.batteryTempC);
      if (sim.isElectric) {
        const el = this.profile.electric!;
        put(S.Range, ((st.soc / 100) * el.batteryKWh * 1000) / 165);
      }
    }
    put(S.EngineRunning, flag(st.engineRunning));
    put(S.LightIntensity, st.lightIntensity);
    put(S.LowBeam, flag(b.lowBeam));
    put(S.HighBeam, flag(b.highBeam));
    put(S.FogLight, flag(b.fog && on));
    put(S.DoorFrontLeft, flag(b.doors[0]));
    put(S.DoorFrontRight, flag(b.doors[1]));
    put(S.DoorRearLeft, flag(b.doors[2]));
    put(S.DoorRearRight, flag(b.doors[3]));
    put(S.Trunk, flag(b.trunk));
    put(S.Seatbelt, flag(b.seatbelt));
    put(S.ParkingBrake, flag(b.parkingBrake));
    put(S.TireFL, st.tires[0]);
    put(S.TireFR, st.tires[1]);
    put(S.TireRL, st.tires[2]);
    put(S.TireRR, st.tires[3]);
  }
}
