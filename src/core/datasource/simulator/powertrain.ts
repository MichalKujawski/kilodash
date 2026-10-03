import { FUEL_CONSTANTS } from '../../derived/fuel';
import { approach, clamp, interpTable, lerp, SmoothNoise } from '../../math';
import type { EngineSpec, VehicleProfile } from './profile';
import { BARO_KPA, G, type VehicleSimulator, type VehicleState } from './vehicle';

const AIR_DENSITY_G_L = 1.19;

/** Propulsion model. Returns tractive force at the wheels (N) each step. */
export interface Powertrain {
  /** Part of the driver's brake demand covered by regeneration this step, N. */
  regenBrakeN: number;
  update(dt: number): number;
  /** After speed integration: gear selection etc. */
  afterStep?(dt: number): void;
  shift?(dir: 1 | -1): void;
  /** Engine just fired after cranking. */
  onStart?(): void;
}

export function createPowertrain(sim: VehicleSimulator): Powertrain {
  const p = sim.profile;
  if (!p.engine) return new ElectricPowertrain(sim);
  if (p.electric) return new HybridPowertrain(sim, p.engine);
  return new CombustionPowertrain(sim, p.engine);
}

function wheelRpm(s: VehicleState, p: VehicleProfile): number {
  return (s.speedMs / (2 * Math.PI * p.wheelRadiusM)) * 60;
}

/**
 * Engine air/fuel model shared by ICE and hybrid: manifold pressure from
 * throttle and boost, speed-density MAF, stoichiometric (petrol) or lean (diesel)
 * fuel flow, with overrun fuel cut.
 */
function airAndFuel(
  s: VehicleState,
  p: VehicleProfile,
  e: EngineSpec,
  effThrottle: number,
  boostKPa: number,
  fuelCut: boolean,
  dt: number,
): void {
  if (!s.engineRunning) {
    s.mapKPa = BARO_KPA;
    s.mafGs = 0;
    s.loadPct = 0;
    s.fuelRateLh = 0;
    return;
  }
  s.mapKPa = clamp(BARO_KPA * lerp(0.28, 1, effThrottle) + boostKPa, 18, 255);
  s.mafGs = ((e.displacementL * s.rpm) / 120) * 0.88 * AIR_DENSITY_G_L * (s.mapKPa / BARO_KPA);
  const boostShare = e.maxBoostKPa > 0 ? boostKPa / e.maxBoostKPa : 1;
  s.loadPct = clamp(effThrottle * 100 * (0.85 + 0.15 * boostShare), 0, 100);
  const k = FUEL_CONSTANTS[p.fuelType === 'diesel' ? 'diesel' : 'petrol'];
  const lambda = p.fuelType === 'diesel' ? lerp(3.5, 1.25, effThrottle) : 1;
  s.fuelRateLh = fuelCut ? 0 : (s.mafGs * 3600) / (k.afr * lambda * k.densityGL);
  s.fuelL = Math.max(0, s.fuelL - (s.fuelRateLh / 3600) * dt);
  if (s.fuelL <= 0) s.engineRunning = false;
}

/**
 * Combustion engine + stepped gearbox: torque curve, turbo lag, idle governor
 * with cold-idle and start flare, overrun fuel cut, rev limiter with driveline
 * wind-up bounce, misfire fault, auto/manual shifting with rev-matched
 * downshifts, launch slip and torque-converter creep.
 */
export class CombustionPowertrain implements Powertrain {
  regenBrakeN = 0;
  private shiftState: { to: number; t: number } | null = null;
  private cooldown = 0;
  private limiterCut = 0;
  private boost = 0;
  private windup = 0;
  private flare = 0;
  private idleNoise: SmoothNoise;

  constructor(
    private sim: VehicleSimulator,
    private e: EngineSpec,
  ) {
    this.idleNoise = new SmoothNoise(sim.rng, 3);
  }

  onStart(): void {
    this.flare = 1;
  }

  shift(dir: 1 | -1): void {
    const sim = this.sim;
    sim.mode = 'manual';
    const to = this.targetGear() + dir;
    // Refuse a downshift that would over-rev the engine, like a real DCT.
    if (dir < 0 && this.coupledRpm(to) > this.e.limiterRpm - 200) return;
    this.request(to);
  }

  private targetGear(): number {
    return this.shiftState ? this.shiftState.to : this.sim.state.gear;
  }

