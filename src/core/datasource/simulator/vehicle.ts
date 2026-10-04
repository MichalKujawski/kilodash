import { coastingAllowed, DriveModeController } from '../../drive/DriveModeController';
import { comfortConsumers, consumerFuelLh, type Consumer } from '../../drive/efficiency';
import { throttleMap, type GearboxProgram, type ModeParams } from '../../drive/modes';
import { approach, clamp, createRng, SmoothNoise } from '../../math';
import { describeDtc, type DtcInfo } from '../../obd/dtc';
import type { VehicleProfile } from './profile';
import { createPowertrain, type Powertrain } from './powertrain';

export const G = 9.81;
const AIR_DENSITY_KG_M3 = 1.2;
export const BARO_KPA = 101;

export interface DriverInputs {
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  leftIndicator: boolean;
  rightIndicator: boolean;
  /** Road curvature being followed, 1/m (positive = right-hand bend). */
  curvature: number;
  /** Road gradient as rise/run (negative = downhill). */
  gradient: number;
}

export type DriveMode = 'auto' | 'manual';

/** Gear selector position (automatic / dual-clutch). */
export type Selector = 'P' | 'R' | 'N' | 'D';

export type FaultKind =
  'overheat' | 'lowFuel' | 'checkEngine' | 'doorOpen' | 'lowTire' | 'alternator';

export const FAULTS: FaultKind[] = [
  'overheat',
  'lowFuel',
  'checkEngine',
  'doorOpen',
  'lowTire',
  'alternator',
];

/** 0 OFF, 1 ACC, 2 ON, 3 START (cranking), matching VSS LowVoltageSystemState order. */
export type IgnitionLevel = 0 | 1 | 2 | 3;

export type LightSwitch = 'off' | 'auto' | 'parking' | 'low';
export type WiperMode = 'off' | 'auto' | 'interval' | 'slow' | 'fast';
/** D = normal automatic, S = sport program, M = manual (paddles). */
export type GearProgram = 'D' | 'S' | 'M';

/** Flashes in a comfort blink (stalk tapped, not latched). */
export const COMFORT_FLASHES = 3;

export interface BodyState {
  lightSwitch: LightSwitch;
  /** Outputs computed from the switch, light sensor and rain. */
  lowBeam: boolean;
  parkingLights: boolean;
  highBeam: boolean;
  /** Stalk pushed forward (high beam latched). */
  highBeamLatched: boolean;
  /** Stalk pulled (headlight flash, momentary). */
  highBeamFlash: boolean;
  autoHighBeam: boolean;
  /** Front fog lights. */
  fog: boolean;
  fogRear: boolean;
  hazard: boolean;
  wipers: WiperMode;
  washer: boolean;
  /** FL, FR, RL, RR. */
  doors: [boolean, boolean, boolean, boolean];
  trunk: boolean;
  seatbelt: boolean;
  parkingBrake: boolean;
}

/** Complete simulated vehicle state. Units are SI unless suffixed. */
export interface VehicleState {
  timeS: number;
  ignition: IgnitionLevel;
  /** Drive-ready (ICE running or EV "READY"). */
  ready: boolean;
  engineRunning: boolean;
  speedMs: number;
  rpm: number;
  /** 0 = neutral, 1..n forward gears. */
  gear: number;
  coupled: boolean;
  throttle: number;
  brake: number;
  coolantC: number;
  oilC: number;
  intakeC: number;
  ambientC: number;
  /** 0..100 % ambient light. */
  lightIntensity: number;
  fuelL: number;
  odometerKm: number;
  runTimeS: number;
  accelG: number;
  latG: number;
  steeringDeg: number;
  mapKPa: number;
  baroKPa: number;
  boostKPa: number;
  mafGs: number;
  loadPct: number;
  fuelRateLh: number;
  voltage: number;
  shiftRecommended: boolean;
  tcs: boolean;
  abs: boolean;
  /** Traction battery state of charge, %. */
  soc: number;
  /** Traction power, kW (negative = regen). */
  powerKW: number;
  batteryTempC: number;
  /** Tyre pressures FL, FR, RL, RR, kPa. */
  tires: [number, number, number, number];
  /** A speed assist (cruise/ACC) is controlling the pedals (set by the assist each step). */
  cruiseActive: boolean;
  selector: Selector;
  /** +1 forward, −1 reversing (speed is always a magnitude). */
  direction: 1 | -1;
  cruiseSetKmh: number;
  mil: boolean;
  /** Eco coasting: clutch open, engine idling. */
  coasting: boolean;
  /** Cylinder deactivation active. */
  cylindersOff: boolean;
  /** EV lift-off regeneration level 0–3. */
  regenLevel: number;
  /** EV "B" (strong regeneration, one-pedal) selected. */
  evB: boolean;
  /** Power request, % of max (negative: % of max regeneration). */
  powerPct: number;
  /** Hill descent control: 0 off, 1 standby, 2 braking. */
  hdc: 0 | 1 | 2;
}

