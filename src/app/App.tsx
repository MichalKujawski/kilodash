import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import type { ClusterKey } from '@/cluster/renderer/types';
import { classic } from '@/cluster/layouts/classic';
import { DEFAULT_THEME } from '@/cluster/themes';
import { S } from '@/core/signals/catalog';
import { DEFAULT_PROFILE } from '@/profiles';
import { AudioEngine } from './audio/AudioEngine';
import { useClusterAudio } from './audio/useClusterAudio';
import { ClusterView } from './ClusterView';
import { DevPanel } from './DevPanel';
import { applyPose, poseFromUrl } from './poses';
import { ClusterSession } from './session';
import { useKeyboardDriving } from './useKeyboardDriving';
import { usePoll } from './useSignal';

const KEYS: [string, string][] = [
  ['W / S', 'Throttle / brake'],
  ['Q / E', 'Paddles'],
  [', / .', 'Indicators'],
  ['← / →', 'Pages'],
  ['Enter', 'OK'],
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
const POSE = poseFromUrl();

export function App() {
  const [session, setSession] = useState<ClusterSession | null>(null);
  const [renderer, setRenderer] = useState<ClusterRenderer | null>(null);
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [sound, setSound] = useState({ muted: false, engine: false });
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const audio = useMemo(() => new AudioEngine(), []);
  const profile = DEFAULT_PROFILE;

  useEffect(() => {
    const s = new ClusterSession(
      profile,
      POSE ? {} : { startOff: true, attract: true, scenario: 'city' },
    );
    let live = true;
    void s.start().then(() => {
      if (!live) return;
      if (POSE) applyPose(s.source, POSE);
      // Scripting hook for tests and visual review (dev builds or ?debug).
      if (import.meta.env.DEV || params.has('debug')) {
        (window as unknown as { __oc?: unknown }).__oc = {
          session: s,
          renderer: () => rendererRef.current,
        };
      }
      setSession(s);
    });
    return () => {
      live = false;
      void s.stop();
      setSession(null);
    };
  }, [profile]);

  useEffect(() => {
    audio.setMuted(sound.muted);
    audio.setEngineSound(sound.engine);
  }, [audio, sound]);

  useClusterAudio(session, audio);
  useKeyboardDriving(session?.source, {
    onAnyKey: () => audio.unlock(),
    toggleMute: () => setSound((s) => ({ ...s, muted: !s.muted })),
    toggleEngineSound: () => setSound((s) => ({ ...s, engine: !s.engine })),
    cycleNight: () => rendererRef.current?.cycleNightMode(),
  });

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    const unlock = (): void => audio.unlock();
    window.addEventListener('pointerdown', unlock);
    return () => window.removeEventListener('pointerdown', unlock);
  }, [audio]);

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
    setRenderer(r);
  }, []);

  const cluster = session ? (
    <ClusterView
      session={session}
      layout={classic}
      theme={DEFAULT_THEME}
      onFps={onFps}
      onRenderer={onRenderer}
      parallax={!KIOSK}
      lowPower={LOW_POWER}
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
        {session && (
          <DevPanel session={session} renderer={renderer} sound={sound} onSound={setSound} />
        )}
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
