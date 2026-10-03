export interface DtcInfo {
  code: string;
  description: string;
}

const PREFIX = ['P', 'C', 'B', 'U'] as const;

/** Decode one 2-byte DTC: top two bits pick P/C/B/U, then 14 bits of hex digits. */
export function decodeDtc(a: number, b: number): string {
  const letter = PREFIX[(a >> 6) & 0x03]!;
  const d1 = (a >> 4) & 0x03;
  const d2 = a & 0x0f;
  return `${letter}${d1}${d2.toString(16).toUpperCase()}${((b >> 4) & 0x0f).toString(16).toUpperCase()}${(b & 0x0f).toString(16).toUpperCase()}`;
}

export function encodeDtc(code: string): [number, number] {
  const letter = PREFIX.indexOf(code[0] as (typeof PREFIX)[number]);
  const d1 = parseInt(code[1] ?? '0', 16);
  const d2 = parseInt(code[2] ?? '0', 16);
  const rest = parseInt(code.slice(3), 16);
  return [((letter & 3) << 6) | ((d1 & 3) << 4) | (d2 & 0x0f), rest & 0xff];
}

/** Parse a Mode 03 response payload (bytes after the 0x43 service byte), skipping 0000 padding. */
export function parseDtcPayload(bytes: number[]): string[] {
  const out: string[] = [];
  // CAN responses prefix a count byte; detect by odd length.
  const data = bytes.length % 2 === 1 ? bytes.slice(1) : bytes;
  for (let i = 0; i + 1 < data.length; i += 2) {
    const a = data[i]!;
    const b = data[i + 1]!;
    if (a === 0 && b === 0) continue;
    out.push(decodeDtc(a, b));
  }
  return out;
}

/** Human descriptions for common generic codes. */
export const DTC_DESCRIPTIONS: Record<string, string> = {
  P0101: 'Mass air flow sensor range/performance',
  P0128: 'Coolant thermostat below regulating temperature',
  P0171: 'System too lean (bank 1)',
  P0217: 'Engine overheat condition',
  P0300: 'Random/multiple cylinder misfire detected',
  P0301: 'Cylinder 1 misfire detected',
  P0302: 'Cylinder 2 misfire detected',
  P0420: 'Catalyst system efficiency below threshold (bank 1)',
  P0442: 'Evaporative emission system small leak detected',
  P0562: 'System voltage low',
  P0620: 'Generator control circuit malfunction',
  C0750: 'Tire pressure monitor sensor low pressure',
  B1000: 'Electronic control unit internal fault',
  U0100: 'Lost communication with ECM/PCM',
};

export function describeDtc(code: string): DtcInfo {
  return { code, description: DTC_DESCRIPTIONS[code] ?? 'Manufacturer-specific code' };
}
