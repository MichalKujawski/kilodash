import { useEffect } from 'react';
import { KEY_TO_ACTION, type Action } from './actions';
import type { ControlBus } from './ControlBus';

/** Standard-mapping gamepad buttons → actions. */
const PAD_BUTTONS: [number, Action][] = [
  [4, 'paddleDown'],
  [5, 'paddleUp'],
  [12, 'scrollUp'],
  [13, 'scrollDown'],
  [14, 'left'],
  [15, 'right'],
  [0, 'ok'],
  [1, 'back'],
  [3, 'view'],
  [2, 'accMain'],
  [8, 'hazard'],
  [9, 'start'],
];

/**
 * Keyboard and gamepad → control bus. Keys map through `ACTIONS`; gamepad
 * triggers are analog pedals, the left stick works the indicator stalk.
 */
export function useControlInputs(bus: ControlBus | null, onAnyInput?: () => void): void {
  useEffect(() => {
    if (!bus) return;
    const keyAction = (e: KeyboardEvent): Action | undefined =>
      KEY_TO_ACTION.get(e.key.toLowerCase());
    const typing = (e: KeyboardEvent): boolean =>
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement ||
      e.target instanceof HTMLSelectElement;
    const down = (e: KeyboardEvent): void => {
      if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
      const a = keyAction(e);
      if (!a) return;
      onAnyInput?.();
      e.preventDefault();
      if (!e.repeat) bus.press(a);
    };
    const up = (e: KeyboardEvent): void => {
      const a = keyAction(e);
      if (a) bus.release(a);
    };
    const blur = (): void => {
      for (const a of ['throttle', 'brake', 'flash', 'washer'] as Action[]) bus.release(a);
    };

    // Gamepad polling (the API has no events for buttons).
    const prev = new Map<number, boolean>();
    let stick: Action | null = null;
    let raf = 0;
    const poll = (): void => {
      raf = requestAnimationFrame(poll);
      const pad = navigator.getGamepads?.().find((g) => g && g.mapping === 'standard');
      if (!pad) return;
      for (const [i, a] of PAD_BUTTONS) {
        const pressed = !!pad.buttons[i]?.pressed;
        if (pressed !== !!prev.get(i)) {
          if (pressed) {
            onAnyInput?.();
            bus.press(a);
          } else bus.release(a);
          prev.set(i, pressed);
        }
      }
      const rt = pad.buttons[7]?.value ?? 0;
      const lt = pad.buttons[6]?.value ?? 0;
      bus.setPedal('throttle', rt > 0.02 ? rt : null);
      bus.setPedal('brake', lt > 0.02 ? lt : null);
      const x = pad.axes[0] ?? 0;
      const want: Action | null = x < -0.6 ? 'indicatorLeft' : x > 0.6 ? 'indicatorRight' : null;
      if (want !== stick) {
        if (stick) bus.release(stick);
        if (want) bus.press(want);
        stick = want;
      }
    };
    raf = requestAnimationFrame(poll);

    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [bus, onAnyInput]);
}
