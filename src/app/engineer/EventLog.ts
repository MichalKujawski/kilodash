export type EventKind = 'state' | 'alert' | 'mode';

export interface LogEvent {
  /** Seconds since the log started. */
  t: number;
  kind: EventKind;
  /** Short line for the timeline. */
  text: string;
  /** Detail shown when the event is opened. */
  detail: Record<string, unknown>;
}

/** What the log compares between samples. */
export interface Snapshot {
  machines: Record<string, string>;
  alerts: { id: string; severity: string }[];
  driveMode: string;
  /** Car context stored with each event (speed, road…). */
  context: Record<string, unknown>;
}

const MAX_EVENTS = 300;

/**
 * Timeline of what the car did: state-machine transitions, warnings raised
 * and cleared, drive-mode changes. It samples snapshots a few times a second
 * and records only the differences, so it costs nothing while nothing happens.
 */
export class EventLog {
  readonly events: LogEvent[] = [];
  private last: Snapshot | null = null;
  private t0: number | null = null;
  /** Bumped on every change, so a UI can tell it needs to redraw. */
  version = 0;

  sample(nowMs: number, snap: Snapshot): void {
    this.t0 ??= nowMs;
    const t = (nowMs - this.t0) / 1000;
    const prev = this.last;
    this.last = snap;
    if (!prev) return;
    for (const [id, state] of Object.entries(snap.machines)) {
      const before = prev.machines[id];
      if (before !== undefined && before !== state)
        this.push(
          t,
          'state',
          `${id}: ${before} → ${state}`,
          { machine: id, from: before, to: state },
          snap,
        );
    }
    const had = new Set(prev.alerts.map((a) => a.id));
    const has = new Set(snap.alerts.map((a) => a.id));
    for (const a of snap.alerts)
      if (!had.has(a.id))
        this.push(t, 'alert', `raised: ${a.id} (${a.severity})`, { ...a, raised: true }, snap);
    for (const a of prev.alerts)
      if (!has.has(a.id)) this.push(t, 'alert', `cleared: ${a.id}`, { ...a, raised: false }, snap);
    if (prev.driveMode !== snap.driveMode)
      this.push(t, 'mode', `drive mode: ${prev.driveMode} → ${snap.driveMode}`, {}, snap);
  }

  private push(
    t: number,
    kind: EventKind,
    text: string,
    detail: Record<string, unknown>,
    snap: Snapshot,
  ): void {
    this.events.push({ t, kind, text, detail: { ...detail, ...snap.context } });
    if (this.events.length > MAX_EVENTS) this.events.shift();
    this.version++;
  }
}
