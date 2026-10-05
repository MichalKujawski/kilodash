import { useEffect, useRef } from 'react';
import { ABOUT, REPO_URL } from '../site';
import { usePoll } from '../useSignal';
import type { ClusterSession } from '../session';
import { DECISIONS, HIGHLIGHTS, PIPELINE, PIPELINE_LINES, PITCH, TECH } from './content';
import './landing.css';

interface Props {
  session: ClusterSession | null;
  fps: number;
  /** Jump the guided demo to a chapter (and scroll back up to it). */
  onShowMe: (chapter: string) => void;
  /** Open a doc in the side sheet (features, ADRs, privacy). */
  onDoc: (id: string) => void;
}

/** The page below the cockpit: one idea per section, quiet, max ~1100 px. */
export function Landing({ session, fps, onShowMe, onDoc }: Props) {
  return (
    <div className="landing">
      <section className="ld-pitch" aria-labelledby="ld-pitch">
        <h2 id="ld-pitch">{PITCH.headline}</h2>
        <p>{PITCH.line}</p>
      </section>

      <section aria-labelledby="ld-highlights">
        <h3 className="ld-kicker" id="ld-highlights">
          Highlights
        </h3>
        <div className="ld-cards">
          {HIGHLIGHTS.map((h) => (
            <article key={h.chapter} className="ld-card">
              <CardLoop poster={h.poster} loop={h.loop} />
              <div className="ld-card-body">
                <h4>{h.title}</h4>
                <p>{h.line}</p>
                <button className="ld-link" onClick={() => onShowMe(h.chapter)}>
                  Show me ↑
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="ld-how">
        <h3 className="ld-kicker" id="ld-how">
          How it works
        </h3>
        <Pipeline session={session} fps={fps} />
        <ul className="ld-lines">
          {PIPELINE_LINES.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ld-decisions">
        <h3 className="ld-kicker" id="ld-decisions">
          Engineering decisions
        </h3>
        <ol className="ld-decisions">
          {DECISIONS.map((d, i) => (
            <li key={d.id}>
              <button onClick={() => onDoc(d.id)}>
                <span className="ld-num">{String(i + 1).padStart(2, '0')}</span>
                {d.title}
                <span className="ld-arrow">→</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ld-tech">
        <h3 className="ld-kicker" id="ld-tech">
          Built with
        </h3>
        <ul className="ld-badges">
          {TECH.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section className="ld-about" aria-labelledby="ld-about">
        <h3 className="ld-kicker" id="ld-about">
          About
        </h3>
        <p className="ld-name">{ABOUT.name}</p>
        <p>{ABOUT.bio}</p>
        <p className="ld-about-links">
          {ABOUT.links
            .filter((l) => l.href)
            .map((l) => (
              <a key={l.label} href={l.href} target="_blank" rel="noreferrer">
                {l.label}
              </a>
            ))}
        </p>
      </section>

      <footer className="ld-footer">
        <p>
          Not affiliated with any vehicle manufacturer. Not a certified automotive product; for
          demonstration only.
        </p>
        <p>
          <a href={`${REPO_URL}/blob/main/LICENSE`} target="_blank" rel="noreferrer">
            MIT licence
          </a>
          <span aria-hidden> · </span>
          <button className="ld-link" onClick={() => onDoc('PRIVACY')}>
            Privacy
          </button>
          <span aria-hidden> · </span>
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            Source
          </a>
        </p>
      </footer>
    </div>
  );
}

/** The data path, with live values flowing through it. */
function Pipeline({ session, fps }: { session: ClusterSession | null; fps: number }) {
  usePoll(2);
  const src = session?.source;
  const live = [
    src ? `${src.sim.speedKmh.toFixed(1)} km/h` : '—',
    session ? `${session.store.ids().length} signals` : '—',
    src ? `cruise: ${src.assist.state}` : '—',
    src ? `mode: ${src.sim.driveModes.state.current}` : '—',
    `${fps.toFixed(0)} fps`,
  ];
  return (
    <div className="ld-pipe" role="img" aria-label={PIPELINE.map((p) => p.name).join(' → ')}>
      {PIPELINE.map((p, i) => (
        <div key={p.name} className="ld-pipe-step">
          {i > 0 && <span className="ld-flow" aria-hidden />}
          <div className="ld-node">
            <strong>{p.name}</strong>
            <span>{p.note}</span>
            <code>{live[i]}</code>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * A short muted loop of that moment. It plays only while on screen (no decoding
 * off-screen) and stays a still poster for visitors who prefer reduced motion.
 */
function CardLoop({ poster, loop }: { poster: string; loop: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      poster={poster}
      muted
      loop
      playsInline
      preload="none"
      width={960}
      height={360}
      aria-hidden
    >
      <source src={`${loop}.webm`} type="video/webm" />
      <source src={`${loop}.mp4`} type="video/mp4" />
    </video>
  );
}
