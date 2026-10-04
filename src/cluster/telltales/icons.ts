/**
 * Original telltale artwork on a 24×24 grid, following ISO 2575 meanings.
 * Each icon is a list of parts: filled or stroked SVG path data, or short text.
 */
export type IconPart =
  | { kind: 'fill'; d: string }
  | { kind: 'stroke'; d: string; width?: number }
  | { kind: 'text'; text: string; x: number; y: number; size: number; weight?: number };

export type IconId =
  | 'indicatorLeft'
  | 'indicatorRight'
  | 'lowBeam'
  | 'highBeam'
  | 'fog'
  | 'parkingBrake'
  | 'checkEngine'
  | 'battery'
  | 'oilPressure'
  | 'coolantTemp'
  | 'abs'
  | 'airbag'
  | 'seatbelt'
  | 'lowFuel'
  | 'doorOpen'
  | 'tpms'
  | 'tcs'
  | 'glowPlug'
  | 'cruise'
  | 'ice'
  | 'fuel'
  | 'coolant'
  | 'phone'
  | 'signal'
  | 'laneAssist';

const lamp = 'M13.5 5.5C18.5 5.5 21 8.5 21 12s-2.5 6.5-7.5 6.5z';

export const ICONS: Record<IconId, IconPart[]> = {
  indicatorLeft: [{ kind: 'fill', d: 'M2 12 11 3.5V8.5H22V15.5H11V20.5Z' }],
  indicatorRight: [{ kind: 'fill', d: 'M22 12 13 3.5V8.5H2V15.5H13V20.5Z' }],
  lowBeam: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 7.5 3.5 10M11 11 3.5 13.5M11 14.5 3.5 17', width: 1.8 },
  ],
  highBeam: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 7H3M11 10.3H3M11 13.7H3M11 17H3', width: 1.8 },
  ],
  fog: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 8H4M11 12H4M11 16H4', width: 1.6 },
    { kind: 'stroke', d: 'M8 5.5c1.5 1.6-1.5 3.2 0 4.8s-1.5 3.2 0 4.8 1.5 3.2 0 3.6', width: 1.4 },
  ],
  parkingBrake: [
    { kind: 'stroke', d: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z', width: 1.8 },
    { kind: 'stroke', d: 'M4 6.5a10 10 0 0 0 0 11M20 6.5a10 10 0 0 1 0 11', width: 1.6 },
    { kind: 'text', text: 'P', x: 12, y: 16.2, size: 10, weight: 700 },
  ],
  checkEngine: [
    {
      kind: 'stroke',
      d: 'M3 10.5h2V9h2V7h3V5.5h5V7h-2v1h3.5l2 2H21V8h1.5v7.5H21v-2h-2.5v3h-2l-2 2H8l-1.5-1.5H5v-1.5H3z',
      width: 1.7,
    },
  ],
  battery: [
    { kind: 'stroke', d: 'M3 7.5h18v11H3z', width: 1.8 },
    { kind: 'fill', d: 'M5.5 5h3.5v2.5H5.5zM15 5h3.5v2.5H15z' },
    { kind: 'stroke', d: 'M6 13h4M15 13h4M17 11v4', width: 1.6 },
  ],
  oilPressure: [
    { kind: 'stroke', d: 'M2.5 9.5h3l1.5-1.5h6l7 3.5-1 1-3-1.2V16H5V12H2.5z', width: 1.6 },
    { kind: 'stroke', d: 'M9.5 8V6.2h2.5', width: 1.6 },
    { kind: 'fill', d: 'M21 14.5c.8 1.2 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.4 1.2-2.6z' },
  ],
  coolantTemp: [
    { kind: 'stroke', d: 'M12 3v10M12 6h3M12 8.8h3M12 11.6h3', width: 1.8 },
    { kind: 'fill', d: 'M12 12.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z' },
    { kind: 'stroke', d: 'M3 19.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0', width: 1.5 },
  ],
  abs: [
    { kind: 'stroke', d: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z', width: 1.6 },
    { kind: 'stroke', d: 'M3.8 6.5a10 10 0 0 0 0 11M20.2 6.5a10 10 0 0 1 0 11', width: 1.5 },
    { kind: 'text', text: 'ABS', x: 12, y: 14.6, size: 6.6, weight: 700 },
  ],
  airbag: [
    { kind: 'fill', d: 'M7 3.2a2 2 0 1 1 0 4a2 2 0 1 1 0-4z' },
    { kind: 'stroke', d: 'M6.5 9v6.5h5l2 5M6.5 12.5H10', width: 1.9 },
    { kind: 'fill', d: 'M17 8.5a4.3 4.3 0 1 1 0 8.6a4.3 4.3 0 1 1 0-8.6z' },
  ],
  seatbelt: [
    { kind: 'fill', d: 'M11 2.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z' },
    { kind: 'stroke', d: 'M8 21v-6l-1-5.5h8l-1 5.5v6', width: 1.8 },
    { kind: 'stroke', d: 'M15.5 9 7.5 17.5', width: 2 },
  ],
  lowFuel: [
    {
      kind: 'stroke',
      d: 'M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M2.5 20h12',
      width: 1.8,
    },
    { kind: 'fill', d: 'M6 6.5h5v4H6z' },
    { kind: 'stroke', d: 'M13 10h2.5l1.5 1.5v6a1.3 1.3 0 0 0 2.6 0V9l-2-2.5', width: 1.6 },
  ],
  doorOpen: [
    { kind: 'stroke', d: 'M8 3.5h8l1.5 3v12l-1.5 2H8l-1.5-2v-12z', width: 1.7 },
    { kind: 'stroke', d: 'M8.5 8h7M8.5 16h7', width: 1.3 },
    { kind: 'stroke', d: 'M6.5 9.5 2.5 13.5', width: 2 },
  ],
  tpms: [
    {
      kind: 'stroke',
      d: 'M6 5.5C3.5 8 3.2 14 5 17.5l1.2 1.5h11.6l1.2-1.5c1.8-3.5 1.5-9.5-1-12',
      width: 1.8,
    },
    { kind: 'stroke', d: 'M6.5 21h1.8M11.1 21h1.8M15.7 21h1.8', width: 1.6 },
    { kind: 'stroke', d: 'M12 7.5v6', width: 2 },
    { kind: 'fill', d: 'M12 15.4a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z' },
  ],
  tcs: [
    { kind: 'stroke', d: 'M5 13l1.5-4.5h11L19 13v3H5zM7.5 16v1.5M16.5 16v1.5', width: 1.7 },
    {
      kind: 'stroke',
      d: 'M6 20.5c1-1 2-1 3 0M10.5 20.5c1-1 2-1 3 0M15 20.5c1-1 2-1 3 0M9 3.5c-1 1-1 2 0 3M15 3.5c-1 1-1 2 0 3',
      width: 1.4,
    },
  ],
  glowPlug: [
    {
      kind: 'stroke',
      d: 'M3 12h3c0-3 2.5-3 2.5 0s2.5 3 2.5 0 2.5-3 2.5 0 2.5 3 2.5 0H21',
      width: 1.8,
    },
    { kind: 'stroke', d: 'M3 7h18M3 17h18', width: 1.2 },
  ],
  cruise: [
    { kind: 'stroke', d: 'M4.5 17a8 8 0 1 1 15 0', width: 1.8 },
    { kind: 'stroke', d: 'M12 15 16 9.5', width: 2 },
    { kind: 'stroke', d: 'M3 20h7', width: 1.6 },
  ],
  ice: [
    {
      kind: 'stroke',
      d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2',
      width: 1.6,
    },
  ],
  fuel: [
    {
      kind: 'stroke',
      d: 'M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M2.5 20h12',
      width: 1.8,
    },
    { kind: 'fill', d: 'M6 6.5h5v4H6z' },
    { kind: 'stroke', d: 'M13 10h2.5l1.5 1.5v6a1.3 1.3 0 0 0 2.6 0V9l-2-2.5', width: 1.6 },
  ],
  coolant: [
    { kind: 'stroke', d: 'M12 3v10M12 6h3M12 8.8h3', width: 1.8 },
    { kind: 'fill', d: 'M12 12.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z' },
    { kind: 'stroke', d: 'M4 20c1.3-.9 2.7-.9 4 0s2.7.9 4 0 2.7-.9 4 0 2.7.9 4 0', width: 1.5 },
  ],
  phone: [
    {
      kind: 'stroke',
      d: 'M7 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 5.5a2 2 0 0 1 2-2z',
      width: 1.6,
    },
  ],
  signal: [{ kind: 'fill', d: 'M3 17h3v3H3zM8 13h3v7H8zM13 9h3v11h-3zM18 5h3v15h-3z' }],
  laneAssist: [
    // Lane markings in perspective with the car between them.
    { kind: 'stroke', d: 'M3.5 21 8 4M20.5 21 16 4', width: 1.8 },
    { kind: 'fill', d: 'M9.2 13.5h5.6l1 3v3.5h-1.6v-1.2H9.8v1.2H8.2V16.5z' },
  ],
};

const cache = new Map<string, Path2D>();

function path(d: string): Path2D {
  let p = cache.get(d);
  if (!p) {
    p = new Path2D(d);
    cache.set(d, p);
  }
  return p;
}

/** Draw an icon centred at (x, y), `size` px square, in one colour. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: IconId,
  x: number,
  y: number,
  size: number,
  color: string,
  family = 'sans-serif',
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const part of ICONS[id]) {
    if (part.kind === 'fill') ctx.fill(path(part.d));
    else if (part.kind === 'stroke') {
      ctx.lineWidth = part.width ?? 1.8;
      ctx.stroke(path(part.d));
    } else {
      ctx.font = `${part.weight ?? 600} ${part.size}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(part.text, part.x, part.y);
    }
  }
  ctx.restore();
}
