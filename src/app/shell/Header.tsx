import { REPO_URL } from '../site';
import { useEffect, useState } from 'react';

export type SiteMode = 'watch' | 'drive' | 'engineer';
export const SITE_MODES: SiteMode[] = ['watch', 'drive', 'engineer'];
const LABEL: Record<SiteMode, string> = { watch: 'Watch', drive: 'Drive', engineer: 'Engineer' };

interface Props {
  mode: SiteMode;
  onMode: (m: SiteMode) => void;
  muted: boolean;
  onMute: () => void;
}

/**
 * Thin, quiet header: wordmark, Watch · Drive · Engineer switch, sound and
 * source links. In Watch it fades out after 3 s without pointer movement and
 * returns on movement or keyboard focus (cinema feel).
 */
export function Header({ mode, onMode, muted, onMute }: Props) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (mode !== 'watch') return;
    let t = setTimeout(() => setIdle(true), 3000);
    const wake = (): void => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 3000);
    };
    window.addEventListener('pointermove', wake);
    window.addEventListener('keydown', wake);
    window.addEventListener('focusin', wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
      window.removeEventListener('focusin', wake);
    };
  }, [mode]);
  const index = SITE_MODES.indexOf(mode);
  return (
    <header className={`site-header ${idle && mode === 'watch' ? 'is-idle' : ''}`}>
      <a className="wordmark" href="./" aria-label="OpenCluster home">
        OpenCluster
      </a>
      <nav className="mode-switch" aria-label="Mode">
        <span
          className="mode-thumb"
          style={{ transform: `translateX(${index * 100}%)` }}
          aria-hidden
        />
        {SITE_MODES.map((m) => (
          <button
            key={m}
            className={m === mode ? 'is-on' : ''}
            aria-pressed={m === mode}
            onClick={() => onMode(m)}
          >
            {LABEL[m]}
          </button>
        ))}
      </nav>
      <div className="header-icons">
        <button
          className="icon-btn"
          onClick={onMute}
          aria-label={muted ? 'Sound on' : 'Sound off'}
          title={muted ? 'Sound on' : 'Sound off'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {muted ? (
              <path d="M17 9l4 6M21 9l-4 6" />
            ) : (
              <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
            )}
          </svg>
        </button>
        <a
          className="icon-btn"
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Source code on GitHub"
          title="Source code"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.4-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.7.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5 0-1.1.4-2 1-2.7-.1-.3-.4-1.3.1-2.7 0 0 .8-.3 2.8 1a9.6 9.6 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .6 1.4.2 2.4.1 2.7.6.7 1 1.6 1 2.7 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2z" />
          </svg>
        </a>
      </div>
    </header>
  );
}
