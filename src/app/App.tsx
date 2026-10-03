import { useEffect, useState } from 'react';
import { classic } from '@/cluster/layouts/classic';
import { DEFAULT_THEME } from '@/cluster/themes';
import { S } from '@/core/signals/catalog';
import { DEFAULT_PROFILE } from '@/profiles';
import { ClusterView } from './ClusterView';
import { ClusterSession } from './session';
import { useKeyboardDriving } from './useKeyboardDriving';
import { usePoll } from './useSignal';

const KEYS: [string, string][] = [
  ['W', 'Throttle'],
  ['S', 'Brake'],
  ['Q / E', 'Paddles'],
  [', / .', 'Indicators'],
  ['P', 'Autopilot'],
];

export function App() {
  const [session, setSession] = useState<ClusterSession | null>(null);
  const [fps, setFps] = useState(0);
  const profile = DEFAULT_PROFILE;

  useEffect(() => {
    const s = new ClusterSession(profile);
    let live = true;
    void s.start().then(() => live && setSession(s));
    return () => {
      live = false;
      void s.stop();
      setSession(null);
    };
  }, [profile]);

  useKeyboardDriving(session?.source);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden />
          <span className="brand-name">OpenCluster</span>
          <span className="brand-tag">Adaptive virtual cockpit</span>
        </div>
        {session && <StatusChips session={session} fps={fps} />}
      </header>

      <main className="stage">
        <div className="bezel">
          <div className="screen">
            {session ? (
              <ClusterView
                session={session}
                layout={classic}
                theme={DEFAULT_THEME}
                onFps={setFps}
              />
            ) : (
              <div className="screen-boot">Starting…</div>
            )}
          </div>
        </div>

        <section className="hints" aria-label="Keyboard controls">
          {KEYS.map(([k, label]) => (
            <span key={k} className="hint">
              <kbd>{k}</kbd>
              {label}
            </span>
          ))}
        </section>
      </main>
    </div>
  );
}

function StatusChips({ session, fps }: { session: ClusterSession; fps: number }) {
  usePoll(4);
  const src = session.source;
  const manualGears = session.store.value(S.SelectedGear, 127) !== 127;
  return (
    <div className="chips">
      <span className="chip">{session.profile.name}</span>
      <span className={`chip ${src.isAutopilotActive ? 'chip-on' : ''}`}>
        Autopilot {src.isAutopilotActive ? 'on' : src.autopilot ? 'paused' : 'off'}
      </span>
      <span className="chip">{manualGears ? 'Manual' : 'Auto'} gears</span>
      <span className="chip chip-mono">{fps.toFixed(0)} fps</span>
    </div>
  );
}
