import { useEffect } from 'react';
import { S } from '@/core/signals/catalog';
import type { ClusterSession } from '../session';
import type { AudioEngine } from './AudioEngine';

/**
 * Drives sounds from the session: relay ticks in phase with the shared flasher,
 * chimes on raised/reminded alerts, and the optional engine note.
 */
export function useClusterAudio(session: ClusterSession | null, audio: AudioEngine): void {
  useEffect(() => {
    if (!session) return;
    const { store, flasher, alerts } = session;
    const cylinders = session.profile.engine?.cylinders ?? 4;
    const last = { indicatorLeft: false, indicatorRight: false };
    let lastIsa = 0;
    let nextBeep = 0;
    let toneOn = false;
    const timer = setInterval(() => {
      const now = performance.now();
      const hazard = store.value(S.Hazard) > 0;
      let edge: boolean | null = null;
      for (const [key, id] of [
        ['indicatorLeft', S.IndicatorLeft],
        ['indicatorRight', S.IndicatorRight],
      ] as const) {
        const lit = flasher.lit(key, store.value(id) > 0 || hazard, now);
        if (lit !== last[key]) edge = lit;
        last[key] = lit;
      }
      if (edge !== null) audio.tick(edge);
      // Speed warning: one short chime when the acoustic stage starts.
      const isa = store.value(S.IsaState);
      if (isa === 3 && lastIsa !== 3) audio.chime('info');
      lastIsa = isa;
      // Park distance beeps: interval from the car, continuous when very close.
      const beep = store.value(S.ParkBeep);
      const front = store.value(S.ParkBeepFront) > 0;
      const continuous = beep < 0;
      if (continuous !== toneOn) {
        audio.parkTone(continuous, front);
        toneOn = continuous;
      }
      if (beep > 0 && now >= nextBeep) {
        audio.parkBeep(front);
        nextBeep = now + beep * 1000;
      } else if (beep === 0) nextBeep = 0;
      audio.updateEngine(
        store.value(S.EngineSpeed),
        store.value(S.EngineLoad),
        store.value(S.EngineRunning) > 0,
        cylinders,
      );
    }, 15);
    const offRaise = alerts.raised.on((a) => audio.chime(a.rule.severity));
    const offRemind = alerts.reminded.on((a) => audio.chime(a.rule.severity));
    return () => {
      clearInterval(timer);
      offRaise();
      offRemind();
    };
  }, [session, audio]);
}
