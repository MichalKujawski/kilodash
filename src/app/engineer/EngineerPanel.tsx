import { useEffect, useState, type ReactNode } from 'react';
import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import { SIGNALS } from '@/core/signals/catalog';
import type { ClusterSession } from '../session';
import { usePoll } from '../useSignal';
import { Workshop } from '../Workshop';
import { WorldPanel } from '../WorldPanel';
import type { EventLog, EventKind } from './EventLog';
import { MACHINES } from './machines';
import { StateDiagram } from './StateDiagram';
import { viewModel } from './viewModel';
import './engineer.css';

const TABS = ['Signals', 'States', 'Events', 'View model', 'Workshop', 'Performance'] as const;
type Tab = (typeof TABS)[number];

export interface Perf {
  fps: number;
  frameMs: number;
  dropped: number;
}

interface Props {
  session: ClusterSession;
  renderer: ClusterRenderer | null;
  log: EventLog;
  perf: Perf;
  profileId: string;
  onProfile: (id: string) => void;
  sound: { muted: boolean; engine: boolean };
  onSound: (s: { muted: boolean; engine: boolean }) => void;
  onHow: (doc: string) => void;
}

/** Engineer mode: the cockpit's internals, live, IDE-style. */
export function EngineerPanel(props: Props) {
  const [tab, setTab] = useState<Tab>('States');
  return (
    <section className="eng" aria-label="Engineer">
      <div className="eng-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={t === tab}
            className="eng-tab"
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="eng-body" role="tabpanel" aria-label={tab}>
        {tab === 'Signals' && <Signals session={props.session} />}
        {tab === 'States' && <States session={props.session} onHow={props.onHow} />}
        {tab === 'Events' && <Events log={props.log} />}
        {tab === 'View model' && <ViewModel session={props.session} renderer={props.renderer} />}
        {tab === 'Workshop' && (
          <>
            <WorldPanel
              session={props.session}
              renderer={props.renderer}
              sound={props.sound}
              onSound={props.onSound}
            />
            <Workshop
              session={props.session}
              profileId={props.profileId}
              onProfile={props.onProfile}
            />
          </>
        )}
        {tab === 'Performance' && <Performance perf={props.perf} renderer={props.renderer} />}
      </div>
    </section>
  );
}

const fmt = (v: number): string =>
  !Number.isFinite(v) ? '—' : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);

