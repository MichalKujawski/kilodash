// Deterministic video capture of the guided demo (needs the dev server or a preview build).
//
//   node scripts/record-video.mjs --chapter motorway --from 2 --seconds 8 --out media/x.mp4
//     [--fps 60] [--size 1920x1080] [--format 169|45] [--crop x,y,w,h] [--scale 960x360]
//
// Playwright's fake clock drives requestAnimationFrame, timers and performance.now, so
// the app advances exactly one frame between screenshots: every run gives the same video,
// however slow the capture is. Frames are piped straight into ffmpeg (MP4, WebM or
// animated WebP, chosen by the file extension).
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';

export function parseArgs(argv) {
  const a = {
    chapter: 'startup',
    from: 0,
    seconds: 5,
    fps: 60,
    size: '1920x1080',
    format: '169',
    fade: 0,
  };
  for (let i = 0; i < argv.length; i += 2) a[argv[i].replace(/^--/, '')] = argv[i + 1];
  const [w, h] = a.size.split('x').map(Number);
  return {
    ...a,
    from: Number(a.from),
    seconds: Number(a.seconds),
    fps: Number(a.fps),
    fade: Number(a.fade),
    w,
    h,
  };
}

function encoder(out, fps, scale, fade, seconds) {
  const filters = [];
  if (scale) filters.push(`scale=${scale.replace('x', ':')}:flags=lanczos`);
  // Dip to black at both ends, so cut segments join smoothly.
  if (fade) filters.push(`fade=t=in:st=0:d=${fade}`, `fade=t=out:st=${seconds - fade}:d=${fade}`);
  const vf = filters.length ? ['-vf', filters.join(',')] : [];
  const codec = out.endsWith('.webm')
    ? ['-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-pix_fmt', 'yuv420p']
    : out.endsWith('.webp')
      ? ['-c:v', 'libwebp', '-lossless', '0', '-q:v', '70', '-loop', '0', '-an']
      : [
          '-c:v',
          'libx264',
          '-preset',
          'slow',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
        ];
  const args = [
    '-y',
    '-loglevel',
    'error',
    '-f',
    'image2pipe',
    '-framerate',
    String(fps),
    '-i',
    '-',
    ...vf,
    ...codec,
    out,
  ];
  return spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
}

/** Opens the demo at a chapter on paused fake time (nothing in the app runs on real time). */
async function openChapter({ chapter, w, h, format }) {
  const browser = await chromium.launch({
    channel: 'chrome',
    args: [
      '--ignore-gpu-blocklist',
      '--enable-gpu',
      '--use-angle=vulkan',
      '--enable-features=Vulkan',
    ],
  });
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(`${BASE}/?record=1&format=${format}&chapter=${chapter}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForSelector('canvas.cluster-canvas');
  // The page-load start-up sweep plays first; then restart the chapter cleanly.
  await page.clock.runFor(3600);
  await page.evaluate((c) => window.__oc.director()?.goto(c), chapter);
  await page.clock.runFor(150);
  return { browser, page };
}

/** `--crop screen` = the cluster display only; otherwise "x,y,w,h". */
async function clipFor(page, crop) {
  if (!crop) return undefined;
  if (crop === 'screen') {
    const b = await page.locator('.screen').boundingBox();
    // Even sizes (video codecs need them).
    return {
      x: Math.round(b.x),
      y: Math.round(b.y),
      width: Math.round(b.width / 2) * 2,
      height: Math.round(b.height / 2) * 2,
    };
  }
  const [x, y, width, height] = crop.split(',').map(Number);
  return { x, y, width, height };
}

/** Single frames at chapter times (seconds), for choosing cuts and for posters. */
export async function stills({ chapter, times, w = 1920, h = 1080, format = '169', crop, out }) {
  mkdirSync(out, { recursive: true });
  const { browser, page } = await openChapter({ chapter, w, h, format });
  const clip = await clipFor(page, crop);
  let t = 0;
  for (const at of times) {
    await page.clock.runFor(Math.round((at - t) * 1000));
    t = at;
    await page.screenshot({ path: `${out}/${chapter}-${String(at).padStart(4, '0')}.png`, clip });
  }
  await browser.close();
}

export async function record(opts) {
  const { from, seconds, fps, crop, scale, fade, out } = opts;
  mkdirSync(dirname(out), { recursive: true });
  const { browser, page } = await openChapter(opts);
  const frameMs = 1000 / fps;
  await page.clock.runFor(from * 1000);
  const clip = await clipFor(page, crop);
  const ff = encoder(out, fps, scale, fade, seconds);
  const done = new Promise((resolve, reject) =>
    ff.on('close', (c) => (c === 0 ? resolve() : reject(new Error(`ffmpeg ${c}`)))),
  );
  const frames = Math.round(seconds * fps);
  const t0 = Date.now();
  let carried = 0;
  for (let i = 0; i < frames; i++) {
    // Whole milliseconds per step, carrying the remainder so 60 fps stays exact on average.
    carried += frameMs;
    const step = Math.floor(carried);
    carried -= step;
    await page.clock.runFor(step);
    const jpg = await page.screenshot({ type: 'jpeg', quality: 92, clip });
    if (!ff.stdin.write(jpg)) await new Promise((r) => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await browser.close();
  console.log(`${out}: ${frames} frames in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const o = parseArgs(process.argv.slice(2));
  if (!o.out) throw new Error('--out is required');
  await record(o);
}
