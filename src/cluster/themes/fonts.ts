import type { Theme } from './types';

const pending = new Map<string, Promise<void>>();

function injectStylesheet(spec: string): Promise<void> {
  let p = pending.get(spec);
  if (!p) {
    p = new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${spec.replace(/ /g, '+')}&display=swap`;
      link.onload = () => resolve();
      link.onerror = () => resolve();
      document.head.appendChild(link);
    });
    pending.set(spec, p);
  }
  return p;
}

/**
 * Load a theme's web fonts on demand (only the default theme's fonts are in the
 * page head), then wait until canvas can use them. Concurrent callers share the
 * same pending load.
 */
export async function ensureThemeFonts(theme: Theme): Promise<void> {
  if (typeof document === 'undefined') return;
  await Promise.all((theme.fonts.load ?? []).map(injectStylesheet));
  if (!document.fonts) return;
  const families = [theme.fonts.primary, theme.fonts.numerals, theme.fonts.readout].filter(
    (f) => f !== 'segment',
  );
  const loads = families.flatMap((f) =>
    [400, 500, 700].flatMap((w) => [
      document.fonts.load(`${w} 32px ${f}`),
      document.fonts.load(`italic ${w} 32px ${f}`),
    ]),
  );
  await Promise.allSettled(loads);
}

/** Open-licensed font choices offered by the theme editor. */
export const FONT_CHOICES: { label: string; family: string; load?: string }[] = [
  { label: 'Barlow Semi Condensed', family: '"Barlow Semi Condensed", system-ui, sans-serif' },
  { label: 'Inter', family: '"Inter", system-ui, sans-serif' },
  {
    label: 'Rajdhani',
    family: '"Rajdhani", system-ui, sans-serif',
    load: 'Rajdhani:wght@500;600;700',
  },
  { label: 'Orbitron', family: '"Orbitron", system-ui, sans-serif', load: 'Orbitron:wght@500;700' },
  { label: 'Nunito', family: '"Nunito", system-ui, sans-serif', load: 'Nunito:wght@400;600;700' },
  {
    label: 'Libre Baskerville',
    family: '"Libre Baskerville", Georgia, serif',
    load: 'Libre Baskerville:ital,wght@0,400;0,700;1,400',
  },
  {
    label: 'Share Tech Mono',
    family: '"Share Tech Mono", ui-monospace, monospace',
    load: 'Share Tech Mono',
  },
  {
    label: 'JetBrains Mono',
    family: '"JetBrains Mono", ui-monospace, monospace',
    load: 'JetBrains Mono:wght@400;600',
  },
];