export interface Environment {
  ambientC: number;
  lightIntensity: number;
  /** Rain on the windscreen, 0–1 (rain sensor). */
  rain: number;
  /** Tyre-road friction coefficient (1 dry, ~0.4 icy). */
  grip: number;
}

const TIRE_BASE: [number, number, number, number] = [238, 238, 236, 237];

/**
 * Deterministic vehicle model. Shared chassis/body/thermal/electrical logic lives
 * here; propulsion is delegated to an ICE, EV or hybrid `Powertrain`.
 *
 * Pure and timer-free: call `step(dt)` at a fixed rate (100 Hz recommended).
 */
export class VehicleSimulator {
  readonly profile: VehicleProfile;
  readonly state: VehicleState;
  readonly body: BodyState;
  readonly faults = new Set<FaultKind>();
  readonly inputs: DriverInputs = {
    throttle: 0,
    brake: 0,
    leftIndicator: false,
    rightIndicator: false,
    curvature: 0,
    gradient: 0,
  };
  readonly env: Environment;
  mode: DriveMode = 'auto';
  /** Multiplies thermal rates so warm-up is watchable in a demo. */
  warmupScale = 6;
  readonly powertrain: Powertrain;
  readonly rng: () => number;
  /** Driving mode selection (Eco/Comfort/Normal/Sport/Individual/Snow/Off-road). */
  readonly driveModes: DriveModeController;

  private crankT = 0;
  private comfort: { side: 'left' | 'right'; left: number } | null = null;
  gearProgram: GearProgram = 'D';
  private curvature = 0;
  private gradient = 0;
  private accelFiltered = 0;
  private tcsHold = 0;
  private absHold = 0;
  private voltNoise: SmoothNoise;
  private tireWarm = 0;
  private lastIgnition: IgnitionLevel = 2;
  /** Comfort consumers running now (A/C, heaters, lights). */
  consumers: Consumer[] = [];
  private onTimeS = 0;
  /** Pedals released this long, s (coasting starts after a short pause). */
  private liftT = 0;

  constructor(profile: VehicleProfile, seed = 1, env: Partial<Environment> = {}) {
    this.profile = profile;
    this.rng = createRng(seed);
    this.voltNoise = new SmoothNoise(this.rng, 0.7);
    this.env = { ambientC: 14, lightIntensity: 85, rain: 0, grip: 1, ...env };
    const e = profile.engine;
    this.state = {
      timeS: 0,
      ignition: 2,
      ready: true,
      engineRunning: !!e,
      speedMs: 0,
      rpm: e?.idleRpm ?? 0,
      gear: 1,
      coupled: false,
      throttle: 0,
      brake: 0,
      coolantC: 62,
      oilC: 55,
      intakeC: this.env.ambientC + 8,
      ambientC: this.env.ambientC,
      lightIntensity: this.env.lightIntensity,
      fuelL: profile.tankL * 0.72,
      odometerKm: 48_213.4,
      runTimeS: 0,
      accelG: 0,
      latG: 0,
      steeringDeg: 0,
      mapKPa: 35,
      baroKPa: BARO_KPA,
      boostKPa: 0,
      mafGs: 3,
      loadPct: 20,
      fuelRateLh: 0.8,
      voltage: 14.2,
      shiftRecommended: false,
      tcs: false,
      abs: false,
      soc: 78,
      powerKW: 0,
      batteryTempC: 24,
      tires: [...TIRE_BASE],
      cruiseActive: false,
      selector: 'D',
      direction: 1,
      cruiseSetKmh: 0,
      mil: false,
      coasting: false,
      cylindersOff: false,
      regenLevel: 1,
      evB: false,
      powerPct: 0,
      hdc: 0,
    };
    this.body = {
      lightSwitch: 'auto',
      lowBeam: false,
      parkingLights: false,
      highBeam: false,
      highBeamLatched: false,
      highBeamFlash: false,
      autoHighBeam: false,
      fog: false,
      fogRear: false,
      hazard: false,
      wipers: 'auto',
      washer: false,
      doors: [false, false, false, false],
      trunk: false,
      seatbelt: true,
      parkingBrake: false,
    };
    this.driveModes = new DriveModeController({
      ...profile.equipment,
      awd: profile.drive === 'awd',
    });
    this.powertrain = createPowertrain(this);
  }

