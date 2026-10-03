import { useRef, useState } from 'react';
import { FONT_CHOICES } from '@/cluster/themes/fonts';
import type { Theme } from '@/cluster/themes/types';
import { parseTheme, serializeTheme } from '@/cluster/themes/validate';
import { getPath, isBuiltIn, setPath, toHex, withHex } from './themeStore';

interface Props {
  theme: Theme;
  /** Apply a change live (no cross-fade while dragging). */
  onChange: (theme: Theme) => void;
  onSave: (theme: Theme) => void;
  onDelete: (id: string) => void;
}

const COLORS: [string, string][] = [
  ['background', 'Background'],
  ['text.primary', 'Text'],
  ['text.accent', 'Accent'],
  ['dial.needle.color', 'Needle'],
  ['dial.needle.glow', 'Needle glow'],
  ['dial.ticks.major.color', 'Major ticks'],
  ['dial.numerals.color', 'Numerals'],
  ['dial.tickBand.outer', 'Tick band'],
  ['dial.face.edge', 'Dial face'],
  ['dial.bezel.light', 'Bezel'],
  ['dial.redline.band', 'Redline'],
  ['dial.hub.fill', 'Hub'],
  ['dial.hub.text', 'Readouts'],
  ['sideGauge.fill', 'Side gauges'],
  ['map.route', 'Map route'],
  ['effects.ambient', 'Ambient light'],
];

const SLIDERS: [string, string, number, number, number][] = [
  ['effects.bloom', 'Glow', 0, 1, 0.05],
  ['effects.glass', 'Glass', 0, 0.08, 0.005],
  ['dial.needle.afterglowDeg', 'Afterglow', 0, 45, 1],
  ['dial.tickBand.width', 'Tick band', 0.06, 0.22, 0.01],
  ['dial.hub.radius', 'Hub size', 0.1, 0.6, 0.01],
  ['dial.sweepDeg', 'Sweep', 200, 300, 5],
  ['needlePhysics.stiffness', 'Needle stiffness', 40, 420, 10],
  ['needlePhysics.damping', 'Needle damping', 6, 45, 1],
];

const SELECTS: [string, string, string[]][] = [
  ['dial.needle.style', 'Needle', ['blade', 'line', 'arrow']],
  ['dial.mode', 'Dial', ['needle', 'segments']],
  ['dial.numerals.orientation', 'Numerals', ['upright', 'radial']],
  ['backdrop.kind', 'Backdrop', ['solid', 'gradient', 'carbon', 'grid', 'particles']],
  ['sounds.chime', 'Chimes', ['bell', 'digital', 'soft']],
];

/**
 * Live theme editor: colours, fonts, glow, needle feel and dial style, with
 * export/import as JSON and saving to this browser. Proves the theme system is
 * data, not code.
 */
