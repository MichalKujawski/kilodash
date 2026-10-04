import { Emitter } from '../../emitter';
import { FUEL_TYPE_TO_CODE } from '../../obd/pids';
import { S } from '../../signals/catalog';
import type { Sample, SignalId, SignalSource } from '../../signals/types';
import { ASSIST_FUNCTIONS, ASSIST_STATES, SpeedAssist } from '../../assist/SpeedAssist';
import {
  ISA_LEVELS,
  IsaWarning,
  SpeedLimitRecognition,
  type RecognizedLimit,
} from '../../assist/SpeedLimitRecognition';
import { createRng, SmoothNoise } from '../../math';
import {
  BLIND_SPOT_STATES,
  BlindSpot,
  CollisionAssist,
  CROSS_TRAFFIC_STATES,
  CrossTraffic,
  FCW_STAGES,
} from '../../assist/CollisionAssist';
import { IndirectTpms, SEAT_STATES, SeatbeltReminder, ServiceInterval } from '../../body/monitors';
import { AutoHighBeam, FatigueMonitor } from '../../body/lights';
import { ParkAssist } from '../../body/ParkAssist';
import { ExhaustFluid, ParticulateFilter } from '../../drive/Diesel';
import {
  AUTO_HOLD_STATES,
  AutoHold,
  GEAR_ADVICE,
  gearAdvice,
  shiftLight,
  START_STOP_STATES,
  StartStop,
  STOP_BLOCKS,
} from '../../drive/StartStop';
import { driverSteer, LaneAssist, LANE_ASSIST_STATES, LINE_STATES } from '../../assist/LaneAssist';
import { consumerFuelLh, ecoTip, type EfficiencyState } from '../../drive/efficiency';
import { DRIVE_MODE_ORDER } from '../../drive/modes';
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
  G,
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
  /** Steering-wheel "hands on" (hands-off detection). */
  handsOn: boolean;
  /** Workshop: the driver looks at their phone (weak, late steering and braking). */
  distracted: boolean;
  /** Workshop: radar/camera covered (dirt, snow). */
  sensorBlocked: boolean;
  /** Workshop: the driver is tired (micro-sleeps, then sharp corrections). */
  tired: boolean;
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
  { id: 'wetLimit', label: 'Limit when wet', segment: 'A 7', at: 7350, lane: 0 },
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
  /** Cruise control / ACC / speed limiter. */
  readonly assist: SpeedAssist;
  /** Traffic-sign recognition + map, and the speed warning (ISA). */
  readonly recognition: SpeedLimitRecognition;
  readonly isa = new IsaWarning();
  /** Lane keeping / centering with hands-off staging. */
  readonly lane = new LaneAssist();
  /** Collision warning + emergency braking, blind spot, rear cross traffic. */
  readonly collision = new CollisionAssist();
  readonly blindSpot = new BlindSpot();
  readonly crossTraffic = new CrossTraffic();
  /** Engine start-stop and Auto Hold. */
  readonly startStop = new StartStop();
  readonly autoHold = new AutoHold();
  /** Diesel: particulate filter and exhaust fluid. */
  readonly dpf = new ParticulateFilter();
  readonly def = new ExhaustFluid();
  /** Seat-belt reminder, indirect tyre monitoring, service interval. */
  readonly belts = new SeatbeltReminder();
  readonly tpmsIndirect = new IndirectTpms();
  readonly service: ServiceInterval;
  /** Park distance control, auto high beam, fatigue detection. */
  readonly park = new ParkAssist();
  readonly highBeam = new AutoHighBeam();
  readonly fatigue = new FatigueMonitor();
  private sleepT = 0;
  private lastOdo = 0;
  private wander: SmoothNoise;
  /** The limit the car believes applies (what the cluster shows). */
  recognized: RecognizedLimit = {
    limit: undefined,
    advisory: null,
    noOvertaking: false,
    plate: null,
    source: 'map',
  };
  private seenSigns = new Set<number>();
  private lastRoad = '';
  private lastIgnition = 2;
  /** Demo drive enabled (resumes after inactivity). */
  autopilot = true;
  /** Freeze the simulation (review poses of short events); the cluster keeps drawing. */
  paused = false;
  readonly buttons: CarButtons = {
    laneAssist: true,
    startStopOff: false,
    esc: 'on',
    autoHold: false,
    parkAssist: false,
    handsOn: true,
    distracted: false,
    sensorBlocked: false,
    tired: false,
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
    this.assist = new SpeedAssist(!!profile.equipment?.acc);
    this.service = new ServiceInterval(profile.service?.km, profile.service?.days);
    this.recognition = new SpeedLimitRecognition(createRng((options.seed ?? 1) + 10));
    this.wander = new SmoothNoise(createRng((options.seed ?? 1) + 21), 0.25);
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
    this.resetRecognition();
  }

  private resetRecognition(): void {
    this.recognition.reset();
    this.seenSigns.clear();
    this.lastRoad = '';
  }

  /** Back to the first bay, ignition off; the Demo drive starts a new day. */
  parkAtStart(): void {
    this.world.resetToStart();
    this.sim.setIgnition(0);
    this.sim.state.speedMs = 0;
    this.sim.setSelector('P');
    this.demo.restart();
    this.lastScene = null;
    this.resetRecognition();
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

  /**
   * Steering-wheel paddle: switches to manual gear selection and pauses the
   * Demo drive. On an EV the paddles set the regeneration level instead
   * (left/down = stronger, right/up = weaker).
   */
  paddle(dir: 'up' | 'down'): void {
    this.touch();
    const sim = this.sim;
    if (sim.isElectric) {
      const st = sim.state;
      st.evB = false;
      st.regenLevel = Math.max(0, Math.min(3, st.regenLevel + (dir === 'down' ? 1 : -1)));
      return;
    }
    if (dir === 'up') sim.shiftUp();
    else sim.shiftDown();
  }

  /** EV: B on the selector (strong regeneration, one-pedal driving); toggles. */
  toggleEvB(): void {
    const st = this.sim.state;
    if (!this.sim.isElectric || st.selector !== 'D') return;
    st.evB = !st.evB;
  }

  // --- Driving mode -----------------------------------------------------------

  /** Mode button: opens the list in the cluster, further presses step through it. */
  pressDriveMode(): void {
    this.sim.driveModes.pressButton();
  }

  /** Whether the drive-mode list or Individual screen currently takes the cluster keys. */
  get driveModeUiOpen(): boolean {
    const st = this.sim.driveModes.state;
    return !!st.popup || !!st.config;
  }

  /** Cluster keys while the mode list is open. Returns true if consumed. */
  driveModeKey(key: 'up' | 'down' | 'left' | 'right' | 'ok' | 'back'): boolean {
    const dm = this.sim.driveModes;
    const st = this.sim.state;
    const parked = st.speedMs < 0.3 && (st.selector === 'P' || this.sim.body.parkingBrake);
    switch (key) {
      case 'up':
        return dm.move(-1);
      case 'down':
        return dm.move(1);
      case 'left':
        return dm.adjust(-1);
      case 'right':
        return dm.adjust(1);
      case 'ok':
        return dm.ok(parked);
      case 'back':
        return dm.back();
    }
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

  /** Main button: short = on/off, long = switch between cruise/ACC and the limiter. */
  pressCruiseMain(long = false): void {
    if (long) this.assist.switchFunction();
    else this.assist.pressMain();
  }

  /** SET− (dir −1) / RES+ (dir +1): short ±1 km/h, long to the next multiple of 10. */
  adjustCruise(dir: 1 | -1, long = false): void {
    if (dir < 0) this.assist.pressSet(long, this.sim.speedKmh);
    else this.assist.pressRes(long, this.sim.speedKmh);
  }

  cancelCruise(): void {
    this.assist.cancel();
  }

  pressDistance(): void {
    this.assist.pressDistance();
  }

  /** Workshop: service due soon / overdue / done. */
  setService(what: 'soon' | 'overdue' | 'reset'): void {
    if (what === 'soon') {
      this.service.km = 900;
      this.service.days = 21;
    } else if (what === 'overdue') {
      this.service.km = -120;
      this.service.days = -4;
    } else this.service.reset();
  }

  /** Workshop: store the current tyre pressures (indirect monitoring). */
  storeTyrePressures(): void {
    this.tpmsIndirect.store(this.sim.state.tires);
  }

  /** Workshop: occupants and their belts. */
  toggleDriverBelt(): void {
    this.sim.body.seatbelt = !this.sim.body.seatbelt;
  }

  setPassenger(present: boolean, belted: boolean): void {
    this.sim.body.passenger = { present, belted };
  }

  setRearSeat(seat: 0 | 1 | 2, state: 'empty' | 'belted' | 'unbelted'): void {
    const rear = [...this.sim.body.rear];
    rear[seat] = state;
    this.sim.body.rear = rear;
  }

  /** Workshop: fill the particulate filter / empty the exhaust fluid to see the warnings. */
  setDieselDemo(what: 'dpf' | 'def' | 'service'): void {
    if (what === 'dpf') this.dpf.load = 82;
    else if (what === 'def') this.def.litres = 2.3;
    else {
      this.dpf.load = 20;
      this.def.refill();
    }
  }

  pressButton(
    b:
      | 'laneAssist'
      | 'startStopOff'
      | 'autoHold'
      | 'parkAssist'
      | 'handsOn'
      | 'distracted'
      | 'sensorBlocked'
      | 'tired',
  ): void {
    if (b === 'parkAssist') {
      this.park.toggle(this.sim.speedKmh);
      this.buttons.parkAssist = this.park.active;
      return;
    }
    this.buttons[b] = !this.buttons[b];
    if (b === 'laneAssist') this.lane.toggle();
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
    if (this.paused) {
      // Frozen moment (screenshots of short events): keep publishing so nothing goes stale.
      this.emit(now, true);
      return;
    }
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
    scene.driveModes = sim.driveModes.state;
    scene.efficiency = this.efficiency();
    this.lastScene = scene;
    const auto = this.isAutopilotActive;
    if (auto) {
      if (!this.wasAutopilot) this.demo.resume(sim);
      this.demo.distracted = this.buttons.distracted;
      this.demo.update(sim, world, scene, STEP_S, this.assist);
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
    // The human's own pedals, before any assist adds to them.
    const human = { throttle: sim.inputs.throttle, brake: sim.inputs.brake };
    this.recognize(scene);
    this.applyAssist(scene);
    sim.inputs.curvature = world.curvature();
    sim.inputs.gradient = world.gradient() * sim.state.direction;
    const steer = this.applyLane(scene);
    this.applyCollision(scene, human);
    this.applyStopAndHold(human);
    this.syncEnvironment();
    sim.step(STEP_S);
    world.step(STEP_S, sim.state.speedMs, sim.state.direction, steer);
    // Never drive through the car ahead (emergency braking comes with the assist systems).
    const lead = scene.lead;
    if (lead && lead.dx < 0.4 && sim.state.direction === 1)
      sim.state.speedMs = Math.min(sim.state.speedMs, lead.v);
  }

  /** Comfort consumers and the current eco tip (efficiency page). */
  private efficiency(): EfficiencyState {
    const sim = this.sim;
    const st = sim.state;
    const consumersLh = sim.consumers.reduce((a, c) => a + consumerFuelLh(c.kW), 0);
    return {
      consumers: sim.consumers,
      consumersLh,
      tip: ecoTip({
        speedKmh: sim.speedKmh,
        rpm: st.rpm,
        throttle: st.throttle,
        manualGears: sim.mode === 'manual' && !!this.profile.engine,
        consumersLh,
        coasting: st.coasting,
        ecoMode:
          sim.driveModes.state.current === 'eco' || sim.driveModes.state.available.length === 0,
      }),
    };
  }

  private lastMode = '';

  private lastIgnitionStop = 2;

  /**
   * Auto Hold and engine start-stop (combustion cars with start-stop), plus
   * the diesel's particulate filter and exhaust fluid.
   */
  private applyStopAndHold(human: { throttle: number; brake: number }): void {
    const sim = this.sim;
    const st = sim.state;
    const b = sim.body;
    const p = this.profile;
    if (this.lastIgnitionStop < 2 && st.ignition >= 2) {
      this.startStop.onIgnition();
      this.buttons.startStopOff = false;
    }
    this.lastIgnitionStop = st.ignition;
    const doorOpen = b.doors.some((d) => d) || b.trunk;
    const inDrive = st.selector === 'D';
    this.autoHold.enabled = this.buttons.autoHold;
    const hold = this.autoHold.step({
      speedKmh: sim.speedKmh,
      brake: sim.inputs.brake,
      throttle: human.throttle,
      inDrive,
      doorOpen,
      beltOn: b.seatbelt,
    });
    if (hold.brake !== null) sim.inputs.brake = Math.max(sim.inputs.brake, hold.brake);
    if (hold.park) b.parkingBrake = true;

    if (p.equipment?.startStop && p.engine && !p.electric) {
      this.startStop.enabled = !this.buttons.startStopOff;
      const out = this.startStop.step({
        speedKmh: sim.speedKmh,
        brake: sim.inputs.brake,
        throttle: sim.inputs.throttle,
        holding: this.autoHold.state === 'holding' || this.assist.state === 'hold',
        inDrive,
        engineRunning: st.engineRunning,
        coolantC: st.coolantC,
        batteryOk: !sim.faults.has('alternator'),
        ambientC: st.ambientC,
        gradient: sim.inputs.gradient,
        steeringDeg: st.steeringDeg,
        doorOpen,
        beltOn: b.seatbelt,
        filterCleaning: this.dpf.regenerating,
        dt: STEP_S,
      });
      if (out.stopEngine) sim.autoStop();
      if (out.startEngine) sim.autoRestart();
      if (!sim.autoStopped && this.startStop.state === 'restartRequired')
        this.startStop.manualRestart();
    }

    // Park distance control.
    this.park.step({
      reverse: st.selector === 'R',
      speedKmh: sim.speedKmh,
      distances: this.lastScene?.park ?? {
        front: [null, null, null],
        rear: [null, null, null],
        left: null,
        right: null,
      },
      fault: sim.faults.has('parkSensor'),
    });
    this.buttons.parkAssist = this.park.active;
    // Auto high beam from the front camera's view of other lights.
    const sc = this.lastScene;
    if (sc) {
      const oncoming = sc.objects.filter((o) => o.oncoming && o.dx > 0);
      sim.body.autoHighBeamOn = this.highBeam.step({
        enabled: b.autoHighBeam,
        lowBeamOn: b.lowBeam,
        light: st.lightIntensity,
        speedKmh: sim.speedKmh,
        inTown: !!sc.road.town || sc.road.kind === 'urban' || sc.road.kind === 'zone30',
        oncoming: oncoming.length ? Math.min(...oncoming.map((o) => o.dx)) : null,
        ahead: sc.lead ? sc.lead.dx : null,
        dt: STEP_S,
      });
      this.fatigue.step({
        speedKmh: sim.speedKmh,
        engineOn: st.ready,
        doorOpen,
        lat: sc.ego.lateral,
        latV: sc.ego.lateralV,
        dt: STEP_S,
      });
    }
    this.belts.step({
      ignitionOn: st.ignition >= 2,
      speedKmh: sim.speedKmh,
      driverBelted: b.seatbelt,
      passenger: b.passenger,
      rear: b.rear,
      dt: STEP_S,
    });
    if (p.tpmsType === 'indirect') this.tpmsIndirect.step(st.tires, sim.speedKmh, STEP_S);
    if (this.lastOdo > 0) this.service.drive(Math.max(0, st.odometerKm - this.lastOdo));

    if (p.fuelType === 'diesel') {
      this.dpf.step(sim.speedKmh, st.loadPct, st.engineRunning, STEP_S);
      if (this.lastOdo > 0) this.def.consume(Math.max(0, st.odometerKm - this.lastOdo));
      sim.startBlocked = this.def.startBlocked;
    }
    this.lastOdo = st.odometerKm;
  }

  /** Engine speed in another gear at the current road speed. */
  private gearRpm(gear: number): number {
    const p = this.profile;
    const r = p.gearRatios[gear - 1];
    return r
      ? (this.sim.state.speedMs / (2 * Math.PI * p.wheelRadiusM)) * 60 * r * p.finalDrive
      : 0;
  }

  private autoHazard = false;
  private lastIgnitionFcw = 2;

  /**
   * Forward collision warning / emergency braking, blind-spot monitoring and
   * rear cross-traffic. AEB overrides the pedals (and cancels ACC); after an
   * emergency stop from speed the hazards come on until the car drives off.
   */
  private applyCollision(scene: SceneSnapshot, human: { throttle: number; brake: number }): void {
    const sim = this.sim;
    const st = sim.state;
    if (this.lastIgnitionFcw < 2 && st.ignition >= 2) this.collision.onIgnition();
    this.lastIgnitionFcw = st.ignition;
    const forward = st.direction === 1 && st.selector === 'D';
    const lead = scene.lead;
    const out = this.collision.step({
      speedKmh: forward ? sim.speedKmh : 0,
      lead: lead ? { gap: lead.dx, speed: lead.v, accel: lead.a } : null,
      driverBrake: human.brake,
      driverThrottle: human.throttle,
      blocked: this.buttons.sensorBlocked,
      dt: STEP_S,
    });
    if (out.brake !== null) {
      sim.inputs.brake = Math.max(sim.inputs.brake, out.brake);
      if (this.collision.stage === 'braking' || this.collision.stage === 'hold') {
        sim.inputs.throttle = 0;
        this.assist.cancel();
      }
    }
    if (out.hazards && !this.autoHazard) {
      this.autoHazard = true;
      sim.body.hazard = true;
    }
    this.collision.clearHazards(sim.speedKmh);
    if (this.autoHazard && !out.hazards) {
      this.autoHazard = false;
      sim.body.hazard = false;
    }
    const left = sim.indicating('left');
    const right = sim.indicating('right');
    this.blindSpot.step(
      forward ? sim.speedKmh : 0,
      scene.objects,
      left ? 'left' : right ? 'right' : null,
    );
    const rearBrake = this.crossTraffic.step(st.direction === -1, sim.speedKmh, scene.crossTraffic);
    if (rearBrake !== null) {
      sim.inputs.throttle = 0;
      sim.inputs.brake = Math.max(sim.inputs.brake, rearBrake);
    }
  }

  /** Lane markings the camera can see on each side of our lane. */
  private laneLines(scene: SceneSnapshot): { left: boolean; right: boolean } {
    const env = scene.env;
    // Snow-covered or fog-hidden markings aren't found.
    if (env.surface === 'icy' || env.weather === 'fog' || scene.ego.inBay)
      return { left: false, right: false };
    switch (scene.road.kind) {
      case 'motorway':
      case 'ramp':
      case 'rural':
        return { left: true, right: true };
      case 'urban':
        // Town streets: a centre line, but a kerb rather than a line on the right.
        return { left: true, right: false };
      default:
        return { left: false, right: false };
    }
  }

  /**
   * Lane keeping/centering plus the driver's own steering; returns the lateral
   * acceleration for the world. Hands-off escalation can jolt the brakes or
   * stop the car (hazards on, parking brake once stopped).
   */
  private applyLane(scene: SceneSnapshot): number {
    const sim = this.sim;
    const st = sim.state;
    if (this.lastIgnitionLane < 2 && st.ignition >= 2) this.lane.reset();
    this.lastIgnitionLane = st.ignition;
    const lat = scene.ego.lateral;
    const latV = scene.ego.lateralV;
    const left = sim.indicating('left');
    const right = sim.indicating('right');
    const out = this.lane.step({
      speedKmh: sim.speedKmh,
      lat,
      latV,
      lines: this.laneLines(scene),
      indicating: left ? 'left' : right ? 'right' : null,
      changingLane: this.world.ego.targetLane !== this.world.ego.lane,
      accEngaged: this.assist.engaged && this.assist.fn !== 'limiter',
      handsOn: this.buttons.handsOn,
      dt: STEP_S,
    });
    if (out.jolt) sim.inputs.brake = Math.max(sim.inputs.brake, 0.35);
    if (out.emergencyDecel !== null) {
      this.assist.cancel();
      sim.body.hazard = true;
      sim.inputs.throttle = 0;
      sim.inputs.brake = out.emergencyDecel / (G * 1.05);
      if (st.speedMs < 0.3) {
        sim.inputs.brake = 0.5;
        sim.body.parkingBrake = true;
      }
    }
    // A tired driver nods off for ~2 s every minute or so, then jerks the wheel.
    this.sleepT = this.buttons.tired ? (this.sleepT + STEP_S) % 55 : 0;
    const human = driverSteer({
      lat,
      latV,
      handsOn: this.buttons.handsOn,
      distracted: this.buttons.distracted,
      wander: this.wander.next(STEP_S),
      asleep: this.buttons.tired && this.sleepT > 40 && this.sleepT < 43,
      startled: this.buttons.tired && this.sleepT >= 43 && this.sleepT < 44,
    });
    return human * out.driverWeight + out.steer;
  }

  private lastIgnitionLane = 2;

  /** Camera + map speed-limit recognition and the ISA warning. */
  private recognize(scene: SceneSnapshot): void {
    const st = this.sim.state;
    if (this.lastIgnition < 2 && st.ignition >= 2) this.isa.onIgnition();
    this.lastIgnition = st.ignition;
    const passed = scene.passedSigns.filter((g) => !this.seenSigns.has(g.s));
    for (const g of passed) this.seenSigns.add(g.s);
    const road = scene.road.name;
    const roadChanged = this.lastRoad !== '' && road !== this.lastRoad;
    this.lastRoad = road;
    const route = this.world.route;
    const ctx = { wet: scene.env.wet, hour: scene.env.hour };
    this.recognized = this.recognition.step({
      passed,
      map: route.mapLegalAt(scene.ego.s, ctx),
      implicit: { urban: route.country.implicit.urban!, rural: route.country.implicit.rural },
      roadChanged,
      ...ctx,
    });
    this.isa.step(this.sim.speedKmh, st.ignition >= 2 ? this.recognized.limit : undefined, STEP_S);
  }

  /** Run cruise/ACC/limiter on top of the driver's pedals. */
  private applyAssist(scene: SceneSnapshot): void {
    const sim = this.sim;
    const st = sim.state;
    const a = this.assist;
    if (st.ignition < 2 && a.state !== 'off') a.switchOff();
    // The driving mode sets ACC dynamics and the default distance.
    const mode = sim.driveModes.state.current;
    a.dynamics = sim.modeParams.acc;
    if (mode !== this.lastMode) {
      a.distance = mode === 'sport' ? 2 : mode === 'snow' ? 5 : 3;
      this.lastMode = mode;
    }
    const lead = scene.lead;
    const out = a.step({
      speedKmh: sim.speedKmh,
      driverThrottle: sim.inputs.throttle,
      driverBrake: sim.inputs.brake,
      canDrive: st.ready && st.selector === 'D',
      lead: lead && !lead.oncoming ? { gap: lead.dx, speed: lead.v } : null,
      dt: STEP_S,
    });
    if (out.pedals) {
      sim.inputs.throttle = Math.max(sim.inputs.throttle, out.pedals.throttle);
      sim.inputs.brake = out.pedals.brake;
    }
    if (out.throttleCap !== null)
      sim.inputs.throttle = Math.min(sim.inputs.throttle, out.throttleCap);
    st.cruiseActive = a.controlling;
    st.cruiseSetKmh = a.setKmh ?? 0;
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
    put(S.LaneAssistEnabled, flag(this.lane.enabled));
    const lo = this.lane.out;
    put(S.LaneAssistState, LANE_ASSIST_STATES.indexOf(this.lane.state));
    put(S.LaneLeft, LINE_STATES.indexOf(lo.left));
    put(S.LaneRight, LINE_STATES.indexOf(lo.right));
    put(S.HandsOffStage, lo.handsOffStage);
    put(S.AssistedDriving, flag(lo.assisted));
    put(S.LaneOffset, this.lastScene?.ego.lateral ?? 0);
    put(S.FcwState, FCW_STAGES.indexOf(this.collision.stage));
    put(S.StartStopState, START_STOP_STATES.indexOf(this.startStop.state));
    put(S.StartStopReason, STOP_BLOCKS.indexOf(this.startStop.reason));
    put(S.AutoHoldState, AUTO_HOLD_STATES.indexOf(this.autoHold.state));
    put(S.GlowPlug, flag(sim.glowing));
    if (this.profile.engine && on) {
      const e = this.profile.engine;
      const prog = sim.program;
      const sport = sim.driveModes.state.current === 'sport' || prog === 'S';
      const advice = gearAdvice({
        manual: sim.mode === 'manual' || this.profile.transmission === 'manual',
        sport,
        gear: st.gear,
        gears: sim.gearCount,
        rpm: st.rpm,
        idleRpm: e.idleRpm,
        rpmUp: this.gearRpm(st.gear + 1),
        rpmDown: this.gearRpm(st.gear - 1),
        throttle: st.throttle,
        redlineRpm: e.redlineRpm,
      });
      put(S.GearAdvice, GEAR_ADVICE.indexOf(advice.advice));
      put(S.RecommendedGear, advice.gear);
      put(S.ShiftLight, sport || prog === 'M' ? shiftLight(st.rpm, e.redlineRpm) : -1);
    }
    put(S.BlindSpotLeft, BLIND_SPOT_STATES.indexOf(this.blindSpot.left));
    put(S.BlindSpotRight, BLIND_SPOT_STATES.indexOf(this.blindSpot.right));
    put(S.CrossTraffic, CROSS_TRAFFIC_STATES.indexOf(this.crossTraffic.state));
    put(S.ABSActive, flag(st.abs));
    const as = this.assist;
    put(S.CruiseActive, flag(as.engaged));
    put(S.CruiseSpeed, as.setKmh ?? 0);
    put(S.SpeedAssistState, ASSIST_STATES.indexOf(as.state));
    put(S.SpeedAssistFunction, ASSIST_FUNCTIONS.indexOf(as.fn));
    put(S.AccDistance, as.distance);
    put(S.AccTargetDistance, as.leadGap ?? -1);
    put(S.AccTakeover, flag(as.out.takeover));
    put(S.AccLeadDrivingOff, flag(as.out.leadDrivingOff));
    put(S.LimiterExceeded, flag(as.out.limiterExceeded));
    const r = this.recognized;
    if (on) {
      put(S.SpeedLimit, r.limit === undefined ? -1 : (r.limit ?? 0));
      put(S.SpeedAdvisory, r.advisory ?? 0);
      put(S.NoOvertaking, flag(r.noOvertaking));
      put(S.SpeedLimitPlate, r.plate === 'wet' ? 1 : r.plate === 'time' ? 2 : 0);
      put(S.SpeedLimitSource, r.source === 'camera' ? 0 : 1);
    }
    put(S.IsaState, ISA_LEVELS.indexOf(this.isa.level));
    put(S.IsaOffset, this.isa.offset);
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
      put(S.DpfLoad, this.dpf.load);
      put(S.DpfRegenerating, flag(this.dpf.regenerating));
      put(S.DefRange, this.def.rangeKm);
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
    // Gearbox program as the driver sees it: S/M on the lever, else the mode's program.
    const prog = sim.program;
    put(
      S.GearboxMode,
      st.evB ? 4 : prog === 'S' ? 1 : prog === 'M' ? 2 : prog === 'E' && !sim.isElectric ? 3 : 0,
    );
    put(S.DriveMode, DRIVE_MODE_ORDER.indexOf(sim.driveModes.state.current));
    put(S.Coasting, flag(st.coasting));
    put(S.CylinderDeactivation, flag(st.cylindersOff));
    put(S.HillDescent, st.hdc);
    put(S.RegenLevel, st.regenLevel);
    put(S.PowerDemand, st.powerPct);
    const sc = this.lastScene;
    if (sc) {
      put(S.Altitude, sc.road.elevation);
      put(S.Heading, (((90 - (sc.ego.heading * 180) / Math.PI) % 360) + 360) % 360);
    }
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
    put(S.TireTempFL, st.tireTemps[0]);
    put(S.TireTempFR, st.tireTemps[1]);
    put(S.TireTempRL, st.tireTemps[2]);
    put(S.TireTempRR, st.tireTemps[3]);
    put(S.TpmsWarning, flag(this.tpmsIndirect.warning));
    // Faults and service items.
    const fl = sim.faults;
    put(S.OilPressureLow, flag(fl.has('oilPressure')));
    put(S.CoolantLevelLow, flag(fl.has('coolantLevel')));
    put(S.BrakeFluidLow, flag(fl.has('brakeFluid')));
    put(S.PowerSteeringFault, flag(fl.has('powerSteering')));
    put(S.Hood, flag(b.hood));
    put(S.TransmissionHot, flag(fl.has('gearboxHot')));
    put(S.AirbagFault, flag(fl.has('airbag')));
    put(S.AbsFault, flag(fl.has('abs')));
    put(S.WasherFluidLow, flag(fl.has('washerFluid')));
    put(S.BrakePadsWorn, flag(fl.has('brakePads')));
    put(S.BulbFailure, flag(fl.has('bulb')));
    put(S.KeyBatteryLow, flag(fl.has('keyBattery')));
    put(S.SeatbeltReminder, this.belts.stage);
    put(S.FatigueWarning, this.fatigue.stage);
    put(S.AutoHighBeamArmed, flag(this.highBeam.armed && b.autoHighBeam));
    const pd = this.lastScene?.park;
    put(S.ParkAssistState, this.park.fault && this.park.active ? 2 : this.park.active ? 1 : 0);
    if (pd) {
      const dist = (v: number | null): number => (v === null ? -1 : v);
      put(S.ParkFrontLeft, dist(pd.front[0]));
      put(S.ParkFrontCentre, dist(pd.front[1]));
      put(S.ParkFrontRight, dist(pd.front[2]));
      put(S.ParkRearLeft, dist(pd.rear[0]));
      put(S.ParkRearCentre, dist(pd.rear[1]));
      put(S.ParkRearRight, dist(pd.rear[2]));
      put(S.ParkLeft, dist(pd.left));
      put(S.ParkRight, dist(pd.right));
    }
    put(S.ParkBeep, this.park.out.beep);
    put(S.ParkBeepFront, flag(this.park.out.front));
    put(S.BeltStatusVisible, flag(this.belts.statusVisible));
    const seat = (present: boolean, belted: boolean): number => (!present ? 0 : belted ? 1 : 2);
    put(S.BeltPassenger, seat(b.passenger.present, b.passenger.belted));
    put(S.BeltRearLeft, SEAT_STATES.indexOf(b.rear[0] ?? 'empty'));
    put(S.BeltRearMiddle, SEAT_STATES.indexOf(b.rear[1] ?? 'empty'));
    put(S.BeltRearRight, SEAT_STATES.indexOf(b.rear[2] ?? 'empty'));
    put(S.ServiceKm, Math.round(this.service.km));
    put(S.ServiceDays, Math.round(this.service.days));
    return out;
  }

  private emit(ts: number, includeLow: boolean): void {
    for (const [id, value] of this.values(includeLow)) {
      if (this.wanted.has(id))
        this.samples.emit({ id, value, ts, source: this.sources.get(id) ?? 'simulated' });
    }
  }
}