  /** What the selected driving mode asks of every subsystem. */
  get modeParams(): ModeParams {
    return this.driveModes.params;
  }

  /**
   * Effective gearbox program: the lever (S, M) wins over the driving mode,
   * otherwise the mode's program (Eco = E, Sport = S, …).
   */
  get program(): GearboxProgram | 'M' {
    // Paddles put the gearbox in manual even with the lever in D.
    if (this.gearProgram === 'M' || this.mode === 'manual') return 'M';
    if (this.gearProgram === 'S') return 'S';
    return this.modeParams.gearbox;
  }

  get isElectric(): boolean {
    return !this.profile.engine;
  }

  get gearCount(): number {
    return this.profile.gearRatios.length;
  }

  get speedKmh(): number {
    return this.state.speedMs * 3.6;
  }

  // --- Driver controls -------------------------------------------------------

  shiftUp(): void {
    this.powertrain.shift?.(1);
  }

  shiftDown(): void {
    this.powertrain.shift?.(-1);
  }

  /**
   * Move the gear selector. P and R (and leaving R) need a standstill, as the
   * real gearbox interlock does; returns false when refused.
   */
  setSelector(sel: Selector): boolean {
    const s = this.state;
    const needsStop = sel === 'P' || sel === 'R' || s.selector === 'R' || s.selector === 'P';
    if (needsStop && s.speedMs > 0.5 && sel !== 'N') return false;
    s.selector = sel;
    s.direction = sel === 'R' ? -1 : 1;
    if (sel !== 'D') s.cruiseActive = false;
    return true;
  }

  setMode(mode: DriveMode): void {
    this.mode = mode;
  }

  /** Turn the key to OFF / ACC / ON. Anything below ON stops the engine. */
  setIgnition(level: 0 | 1 | 2): void {
    const s = this.state;
    s.ignition = level;
    if (level < 2) {
      s.engineRunning = false;
      s.ready = false;
      s.cruiseActive = false;
    }
  }

  /** Stalk tapped: three flashes (comfort blink); tapping the other way cancels. */
  tapIndicator(side: 'left' | 'right'): void {
    if (this.comfort && this.comfort.side !== side) {
      this.comfort = null;
      return;
    }
    // One flash period is 0.75 s (≈80/min).
    this.comfort = { side, left: COMFORT_FLASHES * 0.75 - 0.2 };
  }

  /** Is the indicator on this side flashing (stalk latched, comfort blink or hazard)? */
  indicating(side: 'left' | 'right'): boolean {
    const latched = side === 'left' ? this.inputs.leftIndicator : this.inputs.rightIndicator;
    return latched || this.comfort?.side === side;
  }

  /** D, S or M on the selector gate. M hands gear choice to the paddles. */
  setGearProgram(p: GearProgram): void {
    this.gearProgram = p;
    this.mode = p === 'M' ? 'manual' : 'auto';
  }

  /**
   * Keyless start button: without the brake it toggles the ignition; with the
   * brake pressed it starts the engine; while running (and stopped) it switches
   * everything off.
   */
  pressStart(brakePressed: boolean): void {
    const s = this.state;
    if (s.ready || s.ignition === 3) {
      if (s.speedMs < 1) this.setIgnition(0);
      return;
    }
    if (brakePressed) this.start();
    else this.setIgnition(s.ignition >= 2 ? 0 : 2);
  }

