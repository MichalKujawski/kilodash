import { approach, clamp, createRng, interpTable, lerp, SmoothNoise } from '../../math';
import { FUEL_CONSTANTS } from '../../derived/fuel';
import type { VehicleProfile } from './profile';

const G = 9.81;
const AIR_DENSITY_KG_M3 = 1.2;
const AIR_DENSITY_G_L = 1.19;
const BARO_KPA = 101;

export interface DriverInputs {
  /** 0..1 */
  throttle: number;
  /** 0..1 */
  brake: number;
  leftIndicator: boolean;
  rightIndicator: boolean;
}

export type DriveMode = 'auto' | 'manual';

interface Shift {
  to: number;
  t: number;
}

/** Complete simulated vehicle state. Units are SI unless suffixed. */
export interface VehicleState {
  timeS: number;
  speedMs: number;
  rpm: number;
  /** 0 = neutral, 1..n forward gears. */
  gear: number;
  /** True while drive torque is fully transmitted (clutch closed / converter locked). */
  coupled: boolean;
  throttle: number;
  brake: number;
  coolantC: number;
  oilC: number;
  intakeC: number;
  ambientC: number;
  fuelL: number;
  odometerKm: number;
  accelG: number;
  mapKPa: number;
  mafGs: number;
  loadPct: number;
  fuelRateLh: number;
  voltage: number;
  engineRunning: boolean;
  shiftRecommended: boolean;
}

/**
 * Deterministic longitudinal vehicle model: engine with torque curve, idle control,
 * rev limiter and engine braking; gearbox with automatic shift logic and launch slip;
 * aero/rolling/brake forces; thermal, fuel and electrical models.
 *
 * Pure and timer-free: call `step(dt)` at a fixed rate (100 Hz recommended).
 */
export class VehicleSimulator {
  readonly profile: VehicleProfile;
  readonly state: VehicleState;
  readonly inputs: DriverInputs = {
    throttle: 0,
    brake: 0,
    leftIndicator: false,
    rightIndicator: false,
  };
  mode: DriveMode = 'auto';
  /** Multiplies thermal rates so warm-up is watchable in a demo. */
  warmupScale = 6;

  private shift: Shift | null = null;
  private shiftCooldown = 0;
  private limiterCut = 0;
  private boostKPa = 0;
  private idleNoise: SmoothNoise;
  private voltNoise: SmoothNoise;
  private accelFiltered = 0;
  private windup = 0;

  constructor(profile: VehicleProfile, seed = 1, ambientC = 14) {
    this.profile = profile;
    const rng = createRng(seed);
    this.idleNoise = new SmoothNoise(rng, 3);
    this.voltNoise = new SmoothNoise(rng, 0.7);
    this.state = {
      timeS: 0,
      speedMs: 0,
      rpm: profile.engine.idleRpm,
      gear: 1,
      coupled: false,
      throttle: 0,
      brake: 0,
      coolantC: 62,
      oilC: 55,
      intakeC: ambientC + 8,
      ambientC,
      fuelL: profile.tankL * 0.72,
      odometerKm: 48_213.4,
      accelG: 0,
      mapKPa: 35,
      mafGs: 3,
      loadPct: 20,
      fuelRateLh: 0.8,
      voltage: 14.2,
      engineRunning: true,
      shiftRecommended: false,
    };
  }

  get gearCount(): number {
    return this.profile.gearRatios.length;
  }

  get speedKmh(): number {
    return this.state.speedMs * 3.6;
  }

  shiftUp(): void {
    this.mode = 'manual';
    this.requestShift(this.targetGear() + 1);
  }

  shiftDown(): void {
    this.mode = 'manual';
    const to = this.targetGear() - 1;
    // Refuse a downshift that would over-rev the engine, like a real DCT.
    if (to >= 1 && this.coupledRpm(to) < this.profile.engine.limiterRpm - 200)
      this.requestShift(to);
  }

  setMode(mode: DriveMode): void {
    this.mode = mode;
  }

