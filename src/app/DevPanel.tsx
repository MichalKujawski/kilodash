import { FAULTS, type FaultKind } from '@/core/datasource/simulator/vehicle';
import { t } from '@/core/i18n';
import type { ClusterRenderer, NightMode } from '@/cluster/renderer/ClusterRenderer';
import type { ClusterSession } from './session';
import { SCENARIO_KEYS } from './useKeyboardDriving';
import { usePoll } from './useSignal';

const FAULT_LABELS: Record<FaultKind, string> = {
  overheat: 'Overheat',
  lowFuel: 'Low fuel',
  checkEngine: 'Check engine',
  doorOpen: 'Door open',
  lowTire: 'Low tyre',
  alternator: 'Alternator',
};

interface Props {
  session: ClusterSession;
  renderer: ClusterRenderer | null;
  sound: { muted: boolean; engine: boolean };
  onSound: (s: { muted: boolean; engine: boolean }) => void;
}

/** Temporary control strip (scenarios, faults, lights); the full Drive panel comes with the website. */
export function DevPanel({ session, renderer, sound, onSound }: Props) {
  usePoll(4);
  const src = session.source;
  const sim = src.sim;
  const night: NightMode = renderer?.nightMode ?? 'auto';
  const cycleNight = (): void => {
    renderer?.cycleNightMode();
  };
  return (
    <section className="dev-panel" aria-label="Simulator controls">
      <div className="dev-row">
        <span className="dev-label">Scenario</span>
        {SCENARIO_KEYS.map((id, i) => (
          <button
            key={id}
            className={`pill ${src.scenario === id ? 'pill-on' : ''}`}
            onClick={() => src.setScenario(id)}
          >
            <kbd>{i + 1}</kbd> {t(`scenario.${id}`)}
          </button>
        ))}
        <button
          className={`pill ${src.attract ? 'pill-on' : ''}`}
          onClick={() => src.setAttract(!src.attract)}
        >
          Attract mode
        </button>
      </div>
      <div className="dev-row">
        <span className="dev-label">Faults</span>
        {FAULTS.map((f) => (
          <button
            key={f}
            className={`pill ${sim.faults.has(f) ? 'pill-warn' : ''}`}
            onClick={() => src.setFault(f, !sim.faults.has(f))}
          >
            {FAULT_LABELS[f]}
          </button>
        ))}
        <button className="pill" onClick={() => src.refuel()}>
          Refuel
        </button>
      </div>
      <div className="dev-row">
        <span className="dev-label">Car</span>
        <button
          className={`pill ${sim.state.ready ? 'pill-on' : ''}`}
          onClick={() => src.toggleIgnition()}
        >
          <kbd>K</kbd> Ignition
        </button>
        <button
          className={`pill ${sim.body.hazard ? 'pill-warn' : ''}`}
          onClick={() => src.toggleHazard()}
        >
          <kbd>Space</kbd> Hazard
        </button>
        <button
          className={`pill ${sim.body.highBeam ? 'pill-on' : ''}`}
          onClick={() => src.toggleHighBeam()}
        >
          <kbd>H</kbd> High beam
        </button>
        <button
          className={`pill ${sim.state.cruiseActive ? 'pill-on' : ''}`}
          onClick={() => src.toggleCruise()}
        >
          <kbd>C</kbd> Cruise
        </button>
        <button className="pill" onClick={cycleNight}>
          <kbd>N</kbd> Night: {night}
        </button>
        <button
          className={`pill ${!sound.muted ? 'pill-on' : ''}`}
          onClick={() => onSound({ ...sound, muted: !sound.muted })}
        >
          <kbd>M</kbd> Sound
        </button>
        <button
          className={`pill ${sound.engine ? 'pill-on' : ''}`}
          onClick={() => onSound({ ...sound, engine: !sound.engine })}
        >
          <kbd>G</kbd> Engine sound
        </button>
      </div>
    </section>
  );
}
