import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import type { ClusterKey } from '@/cluster/renderer/types';
import { classic } from '@/cluster/layouts/classic';
import { DEFAULT_THEME, THEMES, THEME_BY_ID } from '@/cluster/themes';
import type { Theme } from '@/cluster/themes/types';
import { S } from '@/core/signals/catalog';
import { DEFAULT_PROFILE } from '@/profiles';
import { AudioEngine } from './audio/AudioEngine';
import { useClusterAudio } from './audio/useClusterAudio';
import { ClusterView } from './ClusterView';
import { DevPanel } from './DevPanel';
import { ThemeEditor } from './ThemeEditor';
import {
  loadSelectedThemeId,
  loadUserThemes,
  saveSelectedThemeId,
  saveUserThemes,
} from './themeStore';
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
/** Experimental extras (other themes, theme editor) are only exposed with ?dev=1. */
const DEV = params.get('dev') === '1';
const POSE = poseFromUrl();
function initialTheme(userThemes: Theme[]): Theme {
  // The public demo is the Midnight experience only.
  if (!DEV) return DEFAULT_THEME;
  const id = params.get('theme') ?? loadSelectedThemeId() ?? '';
  return THEME_BY_ID.get(id) ?? userThemes.find((t) => t.id === id) ?? DEFAULT_THEME;
}

export function App() {
  const [session, setSession] = useState<ClusterSession | null>(null);
  const [renderer, setRenderer] = useState<ClusterRenderer | null>(null);
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [sound, setSound] = useState({ muted: false, engine: false });
  const [userThemes, setUserThemes] = useState<Theme[]>(() => loadUserThemes());
  const [theme, setThemeState] = useState<Theme>(() => initialTheme(userThemes));
  const [animateTheme, setAnimateTheme] = useState(true);
  const [editing, setEditing] = useState(false);
  const allThemes = useMemo(() => [...THEMES, ...userThemes], [userThemes]);
  const setTheme = useCallback((next: Theme | ((cur: Theme) => Theme), animate = true) => {
    setAnimateTheme(animate);
    setThemeState((cur) => {
      const t = typeof next === 'function' ? next(cur) : next;
      saveSelectedThemeId(t.id);
      return t;
    });
  }, []);
  const saveTheme = useCallback((t: Theme) => {
    setUserThemes((list) => {
      const next = [...list.filter((x) => x.id !== t.id), t];
      saveUserThemes(next);
      return next;
    });
  }, []);
  const deleteTheme = useCallback(
    (id: string) => {
      setUserThemes((list) => {
        const next = list.filter((x) => x.id !== id);
        saveUserThemes(next);
        return next;
      });
      setTheme(DEFAULT_THEME);
    },
    [setTheme],
  );
  const rendererRef = useRef<ClusterRenderer | null>(null);
  const audio = useMemo(() => new AudioEngine(), []);
  const profile = DEFAULT_PROFILE;

  useEffect(() => {
    const s = new ClusterSession(profile, POSE ? {} : { startOff: true, env: { realTime: true } });
    let live = true;
    void s.start().then(() => {
      if (!live) return;
      if (POSE) applyPose(s, POSE);
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
    audio.setChimeStyle(theme.sounds.chime);
  }, [audio, theme]);

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
    cycleTheme: () =>
      DEV &&
      setTheme(
        (cur) =>
          allThemes[(allThemes.findIndex((t) => t.id === cur.id) + 1) % allThemes.length] ??
          DEFAULT_THEME,
      ),
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

  const [dropped, setDropped] = useState(0);
  const onFps = useCallback((f: number, ms: number, d: number) => {
    setDropped((x) => x + d);
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
      theme={theme}
      onFps={onFps}
      onRenderer={onRenderer}
      parallax={!KIOSK}
      lowPower={LOW_POWER}
      animateTheme={animateTheme}
    />
  ) : null;

  if (KIOSK)
    return (
      <div
        className="kiosk"
        data-fps={fps.toFixed(0)}
        data-frame-ms={frameMs.toFixed(2)}
        data-dropped={dropped}
      >
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

        {DEV && (
          <section className="theme-chooser" aria-label="Themes (experimental)">
            <div className="dev-row">
              <span className="dev-label">Theme</span>
              {allThemes.map((t) => (
                <button
                  key={t.id}
                  className={`pill ${t.id === theme.id ? 'pill-on' : ''}`}
                  onClick={() => setTheme(t)}
                >
                  <span
                    className="swatch"
                    style={{ background: t.dial.needle.color }}
                    aria-hidden
                  />
                  {t.name}
                </button>
              ))}
              <button
                className={`pill ${editing ? 'pill-on' : ''}`}
                onClick={() => setEditing((e) => !e)}
              >
                Theme editor
              </button>
            </div>
            {editing && (
              <ThemeEditor
                theme={theme}
                onChange={(t) => setTheme(t, false)}
                onSave={saveTheme}
                onDelete={deleteTheme}
              />
            )}
            <p className="te-note">Experimental — these themes are not contract-complete.</p>
          </section>
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
