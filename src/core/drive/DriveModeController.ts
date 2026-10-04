import {
  availableModes,
  DEFAULT_INDIVIDUAL,
  individualParams,
  MODES,
  type DriveModeId,
  type IndividualSettings,
  type Level,
  type ModeParams,
} from './modes';

/** The selection popup confirms on its own after this long without input, s. */
export const POPUP_CONFIRM_S = 2;

export interface DriveModeState {
  available: DriveModeId[];
  current: DriveModeId;
  popup: { open: boolean; highlight: DriveModeId; timer: number } | null;
  /** Individual configuration screen (parked only). */
  config: { open: boolean; row: number } | null;
  individual: IndividualSettings;
}

export const INDIVIDUAL_ROWS: (keyof IndividualSettings)[] = [
  'engine',
  'gearbox',
  'steering',
  'dampers',
  'ac',
  'acc',
  'sound',
];
const LEVELS: Level[] = ['eco', 'normal', 'sport'];

/**
 * Driving mode selection like real cars: the mode button opens a list in the
 * cluster; further presses (or the scroll wheel) move the highlight; OK or ~2 s
 * without input confirms. The mode resets to Normal at every ignition unless
 * "remember last mode" is set. Individual is configured only when parked.
 */
export class DriveModeController {
  state: DriveModeState;
  rememberLast = false;

  constructor(
    equipment: { adaptiveDampers?: boolean; awd?: boolean; driveModes?: boolean },
    individual?: IndividualSettings,
  ) {
    const available = availableModes(equipment);
    this.state = {
      available,
      current: available.includes('normal') ? 'normal' : (available[0] ?? 'normal'),
      popup: null,
      config: null,
      individual: individual ?? { ...DEFAULT_INDIVIDUAL },
    };
  }

  get params(): ModeParams {
    const s = this.state;
    return s.current === 'individual' ? individualParams(s.individual) : MODES[s.current].params;
  }

  toggleRememberLast(): void {
    this.rememberLast = !this.rememberLast;
  }

  /** Called when the ignition comes on. */
  onIgnition(): void {
    if (!this.rememberLast && this.state.available.includes('normal'))
      this.state.current = 'normal';
    this.state.popup = null;
    this.state.config = null;
  }

  /** The mode button: open the list, or move to the next entry. */
  pressButton(): void {
    const s = this.state;
    if (s.available.length === 0) return;
    if (!s.popup) {
      s.popup = { open: true, highlight: s.current, timer: 0 };
      return;
    }
    this.move(1);
  }

  /** Scroll wheel while the list is open. Returns true if consumed. */
  move(dir: 1 | -1): boolean {
    const s = this.state;
    if (s.config) {
      s.config.row = (s.config.row + dir + INDIVIDUAL_ROWS.length) % INDIVIDUAL_ROWS.length;
      return true;
    }
    if (!s.popup) return false;
    const i = s.available.indexOf(s.popup.highlight);
    s.popup.highlight = s.available[(i + dir + s.available.length) % s.available.length]!;
    s.popup.timer = 0;
    return true;
  }

  /** OK: confirm the highlighted mode (Individual + parked opens its settings). */
  ok(parked: boolean): boolean {
    const s = this.state;
    if (s.config) {
      s.config = null;
      return true;
    }
    if (!s.popup) return false;
    this.select(s.popup.highlight);
    if (s.popup.highlight === 'individual' && parked) s.config = { open: true, row: 0 };
    s.popup = null;
    return true;
  }

  /** Left/right on the Individual screen cycles the row's level. */
  adjust(dir: 1 | -1): boolean {
    const s = this.state;
    if (!s.config) return false;
    const key = INDIVIDUAL_ROWS[s.config.row]!;
    const i = LEVELS.indexOf(s.individual[key]);
    s.individual = { ...s.individual, [key]: LEVELS[Math.max(0, Math.min(2, i + dir))]! };
    return true;
  }

  back(): boolean {
    const s = this.state;
    if (s.config) {
      s.config = null;
      return true;
    }
    if (s.popup) {
      s.popup = null;
      return true;
    }
    return false;
  }

  select(id: DriveModeId): void {
    if (this.state.available.includes(id)) this.state.current = id;
  }

  step(dt: number, parked: boolean): void {
    const s = this.state;
    if (s.popup) {
      s.popup.timer += dt;
      if (s.popup.timer >= POPUP_CONFIRM_S) this.ok(parked);
    }
    // Individual configuration is a parked-only screen.
    if (s.config && !parked) s.config = null;
  }
}

export interface CoastingInput {
  modeAllows: boolean;
  automatic: boolean;
  /** Selector in D and not manual. */
  inDrive: boolean;
  cruiseOrAcc: boolean;
  throttle: number;
  brake: number;
  speedKmh: number;
  gradient: number;
}

/**
 * Eco coasting (freewheeling): with the pedals released above ~20 km/h the
 * clutch opens and the engine idles. Never with cruise/ACC, on steep descents,
 * or in manual mode. Any pedal touch re-engages.
 */
export function coastingAllowed(i: CoastingInput): boolean {
  return (
    i.modeAllows &&
    i.automatic &&
    i.inDrive &&
    !i.cruiseOrAcc &&
    i.throttle < 0.02 &&
    i.brake < 0.02 &&
    i.speedKmh > 20 &&
    i.gradient > -0.04
  );
}

export interface CdaInput {
  supported: boolean;
  sportMode: boolean;
  coolantC: number;
  rpm: number;
  /** Brake torque relative to the engine's naturally aspirated full-load torque. */
  torqueFrac: number;
  gear: number;
  /** |d(throttle)/dt| smoothed, 1/s. */
  throttleRate: number;
  coasting: boolean;
}

/**
 * Cylinder deactivation: at light, steady load in a mid gear the engine runs on
 * half its cylinders. Revs don't change, consumption drops. Off in Sport.
 */
export class CylinderDeactivation {
  active = false;
  private steady = 0;

  update(i: CdaInput, dt: number): boolean {
    const ok =
      i.supported &&
      !i.sportMode &&
      !i.coasting &&
      i.coolantC > 60 &&
      i.rpm > 1300 &&
      i.rpm < 4000 &&
      i.torqueFrac > 0.12 &&
      i.torqueFrac < 0.7 &&
      i.gear >= 3;
    if (!ok || i.throttleRate > 0.25) {
      this.steady = 0;
      this.active = false;
      return false;
    }
    this.steady += dt;
    // Needs about 1.5 s of steady light load before switching.
    if (this.steady > 1.5) this.active = true;
    return this.active;
  }
}
