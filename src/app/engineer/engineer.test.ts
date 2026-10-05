import { describe, expect, it } from 'vitest';
import { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { DEFAULT_PROFILE } from '@/profiles';
import { EventLog, type Snapshot } from './EventLog';
import { MACHINES } from './machines';

const snap = (
  machines: Record<string, string>,
  alerts: string[] = [],
  driveMode = 'normal',
): Snapshot => ({
  machines,
  alerts: alerts.map((id) => ({ id, severity: 'critical' })),
  driveMode,
  context: { kmh: 100 },
});

describe('Engineer state machines', () => {
  it('every live state is one the diagram knows, and transitions join known states', () => {
    const src = new SimulatorSource(DEFAULT_PROFILE);
    src.fastForward(2);
    for (const m of MACHINES) {
      const ids = new Set(m.states.map((s) => s.id));
      expect(ids.has(m.read(src)), `${m.id}: ${m.read(src)}`).toBe(true);
      for (const tr of m.transitions) {
        expect(ids.has(tr.from), `${m.id} ${tr.from}`).toBe(true);
        expect(ids.has(tr.to), `${m.id} ${tr.to}`).toBe(true);
      }
    }
  });
});

describe('EventLog', () => {
  it('records only changes: transitions, alerts raised and cleared, mode changes', () => {
    const log = new EventLog();
    log.sample(0, snap({ fcw: 'ready' }));
    log.sample(100, snap({ fcw: 'ready' }));
    expect(log.events).toHaveLength(0);
    log.sample(200, snap({ fcw: 'prewarn' }, ['collisionPrewarn']));
    log.sample(300, snap({ fcw: 'ready' }, [], 'sport'));
    expect(log.events.map((e) => e.text)).toEqual([
      'fcw: ready → prewarn',
      'raised: collisionPrewarn (critical)',
      'fcw: prewarn → ready',
      'cleared: collisionPrewarn',
      'drive mode: normal → sport',
    ]);
    expect(log.events[0]!.t).toBeCloseTo(0.2);
    expect(log.events[0]!.detail.kmh).toBe(100);
  });
});

describe('viewModel', () => {
  it("shows the active page's inputs, or the view's own when it has no pages", async () => {
    const { viewModel } = await import('./viewModel');
    const { ClusterSession } = await import('../session');
    const s = new ClusterSession(DEFAULT_PROFILE);
    await s.start();
    s.source.fastForward(1);
    const trip = viewModel('classic', 'trip', s.store, s.source.scene(), s.alerts);
    expect(Object.keys(trip.signals as object).some((k) => k.includes('TraveledDistance'))).toBe(
      true,
    );
    const assist = viewModel('assist', '', s.store, s.source.scene(), s.alerts);
    expect(Object.keys(assist.signals as object).some((k) => k.includes('CruiseControl'))).toBe(
      true,
    );
    expect(assist).toHaveProperty('lead');
    await s.stop();
  });
});

describe('feature docs', () => {
  it('every source file a doc names exists (no dead "How it works" links)', async () => {
    const fs = await import('node:fs');
    const { sourcePaths } = await import('./markdown');
    const dir = 'docs/features';
    const missing: string[] = [];
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.md')))
      for (const p of sourcePaths(fs.readFileSync(`${dir}/${f}`, 'utf8')))
        if (!fs.existsSync(p)) missing.push(`${f}: ${p}`);
    expect(missing).toEqual([]);
  });
});