function Signals({ session }: { session: ClusterSession }) {
  usePoll(4);
  const [q, setQ] = useState('');
  const st = session.store;
  const rows = st
    .ids()
    .filter((id) => id.toLowerCase().includes(q.toLowerCase()))
    .sort();
  return (
    <div className="eng-signals">
      <input
        className="eng-filter"
        placeholder={`Filter ${st.ids().length} signals…`}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Filter signals"
      />
      <table className="eng-table">
        <thead>
          <tr>
            <th>Signal</th>
            <th className="num">Value</th>
            <th>Unit</th>
            <th>Quality</th>
            <th className="num">Hz</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((id) => {
            const q2 = st.quality(id);
            return (
              <tr key={id}>
                <td title={`${id} · ${st.source(id) ?? ''}`}>{id.replace(/^Vehicle\./, '')}</td>
                <td className="num">{fmt(st.value(id))}</td>
                <td>{SIGNALS.get(id)?.unit ?? ''}</td>
                <td className={`q q-${q2}`}>{q2}</td>
                <td className="num">{st.rateHz(id).toFixed(0)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function States({ session, onHow }: { session: ClusterSession; onHow: (doc: string) => void }) {
  usePoll(8);
  return (
    <div className="eng-states">
      {MACHINES.map((m) => (
        <StateDiagram key={m.id} machine={m} current={m.read(session.source)} onHow={onHow} />
      ))}
    </div>
  );
}

const KINDS: EventKind[] = ['state', 'alert', 'mode'];

function Events({ log }: { log: EventLog }) {
  usePoll(4);
  const [open, setOpen] = useState<number | null>(null);
  const [kinds, setKinds] = useState<Set<EventKind>>(() => new Set(KINDS));
  const list = log.events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => kinds.has(e.kind))
    .reverse();
  return (
    <div className="eng-events">
      <div className="eng-chips">
        {KINDS.map((k) => (
          <button
            key={k}
            className={`eng-chip ${kinds.has(k) ? 'on' : ''}`}
            aria-pressed={kinds.has(k)}
            onClick={() =>
              setKinds((s) => {
                const n = new Set(s);
                if (n.has(k)) n.delete(k);
                else n.add(k);
                return n;
              })
            }
          >
            {k === 'state' ? 'Transitions' : k === 'alert' ? 'Warnings' : 'Modes'}
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="eng-empty">Nothing yet. Drive, or let the demo play.</p>}
      <ol className="eng-timeline">
        {list.slice(0, 150).map(({ e, i }) => (
          <li key={i} className={`ev ev-${e.kind}`}>
            <button
              className="ev-row"
              aria-expanded={open === i}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className="ev-t">{e.t.toFixed(1)} s</span>
              <span className="ev-text">{e.text}</span>
            </button>
            {open === i && <pre className="ev-detail">{JSON.stringify(e.detail, null, 2)}</pre>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ViewModel({
  session,
  renderer,
}: {
  session: ClusterSession;
  renderer: ClusterRenderer | null;
}) {
  usePoll(4);
  if (!renderer) return null;
  const vm = viewModel(
    renderer.view,
    renderer.ui.centerPage,
    session.store,
    session.source.scene(),
    session.alerts,
  );
  return (
    <div className="eng-vm">
      <p className="eng-note">
        What the active page draws from. Use the wheel's pages and View to switch.
      </p>
      <pre>{JSON.stringify(vm, null, 2)}</pre>
    </div>
  );
}

const HISTORY = 120;

function Performance({ perf, renderer }: { perf: Perf; renderer: ClusterRenderer | null }) {
  usePoll(4);
  const [hist, setHist] = useState<number[]>([]);
  useEffect(() => {
    const id = window.setInterval(
      () => setHist((h) => [...h.slice(1 - HISTORY), renderer?.frameMs ?? 0]),
      250,
    );
    return () => window.clearInterval(id);
  }, [renderer]);
  const profile = renderer?.profile;
  const max = 16.7;
  const points = hist
    .map((v, i) => `${(i / (HISTORY - 1)) * 300},${60 - Math.min(v / max, 1) * 56}`)
    .join(' ');
  return (
    <div className="eng-perf">
      <div className="eng-metrics">
        <Metric label="Frame rate" value={`${perf.fps.toFixed(0)} fps`} ok={perf.fps >= 58} />
        <Metric label="Frame time" value={`${perf.frameMs.toFixed(2)} ms`} ok={perf.frameMs < 8} />
        <Metric label="Dropped frames" value={String(perf.dropped)} ok={perf.dropped === 0} />
        <Metric
          label="First cluster frame"
          value={renderer?.firstFrameMs ? `${Math.round(renderer.firstFrameMs)} ms` : '—'}
          ok={(renderer?.firstFrameMs ?? 0) < 1500}
        />
      </div>
      <figure className="eng-spark">
        <figcaption>Frame time, last 30 s (top = 16.7 ms budget)</figcaption>
        <svg viewBox="0 0 300 60" preserveAspectRatio="none">
          <line x1="0" y1="4" x2="300" y2="4" className="budget" />
          <polyline points={points} />
        </svg>
      </figure>
      <div className="eng-profile">
        <button
          className="eng-chip"
          aria-pressed={!!profile}
          onClick={() => {
            renderer?.setProfiling(!renderer.profile);
          }}
        >
          {profile ? 'Stop profiling' : 'Profile render phases'}
        </button>
        {profile && (
          <table className="eng-table">
            <tbody>
              {Object.entries(profile)
                .sort((a, b) => b[1] - a[1])
                .map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td className="num">{v.toFixed(2)} ms</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value, ok }: { label: string; value: ReactNode; ok: boolean }) {
  return (
    <div className={`eng-metric ${ok ? 'ok' : 'bad'}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
