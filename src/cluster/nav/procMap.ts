import { createRng } from '@/core/math';

export interface Vec2 {
  x: number;
  y: number;
}

export type BlockKind = 'building' | 'park' | 'water';

export interface Street {
  name: string;
  major: boolean;
}

const STREET_NAMES = [
  'Harbor Avenue',
  'Linden Street',
  'Mill Road',
  'Cedar Lane',
  'Station Road',
  'Elm Street',
  'Bridge Street',
  'Market Street',
  'Park Avenue',
  'Kingsway',
  'Orchard Road',
  'Canal Street',
  'Maple Drive',
  'Foundry Lane',
  'Quay Road',
  'Willow Way',
  'Granite Street',
  'North Parade',
  'Lantern Row',
  'Meadow Road',
  'Copper Street',
  'Ash Grove',
  'Signal Hill',
  'Ferry Lane',
  'Union Street',
  'Beacon Road',
  'Holloway',
  'Riverside Drive',
  'Chapel Street',
  'Tannery Road',
] as const;

/**
 * Deterministic procedural city: a jittered street grid with named streets, city
 * blocks (buildings, parks, a river). Units are metres, +x east, +y south.
 */
export class ProceduralCity {
  readonly n: number;
  readonly spacing: number;
  readonly nodes: Vec2[][];
  /** Street running along row j (east-west). */
  readonly rows: Street[];
  /** Street running along column i (north-south). */
  readonly cols: Street[];
  readonly blocks: BlockKind[][];

  constructor(seed = 7, n = 28, spacing = 140) {
    this.n = n;
    this.spacing = spacing;
    const rng = createRng(seed);
    this.nodes = [];
    for (let i = 0; i < n; i++) {
      const col: Vec2[] = [];
      for (let j = 0; j < n; j++) {
        // Gentle warp so streets aren't ruler-straight.
        const wx = Math.sin(j * 0.45 + i * 0.1) * spacing * 0.12;
        const wy = Math.cos(i * 0.4 + j * 0.15) * spacing * 0.12;
        col.push({
          x: i * spacing + wx + (rng() - 0.5) * spacing * 0.12,
          y: j * spacing + wy + (rng() - 0.5) * spacing * 0.12,
        });
      }
      this.nodes.push(col);
    }
    const names = [...STREET_NAMES];
    const pick = (k: number): string => names[k % names.length]!;
    this.rows = Array.from({ length: n }, (_, j) => ({ name: pick(j * 2), major: j % 5 === 2 }));
    this.cols = Array.from({ length: n }, (_, i) => ({
      name: pick(i * 2 + 1),
      major: i % 6 === 3,
    }));
    this.blocks = [];
    for (let i = 0; i < n - 1; i++) {
      const col: BlockKind[] = [];
      for (let j = 0; j < n - 1; j++) {
        const river = Math.abs(i - (n * 0.62 + Math.sin(j * 0.35) * 2.5)) < 0.9;
        col.push(river ? 'water' : rng() < 0.09 ? 'park' : 'building');
      }
      this.blocks.push(col);
    }
  }

  node(i: number, j: number): Vec2 {
    return this.nodes[i]![j]!;
  }

  /** Street connecting two adjacent grid nodes. */
  streetBetween(a: [number, number], b: [number, number]): Street {
    return a[1] === b[1] ? this.rows[a[1]]! : this.cols[a[0]]!;
  }
}

export type TurnDirection = 'left' | 'right' | 'straight';

export interface NextTurn {
  direction: TurnDirection;
  distanceM: number;
  street: string;
}

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

/**
 * Drives a deterministic random route through the city, advancing by distance.
 * Exposes position, heading, current street and the next turn for navigation.
 */
export class RouteFollower {
  private path: [number, number][] = [];
  private seg = 0;
  private along = 0;
  private rng: () => number;

  constructor(
    readonly city: ProceduralCity,
    seed = 3,
  ) {
    this.rng = createRng(seed);
    const mid = Math.floor(city.n / 2);
    this.path = [
      [mid, mid],
      [mid + 1, mid],
    ];
    this.extend(40);
  }

  private extend(count: number): void {
    const n = this.city.n;
    for (let k = 0; k < count; k++) {
      const a = this.path[this.path.length - 2]!;
      const b = this.path[this.path.length - 1]!;
      const dir: [number, number] = [b[0] - a[0], b[1] - a[1]];
      const di = DIRS.findIndex((d) => d[0] === dir[0] && d[1] === dir[1]);
      const r = this.rng();
      const options = [di, (di + 1) % 4, (di + 3) % 4];
      // Prefer going straight; turn at ~40% of junctions.
      let order =
        r < 0.6
          ? options
          : r < 0.8
            ? [options[1]!, options[0]!, options[2]!]
            : [options[2]!, options[0]!, options[1]!];
      order = order.filter((o) => {
        const nx = b[0] + DIRS[o]![0];
        const ny = b[1] + DIRS[o]![1];
        return nx >= 2 && ny >= 2 && nx < n - 2 && ny < n - 2;
      });
      const chosen = order[0] ?? (di + 2) % 4;
      this.path.push([b[0] + DIRS[chosen]![0], b[1] + DIRS[chosen]![1]]);
    }
  }

  private pt(k: number): Vec2 {
    const [i, j] = this.path[k]!;
    return this.city.node(i, j);
  }

  private segLength(k: number): number {
    const a = this.pt(k);
    const b = this.pt(k + 1);
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  advance(meters: number): void {
    this.along += Math.max(0, meters);
    while (this.along >= this.segLength(this.seg)) {
      this.along -= this.segLength(this.seg);
      this.seg++;
      if (this.seg > 20) {
        // Drop the travelled part to keep the path short.
        this.path.splice(0, 10);
        this.seg -= 10;
      }
      if (this.path.length - this.seg < 20) this.extend(20);
    }
  }

  get position(): Vec2 {
    const a = this.pt(this.seg);
    const b = this.pt(this.seg + 1);
    const t = this.along / this.segLength(this.seg);
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  /** Heading in radians (atan2 of travel direction, +x = 0). */
  get heading(): number {
    const a = this.pt(this.seg);
    const b = this.pt(this.seg + 1);
    return Math.atan2(b.y - a.y, b.x - a.x);
  }

  get street(): string {
    return this.city.streetBetween(this.path[this.seg]!, this.path[this.seg + 1]!).name;
  }

  /** Points from the current position along the route for `count` nodes. */
  ahead(count: number): Vec2[] {
    const out = [this.position];
    for (let k = 1; k <= count && this.seg + k < this.path.length; k++)
      out.push(this.pt(this.seg + k));
    return out;
  }

  nextTurn(): NextTurn {
    let dist = this.segLength(this.seg) - this.along;
    for (let k = this.seg + 1; k + 1 < this.path.length; k++) {
      const a = this.path[k - 1]!;
      const b = this.path[k]!;
      const c = this.path[k + 1]!;
      const d1 = [b[0] - a[0], b[1] - a[1]];
      const d2 = [c[0] - b[0], c[1] - b[1]];
      const cross = d1[0]! * d2[1]! - d1[1]! * d2[0]!;
      if (cross !== 0) {
        // y points south, so a positive cross product is a right turn.
        return {
          direction: cross > 0 ? 'right' : 'left',
          distanceM: dist,
          street: this.city.streetBetween(b, c).name,
        };
      }
      dist += this.segLength(k);
    }
    return { direction: 'straight', distanceM: dist, street: this.street };
  }
}
