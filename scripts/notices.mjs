// Production dependencies → THIRD_PARTY_NOTICES.md (`npm run notices`; `-- --check` fails if out of date).
//
// Only what ships to the browser is listed: the packages in package-lock.json that aren't dev-only. Build
// tools (Vite, TypeScript, Vitest, Playwright…) never reach the visitor. Each package's own license file is
// copied in full, which is what MIT and the SIL Open Font License ask for.
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = 'THIRD_PARTY_NOTICES.md';
const CHECK = process.argv.includes('--check');

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const shipped = Object.entries(lock.packages)
  .filter(([path, p]) => path && !p.dev && !p.devOptional)
  .map(([path, p]) => ({ name: path.replace(/^.*node_modules\//, ''), dir: path, ...p }))
  .sort((a, b) => a.name.localeCompare(b.name));

function licenseText(dir) {
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
  if (!file) throw new Error(`No license file in ${dir}`);
  return readFileSync(join(dir, file), 'utf8').trim();
}

function render() {
  const out = [
    '# Third-party notices',
    '',
    "_Generated from package-lock.json by `npm run notices`. Don't edit by hand._",
    '',
    'Kilodash is MIT licensed (see [LICENSE](LICENSE)). The site ships the open-source packages below;',
    'their licenses follow in full.',
    '',
    '| Package | Version | License | Used for |',
    '| --- | --- | --- | --- |',
  ];
  const usedFor = {
    react: 'UI around the cluster',
    'react-dom': 'UI around the cluster',
    scheduler: 'dependency of react-dom',
    'loose-envify': 'dependency of react',
    'js-tokens': 'dependency of loose-envify',
    '@fontsource/inter': 'Inter typeface (self-hosted)',
    '@fontsource/barlow-semi-condensed': 'Barlow Semi Condensed typeface (self-hosted)',
  };
  for (const p of shipped)
    out.push(`| ${p.name} | ${p.version} | ${p.license} | ${usedFor[p.name] ?? ''} |`);
  out.push(
    '',
    '## Original work in this repository',
    '',
    '- **Telltale and warning symbols** are original drawings made in code (`src/cluster/telltales/icons.ts`).',
    '  They follow the public ISO 2575 symbol conventions, so drivers recognise them; no manufacturer artwork',
    '  is used.',
    '- **Sounds** are synthesized at run time with the Web Audio API (`src/app/audio/`). There are no audio files.',
    '- **The map** is generated procedurally from the simulated route (`src/cluster/nav/`). There are no map',
    '  tiles and no map data provider. Place names are real-sounding German names on a fictional route.',
    '- **All images and videos** in the repository are renders of this project.',
    '',
    '## Developer mode only',
    '',
    'The experimental themes behind `?dev=1` (see [docs/THEMES.md](docs/THEMES.md)) load these fonts from',
    'Google Fonts when chosen, under the SIL Open Font License 1.1: Orbitron, Rajdhani, Nunito,',
    "Libre Baskerville, Share Tech Mono. They aren't bundled or redistributed.",
    '',
    '## License texts',
  );
  for (const p of shipped) {
    if (!existsSync(p.dir)) throw new Error(`${p.dir} missing: run npm ci first`);
    out.push('', `### ${p.name} ${p.version}`, '', '```text', licenseText(p.dir), '```');
  }
  return out.join('\n') + '\n';
}

const text = render();
if (CHECK) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== text) {
    console.error(`${OUT} is out of date. Run: npm run notices`);
    process.exit(1);
  }
  console.log(`${OUT} is up to date.`);
} else {
  writeFileSync(OUT, text);
  console.log(`Wrote ${OUT} (${shipped.length} packages).`);
}
