import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import type { ClusterKey } from '@/cluster/renderer/types';
import { classic } from '@/cluster/layouts/classic';
import { DEFAULT_THEME } from '@/cluster/themes';
import { S } from '@/core/signals/catalog';
import { DEFAULT_PROFILE } from '@/profiles';
import { ClusterView } from './ClusterView';
import { applyPose, poseFromUrl } from './poses';
import { ClusterSession } from './session';
import { useKeyboardDriving } from './useKeyboardDriving';
import { usePoll } from './useSignal';

const KEYS: [string, string][] = [
  ['W', 'Throttle'],
  ['S', 'Brake'],
  ['Q / E', 'Paddles'],
  [', / .', 'Indicators'],
  ['← / →', 'Pages'],
  ['P', 'Autopilot'],
];

const ARROWS: Record<string, ClusterKey> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  Enter: 'ok',
  Escape: 'back',
};

const params = new URLSearchParams(window.location.search);
const KIOSK = params.get('kiosk') === '1';
const LOW_POWER = params.get('lowpower') === '1';

export function App() {
  const [session, setSession] = useState<ClusterSession | null>(null);
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const profile = DEFAULT_PROFILE;

  useEffect(() => {
    const s = new ClusterSession(profile);
    let live = true;
    void s.start().then(() => {
      if (!live) return;
      const pose = poseFromUrl();
      if (pose) applyPose(s.source, pose);
      setSession(s);
    });
    return () => {
      live = false;
      void s.stop();
      setSession(null);
    };
  }, [profile]);

  useKeyboardDriving(session?.source);

  // Steering-wheel navigation keys go into the cluster.
  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      const key = ARROWS[e.key];
      if (key && rendererRef.current?.input(key)) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  const onFps = useCallback((f: number, ms: number) => {
    setFps(f);
    setFrameMs(ms);
  }, []);

  const onRenderer = useCallback((r: ClusterRenderer | null) => {
    rendererRef.current = r;
  }, []);

  const cluster = session ? (
    <ClusterView
      session={session}
      layout={classic}
      theme={DEFAULT_THEME}
      onFps={onFps}
      lowPower={LOW_POWER}
      onRenderer={onRenderer}
      parallax={!KIOSK}
    />
  ) : null;

  if (KIOSK)
    return (
      <div className="kiosk" data-fps={fps.toFixed(0)} data-frame-ms={frameMs.toFixed(2)}>
        {cluster}
      </div>
    );

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
        <div className="hood">
          <div className="screen">{cluster ?? <div className="screen-boot">Starting…</div>}</div>
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
