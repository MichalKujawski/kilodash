/** Seat states for the belt status display. */
export type SeatState = 'empty' | 'belted' | 'unbelted';
export const SEAT_STATES: SeatState[] = ['empty', 'belted', 'unbelted'];

/** Driving faster than this starts the audible reminder, km/h (EU R16 / Euro NCAP). */
export const BELT_SPEED_KMH = 25;
/** The audible, flashing phase lasts at least this long, s. */
export const BELT_CHIME_S = 90;
/** Rear belt status shows this long after start or after a change, s. */
export const BELT_STATUS_S = 30;

export interface BeltInput {
  ignitionOn: boolean;
  speedKmh: number;
  driverBelted: boolean;
  passenger: { present: boolean; belted: boolean };
  rear: SeatState[];
  dt: number;
}

/**
 * Seat-belt reminder as required in the EU: a lamp while someone in front is
 * unbelted; above 25 km/h the lamp flashes with a chime for 90 s, then stays
 * lit. A rear belt unfastened while driving warns for 30 s. After every start
 * (and on any rear change) the rear seats' belt status is shown for 30 s.
 */
export class SeatbeltReminder {
  /** 0 none, 1 lamp, 2 flashing + chime, 3 lamp after the chime period. */
  stage = 0;
  statusVisible = false;
  private chimeT = 0;
  private triggered = false;
  private statusT = Infinity;
  private rearChimeT = 0;
  private lastRear: SeatState[] = [];
  private wasOn = false;

  step(i: BeltInput): void {
    if (!i.ignitionOn) {
      this.stage = 0;
      this.statusVisible = false;
      this.wasOn = false;
      this.triggered = false;
      this.chimeT = 0;
      return;
    }
    if (!this.wasOn) {
      this.wasOn = true;
      this.statusT = 0;
      this.lastRear = [...i.rear];
    }
    // A rear belt unfastened while moving: warn for 30 s and show the seats.
    const changed = i.rear.some((s, k) => s !== this.lastRear[k]);
    const unbuckled = i.rear.some((s, k) => s === 'unbelted' && this.lastRear[k] === 'belted');
    if (changed) {
      this.statusT = 0;
      if (unbuckled && i.speedKmh > 10) this.rearChimeT = BELT_STATUS_S;
      this.lastRear = [...i.rear];
    }
    this.statusT += i.dt;
    // Only worth showing with somebody besides the driver aboard.
    const passengers = i.passenger.present || i.rear.some((r) => r !== 'empty');
    this.statusVisible = passengers && this.statusT < BELT_STATUS_S;
    this.rearChimeT = Math.max(0, this.rearChimeT - i.dt);

    const front = !i.driverBelted || (i.passenger.present && !i.passenger.belted);
    if (!front) {
      this.triggered = false;
      this.chimeT = 0;
      this.stage = this.rearChimeT > 0 ? 2 : 0;
      return;
    }
    if (i.speedKmh >= BELT_SPEED_KMH) this.triggered = true;
    if (!this.triggered) {
      this.stage = 1;
      return;
    }
    this.chimeT += i.dt;
    this.stage = this.chimeT < BELT_CHIME_S ? 2 : 3;
  }
}

/**
 * Indirect tyre-pressure monitoring (no sensors in the wheels): the ABS wheel
 * speeds reveal a tyre that rolls on a smaller radius. It only warns, and must
 * be told the correct pressures ("store pressures") after inflating.
 */
export class IndirectTpms {
  private stored: number[] | null = null;
  private lowT = 0;
  warning = false;

  store(pressures: number[]): void {
    this.stored = [...pressures];
    this.lowT = 0;
    this.warning = false;
  }

  step(pressures: number[], speedKmh: number, dt: number): void {
    if (!this.stored) this.store(pressures);
    // Detection needs the car rolling: about 20 % lower than stored, for a while.
    const low = pressures.some((p, k) => p < this.stored![k]! * 0.8);
    this.lowT = low && speedKmh > 15 ? this.lowT + dt : low ? this.lowT : 0;
    if (this.lowT > 8) this.warning = true;
    if (!low) this.warning = false;
  }
}

/** Service is announced at start when due within these, km / days. */
export const SERVICE_SOON = { km: 1000, days: 30 };

/** Flexible service interval: counts down kilometres and days. */
export class ServiceInterval {
  constructor(
    public km = 12_800,
    public days = 240,
  ) {}

  drive(km: number): void {
    this.km -= km;
  }

  passDays(days: number): void {
    this.days -= days;
  }

  reset(): void {
    this.km = 30_000;
    this.days = 730;
  }

  get due(): boolean {
    return this.km < SERVICE_SOON.km || this.days < SERVICE_SOON.days;
  }
}
