import { describe, expect, it } from 'vitest';
import { Analytics, optedOut, readConfig } from './analytics';

describe('analytics', () => {
  it('is off unless provider, script and site are all configured', () => {
    expect(readConfig({})).toBeNull();
    expect(
      readConfig({ VITE_ANALYTICS_PROVIDER: 'plausible', VITE_ANALYTICS_SRC: 'x' }),
    ).toBeNull();
    expect(
      readConfig({
        VITE_ANALYTICS_PROVIDER: 'ga',
        VITE_ANALYTICS_SRC: 'x',
        VITE_ANALYTICS_SITE: 'y',
      }),
    ).toBeNull();
    expect(
      readConfig({
        VITE_ANALYTICS_PROVIDER: 'umami',
        VITE_ANALYTICS_SRC: 'https://a/s.js',
        VITE_ANALYTICS_SITE: 'id',
      }),
    ).toEqual({ provider: 'umami', src: 'https://a/s.js', site: 'id' });
  });

  it('respects Do Not Track and Global Privacy Control', () => {
    expect(optedOut({ doNotTrack: '1' })).toBe(true);
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: null })).toBe(false);
  });

  it('does nothing when off; queues until the script is ready when on', () => {
    const off = new Analytics(null);
    off.track('Mode', { mode: 'drive' });
    expect(off.enabled).toBe(false);

    const sent: string[] = [];
    const on = new Analytics({ provider: 'plausible', src: 's', site: 'd' });
    on.track('Chapter', { chapter: 'motorway' });
    expect(sent).toEqual([]);
    on.ready((n, p) => sent.push(`${n}:${p?.chapter ?? ''}`));
    on.track('Take the wheel');
    expect(sent).toEqual(['Chapter:motorway', 'Take the wheel:']);
  });
});
