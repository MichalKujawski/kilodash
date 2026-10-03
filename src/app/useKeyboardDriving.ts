import { useEffect, useRef } from 'react';
import type { ScenarioId } from '@/core/datasource/simulator/scenarios';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';

export const SCENARIO_KEYS: ScenarioId[] = [
  'city',
  'highway',
  'mountain',
  'track',
  'night',
  'coldStart',
];

export interface ExtraKeyActions {
  cycleNight?: () => void;
  toggleMute?: () => void;
  toggleEngineSound?: () => void;
  cycleTheme?: () => void;
  /** Any key press (used to unlock audio). */
  onAnyKey?: () => void;
}

/**
 * Keyboard driving: W/S throttle & brake, Q/E paddles, `,`/`.` indicators,
 * H high beam, Space hazard, C cruise, F fog, K ignition, 1–6 scenarios,
 * P autopilot, N night mode, M mute, G engine sound.
 */
export function useKeyboardDriving(
  source: SimulatorSource | undefined,
  extra: ExtraKeyActions = {},
): void {
  const extraRef = useRef(extra);
  useEffect(() => {
    extraRef.current = extra;
  });

  useEffect(() => {
    if (!source) return;
    const held = new Set<string>();
    const apply = (): void =>
      source.setManualInput({ throttle: held.has('w') ? 1 : 0, brake: held.has('s') ? 1 : 0 });

    const down = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      extraRef.current.onAnyKey?.();
      const k = e.key.toLowerCase();
      const x = extraRef.current;
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
      } else if (k === 'h') source.toggleHighBeam();
      else if (k === ' ') source.toggleHazard();
      else if (k === 'c') source.toggleCruise();
      else if (k === 'f') source.toggleFog();
      else if (k === 'k') source.toggleIgnition();
      else if (k === 'p') source.setAutopilot(!source.autopilot);
      else if (k === 'n') x.cycleNight?.();
      else if (k === 'm') x.toggleMute?.();
      else if (k === 'g') x.toggleEngineSound?.();
      else if (k === 't') x.cycleTheme?.();
      else if (/^[1-6]$/.test(k)) source.setScenario(SCENARIO_KEYS[Number(k) - 1]!);
      else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent): void => {
      if (held.delete(e.key.toLowerCase())) apply();
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