  private coupledRpm(gear: number): number {
    const p = this.sim.profile;
    const r = p.gearRatios[gear - 1];
    return gear > 0 && r ? wheelRpm(this.sim.state, p) * r * p.finalDrive : 0;
  }

  private request(to: number): void {
    if (to < 1 || to > this.sim.gearCount || to === this.targetGear()) return;
    this.shiftState = { to, t: 0 };
  }

  update(dt: number): number {
    const sim = this.sim;
    const s = sim.state;
    const p = sim.profile;
    const e = this.e;

    if (!s.engineRunning) {
      // Cranking spins the engine at starter speed; otherwise it winds down.
      const target = s.ignition === 3 ? 230 + this.idleNoise.next(dt) * 40 : 0;
      s.rpm += (target - s.rpm) * approach(dt, s.ignition === 3 ? 0.12 : 0.35);
      s.coupled = false;
      this.boost = 0;
      s.boostKPa = 0;
      airAndFuel(s, p, e, 0, 0, true, dt);
      return 0;
    }

    // Idle governor: cold engines idle higher, starts flare briefly.
    this.flare = Math.max(0, this.flare - dt * 0.8);
    const cold = clamp((45 - s.coolantC) / 45, 0, 1) * 320;
    const misfire = sim.faults.has('checkEngine');
    const idleTarget =
      e.idleRpm + cold + this.flare * 650 + this.idleNoise.next(dt) * (misfire ? 55 : 12);
    const idleThrottle = clamp(0.035 + (idleTarget - s.rpm) * 0.0004, 0, 0.25);
    const pedalOff = s.throttle < 0.02;
    const fuelCut = pedalOff && s.coupled && s.rpm > e.idleRpm + 350;
    let eff = fuelCut ? 0 : Math.max(s.throttle, pedalOff ? idleThrottle : 0);

    if (s.rpm >= e.limiterRpm) this.limiterCut = 0.07;
    if (this.limiterCut > 0) {
      this.limiterCut -= dt;
      eff = 0;
    }
    if (this.shiftState && this.shiftState.t < p.shiftTimeS * 0.6) eff *= 0.15; // torque cut
    if (misfire && sim.rng() < 0.04) eff *= 0.5;

    // Turbo: boost only at high load (wastegate open at part throttle), with lag.
    const boostTarget =
      e.maxBoostKPa * clamp((eff - 0.3) / 0.55, 0, 1) * clamp((s.rpm - 1200) / 1800, 0, 1);
    this.boost += (boostTarget - this.boost) * approach(dt, boostTarget > this.boost ? 0.5 : 0.2);
    s.boostKPa = this.boost;
    const boostRatio = e.maxBoostKPa > 0 ? 0.45 + 0.55 * (this.boost / e.maxBoostKPa) : 1;

    // Friction mean effective pressure ~1–1.6 bar across the rev range.
    const friction = (5 + s.rpm * 0.0022) * e.displacementL;
    const engineTorque = interpTable(e.torqueCurve, s.rpm) * eff * boostRatio - friction;

    // Gearbox.
    if (this.shiftState) {
      this.shiftState.t += dt;
      if (this.shiftState.t >= p.shiftTimeS) {
        s.gear = this.shiftState.to;
        this.shiftState = null;
        this.cooldown = 0.9;
      }
    }
    this.cooldown = Math.max(0, this.cooldown - dt);
    const gear = this.targetGear();
    const ratio = gear > 0 ? p.gearRatios[gear - 1]! * p.finalDrive : 0;
    const coupledRpm = this.coupledRpm(gear);
    let wheelTorque = 0;

    if (this.shiftState) {
      // Clutches swap: engine rpm chases the new gear's rpm (gives the downshift blip).
      s.coupled = false;
      s.rpm += (Math.max(coupledRpm, idleTarget) - s.rpm) * approach(dt, p.shiftTimeS / 3);
      wheelTorque = Math.max(0, engineTorque) * ratio * 0.3;
    } else if (s.coupled) {
      if (coupledRpm < e.idleRpm * 0.92) s.coupled = false;
      else {
        // Driveline compliance: torque winds up the shafts slightly, so a limiter
        // cut makes the needle bounce instead of sitting dead still.
        this.windup += (engineTorque * 0.35 - this.windup) * approach(dt, 0.045);
        s.rpm = coupledRpm + this.windup;
        wheelTorque = engineTorque * ratio;
      }
    }
    if (!s.coupled && !this.shiftState) {
      // Launch / creep: slipping clutch or torque converter holds the engine near a
      // throttle-dependent stall speed and transmits torque.
      const stall = lerp(idleTarget, p.transmission === 'automatic' ? 2400 : 3200, s.throttle);
      s.rpm += (Math.max(stall, idleTarget) - s.rpm) * approach(dt, 0.18);
      const mult =
        p.transmission === 'automatic' ? lerp(1.9, 1, clamp(coupledRpm / s.rpm, 0, 1)) : 1;
      const creep = p.transmission === 'manual' || s.brake > 0.05 ? 0 : 35;
      wheelTorque = (Math.max(0, engineTorque) * mult + creep) * ratio;
      if (coupledRpm >= s.rpm - 30 && s.speedMs > 0.5) s.coupled = true;
    }

    airAndFuel(s, p, e, eff, this.boost, fuelCut, dt);
    return (wheelTorque * p.drivetrainEfficiency) / p.wheelRadiusM;
  }

