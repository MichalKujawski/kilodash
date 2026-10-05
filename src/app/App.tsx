import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import { classic } from '@/cluster/layouts/classic';
import { DEFAULT_THEME, THEMES, THEME_BY_ID } from '@/cluster/themes';
import type { Theme } from '@/cluster/themes/types';
import { profileById } from '@/profiles';
import { AudioEngine } from './audio/AudioEngine';
import { useClusterAudio } from './audio/useClusterAudio';
import { ClusterView } from './ClusterView';
import { ControlBus } from './controls/ControlBus';
import { ControlPanel } from './controls/ControlPanel';
import { DriveDock } from './dock/DriveDock';
import { EngineerPanel } from './engineer/EngineerPanel';
import { HowItWorks } from './engineer/HowItWorks';
import { useEventLog } from './engineer/useEventLog';
import { Director } from './director/Director';
import { useDirector } from './director/useDirector';
import { WatchPanel } from './director/WatchPanel';
import { useControlInputs } from './controls/useControlInputs';
import { applyPose, poseFromUrl } from './poses';
import { ClusterSession } from './session';
import { Header, SITE_MODES, type SiteMode } from './shell/Header';
import { shouldPlayIntro, useIntro } from './shell/intro';
import { Stage } from './shell/Stage';
import './shell/shell.css';
import { ThemeEditor } from './ThemeEditor';
import {
  loadSelectedThemeId,
  loadUserThemes,
  saveSelectedThemeId,
  saveUserThemes,
} from './themeStore';

const params = new URLSearchParams(window.location.search);
const KIOSK = params.get('kiosk') === '1';
const LOW_POWER = params.get('lowpower') === '1';
/** Experimental extras (other themes, theme editor) are only exposed with ?dev=1. */
const DEV = params.get('dev') === '1';
const POSE = poseFromUrl();
/** `?chapter=<id>` opens the guided demo at that chapter. */
const CHAPTER = params.get('chapter');
/** First plain visit only (not deep links, recordings, kiosk or reduced motion). */
const PLAY_INTRO = shouldPlayIntro(params);

/** Engineer sidebar width on wide screens (narrower screens get a bottom panel), px. */
const ENGINEER_SIDEBAR = 440;
const WIDE = '(min-width: 1280px)';

function useMediaQuery(q: string): boolean {
  const [on, setOn] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const change = (): void => setOn(m.matches);
    m.addEventListener('change', change);
    return () => m.removeEventListener('change', change);
  }, [q]);
  return on;
}

function initialTheme(userThemes: Theme[]): Theme {
  // The public demo is the Midnight experience only.
  if (!DEV) return DEFAULT_THEME;
  const id = params.get('theme') ?? loadSelectedThemeId() ?? '';
  return THEME_BY_ID.get(id) ?? userThemes.find((t) => t.id === id) ?? DEFAULT_THEME;
}

function initialMode(): SiteMode {
  return SITE_MODES.find((m) => m === params.get('mode')) ?? 'watch';
}

