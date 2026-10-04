import { Emitter } from '../../emitter';
import { FUEL_TYPE_TO_CODE } from '../../obd/pids';
import { S } from '../../signals/catalog';
import type { Sample, SignalId, SignalSource } from '../../signals/types';
import { DemoDriver } from '../../world/DemoDriver';
import type { EnvironmentSettings } from '../../world/environment';
import type { SceneSnapshot } from '../../world/scene';
import { World } from '../../world/World';
import type {
  CapabilityProfile,
  ConnectionStatus,
  DataSource,
  DTC,
  Priority,
  Unsubscribe,
  VehicleInfo,
} from '../types';
import type { VehicleProfile } from './profile';
import { profileSignals } from './signals';
import {
  VehicleSimulator,
  type FaultKind,
  type GearProgram,
  type LightSwitch,
  type Selector,
  type WiperMode,
} from './vehicle';

const STEP_S = 0.01;
const MAX_STEPS_PER_TICK = 25;
/** Emit high-rate signals every N steps (100 Hz / 2 = 50 Hz). */
const HIGH_EVERY = 2;
/** Emit low-rate signals every N steps (10 Hz). */
const LOW_EVERY = 10;
/** Seconds after the last manual input before the Demo drive takes over again. */
export const DEMO_RESUME_S = 10;

/** Toggle buttons whose systems arrive in later steps (state is kept now). */
export interface CarButtons {
  laneAssist: boolean;
  startStopOff: boolean;
  /** ESC: on, traction control off (short press), sport (long press). */
  esc: 'on' | 'tcsOff' | 'sport';
  autoHold: boolean;
  parkAssist: boolean;
  /** Steering-wheel "hands on" (for hands-off detection later). */
  handsOn: boolean;
  volume: number;
}

export interface ManualInput {
  throttle?: number;
  brake?: number;
}

export interface SimulatorOptions {
  seed?: number;
  /** Begin parked in the first bay with the ignition off (the Demo drive starts the car). */
  startOff?: boolean;
  env?: Partial<EnvironmentSettings>;
}

/** Named places on the route for demo jumps and screenshots. */
export const WORLD_PLACES: {
  id: string;
  label: string;
  segment: string;
  at: number;
  lane?: number;
}[] = [
  { id: 'town', label: 'Town centre', segment: 'Bahnhofstraße', at: 120 },
  { id: 'zone30', label: '30 zone', segment: 'Lindenweg', at: 60 },
  { id: 'rural', label: 'Rural road', segment: 'L 1180', at: 150 },
  { id: 'village', label: 'Village', segment: 'L 1180', at: 2650 },
  { id: 'motorway', label: 'Autobahn', segment: 'A 7', at: 300 },
  { id: 'tunnel', label: 'Tunnel', segment: 'A 7', at: 3200 },
  { id: 'roadworks', label: 'Roadworks & jam', segment: 'A 7', at: 5400 },
  { id: 'exit', label: 'Exit', segment: 'A 7', at: 8300 },
  { id: 'destination', label: 'Destination', segment: 'Marktstraße', at: 100 },
];

/**
 * The simulated car in its world, seen through the standard DataSource
 * interface, so the cluster cannot tell it apart from a real car. Each signal is
 * tagged with the channel a real car would deliver it on (standard PID,
 * manufacturer PID, CAN). Structured data (traffic objects, navigation, signs)
 * is available as a scene snapshot, like a camera's object list.
 */
export class SimulatorSource implements DataSource {
  readonly id = 'simulator';
  readonly label = 'Physics simulator';
  readonly sim: VehicleSimulator;
  readonly world: World;
  readonly demo: DemoDriver;
  /** Demo drive enabled (resumes after inactivity). */
  autopilot = true;
  readonly buttons: CarButtons = {
    laneAssist: true,
    startStopOff: false,
    esc: 'on',
    autoHold: false,
    parkAssist: false,
    handsOn: true,
    volume: 0.6,
  };

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
  private lastScene: SceneSnapshot | null = null;

