// Signal catalog → docs/SIGNALS.md (`npm run docs:signals`; `-- --check` fails if the file is out of date).
//
// The table is generated from `src/core/signals/catalog.ts` so it can never drift from the code. Node runs
// the TypeScript file directly (type stripping); the doc comments next to each ID become the notes. The OBD
// table is read as text, because pids.ts uses extensionless imports that only the bundler resolves.
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'docs/SIGNALS.md';
const CATALOG = 'src/core/signals/catalog.ts';
const CHECK = process.argv.includes('--check');

const { S, SIGNALS } = await import(`../${CATALOG}`);
const PIDS_FILE = 'src/core/obd/pids.ts';

/** `/** note *\/` written directly above a key in the `S` object, by key name. */
function keyNotes(source) {
  const block = source.slice(source.indexOf('export const S = {'), source.indexOf('\n};'));
  const notes = new Map();
  const re = /\/\*\*\s*([\s\S]*?)\s*\*\/\s*\n\s*(\w+):/g;
  for (const m of block.matchAll(re)) notes.set(m[2], m[1].replace(/\s*\n\s*\*?\s*/g, ' '));
  return notes;
}

/** Signal key (`EngineSpeed`) → OBD-II Mode 01 PID as hex, from the PIDS table. */
function pidByKey(source) {
  const block = source.slice(source.indexOf('export const PIDS'), source.indexOf('\n];'));
  const map = new Map();
  const re =
    /pid: 0x([0-9a-f]+),[\s\S]*?signals: \[([^\]]*)\]|\w+\(0x([0-9a-f]+), '[^']*', S\.(\w+)\)/g;
  for (const m of block.matchAll(re)) {
    const hex = (m[1] ?? m[3]).toUpperCase().padStart(2, '0');
    const keys = m[2] ? [...m[2].matchAll(/S\.(\w+)/g)].map((k) => k[1]) : [m[4]];
    for (const k of keys) map.set(k, hex);
  }
  return map;
}

// Grouped by the second path segment (Vehicle.<Group>...), in a reading order that suits the cluster.
const GROUP_ORDER = ['Speed', 'Powertrain', 'OBD', 'Chassis', 'Body', 'Cabin', 'ADAS', 'Exterior'];
const groupOf = (id) => {
  const seg = id.split('.')[1] ?? '';
  return GROUP_ORDER.includes(seg) ? seg : 'Other';
};

const fmt = (n) => (Number.isInteger(n) ? String(n) : String(+n.toFixed(2)));
const cell = (s) => String(s).replaceAll('|', '\\|');

function render() {
  const notes = keyNotes(readFileSync(CATALOG, 'utf8'));
  const keyById = new Map(Object.entries(S).map(([k, id]) => [id, k]));
  const pids = pidByKey(readFileSync(PIDS_FILE, 'utf8'));
  const groups = new Map();
  for (const def of SIGNALS.values()) {
    const g = groupOf(def.id);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(def);
  }

  const out = [
    '# Signals',
    '',
    `_Generated from \`${CATALOG}\` by \`npm run docs:signals\`. Don't edit by hand._`,
    '',
    `The cluster knows **${SIGNALS.size} vehicle signals**. IDs follow the dot-path style of the`,
    '[COVESA Vehicle Signal Specification](https://covesa.github.io/vehicle_signal_specification/) (VSS);',
    'where VSS has no matching signal, the ID extends it in the same style. Every value is a number',
    '(booleans 0/1, enums as documented). "Hz" is the rate a healthy source refreshes the signal; the store',
    'marks it stale when updates stop. "OBD" is the standard OBD-II Mode 01 PID that carries the value on a',
    'real car, where one exists; everything else would come from the car\'s own CAN bus. "Key" is the name',
    'used in code (`S.Speed`).',
    '',
    'See [ADR 2](adr/0002-signal-store-vss-ids.md) for why the IDs look like this, and',
    '[ARCHITECTURE](ARCHITECTURE.md) for how a signal travels from the simulator to the display.',
    '',
  ];
  for (const g of [...GROUP_ORDER, 'Other']) {
    const defs = groups.get(g);
    if (!defs) continue;
    out.push(`## ${g === 'Speed' ? 'Vehicle' : g} (${defs.length})`, '');
    out.push(
      '| ID | Key | Unit | Range | Hz | OBD | Notes |',
      '| --- | --- | --- | --- | --- | --- | --- |',
    );
    for (const d of defs) {
      const key = keyById.get(d.id);
      const note = notes.get(key) ?? '';
      const pid = pids.get(key) ?? '';
      const range = d.unit === 'bool' ? '0/1' : `${fmt(d.min)} … ${fmt(d.max)}`;
      out.push(
        `| \`${d.id}\` | ${key} | ${d.unit} | ${range} | ${fmt(d.expectedHz)} | ${pid} | ${cell(note)} |`,
      );
    }
    out.push('');
  }
  return out.join('\n');
}

const text = render();
if (CHECK) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    // missing counts as out of date
  }
  if (current !== text) {
    console.error(`${OUT} is out of date. Run: npm run docs:signals`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
} else {
  writeFileSync(OUT, text);
  console.log(`Wrote ${OUT} (${SIGNALS.size} signals).`);
}
