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
  oilPressure: 'Oil pressure',
  coolantLevel: 'Coolant level',
  brakeFluid: 'Brake fluid',
  powerSteering: 'Power steering',
  hoodOpen: 'Bonnet open',
  gearboxHot: 'Gearbox hot',
  airbag: 'Airbag',
  abs: 'ABS',
  washerFluid: 'Washer fluid',
  brakePads: 'Brake pads',
  bulb: 'Bulb',
  keyBattery: 'Key battery',
  parkSensor: 'Park sensor dirty',
};

const NEXT_SEAT = { empty: 'belted', belted: 'unbelted', unbelted: 'empty' } as const;

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
          <span className="dev-label">Occupants</span>
          <button
            className={`pill ${sim.body.seatbelt ? 'pill-on' : 'pill-warn'}`}
            onClick={() => src.toggleDriverBelt()}
          >
            Driver {sim.body.seatbelt ? 'belted' : 'unbelted'}
          </button>
          <button
            className="pill"
            onClick={() => {
              const p = sim.body.passenger;
              // empty → belted → unbelted → empty
              if (!p.present) src.setPassenger(true, true);
              else if (p.belted) src.setPassenger(true, false);
              else src.setPassenger(false, false);
            }}
          >
            Passenger:{' '}
            {!sim.body.passenger.present
              ? 'empty'
              : sim.body.passenger.belted
                ? 'belted'
                : 'unbelted'}
          </button>
          {(['Rear left', 'Rear middle', 'Rear right'] as const).map((name, i) => (
            <button
              key={name}
              className="pill"
              onClick={() =>
                src.setRearSeat(i as 0 | 1 | 2, NEXT_SEAT[sim.body.rear[i] ?? 'empty'])
              }
            >
              {name}: {sim.body.rear[i]}
            </button>
          ))}
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
          <button
            className={`pill ${src.buttons.distracted ? 'pill-on' : ''}`}
            onClick={() => src.pressButton('distracted')}
            title="The driver looks at their phone: weak, late steering"
          >
            Distracted driver
          </button>
          <button
            className={`pill ${src.buttons.tired ? 'pill-on' : ''}`}
            onClick={() => src.pressButton('tired')}
            title="Micro-sleeps every minute; fatigue detection warns after 15 min above 65 km/h"
          >
            Tired driver
          </button>
          <button
            className={`pill ${src.collision.enabled ? 'pill-on' : ''}`}
            onClick={() => src.collision.toggle()}
            title="Collision warning and emergency braking. Back on at every start."
          >
            Collision warning
          </button>
          <button
            className={`pill ${src.buttons.sensorBlocked ? 'pill-on' : ''}`}
            onClick={() => src.pressButton('sensorBlocked')}
            title="Cover the front radar (dirt, snow)"
          >
            Sensor blocked
          </button>
          <button className="pill" onClick={() => src.setService('soon')}>
            Service soon
          </button>
          <button className="pill" onClick={() => src.setService('overdue')}>
            Service overdue
          </button>
          <button className="pill" onClick={() => src.setService('reset')}>
            Service done
          </button>
          {session.profile.tpmsType === 'indirect' && (
            <button className="pill" onClick={() => src.storeTyrePressures()}>
              Store tyre pressures
            </button>
          )}
          {session.profile.fuelType === 'diesel' && (
            <>
              <button className="pill" onClick={() => src.setDieselDemo('dpf')}>
                Load particulate filter
              </button>
              <button className="pill" onClick={() => src.setDieselDemo('def')}>
                Exhaust fluid low
              </button>
              <button className="pill" onClick={() => src.setDieselDemo('service')}>
                Diesel service
              </button>
            </>
          )}
          <button
            className={`pill ${src.sim.driveModes.rememberLast ? 'pill-on' : ''}`}
            onClick={() => src.sim.driveModes.toggleRememberLast()}
            title="Off: every start begins in Normal, as most cars do"
          >
            Remember drive mode
          </button>
          <button
            className={`pill ${src.isa.enabled ? 'pill-on' : ''}`}
            onClick={() => src.isa.toggle()}
            title="Speed warning (ISA). Switches itself back on at every start, as the law requires."
          >
            Speed warning
          </button>
          <select
            className="pill"
            value={src.isa.offset}
            onChange={(e) => src.isa.setOffset(Number(e.target.value))}
            aria-label="Speed warning tolerance"
          >
            {[0, 3, 5, 7, 10].map((o) => (
              <option key={o} value={o}>
                Warn at +{o} km/h
              </option>
            ))}
          </select>
        </div>
        <Inspector session={session} />
      </div>
    </details>
  );
}