  /** Crank the engine (ICE/hybrid) or switch to READY (EV). */
  start(): void {
    const s = this.state;
    if (s.ignition < 2) s.ignition = 2;
    if (s.ready) return;
    if (this.isElectric) {
      s.ready = true;
      return;
    }
    s.ignition = 3;
    this.crankT = 0;
  }

  injectFault(kind: FaultKind): void {
    this.faults.add(kind);
    if (kind === 'lowFuel') {
      this.state.fuelL = Math.min(this.state.fuelL, this.profile.tankL * 0.07);
      this.state.soc = Math.min(this.state.soc, 7);
    }
    if (kind === 'doorOpen') this.body.doors[0] = true;
  }

  clearFault(kind: FaultKind): void {
    this.faults.delete(kind);
    if (kind === 'doorOpen') this.body.doors[0] = false;
    if (kind === 'lowTire') this.state.tires[3] = TIRE_BASE[3];
  }

  refuel(): void {
    this.state.fuelL = this.profile.tankL;
    this.state.soc = Math.max(this.state.soc, 95);
    this.faults.delete('lowFuel');
  }

  /** Stored diagnostic trouble codes derived from active faults. */
  dtcs(): DtcInfo[] {
    const codes: string[] = [];
    if (this.faults.has('checkEngine')) codes.push('P0301', 'P0420');
    if (this.faults.has('overheat')) codes.push('P0217');
    if (this.faults.has('alternator')) codes.push('P0562', 'P0620');
    if (this.faults.has('lowTire') && this.profile.tpms) codes.push('C0750');
    return codes.map(describeDtc);
  }

  // --- Simulation ------------------------------------------------------------

  step(dt: number): void {
    const s = this.state;
    const p = this.profile;
    s.timeS += dt;
    s.ambientC = this.env.ambientC;
    s.lightIntensity += (this.env.lightIntensity - s.lightIntensity) * approach(dt, 3);

    this.updateIgnition(dt);
    if (this.lastIgnition < 2 && s.ignition >= 2) this.driveModes.onIgnition();
    this.lastIgnition = s.ignition;
    this.driveModes.step(dt, s.speedMs < 0.3 && (s.selector === 'P' || this.body.parkingBrake));
    this.updatePedals(dt);
    this.updateCoasting(dt);

    // --- Propulsion ---
    let drive = this.powertrain.update(dt);
    this.chargeConsumers(dt);
    const regenBrakeN = this.powertrain.regenBrakeN;

    // --- Traction control: limit force to what the driven tyres can transmit ---
    const mg = p.massKg * G;
    const transfer = clamp(this.accelFiltered, -0.8, 0.8) * 0.12;
    const share = p.drive === 'awd' ? 1 : p.drive === 'rwd' ? 0.48 + transfer : 0.6 - transfer;
    const maxTraction = this.env.grip * mg * share;
    if (drive > maxTraction) {
      drive = maxTraction * 0.92;
      this.tcsHold = 0.35;
    }
    this.tcsHold = Math.max(0, this.tcsHold - dt);
    s.tcs = this.tcsHold > 0;

    // --- Longitudinal dynamics ---
    const v = s.speedMs;
    this.gradient += (this.inputs.gradient - this.gradient) * approach(dt, 1.5);
    const aero = 0.5 * AIR_DENSITY_KG_M3 * p.dragCoefficient * p.frontalAreaM2 * v * v;
    const rolling = v > 0.05 ? p.rollingResistance * mg : 0;
    const slope = mg * this.gradient;
    const gearRatio = p.gearRatios[s.gear - 1];
    const ratio = s.gear > 0 && gearRatio ? gearRatio * p.finalDrive : 0;
    const effMass = p.massKg * (1.04 + 0.0002 * ratio * ratio);

    let force = drive - aero - rolling - slope;
    if (v <= 0.01 && force < 0) force = 0; // brakes / creep hold the car at standstill

    let brakeForce = Math.max(0, s.brake * mg * 1.05 - regenBrakeN);
    // Ignition off, parking brake or the parking lock (P) hold the car.
    if (s.ignition < 2 || this.body.parkingBrake || s.selector === 'P') {
      if (v < 0.5) brakeForce = Math.max(brakeForce, mg);
      force = Math.min(force, 0);
    }
    const maxBrake = this.env.grip * mg * 0.98;
    if (brakeForce + regenBrakeN > maxBrake && v > 1) {
      brakeForce = Math.max(0, maxBrake - regenBrakeN);
      this.absHold = 0.25;
    }
    this.absHold = Math.max(0, this.absHold - dt);
    s.abs = this.absHold > 0;

    let newV = v + (force / effMass) * dt;
    const brakeDv = (brakeForce / effMass) * dt;
    newV = newV > brakeDv ? newV - brakeDv : 0;
    const accel = (newV - v) / dt;
    s.speedMs = newV;
    this.accelFiltered += (accel / G - this.accelFiltered) * approach(dt, 0.12);
    s.accelG = this.accelFiltered;
    s.odometerKm += (newV * dt) / 1000;

    // --- Lateral: follow road curvature within the grip circle ---
    this.curvature += (this.inputs.curvature - this.curvature) * approach(dt, 0.7);
    const latMax = this.env.grip * 0.98;
    s.latG = clamp((newV * newV * this.curvature) / G, -latMax, latMax);
    s.steeringDeg = (Math.atan(p.wheelbaseM * this.curvature) * p.steeringRatio * 180) / Math.PI;

    this.powertrain.afterStep?.(dt);
    this.updateThermals(dt);
    this.updateBody(dt);
  }

