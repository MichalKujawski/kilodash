import { useEffect, useState } from 'react';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { SignalStore } from '@/core/signals/store';
import type { ControlBus } from '../controls/ControlBus';
import { usePoll } from '../useSignal';
import { cruiseLit } from './context';
import { GearLever } from './GearLever';
import { KeyHelp } from './KeyHelp';
import { Pedals } from './Pedals';
import { Stalk } from './Stalk';
import { Wheel } from './Wheel';
import './dock.css';

const COACH_KEY = 'kilodash.coach.drive';
const COACH_S = 8;

function coachSeen(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === '1';
  } catch {
    return true;
  }
}

interface Props {
  bus: ControlBus;
  source: SimulatorSource;
  store: SignalStore;
  moreOpen: boolean;
  onMore: () => void;
}

/**
 * Drive mode: the controls you need at rest, placed like the car's — stalk,
 * wheel (cluster and cruise spokes), selector with the console button,
 * pedals. Everything else lives in More controls; every key is in "?".
 */
export function DriveDock({ bus, source, store, moreOpen, onMore }: Props) {
  usePoll(6);
  const [help, setHelp] = useState(false);
  const [coach, setCoach] = useState(() => !coachSeen());

  useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === '?') setHelp((h) => !h);
    };
    window.addEventListener('keydown', down);
    return () => window.removeEventListener('keydown', down);
  }, []);

  useEffect(() => {
    if (!coach) return;
    const done = (): void => {
      setCoach(false);
      try {
        localStorage.setItem(COACH_KEY, '1');
      } catch {
        /* private mode: show again next time */
      }
    };
    const t = window.setTimeout(done, COACH_S * 1000);
    window.addEventListener('keydown', done, { once: true });
    window.addEventListener('pointerdown', done, { once: true });
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', done);
      window.removeEventListener('pointerdown', done);
    };
  }, [coach]);

  const scene = source.scene();
  const lit = cruiseLit(scene.road.kind, source.sim.speedKmh, source.assist.state !== 'off');

  return (
    <div className="dock">
      <div className="dock-tools">
        <button
          className="round"
          aria-label="Keyboard controls"
          title="Keyboard (?)"
          onClick={() => setHelp(true)}
        >
          ?
        </button>
        <button className="more-toggle" aria-expanded={moreOpen} onClick={onMore}>
          More controls {moreOpen ? '▾' : '▴'}
        </button>
      </div>

      <div className="dock-row">
        <figure className="dock-item dock-stalk" title="Turn signal">
          {coach && <span className="coach">Tap to signal</span>}
          <Stalk bus={bus} source={source} store={store} />
          <figcaption>Turn signal</figcaption>
        </figure>
        <figure className="dock-item dock-wheel" title="Steering wheel">
          {coach && <span className="coach">Pages, OK and View</span>}
          <Wheel bus={bus} source={source} cruiseLit={lit} />
          <figcaption>Steering wheel</figcaption>
        </figure>
        <figure className="dock-item dock-lever" title="Gear and drive mode">
          <GearLever bus={bus} source={source} />
          <figcaption>Gear · drive mode</figcaption>
        </figure>
        <figure className="dock-item dock-pedals" title="Brake and accelerator">
          {coach && <span className="coach">Hold to drive</span>}
          <Pedals bus={bus} source={source} />
          <figcaption>
            <span>Brake</span>
            <span>Accelerator</span>
          </figcaption>
        </figure>
      </div>

      {help && <KeyHelp onClose={() => setHelp(false)} />}
    </div>
  );
}
