// Verified project numbers → docs/PROJECT_STATS.md (`npm run stats`, add `-- --lighthouse` for Lighthouse).
//
// Every number used in the README, CV text or the site comes from this file, so each one is measured or
// counted from the repository here, never typed in by hand. Counting rules are written next to each count.
import { execSync, spawn } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const LIGHTHOUSE = process.argv.includes('--lighthouse');
const PORT = 4321; // not on the browsers' blocked-port list (4190 is)
const BASE = `http://127.0.0.1:${PORT}`;
const sh = (cmd, opts = {}) =>
  execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const read = (p) => readFileSync(p, 'utf8');
const count = (text, re) => (text.match(re) ?? []).length;
const files = (dir, test = () => true) =>
  readdirSync(dir, { recursive: true })
    .map((f) => join(dir, f))
    .filter((f) => statSync(f).isFile() && test(f));
const lines = (list) => list.reduce((n, f) => n + read(f).split('\n').length, 0);
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

// ---- Code and content counts -------------------------------------------------------------------
function codeCounts() {
  const catalog = read('src/core/signals/catalog.ts');
  const sBlock = catalog.slice(
    catalog.indexOf('export const S = {'),
    catalog.indexOf('\n}', catalog.indexOf('export const S = {')),
  );
  const registry = read('src/cluster/widgets/registry.ts');
  const wBlock = registry.slice(registry.indexOf('new Map('), registry.indexOf('].map'));
  const isTest = (f) => /\.test\.tsx?$/.test(f);
  const src = files('src', (f) => /\.(ts|tsx|css)$/.test(f));
  const behaviour = ['src/core/assist', 'src/core/drive', 'src/core/body'].flatMap((d) =>
    files(d, (f) => f.endsWith('.ts') && !isTest(f)),
  );
  return {
    // Keys of the S object: every vehicle signal ID the cluster knows.
    signals: count(sBlock, /^\s+[A-Za-z0-9]+: '/gm),
    // Exported classes in the behaviour folders (assists, drive, body): the tested state machines.
    behaviourClasses: behaviour.reduce((n, f) => n + count(read(f), /^export class /gm), 0),
    // Entries in TELLTALES.
    telltales: count(read('src/cluster/telltales/definitions.ts'), /\bid: '/g),
    // Entries in the alert rule table.
    alertRules: count(read('src/core/alerts/rules.ts'), /\bid: '/g),
    // Widget types in the registry (named factories + the view widgets).
    widgetTypes:
      count(wBlock, /^\s+[a-zA-Z]+,$/gm) +
      count(read('src/cluster/widgets/ViewWidgets.ts'), /simple\('/g),
    views:
      count(read('src/cluster/layouts/views.ts').match(/export const VIEWS[^;]+;/)[0], /'/g) / 2,
    chapters: count(read('src/app/director/chapters.ts'), /^ {4}id: '/gm),
    // Car profiles, without the developer profile.
    profiles: files('src/profiles', (f) => f.endsWith('.json') && !f.includes('dev-')).length,
    adrs: files('docs/adr', (f) => /\/\d{4}-.*\.md$/.test(f)).length,
    featureDocs: files('docs/features', (f) => f.endsWith('.md')).length,
    loc: {
      'TypeScript (app code)': lines(src.filter((f) => /\.tsx?$/.test(f) && !isTest(f))),
      'TypeScript (unit tests)': lines(src.filter(isTest)),
      'TypeScript (browser tests)': lines(files('e2e', (f) => f.endsWith('.ts'))),
      CSS: lines(src.filter((f) => f.endsWith('.css'))),
      'Scripts (JS)': lines(files('scripts', (f) => f.endsWith('.mjs'))),
      'Docs (Markdown)': lines(files('docs', (f) => f.endsWith('.md'))),
    },
    commits: Number(sh('git rev-list --count HEAD').trim()),
  };
}

// ---- Tests ---------------------------------------------------------------------------------------
function unitTests() {
  sh('npx vitest run --reporter=json --outputFile=test-results/vitest.json', {
    maxBuffer: 64 << 20,
  });
  const r = JSON.parse(read('test-results/vitest.json'));
  return { total: r.numTotalTests, passed: r.numPassedTests, files: r.testResults.length };
}

function browserTests() {
  const env = { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: 'test-results/playwright.json' };
  try {
    sh('npx playwright test --reporter=json', { env, maxBuffer: 64 << 20 });
  } catch {
    /* failures still write the report */
  }
  const r = JSON.parse(read('test-results/playwright.json'));
  return { total: r.stats.expected + r.stats.unexpected + r.stats.flaky, passed: r.stats.expected };
}

// ---- Bundle --------------------------------------------------------------------------------------
function bundle() {
  const html = read('dist/index.html');
  const first = [...html.matchAll(/(?:src|href)="\.?\/?(assets\/[^"]+\.(?:js|css))"/g)].map(
    (m) => m[1],
  );
  const gz = first.reduce(
    (n, f) => n + gzipSync(readFileSync(join('dist', f)), { level: 9 }).length,
    0,
  );
  const fonts = files('dist/assets', (f) => f.endsWith('.woff2'));
  return {
    firstLoadGzipKB: Math.round(gz / 1024),
    fontsKB: Math.round(fonts.reduce((n, f) => n + statSync(f).size, 0) / 1024),
    distMB: (files('dist').reduce((n, f) => n + statSync(f).size, 0) / 1048576).toFixed(1),
  };
}

// ---- Performance in a real browser (production build) -------------------------------------------
async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(BASE)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
}

async function measurePerformance() {
  const browser = await chromium.launch({
    ...(process.env.PW_CHROME === '0' ? {} : { channel: 'chrome' }),
    args: [
      '--ignore-gpu-blocklist',
      '--enable-gpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
    ],
  });
  const firstMove = [];
  for (let i = 0; i < 3; i++) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/?mode=watch&debug`);
    // ms since navigation when the speed reading first shows motion.
    const ms = await page.waitForFunction(
      () => ((window.__oc?.session.store.value('Vehicle.Speed') ?? 0) > 1 ? performance.now() : 0),
      null,
      { polling: 'raf', timeout: 10000 },
    );
    firstMove.push(Math.round(await ms.jsonValue()));
    await page.close();
  }
  // 60 s of the guided demo at 1440×900: average fps and dropped frames (after a 5 s settle).
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/?mode=watch&debug`);
  await page.waitForTimeout(5000);
  const site = page.locator('.site');
  const d0 = Number(await site.getAttribute('data-dropped'));
  const fps = [];
  for (let t = 0; t < 60; t += 5) {
    await page.waitForTimeout(5000);
    fps.push(Number(await site.getAttribute('data-fps')));
  }
  const dropped = Number(await site.getAttribute('data-dropped')) - d0;
  await browser.close();
  return {
    firstMoveMs: median(firstMove),
    firstMoveRuns: firstMove,
    avgFps: (fps.reduce((a, b) => a + b, 0) / fps.length).toFixed(1),
    dropped60s: dropped,
  };
}

function lighthouse() {
  const run = (preset) => {
    const out = 'test-results/lighthouse.json';
    sh(
      `npx -y lighthouse@13.5.0 ${BASE}/ --quiet ${preset === 'desktop' ? '--preset=desktop' : ''} ` +
        `--only-categories=performance,accessibility,best-practices,seo --output=json --output-path=${out} ` +
        `--chrome-flags="--headless=new --ignore-gpu-blocklist --enable-gpu --use-angle=vulkan --enable-features=Vulkan"`,
      { stdio: 'ignore' },
    );
    const r = JSON.parse(read(out));
    return Object.fromEntries(
      Object.entries(r.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
    );
  };
  return { desktop: run('desktop'), mobile: run('mobile') };
}

// ---- Report --------------------------------------------------------------------------------------
function report(c, unit, e2e, b, perf, lh) {
  const commit = sh('git rev-parse --short HEAD').trim();
  const date = new Date().toISOString().slice(0, 10);
  const row = (k, v, how) => `| ${k} | ${v} | ${how} |`;
  const lhRow = (k) =>
    lh
      ? row(
          `Lighthouse ${k}`,
          Object.entries(lh[k])
            .map(([n, s]) => `${n} ${s}`)
            .join(', '),
          `production build, ${k} preset`,
        )
      : '';
  return `# Project stats

_Generated by \`npm run stats\` on ${date} at commit \`${commit}\`. Don't edit by hand: re-run the script._

## Quality

| Measure | Value | How |
| --- | --- | --- |
${row('Unit tests', `${unit.passed} / ${unit.total} passing (${unit.files} files)`, 'Vitest')}
${row('Browser tests', `${e2e.passed} / ${e2e.total} passing`, 'Playwright, production build')}
${row('Coverage', 'not measured', 'no coverage tool installed')}

## Performance (production build, 1440×900, desktop GPU)

| Measure | Value | How |
| --- | --- | --- |
${row('First moving frame', `${perf.firstMoveMs} ms (median of ${perf.firstMoveRuns.join(', ')})`, 'navigation → speed reading > 1 km/h')}
${row('Frame rate', `${perf.avgFps} fps average`, '60 s of the guided demo, sampled every 5 s')}
${row('Dropped frames', `${perf.dropped60s} in 60 s`, 'frames taking longer than 1.5 vsync intervals')}
${row('First load', `${b.firstLoadGzipKB} KB gzip (JS + CSS) + ${b.fontsKB} KB fonts`, 'files referenced by index.html')}
${row('Whole build', `${b.distMB} MB`, 'dist/, including video loops')}
${lhRow('desktop')}
${lhRow('mobile')}

## What's modelled

| Measure | Value | Counted as |
| --- | --- | --- |
${row('Vehicle signals', c.signals, 'signal IDs in the catalog (`S` in `core/signals/catalog.ts`)')}
${row('Behaviour classes', c.behaviourClasses, 'exported classes in `core/assist`, `core/drive`, `core/body`')}
${row('Telltales', c.telltales, 'lamp definitions')}
${row('Alert rules', c.alertRules, 'rules in `core/alerts/rules.ts`')}
${row('Widget types', c.widgetTypes, 'widget factories in the registry')}
${row('Cluster views', c.views, '`VIEWS` in `cluster/layouts/views.ts`')}
${row('Demo chapters', c.chapters, '`CHAPTERS` in `app/director/chapters.ts`')}
${row('Car profiles', c.profiles, 'profile JSON files, without the developer profile')}

## Size

| Measure | Value |
| --- | --- |
${Object.entries(c.loc)
  .map(([k, v]) => `| ${k} | ${v.toLocaleString('en')} lines |`)
  .join('\n')}
${`| Commits | ${c.commits} |`}
${`| ADRs | ${c.adrs} |`}
${`| Feature docs | ${c.featureDocs} |`}
`;
}

const c = codeCounts();
console.log('counted code and docs');
const unit = unitTests();
console.log(`unit tests ${unit.passed}/${unit.total}`);
sh('npm run build');
const b = bundle();
const e2e = browserTests();
console.log(`browser tests ${e2e.passed}/${e2e.total}`);
const server = spawn(
  'npx',
  ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'],
  {
    stdio: 'ignore',
    detached: true,
  },
);
try {
  await waitForServer();
  const perf = await measurePerformance();
  console.log(`first move ${perf.firstMoveMs} ms, ${perf.avgFps} fps, ${perf.dropped60s} dropped`);
  const lh = LIGHTHOUSE ? lighthouse() : null;
  writeFileSync('docs/PROJECT_STATS.md', report(c, unit, e2e, b, perf, lh));
  console.log('wrote docs/PROJECT_STATS.md');
} finally {
  process.kill(-server.pid);
}
if (!existsSync('docs/PROJECT_STATS.md')) process.exit(1);