  private updateIgnition(dt: number): void {
    const s = this.state;
    if (s.ignition === 3) {
      this.crankT += dt;
      const crankTime = s.coolantC < 30 ? 1.3 : 0.8;
      if (this.crankT >= crankTime) {
        s.ignition = 2;
        s.engineRunning = true;
        s.ready = true;
        s.runTimeS = 0;
        this.powertrain.onStart?.();
      }
    }
    if (s.engineRunning) s.runTimeS += dt;
  }

  /** Comfort consumers cost fuel (engine) or battery (EV). */
  private chargeConsumers(dt: number): void {
    const s = this.state;
    this.onTimeS = s.ignition >= 2 ? this.onTimeS + dt : 0;
    this.consumers = s.ready
      ? comfortConsumers({
          ambientC: s.ambientC,
          ecoClimate: this.modeParams.ac === 'eco',
          lowBeam: this.body.lowBeam,
          minutesOn: this.onTimeS / 60,
        })
      : [];
    const kW = this.consumers.reduce((a, c) => a + c.kW, 0);
    if (kW <= 0) return;
    if (s.engineRunning) {
      const lh = consumerFuelLh(kW);
      s.fuelRateLh += lh;
      s.fuelL = Math.max(0, s.fuelL - (lh / 3600) * dt);
    } else if (this.profile.electric && s.ready) {
      s.powerKW += kW;
      s.soc = clamp(s.soc - ((kW * dt) / 3600 / this.profile.electric.batteryKWh) * 100, 0, 100);
    }
  }

  /** Eco coasting: freewheel with the pedals released (dual-clutch / automatic only). */
  private updateCoasting(dt: number): void {
    const s = this.state;
    const p = this.profile;
    const released = this.inputs.throttle < 0.02 && this.inputs.brake < 0.02;
    this.liftT = released ? this.liftT + dt : 0;
    s.coasting =
      !!p.engine &&
      !p.electric &&
      s.engineRunning &&
      this.liftT > 0.4 &&
      coastingAllowed({
        modeAllows: this.modeParams.coasting && this.program === 'E',
        automatic: p.transmission === 'dct' || p.transmission === 'automatic',
        inDrive: s.selector === 'D',
        cruiseOrAcc: s.cruiseActive,
        throttle: s.throttle,
        brake: s.brake,
        speedKmh: this.speedKmh,
        gradient: this.gradient,
      });
  }

