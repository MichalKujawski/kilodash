import { Emitter } from '../emitter';
import type { SignalStore } from '../signals/store';
import { evaluate } from './conditions';
import type { AlertRule, Severity } from './rules';

export interface ActiveAlert {
  rule: AlertRule;
  /** ms, when raised (or when it came back after being acknowledged). */
  since: number;
  acknowledged: boolean;
  /** ms, when acknowledged. */
  ackAt?: number;
}

/** Acknowledged yellow messages come back after this long if still active, ms. */
export const RETURN_MS = 5 * 60_000;
/** Several messages of the same priority take turns this long, ms. */
export const CYCLE_MS = 5_000;

const RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

/** How long a popup stays up unless acknowledged (critical: until cleared). */
export const POPUP_MS: Record<Severity, number> = {
  critical: Infinity,
  warning: 10_000,
  info: 6_000,
};

/**
 * Evaluates alert rules against the signal store with hysteresis and minimum
 * durations, keeps a priority-ordered set of active alerts and emits raise/clear
 * events (for chimes). Call `update` at a few Hz.
 */
export class AlertEngine {
  private pending = new Map<string, number>();
  private active = new Map<string, ActiveAlert>();
  private lastChime = new Map<string, number>();
  readonly raised = new Emitter<ActiveAlert>();
  readonly cleared = new Emitter<AlertRule>();
  /** Fires when an active alert should chime again (`repeatChimeS`). */
  readonly reminded = new Emitter<ActiveAlert>();

  constructor(
    private store: SignalStore,
    private rules: AlertRule[],
  ) {}

  update(now: number): void {
    for (const rule of this.rules) {
      const act = this.active.get(rule.id);
      if (act) {
        const clear = rule.clear
          ? evaluate(rule.clear, this.store)
          : !evaluate(rule.when, this.store);
        if (clear) {
          this.active.delete(rule.id);
          this.pending.delete(rule.id);
          this.cleared.emit(rule);
        } else if (
          act.acknowledged &&
          rule.severity === 'warning' &&
          now - (act.ackAt ?? now) >= RETURN_MS
        ) {
          // Priority 2: back on screen (with a gong) while the problem persists.
          act.acknowledged = false;
          act.since = now;
          this.lastChime.set(rule.id, now);
          this.raised.emit(act);
        } else if (
          rule.repeatChimeS &&
          now - (this.lastChime.get(rule.id) ?? 0) >= rule.repeatChimeS * 1000
        ) {
          this.lastChime.set(rule.id, now);
          this.reminded.emit(act);
        }
        continue;
      }
      if (!evaluate(rule.when, this.store)) {
        this.pending.delete(rule.id);
        continue;
      }
      const since = this.pending.get(rule.id) ?? now;
      this.pending.set(rule.id, since);
      if (now - since >= (rule.minDurationS ?? 0) * 1000) {
        const a: ActiveAlert = { rule, since: now, acknowledged: false };
        this.active.set(rule.id, a);
        this.lastChime.set(rule.id, now);
        this.raised.emit(a);
      }
    }
  }

  /** All active alerts, most severe first, then newest first. */
  list(): ActiveAlert[] {
    return [...this.active.values()].sort(
      (a, b) => RANK[a.rule.severity] - RANK[b.rule.severity] || b.since - a.since,
    );
  }

  /** Alerts waiting to be seen (not acknowledged, popup time not over), most severe first. */
  showable(now: number): ActiveAlert[] {
    return this.list().filter((a) => !a.acknowledged && now - a.since < POPUP_MS[a.rule.severity]);
  }

  /**
   * The alert to show as a popup now. Among several of the highest priority
   * they take turns every few seconds, as real clusters cycle messages.
   */
  current(now: number): ActiveAlert | undefined {
    const list = this.showable(now);
    const top = list.filter((a) => a.rule.severity === list[0]?.rule.severity);
    if (top.length <= 1) return top[0];
    return top[Math.floor(now / CYCLE_MS) % top.length];
  }

  /** Dismiss the current popup (steering-wheel OK). Critical alerts stay in the list. */
  acknowledge(id: string, now = performance.now()): void {
    const a = this.active.get(id);
    if (a) {
      a.acknowledged = true;
      a.ackAt = now;
    }
  }

  isActive(id: string): boolean {
    return this.active.has(id);
  }
}
