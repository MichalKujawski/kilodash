import { useRef, type CSSProperties, type ReactNode } from 'react';
import { ACTIONS, keyHint, type Action } from '../controls/actions';
import type { ControlBus } from '../controls/ControlBus';

interface Props {
  bus: ControlBus;
  action: Action;
  children: ReactNode;
  className?: string;
  /** Backlight on (the control is usable now). */
  lit?: boolean;
  /** Function indicator on (e.g. cruise engaged). */
  active?: boolean;
  disabled?: boolean;
  label?: string;
  style?: CSSProperties;
}

/**
 * A physical button: pointer down/up are press/release, so holds and long
 * presses behave like the real control. The keyboard key shows only on hover.
 */
export function HoldButton({
  bus,
  action,
  children,
  className = '',
  lit = true,
  active,
  disabled,
  label,
  style,
}: Props) {
  const held = useRef(false);
  const end = (): void => {
    if (held.current) bus.release(action);
    held.current = false;
  };
  return (
    <button
      type="button"
      className={`hb ${className} ${lit ? 'hb-lit' : ''} ${active ? 'hb-active' : ''}`}
      style={style}
      aria-label={label ?? ACTIONS[action].label}
      aria-pressed={active}
      aria-disabled={disabled}
      data-key={keyHint(action)}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        bus.press(action);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (disabled || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        e.stopPropagation();
        bus.click(action);
      }}
    >
      {children}
      <span className="hb-hit" aria-hidden />
    </button>
  );
}
