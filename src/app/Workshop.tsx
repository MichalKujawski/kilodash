import { SIGNALS } from '@/core/signals/catalog';
import { FAULTS, type FaultKind } from '@/core/datasource/simulator/vehicle';
import { PROFILES } from '@/profiles';
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

function Inspector({ session }: { session: ClusterSession }) {
  usePoll(4);
  const st = session.store;
  const rows = st.ids().sort();
  return (
    <div className="inspector" role="region" aria-label="Data inspector">
      <table>
        <thead>
          <tr>
            <th>Signal</th>
            <th>Value</th>
            <th>Unit</th>
            <th>Source</th>
            <th>Quality</th>
            <th>Hz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((id) => {
            const def = SIGNALS.get(id);
            const v = st.value(id);
            return (
              <tr key={id}>
                <td title={id}>{id.replace(/^Vehicle\./, '')}</td>
                <td className="num">
                  {Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : '—'}
                </td>
                <td>{def?.unit ?? ''}</td>
                <td>{st.source(id)}</td>
                <td>{st.quality(id)}</td>
                <td className="num">{st.rateHz(id).toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  session: ClusterSession;
  profileId: string;
  onProfile: (id: string) => void;
}

/** Developer tools for the demo: fault injection, vehicle profile, live data. */
export function Workshop({ session, profileId, onProfile }: Props) {
  usePoll(4);
  const src = session.source;
  const sim = src.sim;
  return (
    <details className="workshop">
      <summary>Workshop</summary>
      <div className="dev-panel">
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
          <span className="dev-label">Vehicle</span>
          <select
            className="pill"
            value={profileId}
            onChange={(e) => onProfile(e.target.value)}
            aria-label="Vehicle profile"
          >
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            className={`pill ${src.buttons.handsOn ? 'pill-on' : ''}`}
            onClick={() => src.pressButton('handsOn')}
          >
            Hands on wheel
          </button>
        </div>
        <Inspector session={session} />
      </div>
    </details>
  );
}