  constructor(
    readonly profile: VehicleProfile,
    options: SimulatorOptions = {},
    private clock: () => number = () => performance.now(),
  ) {
    this.sim = new VehicleSimulator(profile, options.seed ?? 1);
    this.world = new World({ seed: options.seed, env: options.env });
    this.demo = new DemoDriver();
    for (const s of profileSignals(profile)) {
      this.sources.set(s.id, s.source);
      this.wanted.add(s.id);
    }
    for (const id of [S.LightIntensity, S.AmbientTemp]) {
      this.sources.set(id, 'can');
      this.wanted.add(id);
    }
    if (options.startOff ?? false) {
      this.sim.setIgnition(0);
      this.sim.setSelector('P');
    } else {
      // Already driving: put the car on the road in town.
      this.jumpTo('town');
    }
    this.syncEnvironment();
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

  /** Latest world snapshot (traffic, navigation, signs, environment). */
  scene(): SceneSnapshot {
    return (this.lastScene ??= this.world.snapshot());
  }

  // --- World ------------------------------------------------------------------

  setEnvironment(patch: Partial<EnvironmentSettings>): void {
    this.world.env.set(patch);
    this.syncEnvironment();
  }

  /** Jump the running car to a named place on the route (demo / screenshots). */
  jumpTo(placeId: string): void {
    const place = WORLD_PLACES.find((p) => p.id === placeId);
    if (!place) return;
    const seg = this.world.route.segments.find((s) => s.name === place.segment)!;
    this.world.jumpTo(seg.s0 + place.at, place.lane ?? 0);
    const s = this.sim;
    if (s.state.ignition < 2) s.setIgnition(2);
    if (!s.state.ready) {
      s.state.ready = true;
      s.state.engineRunning = !s.isElectric;
    }
    s.setSelector('D');
    this.demo.resume(s);
    this.lastScene = null;
  }

  /** Back to the first bay, ignition off; the Demo drive starts a new day. */
  parkAtStart(): void {
    this.world.resetToStart();
    this.sim.setIgnition(0);
    this.sim.state.speedMs = 0;
    this.sim.setSelector('P');
    this.demo.restart();
    this.lastScene = null;
  }

  private syncEnvironment(): void {
    const env = this.world.env;
    this.sim.env.ambientC = env.settings.temperatureC;
    this.sim.env.grip = env.grip;
    this.sim.env.lightIntensity = env.light;
    this.sim.env.rain = env.rain;
  }

  // --- Driver controls --------------------------------------------------------

  /** Driver pedal input from keyboard / UI; pauses the Demo drive. */
  setManualInput(input: ManualInput): void {
    Object.assign(this.manual, input);
    this.touch();
  }

  /** Steering-wheel paddle: switches to manual gear selection and pauses the Demo drive. */
  paddle(dir: 'up' | 'down'): void {
    this.touch();
    if (dir === 'up') this.sim.shiftUp();
    else this.sim.shiftDown();
  }

  setSelector(sel: Selector): boolean {
    this.touch();
    return this.sim.setSelector(sel);
  }

  /** Stalk latched up/down (continuous), or back to the centre. */
  setIndicator(side: 'left' | 'right' | 'off'): void {
    this.touch();
    this.sim.inputs.leftIndicator = side === 'left';
    this.sim.inputs.rightIndicator = side === 'right';
  }

  /** Stalk tapped: comfort blink (three flashes). */
  tapIndicator(side: 'left' | 'right'): void {
    this.touch();
    this.sim.inputs.leftIndicator = this.sim.inputs.rightIndicator = false;
    this.sim.tapIndicator(side);
  }

  toggleHazard(): void {
    this.sim.body.hazard = !this.sim.body.hazard;
  }

  setLightSwitch(pos: LightSwitch): void {
    this.sim.body.lightSwitch = pos;
  }

  toggleHighBeam(): void {
    this.sim.body.highBeamLatched = !this.sim.body.highBeamLatched;
  }

  /** Headlight flash while the stalk is pulled. */
  setFlash(on: boolean): void {
    this.sim.body.highBeamFlash = on;
  }

  toggleAutoHighBeam(): void {
    this.sim.body.autoHighBeam = !this.sim.body.autoHighBeam;
  }

  toggleFog(): void {
    this.sim.body.fog = !this.sim.body.fog;
  }

  toggleFogRear(): void {
    this.sim.body.fogRear = !this.sim.body.fogRear;
  }

  setWipers(mode: WiperMode): void {
    this.sim.body.wipers = mode;
  }

  setWasher(on: boolean): void {
    this.sim.body.washer = on;
  }

  setGearProgram(p: GearProgram): void {
    this.touch();
    this.sim.setGearProgram(p);
  }

  /** Engine start/stop button (brake pressed = start). */
  pressStart(): void {
    this.touch();
    this.sim.pressStart(this.manual.brake > 0.2 || this.sim.inputs.brake > 0.2);
  }

  toggleCruise(): void {
    this.sim.setCruise(!this.sim.state.cruiseActive);
  }

  /** SET− / RES+: ±1 km/h, long press to the next multiple of 10 (until ACC arrives, drives cruise). */
  adjustCruise(dir: 1 | -1, long = false): void {
    const s = this.sim.state;
    if (!s.cruiseActive) {
      this.sim.setCruise(true, this.sim.speedKmh);
      return;
    }
    const v = s.cruiseSetKmh;
    s.cruiseSetKmh = long
      ? dir > 0
        ? Math.floor(v / 10) * 10 + 10
        : Math.ceil(v / 10) * 10 - 10
      : v + dir;
  }

  cancelCruise(): void {
    this.sim.setCruise(false);
  }

  pressButton(b: 'laneAssist' | 'startStopOff' | 'autoHold' | 'parkAssist' | 'handsOn'): void {
    this.buttons[b] = !this.buttons[b];
  }

  /** ESC button: short press toggles traction control off, long press = ESC sport. */
  pressEsc(long: boolean): void {
    const e = this.buttons.esc;
    this.buttons.esc = e !== 'on' ? 'on' : long ? 'sport' : 'tcsOff';
  }

  setVolume(v: number): void {
    this.buttons.volume = Math.max(0, Math.min(1, v));
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
    return this.autopilot && this.manualIdle >= DEMO_RESUME_S;
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

  private wasAutopilot = true;

  private step(): void {
    const sim = this.sim;
    const world = this.world;
    this.manualIdle += STEP_S;
    const scene = world.snapshot();
    this.lastScene = scene;
    const auto = this.isAutopilotActive;
    if (auto) {
      if (!this.wasAutopilot) this.demo.resume(sim);
      this.demo.update(sim, world, scene, STEP_S);
    } else {
      sim.inputs.throttle = this.manual.throttle;
      sim.inputs.brake = this.manual.brake;
      // The driver steers along the road; an indicator held on a multi-lane
      // road becomes a lane change.
      if (sim.inputs.leftIndicator && world.ego.targetLane === world.ego.lane) world.changeLane(1);
      if (sim.inputs.rightIndicator && world.ego.targetLane === world.ego.lane)
        world.changeLane(-1);
    }
    this.wasAutopilot = auto;
    sim.inputs.curvature = world.curvature();
    sim.inputs.gradient = world.gradient() * sim.state.direction;
    this.syncEnvironment();
    sim.step(STEP_S);
    world.step(STEP_S, sim.state.speedMs, sim.state.direction);
    // Never drive through the car ahead (emergency braking comes with the assist systems).
    const lead = scene.lead;
    if (lead && lead.dx < 0.4 && sim.state.direction === 1)
      sim.state.speedMs = Math.min(sim.state.speedMs, lead.v);
  }

  /**
   * Current value of every signal the car exposes right now (OBD is silent with
   * the ignition off). Shared by sample emission and tools.
   */
  values(includeLow = true): Map<SignalId, number> {
    const out = new Map<SignalId, number>();
    const sim = this.sim;
    const st = sim.state;
    const b = sim.body;
    const put = (id: SignalId, value: number): void => {
      if (this.sources.has(id)) out.set(id, value);
    };
    const on = st.ignition >= 2;
    const flag = (v: boolean): number => (v ? 1 : 0);
    const sel = st.selector;
    if (on) {
      put(S.Speed, sim.speedKmh);
      put(S.EngineSpeed, st.rpm);
      put(S.Throttle, st.throttle * 100);
      put(S.EngineLoad, st.loadPct);
      put(S.MAF, st.mafGs);
      put(S.MAP, st.mapKPa);
      put(S.FuelRate, st.fuelRateLh);
      put(S.Gear, sel === 'R' ? -1 : sel === 'D' ? st.gear : 0);
      // VSS: 126 = Park, 127 = Drive (automatic), −1 = reverse, 0 = neutral, n = manual gear.
      put(
        S.SelectedGear,
        sel === 'P'
          ? 126
          : sel === 'R'
            ? -1
            : sel === 'N'
              ? 0
              : sim.isElectric || sim.mode === 'auto'
                ? 127
                : st.gear,
      );
      put(S.ShiftRequest, flag(st.shiftRecommended));
      put(S.TractionPower, st.powerKW);
    }
    put(S.AccelLongitudinal, st.accelG);
    put(S.AccelLateral, st.latG);
    put(S.SteeringAngle, st.steeringDeg);
    put(S.BrakePedal, st.brake * 100);
    put(S.Ignition, st.ignition);
    put(S.IndicatorLeft, flag(sim.indicating('left') && on));
    put(S.IndicatorRight, flag(sim.indicating('right') && on));
    put(S.Hazard, flag(b.hazard));
    put(S.TCSActive, flag(st.tcs));
    put(S.ESCMode, ['on', 'tcsOff', 'sport'].indexOf(this.buttons.esc));
    put(S.LaneAssistEnabled, flag(this.buttons.laneAssist));
    put(S.ABSActive, flag(st.abs));
    put(S.CruiseActive, flag(st.cruiseActive));
    put(S.CruiseSpeed, st.cruiseSetKmh);
    if (!includeLow) return out;
    if (on) {
      put(S.CoolantTemp, st.coolantC);
      put(S.OilTemp, st.oilC);
      put(S.IntakeTemp, st.intakeC);
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
    put(S.AmbientTemp, st.ambientC);
    put(S.EngineRunning, flag(st.engineRunning));
    put(S.LightIntensity, st.lightIntensity);
    put(S.LowBeam, flag(b.lowBeam));
    put(S.HighBeam, flag(b.highBeam));
    put(S.FogLight, flag(b.fog && on));
    put(S.FogRear, flag(b.fogRear && on));
    put(S.ParkingLights, flag(b.parkingLights));
    put(S.Wipers, ['off', 'auto', 'interval', 'slow', 'fast'].indexOf(b.wipers));
    put(S.GearboxMode, ['D', 'S', 'M'].indexOf(sim.gearProgram));
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
    return out;
  }

  private emit(ts: number, includeLow: boolean): void {
    for (const [id, value] of this.values(includeLow)) {
      if (this.wanted.has(id))
        this.samples.emit({ id, value, ts, source: this.sources.get(id) ?? 'simulated' });
    }
  }
}