export function App() {
  // `?car=<profile id>` picks another car (screenshots, demos).
  const [profileId, setProfileId] = useState(() => profileById(params.get('car') ?? '').id);
  const [session, setSession] = useState<ClusterSession | null>(null);
  const [bus, setBus] = useState<ControlBus | null>(null);
  const [renderer, setRenderer] = useState<ClusterRenderer | null>(null);
  const [director, setDirector] = useState<Director | null>(null);
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [dropped, setDropped] = useState(0);
  // Autoplay is muted; the header's sound button switches the cockpit audio on.
  const [sound, setSound] = useState({ muted: true, engine: false });
  const [mode, setModeState] = useState<SiteMode>(initialMode);
  const wide = useMediaQuery(WIDE);
  const intro = useIntro(PLAY_INTRO);
  // The demo waits in the dark; it starts (with the start-up sweep) as the display lights up.
  const introHold = intro.phase === 'dark' || intro.phase === 'hood';
  const [moreOpen, setMoreOpen] = useState(false);
  /** Feature doc open in the "How it works" sheet. */
  const [howDoc, setHowDoc] = useState<string | null>(null);
  /** Engineer: the Drive dock is collapsed until asked for (then you drive). */
  const [engineerDriving, setEngineerDriving] = useState(false);
  const [userThemes, setUserThemes] = useState<Theme[]>(() => loadUserThemes());
  const [theme, setThemeState] = useState<Theme>(() => initialTheme(userThemes));
  const [animateTheme, setAnimateTheme] = useState(true);
  const [editing, setEditing] = useState(false);
  const rendererRef = useRef<ClusterRenderer | null>(null);
  /** The keyboard mute key reaches the sound toggle through this (set below). */
  const toggleSoundRef = useRef<() => void>(() => {});
  const audio = useMemo(() => new AudioEngine(), []);
  const allThemes = useMemo(() => [...THEMES, ...userThemes], [userThemes]);

  const setMode = useCallback((m: SiteMode) => {
    setModeState(m);
    const url = new URL(window.location.href);
    url.searchParams.set('mode', m);
    window.history.replaceState(null, '', url);
  }, []);

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

  useEffect(() => {
    // Never open parked, at night or switched off: midday, rolling onto the motorway.
    const s = new ClusterSession(
      profileById(profileId),
      POSE ? {} : { env: { realTime: false, hour: 13.5, weather: 'clear' } },
    );
    const b = new ControlBus(s.source, {
      renderer: () => rendererRef.current,
      toggleMute: () => toggleSoundRef.current(),
    });
    let live = true;
    void s.start().then(() => {
      if (!live) return;
      if (POSE) applyPose(s, POSE);
      else {
        s.source.startRolling();
        setDirector(new Director(s.source, () => rendererRef.current));
      }
      // Scripting hook for tests and visual review (dev builds or ?debug).
      if (import.meta.env.DEV || params.has('debug')) {
        (window as unknown as { __oc?: unknown }).__oc = {
          session: s,
          bus: b,
          audio,
          renderer: () => rendererRef.current,
        };
      }
      setSession(s);
      setBus(b);
    });
    return () => {
      live = false;
      b.dispose();
      void s.stop();
      setSession(null);
      setBus(null);
      setDirector(null);
    };
  }, [profileId, audio]);

  // The guided demo plays in Watch (and keeps the car moving behind Engineer);
  // Drive hands the car over exactly where it is.
  const handsOn = mode === 'drive' || (mode === 'engineer' && engineerDriving);
  const directing = !!director && !handsOn;
  const begun = useRef<Director | null>(null);
  useEffect(() => {
    if (!director) return;
    if (handsOn) director.release();
    else if (introHold) return;
    else if (begun.current !== director) {
      if (CHAPTER) director.goto(CHAPTER);
      else director.start(0);
    } else if (!director.playing) director.start(director.index);
    if (!handsOn) begun.current = director;
  }, [director, handsOn, introHold]);
  const log = useEventLog(session);
  useEffect(() => {
    if (renderer && director?.playing) director.rendererChanged();
  }, [director, renderer]);
  const directorState = useDirector(director, directing);

  useEffect(() => {
    audio.setChimeStyle(theme.sounds.chime);
  }, [audio, theme]);

  useEffect(() => {
    audio.setMuted(sound.muted);
    audio.setEngineSound(sound.engine);
  }, [audio, sound]);

  useClusterAudio(session, audio);
  // Creating the audio context costs ~40 ms: only do it once sound is wanted (any later
  // input is a user gesture too, which browsers require to start audio).
  const unlockAudio = useCallback(() => {
    if (!audio.muted) audio.unlock();
  }, [audio]);
  const toggleSound = useCallback(() => {
    if (sound.muted) audio.unlock();
    setSound((x) => ({ ...x, muted: !x.muted }));
  }, [audio, sound.muted]);
  useEffect(() => {
    toggleSoundRef.current = toggleSound;
  }, [toggleSound]);
  // In Watch the keyboard runs the demo (Space, ←/→), not the car.
  useControlInputs(mode === 'watch' ? null : bus, unlockAudio);

  // Browsers only allow audio after a user gesture.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio);
    return () => window.removeEventListener('pointerdown', unlockAudio);
  }, [unlockAudio]);

  // Dev only: Shift+T cycles the experimental themes.
  useEffect(() => {
    if (!DEV) return;
    const down = (e: KeyboardEvent): void => {
      if (e.key.toLowerCase() === 't' && e.shiftKey) {
        setTheme(
          (cur) =>
            allThemes[(allThemes.findIndex((t) => t.id === cur.id) + 1) % allThemes.length] ??
            DEFAULT_THEME,
        );
      }
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [allThemes, setTheme]);

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
    <div
      className="site"
      data-mode={mode}
      data-intro={intro.phase === 'done' ? undefined : intro.phase}
      data-fps={fps.toFixed(0)}
      data-frame-ms={frameMs.toFixed(2)}
      data-dropped={dropped}
    >
      <Header
        mode={mode}
        onMode={setMode}
        muted={sound.muted}
        onMute={toggleSound}
        awake={intro.phase === 'done'}
      />
      <Stage
        session={session}
        cluster={cluster}
        side={mode === 'engineer' && wide ? ENGINEER_SIDEBAR : 0}
      >
        {mode === 'watch' && director && directorState && (
          <WatchPanel
            director={director}
            state={directorState}
            onTakeWheel={() => setMode('drive')}
            onHowItWorks={setHowDoc}
          />
        )}
        {mode === 'drive' && session && bus && (
          <DriveDock
            bus={bus}
            source={session.source}
            store={session.store}
            moreOpen={moreOpen}
            onMore={() => setMoreOpen((o) => !o)}
          />
        )}
        {mode === 'engineer' && session && bus && engineerDriving && (
          <DriveDock
            bus={bus}
            source={session.source}
            store={session.store}
            moreOpen={moreOpen}
            onMore={() => setMoreOpen((o) => !o)}
          />
        )}
        {mode === 'engineer' && (
          <button
            className="more-toggle eng-drive-toggle"
            aria-expanded={engineerDriving}
            onClick={() => setEngineerDriving((d) => !d)}
          >
            {engineerDriving ? 'Hand back to the demo ▾' : 'Drive controls ▴'}
          </button>
        )}
        {mode === 'watch' && <span className="scroll-hint">SCROLL TO LEARN MORE ↓</span>}
      </Stage>

      {handsOn && moreOpen && session && bus && (
        <div className="more-sheet">
          <ControlPanel bus={bus} source={session.source} />
        </div>
      )}
      {mode === 'engineer' && session && (
        <EngineerPanel
          session={session}
          renderer={renderer}
          log={log}
          perf={{ fps, frameMs, dropped }}
          profileId={profileId}
          onProfile={setProfileId}
          sound={sound}
          onSound={setSound}
          onHow={setHowDoc}
        />
      )}
      {intro.phase !== 'done' && (
        <button className="intro-skip" onClick={intro.skip}>
          Skip intro
        </button>
      )}
      {howDoc && <HowItWorks doc={howDoc} onClose={() => setHowDoc(null)} />}

      {DEV && (
        <section className="theme-chooser more-sheet" aria-label="Themes (experimental)">
          <div className="dev-row">
            <span className="dev-label">Theme</span>
            {allThemes.map((t) => (
              <button
                key={t.id}
                className={`pill ${t.id === theme.id ? 'pill-on' : ''}`}
                onClick={() => setTheme(t)}
              >
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
    </div>
  );
}
