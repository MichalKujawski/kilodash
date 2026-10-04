import type { LegalLimit } from '../world/route';
import type { Plate, Sign } from '../world/types';

export type LimitSource = 'camera' | 'map';

export interface RecognizedLimit {
  /** km/h; null = no limit (derestricted); undefined = unknown. */
  limit: number | null | undefined;
  advisory: number | null;
  noOvertaking: boolean;
  /** Supplementary plate of the sign being shown (it applies right now). */
  plate: Plate['kind'] | null;
  source: LimitSource;
}

export interface RecognitionInput {
  /** Signs passed since the last step. */
  passed: Sign[];
  /** What the navigation map says here (permanent signs, implicit limits). */
  map: LegalLimit;
  /** Implicit limits: in town, outside town. */
  implicit: { urban: number; rural: number | null };
  /** The car turned onto another road (junction, ramp). */
  roadChanged: boolean;
  wet: boolean;
  hour: number;
}

interface CameraReading {
  limit: number | null;
  /** A plated limit read earlier; shown only while its condition holds. */
  conditional: { value: number; plate: Plate } | null;
  noOvertaking: boolean;
}

function plateApplies(p: Plate, wet: boolean, hour: number): boolean {
  if (p.kind === 'wet') return wet;
  return p.from <= p.to ? hour >= p.from && hour < p.to : hour >= p.from || hour < p.to;
}

/**
 * Traffic-sign recognition fused with map data, like real cars:
 * - the camera reads each sign it passes, but not every sign (dirty,
 *   hidden, bent: each sign has a read probability), so recognition is
 *   imperfect on purpose;
 * - a camera reading holds until the next relevant sign or until the car
 *   turns onto another road; then the map fills in;
 * - the map knows permanent limits and implicit ones (town 50, rural 100) but
 *   not temporary roadworks signs.
 */
export class SpeedLimitRecognition {
  private camera: CameraReading | null = null;

  constructor(private rng: () => number) {}

  reset(): void {
    this.camera = null;
  }

  step(i: RecognitionInput): RecognizedLimit {
    if (i.roadChanged) this.camera = null;
    for (const sign of i.passed) {
      if (this.rng() < sign.visibility) this.read(sign, i);
    }
    return this.result(i);
  }

  private read(g: Sign, i: RecognitionInput): void {
    const cam: CameraReading = this.camera ?? {
      limit: i.map.limit,
      conditional: null,
      noOvertaking: i.map.noOvertaking,
    };
    switch (g.kind) {
      case 'limit':
        if (g.plate) cam.conditional = { value: g.value!, plate: g.plate };
        else {
          cam.limit = g.value ?? null;
          cam.conditional = null;
        }
        break;
      case 'limitEnd':
        // Back to whatever applies here without the sign: the map knows.
        this.camera = null;
        return;
      case 'endAll':
      case 'motorwayStart':
        cam.limit = null;
        cam.conditional = null;
        cam.noOvertaking = false;
        break;
      case 'townEntry':
        cam.limit = i.implicit.urban;
        cam.conditional = null;
        break;
      case 'zone30Start':
        cam.limit = 30;
        cam.conditional = null;
        break;
      case 'townExit':
        cam.limit = i.implicit.rural;
        cam.conditional = null;
        break;
      case 'zone30End':
      case 'motorwayEnd':
        this.camera = null;
        return;
      case 'noOvertaking':
        cam.noOvertaking = true;
        break;
      case 'noOvertakingEnd':
        cam.noOvertaking = false;
        break;
      default:
        return; // tunnel, exit signs: no speed information
    }
    this.camera = cam;
  }

  private result(i: RecognitionInput): RecognizedLimit {
    const cam = this.camera;
    if (!cam) {
      return {
        limit: i.map.limit,
        advisory: i.map.advisory,
        noOvertaking: i.map.noOvertaking,
        plate: null,
        source: 'map',
      };
    }
    let limit = cam.limit;
    let plate: Plate['kind'] | null = null;
    const c = cam.conditional;
    if (c && plateApplies(c.plate, i.wet, i.hour) && (limit === null || c.value <= limit)) {
      limit = c.value;
      plate = c.plate.kind;
    }
    return {
      limit,
      advisory: limit === null ? i.map.advisory : null,
      noOvertaking: cam.noOvertaking,
      plate,
      source: 'camera',
    };
  }
}

export type IsaLevel = 'off' | 'ok' | 'visual' | 'acoustic';
export const ISA_LEVELS: IsaLevel[] = ['off', 'ok', 'visual', 'acoustic'];

/** Over the limit this long before the sign flashes, s. */
export const ISA_VISUAL_S = 0.5;
/** Still over after this long: one short chime, s. */
export const ISA_ACOUSTIC_S = 3;
/** Back under for this long ends the episode, s. */
const ISA_CLEAR_S = 2;

/**
 * Intelligent speed assistance warning (EU 2019/2144): when faster than the
 * recognised limit (+ an optional 0–10 km/h offset) the sign flashes, then a
 * single short chime sounds. Switched on at every start; the driver can turn
 * it off for the trip.
 */
export class IsaWarning {
  enabled = true;
  offset = 0;
  level: IsaLevel = 'ok';
  private overT = 0;
  private underT = 0;
  private lastLimit: number | null | undefined = undefined;

  onIgnition(): void {
    this.enabled = true;
    this.overT = 0;
  }

  /** Driver switches the warning off (for this trip) or back on. */
  toggle(): void {
    this.enabled = !this.enabled;
  }

  setOffset(kmh: number): void {
    this.offset = Math.max(0, Math.min(10, Math.round(kmh)));
  }

  step(speedKmh: number, limit: number | null | undefined, dt: number): IsaLevel {
    if (!this.enabled) {
      this.level = 'off';
      return this.level;
    }
    // A new limit starts a new episode.
    if (limit !== this.lastLimit) {
      this.overT = 0;
      this.lastLimit = limit;
    }
    const over = typeof limit === 'number' && Math.round(speedKmh) > limit + this.offset;
    if (over) {
      this.overT += dt;
      this.underT = 0;
    } else {
      this.underT += dt;
      if (this.underT > ISA_CLEAR_S) this.overT = 0;
    }
    if (!over) this.level = 'ok';
    else if (this.overT >= ISA_ACOUSTIC_S) this.level = 'acoustic';
    else if (this.overT >= ISA_VISUAL_S) this.level = 'visual';
    else this.level = 'ok';
    return this.level;
  }
}
