/**
 * Optional, cookieless usage analytics (Plausible or Umami). Off unless the
 * build sets VITE_ANALYTICS_PROVIDER, _SRC and _SITE (see .env.example); then
 * only anonymous event names with a few properties are sent (docs/PRIVACY.md).
 * Visitors with Do Not Track or Global Privacy Control on are never counted.
 */
export type Provider = 'plausible' | 'umami';

export interface AnalyticsConfig {
  provider: Provider;
  /** Script URL of the self-hosted or cloud instance. */
  src: string;
  /** Plausible: the site's domain. Umami: the website ID. */
  site: string;
}

export type EventName =
  | 'Mode'
  | 'Chapter'
  | 'Demo completed'
  | 'Take the wheel'
  | 'How it works'
  | 'Show me'
  | 'Highlight seen'
  | 'Outbound';

export type Props = Record<string, string>;

export function readConfig(env: Record<string, string | undefined>): AnalyticsConfig | null {
  const provider = env.VITE_ANALYTICS_PROVIDER;
  const src = env.VITE_ANALYTICS_SRC;
  const site = env.VITE_ANALYTICS_SITE;
  if ((provider !== 'plausible' && provider !== 'umami') || !src || !site) return null;
  return { provider, src, site };
}

export function optedOut(nav: {
  doNotTrack?: string | null;
  globalPrivacyControl?: boolean;
}): boolean {
  return nav.doNotTrack === '1' || nav.globalPrivacyControl === true;
}

/**
 * Collects events and hands them to the provider once its script has loaded
 * (events from the first second are queued, not lost). With no config it does
 * nothing at all.
 */
export class Analytics {
  private queue: [EventName, Props | undefined][] = [];
  private send: ((name: EventName, props?: Props) => void) | null = null;

  constructor(readonly config: AnalyticsConfig | null) {}

  get enabled(): boolean {
    return this.config !== null;
  }

  track(name: EventName, props?: Props): void {
    if (!this.config) return;
    if (this.send) this.send(name, props);
    else this.queue.push([name, props]);
  }

  /** The provider's script is ready: deliver what was queued. */
  ready(send: (name: EventName, props?: Props) => void): void {
    this.send = send;
    for (const [n, p] of this.queue.splice(0)) send(n, p);
  }
}

type ProviderWindow = Window & {
  plausible?: (name: string, opts?: { props?: Props }) => void;
  umami?: { track: (name: string, data?: Props) => void };
};

function load(a: Analytics, c: AnalyticsConfig): void {
  const s = document.createElement('script');
  s.defer = true;
  s.src = c.src;
  if (c.provider === 'plausible') s.dataset.domain = c.site;
  else s.dataset.websiteId = c.site;
  s.addEventListener('load', () => {
    const w = window as ProviderWindow;
    a.ready((name, props) =>
      c.provider === 'plausible' ? w.plausible?.(name, { props }) : w.umami?.track(name, props),
    );
  });
  document.head.appendChild(s);
  // Outbound links (GitHub, source files): count the click, never the page they lead to.
  document.addEventListener('click', (e) => {
    const link = (e.target as Element | null)?.closest?.('a[href]');
    const href = link?.getAttribute('href') ?? '';
    if (/^https?:/.test(href) && !href.startsWith(location.origin))
      a.track('Outbound', { url: new URL(href).hostname + new URL(href).pathname });
  });
}

function create(): Analytics {
  if (typeof window === 'undefined') return new Analytics(null);
  const params = new URLSearchParams(location.search);
  // Never in recordings or kiosk screens, and never for visitors who opted out.
  const off =
    params.has('record') ||
    params.has('kiosk') ||
    optedOut(navigator as { doNotTrack?: string | null; globalPrivacyControl?: boolean });
  const config = off ? null : readConfig(import.meta.env as Record<string, string | undefined>);
  const a = new Analytics(config);
  if (config) load(a, config);
  return a;
}

export const analytics = create();
export const track = (name: EventName, props?: Props): void => analytics.track(name, props);
