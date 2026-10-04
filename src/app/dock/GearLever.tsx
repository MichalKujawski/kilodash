import { MODES } from '@/core/drive/modes';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { Action } from '../controls/actions';
import type { ControlBus } from '../controls/ControlBus';
import { Glyph } from '../controls/ControlPanel';
import { consoleAction } from './context';
import { HoldButton } from './HoldButton';

/**
 * Gear selector with illuminated letters (the selected one bright, the rest
 * softly backlit), and under it the console's contextual button: drive mode
 * while running, engine start when it is off.
 */
export function GearLever({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const sim = source.sim;
  const sel = sim.state.selector;
  const prog = sim.gearProgram;
  const sport = sim.isElectric ? sim.state.evB : prog === 'S';
  const gate: { a: Action; label: string; on: boolean }[] = [
    { a: 'gearP', label: 'P', on: sel === 'P' },
    { a: 'gearR', label: 'R', on: sel === 'R' },
    { a: 'gearN', label: 'N', on: sel === 'N' },
    { a: 'gearD', label: 'D', on: sel === 'D' && !sport && prog !== 'M' },
    { a: 'gearS', label: sim.isElectric ? 'B' : 'S', on: sel === 'D' && sport },
  ];
  const ctx = consoleAction(sim.state.ready);
  return (
    <div className="lever" aria-label="Gear selector">
      <div className="gate2" role="group" aria-label="Selector positions">
        {gate.map((g) => (
          <HoldButton key={g.a} bus={bus} action={g.a} className="gate2-pos" active={g.on}>
            {g.label}
          </HoldButton>
        ))}
      </div>
      {ctx === 'driveMode' ? (
        <HoldButton bus={bus} action="driveMode" className="console-btn" label="Drive mode">
          <Glyph name="mode" size={15} />
          <span>{MODES[sim.driveModes.state.current].label}</span>
        </HoldButton>
      ) : (
        <HoldButton
          bus={bus}
          action="start"
          className="console-btn console-start"
          label="Engine start (with brake)"
        >
          <Glyph name="power" size={15} />
          <span>Start</span>
        </HoldButton>
      )}
    </div>
  );
}
