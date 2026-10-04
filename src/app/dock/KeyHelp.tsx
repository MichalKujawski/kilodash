import { useEffect } from 'react';
import { ACTIONS, keyHint, type Action } from '../controls/actions';

const GROUPS: { title: string; actions: Action[] }[] = [
  {
    title: 'Driving',
    actions: ['throttle', 'brake', 'indicatorLeft', 'indicatorRight', 'paddleUp', 'paddleDown'],
  },
  {
    title: 'Gear and console',
    actions: ['gearP', 'gearR', 'gearN', 'gearD', 'gearS', 'gearM', 'driveMode', 'start', 'hazard'],
  },
  {
    title: 'Steering wheel',
    actions: ['scrollUp', 'scrollDown', 'ok', 'left', 'right', 'view', 'back'],
  },
  {
    title: 'Cruise control',
    actions: ['accMain', 'accRes', 'accSet', 'accDistance', 'accCancel', 'laneAssist'],
  },
  {
    title: 'Lights and wipers',
    actions: ['lightSwitch', 'highBeam', 'flash', 'autoHighBeam', 'fog', 'wipersUp', 'wipersDown'],
  },
  { title: 'Assists', actions: ['esc', 'autoHold', 'startStop', 'parkAssist'] },
];

/** The "?" overlay: every keyboard control, grouped like the car. */
export function KeyHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' || e.key === '?') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    // Capture phase: Esc closes the overlay instead of reaching the car's Back button.
    window.addEventListener('keydown', down, true);
    return () => window.removeEventListener('keydown', down, true);
  }, [onClose]);
  return (
    <div className="keyhelp-backdrop" onClick={onClose}>
      <div
        className="keyhelp"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard controls"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="keyhelp-head">
          <h2>Keyboard</h2>
          <button className="round" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="keyhelp-grid">
          {GROUPS.map((g) => (
            <section key={g.title}>
              <h3>{g.title}</h3>
              {g.actions.map((a) => (
                <div key={a} className="keyhelp-row">
                  <kbd>{keyHint(a)}</kbd>
                  <span>{ACTIONS[a].label}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
