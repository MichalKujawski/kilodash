import { useEffect } from 'react';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';

/**
 * Keyboard driving: W/S throttle & brake, Q/E paddles, `,`/`.` indicators,
 * P toggles the autopilot.
 */
export function useKeyboardDriving(source: SimulatorSource | undefined): void {
  useEffect(() => {
    if (!source) return;
    const held = new Set<string>();
    const apply = (): void =>
      source.setManualInput({ throttle: held.has('w') ? 1 : 0, brake: held.has('s') ? 1 : 0 });

    const down = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 's') {
        if (!e.repeat) {
          held.add(k);
          apply();
        }
      } else if (k === 'e') source.paddle('up');
      else if (k === 'q') source.paddle('down');
      else if (k === ',' || k === '.') {
        const side = k === ',' ? 'left' : 'right';
        const on =
          side === 'left' ? source.sim.inputs.leftIndicator : source.sim.inputs.rightIndicator;
        source.setIndicator(on ? 'off' : side);
      } else if (k === 'p') source.autopilot = !source.autopilot;
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      const k = e.key.toLowerCase();
      if (held.delete(k)) apply();
    };
    // Keep the manual-input timer alive while a pedal is held.
    const keepAlive = setInterval(() => held.size && apply(), 250);
    const blur = (): void => {
      held.clear();
      apply();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      clearInterval(keepAlive);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [source]);
}