  private updatePedals(dt: number): void {
    const s = this.state;
    // The driving mode's pedal map turns pedal travel into a torque request.
    let throttle = throttleMap(this.modeParams.throttle, clamp(this.inputs.throttle, 0, 1));
    let brake = clamp(this.inputs.brake, 0, 1);

    // Hill descent control (Off-road mode, below 30 km/h): brakes on steep
    // descents to hold walking-to-crawling pace while the driver steers.
    const hdcArmed = this.modeParams.esc === 'offroad' && this.speedKmh < 30 && s.selector !== 'P';
    s.hdc = hdcArmed ? 1 : 0;
    if (hdcArmed && this.gradient < -0.06 && this.inputs.throttle < 0.05 && brake < 0.05) {
      s.hdc = 2;
      brake = clamp((this.speedKmh - 8) * 0.04 - this.gradient * 1.2, 0, 0.6);
    }

    if (!s.ready) throttle = 0;
    s.throttle += (throttle - s.throttle) * approach(dt, 0.08);
    s.brake += (brake - s.brake) * approach(dt, 0.05);
  }

  private updateThermals(dt: number): void {
    const s = this.state;
    const tdt = dt * this.warmupScale;
    if (s.engineRunning) {
      const heat = 0.04 + s.loadPct / 100 + s.rpm / 20000;
      const overheat = this.faults.has('overheat');
      if (s.coolantC < 88 && !overheat) s.coolantC += heat * 0.12 * tdt;
      else {
        const target = overheat ? 128 : 89 + heat * 4;
        s.coolantC += (target - s.coolantC) * approach(tdt, overheat ? 40 : 25);
      }
    } else {
      s.coolantC += (s.ambientC - s.coolantC) * approach(tdt, 900);
    }
    const oilTarget = s.engineRunning
      ? s.coolantC + (s.coolantC > 75 ? 6 + s.loadPct * 0.12 : -6)
      : s.coolantC;
    s.oilC += (oilTarget - s.oilC) * approach(tdt, 45);
    const intakeTarget = s.ambientC + 18 - Math.min(s.speedMs, 30) * 0.4 + s.boostKPa * 0.12;
    s.intakeC += (intakeTarget - s.intakeC) * approach(dt, 8);
    // Traction battery warms with throughput.
    const batTarget = s.ambientC + 8 + Math.abs(s.powerKW) * 0.12;
    s.batteryTempC += (batTarget - s.batteryTempC) * approach(tdt, 400);
  }

  private updateBody(dt: number): void {
    const s = this.state;
    const b = this.body;
    const on = s.ignition >= 2;

    // Lights: "auto" switches low beam on at dusk/in tunnels and with the wipers
    // running (rain); high beam needs low beam, the headlight flash always works.
    const wiping = b.wipers !== 'off' && (b.wipers !== 'auto' || this.env.rain > 0);
    const dark = s.lightIntensity < 40;
    b.lowBeam = on && (b.lightSwitch === 'low' || (b.lightSwitch === 'auto' && (dark || wiping)));
    b.parkingLights = b.lightSwitch === 'parking' || b.lowBeam;
    b.highBeam = (b.highBeamLatched && b.lowBeam) || (b.highBeamFlash && on);
    if (!b.parkingLights) b.fog = false;
    if (!b.lowBeam && !b.fog) b.fogRear = false;
    if (this.comfort) {
      this.comfort.left -= dt;
      if (this.comfort.left <= 0) this.comfort = null;
    }

    // Electrical system.
    const alternatorOk = !this.faults.has('alternator');
    let volts: number;
    if (s.ignition === 3) volts = 10.3 + this.voltNoise.next(dt) * 0.3;
    else if (s.ready) {
      volts = alternatorOk ? 14.15 + this.voltNoise.next(dt) * 0.06 : 11.9 - s.runTimeS * 0.0004;
    } else if (on) volts = 12.3;
    else volts = 12.5;
    s.voltage += (volts - s.voltage) * approach(dt, s.ignition === 3 ? 0.05 : 0.4);

    // Tyres warm up with speed (+~12 kPa); the TPMS fault leaks the rear-right tyre.
    this.tireWarm += (Math.min(s.speedMs / 30, 1) - this.tireWarm) * approach(dt, 240);
    for (let i = 0; i < 4; i++) {
      if (i === 3 && this.faults.has('lowTire')) {
        s.tires[3] = Math.max(150, s.tires[3] - dt * 2.5);
        continue;
      }
      const target = TIRE_BASE[i]! + this.tireWarm * 12;
      s.tires[i] = s.tires[i]! + (target - s.tires[i]!) * approach(dt, 30);
    }

    s.mil = this.faults.has('checkEngine') || this.faults.has('overheat');
  }
}