  afterStep(): void {
    const sim = this.sim;
    const s = sim.state;
    const e = this.e;
    if (!s.engineRunning) return;
    if (sim.mode === 'auto') this.autoShift();
    else if (!this.shiftState && s.gear > 1 && this.coupledRpm(s.gear) < e.idleRpm * 0.95) {
      this.request(s.gear - 1); // keep from stalling in manual mode
    }
    s.shiftRecommended =
      sim.mode === 'manual' &&
      !this.shiftState &&
      s.gear < sim.gearCount &&
      s.rpm > e.redlineRpm - 400;
  }

  private autoShift(): void {
    const s = this.sim.state;
    const e = this.e;
    if (this.shiftState || this.cooldown > 0) return;
    const t = s.throttle;
    const upRpm = lerp(1750, e.redlineRpm - 150, Math.pow(t, 1.8));
    const downRpm = lerp(1100, e.redlineRpm * 0.5, Math.pow(t, 1.6));
    if (s.coupled && s.rpm > upRpm && s.gear < this.sim.gearCount) {
      // Only upshift if the next gear does not lug the engine.
      if (this.coupledRpm(s.gear + 1) > e.idleRpm * 1.25) this.request(s.gear + 1);
      return;
    }
    if (s.gear > 1) {
      const lower = this.coupledRpm(s.gear - 1);
      const kickdown = t > 0.85 && lower < e.redlineRpm - 700;
      if ((s.rpm < downRpm || kickdown) && lower < e.redlineRpm - 400) this.request(s.gear - 1);
      else if (s.speedMs < 1.5) this.request(1);
    }
  }
}

/** Shared regenerative braking: lift-off regen plus blended brake regen. */
function regen(sim: VehicleSimulator, liftG: number): { liftN: number; brakeN: number } {
  const s = sim.state;
  const p = sim.profile;
  const el = p.electric!;
  const v = s.speedMs;
  if (v < 1.5 || !s.ready) return { liftN: 0, brakeN: 0 };
  const maxN = (el.regenPowerKW * 1000) / v;
  const liftN = s.throttle < 0.03 ? Math.min(liftG * p.massKg * G, maxN) : 0;
  const brakeN = Math.min(s.brake * p.massKg * G * 1.05, Math.max(0, maxN - liftN));
  return { liftN, brakeN };
}

/** Single-speed electric drive: torque/power limited motor, regen, SoC. */
export class ElectricPowertrain implements Powertrain {
  regenBrakeN = 0;

  constructor(private sim: VehicleSimulator) {}