  step(dt: number): void {
    const s = this.state;
    const p = this.profile;
    const e = p.engine;
    s.timeS += dt;

    // --- Pedals (actuator lag) ---
    s.throttle += (clamp(this.inputs.throttle, 0, 1) - s.throttle) * approach(dt, 0.08);
    s.brake += (clamp(this.inputs.brake, 0, 1) - s.brake) * approach(dt, 0.05);

    // --- Engine control: idle governor, overrun fuel cut, rev limiter ---
    const idleTarget = e.idleRpm + this.idleNoise.next(dt) * 12;
    const idleThrottle = clamp(0.035 + (idleTarget - s.rpm) * 0.0004, 0, 0.2);
    const pedalOff = s.throttle < 0.02;
    const fuelCut = pedalOff && s.coupled && s.rpm > e.idleRpm + 350;
    let effThrottle = fuelCut ? 0 : Math.max(s.throttle, pedalOff ? idleThrottle : 0);

    if (s.rpm >= e.limiterRpm) this.limiterCut = 0.07;
    if (this.limiterCut > 0) {
      this.limiterCut -= dt;
      effThrottle = 0;
    }
    if (this.shift && this.shift.t < p.shiftTimeS * 0.6) effThrottle *= 0.15; // torque cut

    // Turbo spools with rpm and throttle, lagging behind.
    const boostTarget = e.maxBoostKPa * effThrottle * clamp((s.rpm - 1200) / 1800, 0, 1);
    this.boostKPa +=
      (boostTarget - this.boostKPa) * approach(dt, boostTarget > this.boostKPa ? 0.5 : 0.2);
    const boostRatio = e.maxBoostKPa > 0 ? 0.35 + 0.65 * (this.boostKPa / e.maxBoostKPa) : 1;

    const friction = (10 + s.rpm * 0.0055) * e.displacementL;
    const fullTorque = interpTable(e.torqueCurve, s.rpm);
    const engineTorque = fullTorque * effThrottle * (e.maxBoostKPa > 0 ? boostRatio : 1) - friction;

    // --- Gearbox ---
    if (this.shift) {
      this.shift.t += dt;
      if (this.shift.t >= p.shiftTimeS) {
        s.gear = this.shift.to;
        this.shift = null;
        this.shiftCooldown = 0.9;
      }
    }
    this.shiftCooldown = Math.max(0, this.shiftCooldown - dt);

    const gear = this.shift ? this.shift.to : s.gear;
    const ratio = gear > 0 ? p.gearRatios[gear - 1]! * p.finalDrive : 0;
    const coupledRpm = this.coupledRpm(gear);
    let driveTorque = 0; // at the wheels, Nm

    if (gear === 0 || !s.engineRunning) {
      s.coupled = false;
    } else if (this.shift) {
      // Clutches swap: engine rpm chases the new gear's rpm (gives the downshift blip).
      s.coupled = false;
      s.rpm += (Math.max(coupledRpm, e.idleRpm) - s.rpm) * approach(dt, p.shiftTimeS / 3);
      driveTorque = Math.max(0, engineTorque) * ratio * 0.3;
    } else if (s.coupled) {
      if (coupledRpm < e.idleRpm * 0.92) s.coupled = false;
      else {
        // Driveline compliance: torque winds up the shafts slightly, so a limiter
        // cut makes the needle bounce instead of sitting dead still.
        this.windup += (engineTorque * 0.35 - this.windup) * approach(dt, 0.045);
        s.rpm = coupledRpm + this.windup;
        driveTorque = engineTorque * ratio;
      }
    }

    if (!s.coupled && !this.shift && gear > 0 && s.engineRunning) {
      // Launch / creep: slipping clutch or torque converter holds engine near a
      // throttle-dependent stall speed and transmits torque to the wheels.
      const stallRpm = lerp(e.idleRpm, p.transmission === 'automatic' ? 2400 : 3200, s.throttle);
      s.rpm += (Math.max(stallRpm, e.idleRpm) - s.rpm) * approach(dt, 0.18);
      const multiplication =
        p.transmission === 'automatic' ? lerp(1.9, 1.0, clamp(coupledRpm / s.rpm, 0, 1)) : 1;
      const creep = p.transmission === 'manual' ? 0 : 35;
      driveTorque = (Math.max(0, engineTorque) * multiplication + creep) * ratio;
      if (coupledRpm >= s.rpm - 30 && s.speedMs > 0.5) s.coupled = true;
    }

    if (!s.coupled && !this.shift && (gear === 0 || !s.engineRunning)) {
      const target = s.engineRunning ? lerp(idleTarget, e.limiterRpm, effThrottle) : 0;
      s.rpm += (target - s.rpm) * approach(dt, 0.25);
    }

    // --- Longitudinal dynamics ---
    const v = s.speedMs;
    const driveForce = (driveTorque * p.drivetrainEfficiency) / p.wheelRadiusM;
    const aero = 0.5 * AIR_DENSITY_KG_M3 * p.dragCoefficient * p.frontalAreaM2 * v * v;
    const rolling = v > 0.05 ? p.rollingResistance * p.massKg * G : 0;
    const brakeForce = s.brake * p.massKg * G * 1.05;
    const effMass = p.massKg * (1.04 + 0.0025 * ratio * ratio * 0.08);

    let force = driveForce - aero - rolling;
    if (v <= 0.01 && force < 0) force = 0; // no rolling backwards
    let accel = force / effMass;
    let newV = v + accel * dt;
    // Brakes oppose motion but never reverse it.
    const brakeDv = (brakeForce / effMass) * dt;
    newV = newV > brakeDv ? newV - brakeDv : 0;
    accel = (newV - v) / dt;
    s.speedMs = newV;
    this.accelFiltered += (accel / G - this.accelFiltered) * approach(dt, 0.12);
    s.accelG = this.accelFiltered;
    s.odometerKm += (newV * dt) / 1000;

    // --- Automatic shift logic ---
    if (this.mode === 'auto') this.autoShift();
    else if (!this.shift && s.gear > 1 && this.coupledRpm(s.gear) < e.idleRpm * 0.95) {
      this.requestShift(s.gear - 1); // keep from stalling in manual mode
    }
    s.shiftRecommended =
      this.mode === 'manual' &&
      !this.shift &&
      s.gear < this.gearCount &&
      s.rpm > e.redlineRpm - 400;

    // --- Air, fuel, load ---
    s.mapKPa = s.engineRunning
      ? clamp(BARO_KPA * lerp(0.28, 1, effThrottle) + this.boostKPa, 18, 255)
      : BARO_KPA;
    s.mafGs = s.engineRunning
      ? ((e.displacementL * s.rpm) / 120) * 0.88 * AIR_DENSITY_G_L * (s.mapKPa / BARO_KPA)
      : 0;
    s.loadPct = s.engineRunning ? clamp(effThrottle * 100 * (0.85 + 0.15 * boostRatio), 0, 100) : 0;
    const fuelKind = FUEL_CONSTANTS[p.fuelType === 'diesel' ? 'diesel' : 'petrol'];
    const lambda = p.fuelType === 'diesel' ? lerp(3.5, 1.25, effThrottle) : 1;
    s.fuelRateLh =
      fuelCut || !s.engineRunning
        ? 0
        : (s.mafGs * 3600) / (fuelKind.afr * lambda * fuelKind.densityGL);
    s.fuelL = Math.max(0, s.fuelL - (s.fuelRateLh / 3600) * dt);

    // --- Thermals (accelerated by warmupScale) ---
    const tdt = dt * this.warmupScale;
    const heat = 0.04 + s.loadPct / 100 + s.rpm / 20000;
    if (s.coolantC < 88) s.coolantC += heat * 0.12 * tdt;
    else s.coolantC += (89 + heat * 4 - s.coolantC) * approach(tdt, 25);
    const oilTarget = s.coolantC + (s.coolantC > 75 ? 6 + heat * 12 : -6);
    s.oilC += (oilTarget - s.oilC) * approach(tdt, 45);
    const intakeTarget = s.ambientC + 18 - Math.min(v, 30) * 0.4 + this.boostKPa * 0.12;
    s.intakeC += (intakeTarget - s.intakeC) * approach(dt, 8);

    // --- Electrical ---
    s.voltage = s.engineRunning ? 14.15 + this.voltNoise.next(dt) * 0.06 : 12.4;
  }

