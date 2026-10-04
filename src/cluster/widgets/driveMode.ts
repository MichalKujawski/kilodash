import { DRIVE_MODE_ORDER, MODES, type DriveModeId } from '@/core/drive/modes';

/** Mode id from the DriveMode signal value. */
export function modeId(value: number): DriveModeId {
  return DRIVE_MODE_ORDER[Math.round(value)] ?? 'normal';
}

export function modeLabel(value: number): string {
  return MODES[modeId(value)].label;
}

/** The mode's accent colour, or null for modes that keep the theme's own look. */
export function modeAccent(value: number): string | null {
  return MODES[modeId(value)].params.accent;
}
