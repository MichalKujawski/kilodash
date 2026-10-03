/**
 * Supported-PID bitmaps (Mode 01 PIDs 00, 20, 40 …). Each response carries 4 bytes:
 * bit 7 of byte A is the first PID of the block (base+1), bit 0 of byte D the last
 * (base+32). The last bit doubles as "next block query supported".
 */

export const BITMAP_BLOCKS = [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0] as const;

/** Decode a 4-byte bitmap for the block starting at `base` into PID numbers. */
export function decodeBitmap(base: number, bytes: number[]): number[] {
  const pids: number[] = [];
  for (let i = 0; i < 32; i++) {
    const byte = bytes[i >> 3] ?? 0;
    if (byte & (0x80 >> (i & 7))) pids.push(base + i + 1);
  }
  return pids;
}

/** True if the bitmap says the next block (base+0x20) may be queried. */
export function hasNextBlock(bytes: number[]): boolean {
  return ((bytes[3] ?? 0) & 0x01) !== 0;
}

/**
 * Encode the bitmap for block `base` given every supported PID. Sets the
 * continuation bit when any PID in a later block is supported.
 */
export function encodeBitmap(base: number, supported: ReadonlySet<number>): number[] {
  const bytes = [0, 0, 0, 0];
  for (let i = 0; i < 32; i++) {
    const pid = base + i + 1;
    const isContinuation = i === 31;
    const set = isContinuation
      ? [...supported].some((p) => p > base + 0x20) || supported.has(pid)
      : supported.has(pid);
    if (set) bytes[i >> 3]! |= 0x80 >> (i & 7);
  }
  return bytes;
}

/** OR together bitmaps from several ECUs answering the same request. */
export function mergeBitmaps(responses: number[][]): number[] {
  const out = [0, 0, 0, 0];
  for (const r of responses) for (let i = 0; i < 4; i++) out[i]! |= r[i] ?? 0;
  return out;
}
