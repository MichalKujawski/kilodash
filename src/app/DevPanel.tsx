import type { ClusterRenderer, NightMode } from '@/cluster/renderer/ClusterRenderer';
import { WORLD_PLACES } from '@/core/datasource/simulator/SimulatorSource';
import { FAULTS, type FaultKind } from '@/core/datasource/simulator/vehicle';
import type { Surface, Weather } from '@/core/world/environment';
import type { ClusterSession } from './session';
import { usePoll } from './useSignal';

const FAULT_LABELS: Record<FaultKind, string> = {
  overheat: 'Overheat',
  lowFuel: 'Low fuel',
  checkEngine: 'Check engine',
  doorOpen: 'Door open',
  lowTire: 'Low tyre',
  alternator: 'Alternator',
};

const WEATHER: Weather[] = ['clear', 'rain', 'snow', 'fog'];
const SURFACE: (Surface | 'auto')[] = ['auto', 'dry', 'wet', 'icy'];

interface Props {
  session: ClusterSession;
  renderer: ClusterRenderer | null;
  sound: { muted: boolean; engine: boolean };
  onSound: (s: { muted: boolean; engine: boolean }) => void;
}

function fmtHour(h: number): string {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
}

/** Temporary world/car controls; replaced by the real control panel in the next step. */
export function DevPanel({ session, renderer, sound, onSound }: Props) {
  usePoll(4);
  const src = session.source;
  const sim = src.sim;
  const env = src.world.env;
  const night: NightMode = renderer?.nightMode ?? 'auto';
  return (
    <section className="dev-panel" aria-label="World and car">
      <div className="dev-row">
        <span className="dev-label">World</span>
        <label className="te-field te-slider">
          <span>{env.settings.realTime ? 'Real time' : fmtHour(env.hour)}</span>
          <input
            type="range"
            min={0}
            max={23.9}
            step={0.25}
            value={env.hour}
            onChange={(e) => src.setEnvironment({ realTime: false, hour: Number(e.target.value) })}
          />
        </label>
        <button
          className={`pill ${env.settings.realTime ? 'pill-on' : ''}`}
          onClick={() => src.setEnvironment({ realTime: !env.settings.realTime })}
        >
          Real time
        </button>
        <label className="te-field te-select">
          <span>Weather</span>
          <select
            value={env.settings.weather}
            onChange={(e) => src.setEnvironment({ weather: e.target.value as Weather })}
          >
            {WEATHER.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="te-field te-select">
          <span>Road</span>
          <select
            value={env.settings.surface ?? 'auto'}
            onChange={(e) =>
              src.setEnvironment({
                surface: e.target.value === 'auto' ? null : (e.target.value as Surface),
              })
            }
          >
            {SURFACE.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </label>
        <label className="te-field te-slider">
          <span>{env.settings.temperatureC} °C</span>
          <input
            type="range"
            min={-15}
            max={35}
            step={1}
            value={env.settings.temperatureC}
            onChange={(e) => src.setEnvironment({ temperatureC: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="dev-row">
        <span className="dev-label">Jump to</span>
        {WORLD_PLACES.map((p) => (
          <button key={p.id} className="pill" onClick={() => src.jumpTo(p.id)}>
            {p.label}
          </button>
        ))}
        <button
          className={`pill ${src.isAutopilotActive ? 'pill-on' : ''}`}
          onClick={() => src.setAutopilot(!src.autopilot)}
        >
          <kbd>P</kbd> Demo drive{' '}
          {src.autopilot ? (src.isAutopilotActive ? 'on' : 'paused') : 'off'}
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
        <button className="pill" onClick={() => renderer?.cycleNightMode()}>
          <kbd>N</kbd> Night: {night}
        </button>
        <button
          className={`pill ${!sound.muted ? 'pill-on' : ''}`}
          onClick={() => onSound({ ...sound, muted: !sound.muted })}
        >
          <kbd>M</kbd> Sound
        </button>
      </div>
    </section>
  );
}