export function ThemeEditor({ theme, onChange, onSave, onDelete }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const builtIn = isBuiltIn(theme.id);
  const set = (path: string, value: unknown): void => onChange(setPath(theme, path, value));

  const setFont = (slot: 'primary' | 'numerals' | 'readout', label: string): void => {
    if (slot === 'readout' && label === '7-segment') {
      set('fonts.readout', 'segment');
      return;
    }
    const choice = FONT_CHOICES.find((f) => f.label === label);
    if (!choice) return;
    let next = setPath(theme, `fonts.${slot}`, choice.family);
    if (choice.load)
      next = setPath(next, 'fonts.load', [...new Set([...(theme.fonts.load ?? []), choice.load])]);
    onChange(next);
  };
  // Match on the first family name so stacks with different fallbacks still resolve.
  const firstFamily = (stack: string): string => stack.split(',')[0]!.replace(/"/g, '').trim();
  const fontLabel = (family: string): string =>
    family === 'segment'
      ? '7-segment'
      : (FONT_CHOICES.find((f) => firstFamily(f.family) === firstFamily(family))?.label ??
        'Custom');

  const exportJson = (): void => {
    const json = serializeTheme(theme);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${theme.id}.theme.json`;
    a.click();
    URL.revokeObjectURL(url);
    void navigator.clipboard?.writeText(json).catch(() => undefined);
    setMessage('Exported (also copied to the clipboard).');
  };

  const importText = (text: string): void => {
    const r = parseTheme(text);
    if (!r.theme) {
      setMessage(r.error ?? 'Import failed');
      return;
    }
    const imported = isBuiltIn(r.theme.id) ? { ...r.theme, id: `${r.theme.id}-copy` } : r.theme;
    onChange(imported);
    onSave(imported);
    setMessage(
      r.problems.length
        ? `Imported with ${r.problems.length} warning(s): ${r.problems[0]}`
        : 'Imported.',
    );
  };

  const duplicate = (): void => {
    const copy = {
      ...structuredClone(theme),
      id: `custom-${Date.now().toString(36)}`,
      name: `${theme.name} (custom)`,
    };
    onChange(copy);
    onSave(copy);
    setMessage('Created an editable copy.');
  };

  return (
    <section className="theme-editor" aria-label="Theme editor">
      <div className="te-head">
        <input
          className="te-name"
          value={theme.name}
          aria-label="Theme name"
          onChange={(e) => set('name', e.target.value)}
          disabled={builtIn}
        />
        <div className="te-actions">
          {builtIn ? (
            <button className="pill pill-on" onClick={duplicate}>
              Duplicate &amp; edit
            </button>
          ) : (
            <>
              <button className="pill pill-on" onClick={() => onSave(theme)}>
                Save
              </button>
              <button className="pill" onClick={() => onDelete(theme.id)}>
                Delete
              </button>
            </>
          )}
          <button className="pill" onClick={exportJson}>
            Export JSON
          </button>
          <button className="pill" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void file.text().then(importText);
              e.target.value = '';
            }}
          />
        </div>
      </div>
      {builtIn && (
        <p className="te-note">Built-in themes are read-only. Duplicate one to edit it live.</p>
      )}
      {message && <p className="te-note">{message}</p>}

      <fieldset className="te-grid" disabled={builtIn}>
        {COLORS.map(([path, name]) => {
          const value = String(getPath(theme, path) ?? '#000000');
          return (
            <label key={path} className="te-field">
              <input
                type="color"
                value={toHex(value)}
                onChange={(e) => set(path, withHex(value, e.target.value))}
              />
              <span>{name}</span>
            </label>
          );
        })}
      </fieldset>

      <fieldset className="te-grid te-grid-wide" disabled={builtIn}>
        {(['primary', 'numerals', 'readout'] as const).map((slot) => (
          <label key={slot} className="te-field te-select">
            <span>
              {slot === 'primary'
                ? 'Text font'
                : slot === 'numerals'
                  ? 'Numeral font'
                  : 'Readout font'}
            </span>
            <select
              value={fontLabel(theme.fonts[slot])}
              onChange={(e) => setFont(slot, e.target.value)}
            >
              {FONT_CHOICES.map((f) => (
                <option key={f.label}>{f.label}</option>
              ))}
              {slot === 'readout' && <option>7-segment</option>}
              {fontLabel(theme.fonts[slot]) === 'Custom' && <option>Custom</option>}
            </select>
          </label>
        ))}
        {SELECTS.map(([path, name, options]) => (
          <label key={path} className="te-field te-select">
            <span>{name}</span>
            <select
              value={String(getPath(theme, path))}
              onChange={(e) => set(path, e.target.value)}
            >
              {options.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
        {SLIDERS.map(([path, name, min, max, step]) => (
          <label key={path} className="te-field te-slider">
            <span>{name}</span>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={Number(getPath(theme, path))}
              onChange={(e) => set(path, Number(e.target.value))}
            />
          </label>
        ))}
      </fieldset>
    </section>
  );
}
