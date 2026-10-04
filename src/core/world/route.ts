import { GERMANY, type CountryRules } from './country';
import type {
  Feature,
  RoadKind,
  RouteEvent,
  RoutePoint,
  Segment,
  SegmentSpec,
  Sign,
} from './types';

/** Geometry sample spacing, m. */
const STEP = 2;

/** What the law says at a point, before conditions (wet road, time of day) are applied. */
interface LegalEntry {
  s: number;
  base: number | null;
  explicit: number | null;
  conditional: { value: number; plate: NonNullable<Sign['plate']> }[];
  noOvertaking: boolean;
  motorway: boolean;
}

export interface LegalContext {
  wet: boolean;
  /** Hour of day, 0–24. */
  hour: number;
}

export interface LegalLimit {
  /** Speed limit in km/h, or null where there is none. */
  limit: number | null;
  /** Recommended speed where there is no limit. */
  advisory: number | null;
  noOvertaking: boolean;
}

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

/**
 * The road network the car drives: segments laid end to end, with geometry
 * integrated from curvature, plus signs, features (traffic lights, junctions,
 * exits), scripted traffic events and the legal speed-limit timeline.
 */
export class Route {
  readonly segments: Segment[];
  readonly signs: Sign[];
  readonly features: Feature[];
  readonly events: RouteEvent[];
  readonly points: RoutePoint[];
  readonly length: number;
  /** Path out of the starting bay: reversed along it, ending at s = 0. */
  readonly startBay: Pose[];
  private legal: LegalEntry[];
  /** What a navigation map database knows: permanent signs only (no roadworks). */
  private mapLegal: LegalEntry[];

  constructor(
    specs: SegmentSpec[],
    readonly country: CountryRules = GERMANY,
  ) {
    let s0 = 0;
    this.segments = specs.map((spec, index) => {
      const seg = { ...spec, index, s0 };
      s0 += spec.length;
      return seg;
    });
    this.length = s0;
    this.signs = specs
      .flatMap((spec, i) =>
        (spec.signs ?? []).map(({ at, visibility, ...rest }) => ({
          ...rest,
          s: this.segments[i]!.s0 + at,
          visibility: visibility ?? 0.95,
        })),
      )
      .sort((a, b) => a.s - b.s);
    this.features = specs
      .flatMap((spec, i) =>
        (spec.features ?? []).map(({ at, ...rest }) => ({ ...rest, s: this.segments[i]!.s0 + at })),
      )
      .sort((a, b) => a.s - b.s);
    this.events = specs
      .flatMap((spec, i) =>
        (spec.events ?? []).map(({ at, ...rest }) => ({ ...rest, s: this.segments[i]!.s0 + at })),
      )
      .sort((a, b) => a.s - b.s);
    this.points = this.integrate();
    this.legal = this.buildLegal(this.signs);
    this.mapLegal = this.buildLegal(this.signs.filter((g) => !g.temporary));
    this.startBay = this.buildStartBay();
  }