  update(dt: number): number {
    const sim = this.sim;
    const s = sim.state;
    const p = sim.profile;
    const el = p.electric!;
    s.gear = 1;
    s.rpm = wheelRpm(s, p) * (p.gearRatios[0] ?? 1) * p.finalDrive;
    s.coupled = true;
    if (!s.ready) {
      this.regenBrakeN = 0;
      s.powerKW = 0;
      return 0;
    }
    const v = s.speedMs;
    const ratio = (p.gearRatios[0] ?? 1) * p.finalDrive;
    const torqueLimitN = (el.motorTorqueNm * ratio * p.drivetrainEfficiency) / p.wheelRadiusM;
    const powerLimitN = (el.motorPowerKW * 1000) / Math.max(v, 1);
    let force = s.throttle * Math.min(torqueLimitN, powerLimitN);
    // Gentle creep in D below walking pace.
    if (v < 2 && s.brake < 0.05 && s.throttle < 0.05) force += 260;
    const r = regen(sim, 0.07);
    this.regenBrakeN = r.brakeN;
    force -= r.liftN;

    const tractionKW = (Math.max(force, 0) * v) / 1000 / 0.9;
    const regenKW = ((r.liftN + r.brakeN) * v * 0.7) / 1000;
    s.powerKW = tractionKW - regenKW + 0.6; // + auxiliaries
    s.soc = clamp(s.soc - ((s.powerKW * dt) / 3600 / el.batteryKWh) * 100, 0, 100);
    if (s.soc <= 0) force = Math.min(force, 0);
    s.loadPct = clamp((tractionKW / el.motorPowerKW) * 100, 0, 100);
    return force;
  }
}

/**
 * Power-split hybrid (eCVT): the engine starts and stops by demand, speed and
 * state of charge; the motor fills in, regenerates and charges.
 */
export class HybridPowertrain implements Powertrain {
  regenBrakeN = 0;
  private engineHold = 0;
  private idleNoise: SmoothNoise;

  constructor(
    private sim: VehicleSimulator,
    private e: EngineSpec,
  ) {
    this.idleNoise = new SmoothNoise(sim.rng, 2);
  }

  private enginePeakKW(): number {
    return Math.max(...this.e.torqueCurve.map(([rpm, nm]) => (nm * rpm * 2 * Math.PI) / 60000));
  }

  update(dt: number): number {
    const sim = this.sim;
    const s = sim.state;
    const p = sim.profile;
    const e = this.e;
    const el = p.electric!;
    s.gear = 1;
    s.coupled = true;
    if (!s.ready) {
      s.engineRunning = false;
      s.rpm += (0 - s.rpm) * approach(dt, 0.3);
      this.regenBrakeN = 0;
      s.powerKW = 0;
      airAndFuel(s, p, e, 0, 0, true, dt);
      return 0;
    }

    const peak = this.enginePeakKW();
    const demandKW = s.throttle * (peak + el.motorPowerKW * 0.8);
    const kmh = sim.speedKmh;
    const wantEngine =
      demandKW > el.motorPowerKW * 0.55 ||
      kmh > (el.evMaxKmh ?? 60) ||
      s.soc < 28 ||
      (s.coolantC < 40 && kmh > 5);
    if (wantEngine) this.engineHold = 4;
    else this.engineHold = Math.max(0, this.engineHold - dt);
    const engineOn = this.engineHold > 0;
    s.engineRunning = engineOn;

    // Engine runs on its efficient line; motor supplies or absorbs the difference.
    const chargeKW = s.soc < 55 ? 8 : 0;
    const engineKW = engineOn ? clamp(demandKW + chargeKW, peak * 0.08, peak) : 0;
    const motorKW = demandKW - engineKW;
    const rpmTarget = engineOn ? lerp(1150, e.redlineRpm * 0.82, engineKW / peak) : 0;
    s.rpm +=
      (rpmTarget + (engineOn ? this.idleNoise.next(dt) * 10 : 0) - s.rpm) * approach(dt, 0.35);
    const eff = engineOn ? clamp(engineKW / peak + 0.08, 0, 1) : 0;
    airAndFuel(s, p, e, eff, 0, !engineOn, dt);

    const v = s.speedMs;
    const maxN = ((el.motorTorqueNm * 2.2 + 140) * p.finalDrive) / p.wheelRadiusM;
    let force = Math.min((demandKW * 1000 * p.drivetrainEfficiency) / Math.max(v, 2.5), maxN);
    if (v < 2 && s.brake < 0.05 && s.throttle < 0.05) force += 240;
    const r = regen(sim, 0.05);
    this.regenBrakeN = r.brakeN;
    force -= r.liftN;

    const regenKW = ((r.liftN + r.brakeN) * v * 0.7) / 1000;
    s.powerKW = motorKW - regenKW + 0.4;
    s.soc = clamp(s.soc - ((s.powerKW * dt) / 3600 / el.batteryKWh) * 100, 5, 95);
    return force;
  }
}
