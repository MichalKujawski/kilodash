import { useEffect } from 'react';
import { TOTAL_S } from './chapters';
import type { Director, DirectorState } from './Director';

const clock = (s: number): string =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  director: Director;
  state: DirectorState;
  onTakeWheel: () => void;
  /** Opens the feature's explanation. */
  onHowItWorks: (doc: string) => void;
  /** False on phones: no Drive there, so a note replaces "Take the wheel". */
  canDrive?: boolean;
  /** Phone held upright: suggest turning it. */
  portrait?: boolean;
}

/** Watch mode lower third: chapter caption, chapter bar, "Take the wheel". */
export function WatchPanel({
  director,
  state,
  onTakeWheel,
  onHowItWorks,
  canDrive = true,
  portrait = false,
}: Props) {
  const { chapter, caption, index, playing } = state;
  const chapters = director.chapters;

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') director.toggle();
      else if (e.key === 'ArrowRight') director.next();
      else if (e.key === 'ArrowLeft') director.prev();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, [director]);

  return (
    <div className="watch">
      <div className="caption" aria-live="polite" key={`${chapter.id}-${caption?.t0 ?? 'none'}`}>
        <span className="chapter-number">{String(index + 1).padStart(2, '0')}</span>
        <div>
          <div className="chapter-title">{chapter.title}</div>
          <p className="caption-line">{caption?.title ?? ' '}</p>
          <p className="caption-note">
            {caption?.note}
            {caption?.doc && (
              <button className="how" onClick={() => onHowItWorks(caption.doc!)}>
                How it works →
              </button>
            )}
          </p>
        </div>
      </div>

      <div className="chapter-bar">
        <div className="transport">
          <button
            className="round"
            aria-label={playing ? 'Pause' : 'Play'}
            title={playing ? 'Pause (Space)' : 'Play (Space)'}
            onClick={() => director.toggle()}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </button>
          <button
            className="round"
            aria-label="Next chapter"
            title="Next chapter (→)"
            onClick={() => director.next()}
          >
            <NextIcon />
          </button>
        </div>
        <div className="chapters" role="tablist" aria-label="Chapters">
          {chapters.map((c, i) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={i === index}
              className={`chapter ${i < index ? 'done' : ''} ${i === index ? 'current' : ''}`}
              style={{ flexGrow: c.duration }}
              onClick={() => director.start(i)}
            >
              <span className="track">
                <span
                  className="fill"
                  style={{
                    transform: `scaleX(${i < index ? 1 : i === index ? Math.min(state.t / c.duration, 1) : 0})`,
                  }}
                />
              </span>
              <span className="name">{c.duration >= 10 ? c.title : ''}</span>
            </button>
          ))}
        </div>
        <span className="time">
          {clock(director.elapsed)} / {clock(TOTAL_S)}
        </span>
        {canDrive ? (
          <button className="take-wheel" onClick={onTakeWheel}>
            Take the wheel →
          </button>
        ) : (
          !portrait && <span className="device-note">Best on desktop to drive</span>
        )}
      </div>
      {!canDrive && portrait && (
        <p className="device-note">
          <span>Rotate for a bigger view.</span>
          <span>Best on desktop to take the wheel.</span>
        </p>
      )}
    </div>
  );
}

const PauseIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
  </svg>
);
const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M4.5 2.8v10.4L13 8z" fill="currentColor" />
  </svg>
);
const NextIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
    <path d="M3 3v10l7-5z" fill="currentColor" />
    <rect x="11" y="3" width="2" height="10" rx="0.8" fill="currentColor" />
  </svg>
);
