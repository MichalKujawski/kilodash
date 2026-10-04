import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import { WORLD_PLACES } from '@/core/datasource/simulator/SimulatorSource';
import type { Surface, Weather } from '@/core/world/environment';
import { keyHint } from './controls/actions';
import type { ClusterSession } from './session';
import { usePoll } from './useSignal';

const WEATHER: Weather[] = ['clear', 'rain', 'snow', 'fog'];
const SURFACE: (Surface | 'auto')[] = ['auto', 'dry', 'wet', 'icy'];

function fmtHour(h: number): string {
  return `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
}

interface Props {
  session: ClusterSession;
  renderer: ClusterRenderer | null;
  sound: { muted: boolean; engine: boolean };
  onSound: (s: { muted: boolean; engine: boolean }) => void;
}

/** The world around the car: time, weather, road, where to drive. Not a car control. */
export function WorldPanel({ session, renderer, sound, onSound }: Props) {
  usePoll(4);
  const src = session.source;
  const env = src.world.env;
  return (
    <section className="dev-panel" aria-label="World">
      <div className="dev-row">
        <span className="dev-label">World</span>
        <label className="te-field te-slider">
          <span>
            {env.settings.realTime ? `Real time ${fmtHour(env.hour)}` : fmtHour(env.hour)}
          </span>
          <input
            type="range"
            min={0}
            max={23.9}
            step={0.25}
            value={env.hour}
            aria-label="Time of day"
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
            aria-label="Outside temperature"
            onChange={(e) => src.setEnvironment({ temperatureC: Number(e.target.value) })}
          />
        </label>
      </div>
      <div className="dev-row">
        <span className="dev-label">Drive</span>
        <button
          className={`pill ${src.isAutopilotActive ? 'pill-on' : ''}`}
          onClick={() => src.setAutopilot(!src.autopilot)}
          title={`Demo drive [${keyHint('demo')}]`}
        >
          Demo drive {src.autopilot ? (src.isAutopilotActive ? 'on' : 'paused (you drive)') : 'off'}
        </button>
        {WORLD_PLACES.map((p) => (
          <button key={p.id} className="pill" onClick={() => src.jumpTo(p.id)}>
            {p.label}
          </button>
        ))}
        <button
          className="pill"
          onClick={() => renderer?.cycleNightMode()}
          title={`Night mode [${keyHint('night')}]`}
        >
          Night: {renderer?.nightMode ?? 'auto'}
        </button>
        <button
          className={`pill ${!sound.muted ? 'pill-on' : ''}`}
          onClick={() => onSound({ ...sound, muted: !sound.muted })}
        >
          Sound
        </button>
        <button
          className={`pill ${sound.engine ? 'pill-on' : ''}`}
          onClick={() => onSound({ ...sound, engine: !sound.engine })}
        >
          Engine sound
        </button>
      </div>
    </section>
  );
}