  private targetGear(): number {
    return this.shift ? this.shift.to : this.state.gear;
  }

  private coupledRpm(gear: number): number {
    if (gear <= 0) return 0;
    const p = this.profile;
    const wheelRpm = (this.state.speedMs / (2 * Math.PI * p.wheelRadiusM)) * 60;
    return wheelRpm * p.gearRatios[gear - 1]! * p.finalDrive;
  }

  private requestShift(to: number): void {
    if (to < 1 || to > this.gearCount || to === this.targetGear()) return;
    this.shift = { to, t: 0 };
  }

  private autoShift(): void {
    const s = this.state;
    const e = this.profile.engine;
    if (this.shift || this.shiftCooldown > 0) return;
    const t = s.throttle;
    const upRpm = lerp(2000, e.redlineRpm - 150, Math.pow(t, 1.4));
    const downRpm = lerp(1150, e.redlineRpm * 0.52, Math.pow(t, 1.2));

    if (s.coupled && s.rpm > upRpm && s.gear < this.gearCount) {
      // Only upshift if the next gear does not lug the engine.
      if (this.coupledRpm(s.gear + 1) > e.idleRpm * 1.25) this.requestShift(s.gear + 1);
      return;
    }
    if (s.gear > 1) {
      const lower = this.coupledRpm(s.gear - 1);
      const kickdown = t > 0.85 && lower < e.redlineRpm - 700;
      if ((s.rpm < downRpm || kickdown) && lower < e.redlineRpm - 400) {
        this.requestShift(s.gear - 1);
      } else if (s.speedMs < 1.5) {
        this.requestShift(1);
      }
    }
  }
}