  segmentAt(s: number): Segment {
    let lo = 0;
    let hi = this.segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.segments[mid]!.s0 <= s) lo = mid;
      else hi = mid - 1;
    }
    return this.segments[lo]!;
  }

  /** Raw curvature at s (1/m), from the arcs. */
  curvatureAt(s: number): number {
    const seg = this.segmentAt(s);
    const local = s - seg.s0;
    let k = 0;
    for (const a of seg.arcs ?? []) if (local >= a.at && local < a.at + a.length) k += a.curvature;
    return k;
  }

  gradientAt(s: number): number {
    const seg = this.segmentAt(s);
    const g = seg.gradient;
    if (!g || g.length === 0) return 0;
    const local = s - seg.s0;
    if (local <= g[0]![0]) return g[0]![1];
    for (let i = 1; i < g.length; i++) {
      const [x1, y1] = g[i]!;
      if (local <= x1) {
        const [x0, y0] = g[i - 1]!;
        return y0 + ((y1 - y0) * (local - x0)) / (x1 - x0);
      }
    }
    return g[g.length - 1]![1];
  }

  lanesAt(s: number): number {
    const seg = this.segmentAt(s);
    const local = s - seg.s0;
    if (seg.laneDrop && local >= seg.laneDrop[0] && local < seg.laneDrop[1]) return seg.laneDrop[2];
    return seg.lanes;
  }

  inTunnel(s: number): boolean {
    const seg = this.segmentAt(s);
    const local = s - seg.s0;
    return !!seg.tunnel && local >= seg.tunnel[0] && local < seg.tunnel[1];
  }

  kindAt(s: number): RoadKind {
    return this.segmentAt(s).kind;
  }

  /** Interpolated pose on the route. */
  pointAt(s: number): RoutePoint {
    const c = Math.max(0, Math.min(this.length, s));
    const i = Math.min(this.points.length - 2, Math.floor(c / STEP));
    const a = this.points[i]!;
    const b = this.points[i + 1]!;
    const t = (c - a.s) / (b.s - a.s);
    let dh = b.heading - a.heading;
    if (dh > Math.PI) dh -= 2 * Math.PI;
    if (dh < -Math.PI) dh += 2 * Math.PI;
    return {
      s: c,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      heading: a.heading + dh * t,
      curvature: a.curvature,
      gradient: a.gradient + (b.gradient - a.gradient) * t,
      elevation: a.elevation + (b.elevation - a.elevation) * t,
    };
  }

  /** Town name at s (from town entry/exit signs), if any. */
  townAt(s: number): string | undefined {
    let town = this.segments[0]?.town;
    for (const sign of this.signs) {
      if (sign.s > s) break;
      if (sign.kind === 'townEntry') town = sign.text;
      if (sign.kind === 'townExit') town = undefined;
    }
    return town;
  }

  /** The legal speed limit at s under the given conditions. */
  legalAt(s: number, ctx: LegalContext): LegalLimit {
    return this.limitFrom(this.legal, s, ctx);
  }

  /** The limit a navigation map would report: misses temporary (roadworks) signs. */
  mapLegalAt(s: number, ctx: LegalContext): LegalLimit {
    return this.limitFrom(this.mapLegal, s, ctx);
  }

  private limitFrom(timeline: LegalEntry[], s: number, ctx: LegalContext): LegalLimit {
    let entry = timeline[0]!;
    for (const e of timeline) {
      if (e.s > s) break;
      entry = e;
    }
    let limit = entry.explicit ?? entry.base;
    for (const c of entry.conditional) {
      const applies =
        c.plate.kind === 'wet'
          ? ctx.wet
          : c.plate.from <= c.plate.to
            ? ctx.hour >= c.plate.from && ctx.hour < c.plate.to
            : ctx.hour >= c.plate.from || ctx.hour < c.plate.to;
      if (applies) limit = limit === null ? c.value : Math.min(limit, c.value);
    }
    return {
      limit,
      advisory: limit === null && entry.motorway ? this.country.advisory : null,
      noOvertaking: entry.noOvertaking,
    };
  }

  /** Exact heading at s: the sum of curvature × arc length covered so far. */
  private headingAt(s: number): number {
    if (!this.segmentHeadings) {
      this.segmentHeadings = [];
      let h = 0;
      for (const seg of this.segments) {
        this.segmentHeadings.push(h);
        for (const a of seg.arcs ?? [])
          h += a.curvature * Math.max(0, Math.min(a.length, seg.length - a.at));
      }
    }
    const seg = this.segmentAt(s);
    const local = s - seg.s0;
    let h = this.segmentHeadings[seg.index]!;
    for (const a of seg.arcs ?? [])
      h += a.curvature * Math.max(0, Math.min(a.length, local - a.at));
    return h;
  }

  private segmentHeadings: number[] | undefined;

  private integrate(): RoutePoint[] {
    const pts: RoutePoint[] = [];
    let x = 0;
    let y = 0;
    let elevation = 210;
    // Integrate in 0.25 m sub-steps (tight 10 m junction radii need it), sample every STEP.
    const SUB = 0.25;
    const perSample = Math.round(STEP / SUB);
    for (let s = 0; s <= this.length + STEP; s += STEP) {
      const clampS = (v: number): number => Math.min(v, this.length - 0.001);
      const heading = this.headingAt(clampS(s));
      pts.push({
        s,
        x,
        y,
        heading,
        curvature: this.curvatureAt(clampS(s)),
        gradient: this.gradientAt(clampS(s)),
        elevation,
      });
      for (let i = 0; i < perSample; i++) {
        const sm = clampS(s + (i + 0.5) * SUB);
        const hm = this.headingAt(sm);
        x += Math.cos(hm) * SUB;
        y += Math.sin(hm) * SUB;
        elevation += this.gradientAt(sm) * SUB;
      }
    }
    return pts;
  }

  /**
   * German rules: a town entry sign means 50 (zone signs 30) until the exit
   * sign; outside towns 100; Autobahn none. Explicit signs override until
   * cancelled by an end sign, "end of all restrictions", or a context change
   * (town, zone, motorway). Plates make a limit conditional.
   */
  private buildLegal(signs: Sign[]): LegalEntry[] {
    const r = this.country.implicit;
    const out: LegalEntry[] = [];
    let inTown = !!this.segments[0]?.town;
    let zone30 = false;
    let motorway = false;
    let explicit: number | null = null;
    let conditional: LegalEntry['conditional'] = [];
    let noOvertaking = false;
    let kind: RoadKind = this.segments[0]!.kind;
    const base = (): number | null =>
      kind === 'parking'
        ? r.parking
        : zone30
          ? r.zone30
          : inTown
            ? r.urban
            : motorway
              ? r.motorway
              : // Past the town-exit sign a street counts as a rural road.
                kind === 'urban'
                ? r.rural
                : r[kind];
    const push = (s: number): void => {
      out.push({
        s,
        base: base(),
        explicit,
        conditional: [...conditional],
        noOvertaking,
        motorway,
      });
    };
    const clearContext = (): void => {
      explicit = null;
      conditional = [];
    };
    type Ev = { s: number; seg?: Segment; sign?: Sign };
    const events: Ev[] = [
      ...this.segments.map((seg): Ev => ({ s: seg.s0, seg })),
      ...signs.map((sign): Ev => ({ s: sign.s, sign })),
    ].sort((a, b) => a.s - b.s || (a.seg ? -1 : 1));
    for (const ev of events) {
      if (ev.seg) {
        if (ev.seg.kind !== kind && (ev.seg.kind === 'parking' || kind === 'parking'))
          clearContext();
        kind = ev.seg.kind;
        if (kind === 'urban' || kind === 'zone30') inTown = inTown || !!ev.seg.town;
      } else if (ev.sign) {
        const g = ev.sign;
        switch (g.kind) {
          case 'limit':
            if (g.plate)
              conditional = [
                ...conditional.filter((c) => c.plate.kind !== g.plate!.kind),
                { value: g.value!, plate: g.plate },
              ];
            else explicit = g.value ?? null;
            break;
          case 'limitEnd':
            if (explicit === g.value) explicit = null;
            conditional = conditional.filter((c) => c.value !== g.value);
            break;
          case 'endAll':
            clearContext();
            noOvertaking = false;
            break;
          case 'noOvertaking':
            noOvertaking = true;
            break;
          case 'noOvertakingEnd':
            noOvertaking = false;
            break;
          case 'townEntry':
            inTown = true;
            clearContext();
            break;
          case 'townExit':
            inTown = false;
            clearContext();
            break;
          case 'zone30Start':
            zone30 = true;
            clearContext();
            break;
          case 'zone30End':
            zone30 = false;
            clearContext();
            break;
          case 'motorwayStart':
            motorway = true;
            inTown = false;
            clearContext();
            noOvertaking = false;
            break;
          case 'motorwayEnd':
            motorway = false;
            clearContext();
            break;
          default:
            continue; // informational signs don't change the law
        }
      }
      push(ev.s);
    }
    return out;
  }

  /** Forward arc from the route start into the starting bay (left, 90°, r = 5 m). */
  private buildStartBay(): Pose[] {
    const start = this.points[0]!;
    const out: Pose[] = [];
    const r = 5;
    const n = 20;
    for (let i = 0; i <= n; i++) {
      const a = ((Math.PI / 2) * i) / n;
      // Turning left: heading decreases (y axis points down).
      const heading = start.heading - a;
      const x =
        start.x +
        Math.sin(a) * r * Math.cos(start.heading) +
        (1 - Math.cos(a)) * r * Math.sin(start.heading);
      const y =
        start.y +
        Math.sin(a) * r * Math.sin(start.heading) -
        (1 - Math.cos(a)) * r * Math.cos(start.heading);
      out.push({ x, y, heading });
    }
    // Then 3 m straight into the bay.
    const last = out[out.length - 1]!;
    out.push({
      x: last.x + Math.cos(last.heading) * 3,
      y: last.y + Math.sin(last.heading) * 3,
      heading: last.heading,
    });
    return out;
  }
}
