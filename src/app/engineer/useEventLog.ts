import { useEffect, useMemo } from 'react';
import type { ClusterSession } from '../session';
import { EventLog } from './EventLog';
import { MACHINES } from './machines';

/** Sampling rate of the timeline: every transition lasts longer than this, Hz. */
const LOG_HZ = 10;

/** Keeps a timeline of the car's state changes for the whole visit. */
export function useEventLog(session: ClusterSession | null): EventLog {
  const log = useMemo(() => new EventLog(), []);
  useEffect(() => {
    if (!session) return;
    const src = session.source;
    const id = window.setInterval(() => {
      const scene = src.scene();
      log.sample(performance.now(), {
        machines: Object.fromEntries(MACHINES.map((m) => [m.id, m.read(src)])),
        alerts: session.alerts.list().map((a) => ({ id: a.rule.id, severity: a.rule.severity })),
        driveMode: src.sim.driveModes.state.current,
        context: {
          kmh: Math.round(src.sim.speedKmh),
          road: `${scene.road.name} (${scene.road.kind})`,
          lead: scene.lead
            ? { dx: Math.round(scene.lead.dx), kmh: Math.round(scene.lead.v * 3.6) }
            : null,
        },
      });
    }, 1000 / LOG_HZ);
    return () => window.clearInterval(id);
  }, [log, session]);
  return log;
}
