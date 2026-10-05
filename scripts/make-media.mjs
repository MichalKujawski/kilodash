// Builds every video and image of the showcase from the live demo (see docs/VIDEO_SCRIPT.md).
//
//   node scripts/make-media.mjs [loops] [readme] [og] [highlight] [full] [linkedin]
//
// Small files (card loops, README animation, share image) are committed; the long videos go
// to media/ (git-ignored) for uploading. Needs the dev server (or BASE_URL) and ffmpeg.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { record, stills } from './record-video.mjs';

const only = process.argv.slice(2);
const want = (part) => only.length === 0 || only.includes(part);
const ff = (...args) =>
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });
const TMP = 'media/tmp';
mkdirSync(TMP, { recursive: true });

/** The highlight cut: chapter, in, out (chapter seconds). About 72 s. */
export const HIGHLIGHT = [
  ['startup', 0, 4],
  ['motorway', 7, 25],
  ['safety', 2, 12],
  ['modes', 0, 3],
  ['modes', 10, 15],
  ['city', 13, 25],
  ['night', 0, 5],
  ['parking', 1, 10],
  ['shutdown', 3, 9],
];

/** Landing-card loops: the cluster only, 6 s each. */
const LOOPS = [
  ['motorway', 18, 24],
  ['safety', 5, 11],
  ['modes', 10, 16],
  ['parking', 2, 8],
];

async function cut(name, format, w, h, fps) {
  const parts = [];
  for (const [i, [chapter, from, to]] of HIGHLIGHT.entries()) {
    const out = `${TMP}/${name}-${i}.mp4`;
    await record({ chapter, from, seconds: to - from, fps, w, h, format, fade: 0.25, out });
    parts.push(out);
  }
  writeFileSync(
    `${TMP}/${name}.txt`,
    parts.map((p) => `file '${p.replace(`${TMP}/`, '')}'`).join('\n'),
  );
  ff('-f', 'concat', '-safe', '0', '-i', `${TMP}/${name}.txt`, '-c', 'copy', `media/${name}.mp4`);
}

if (want('loops')) {
  mkdirSync('public/media/loops', { recursive: true });
  for (const [chapter, from, to] of LOOPS) {
    const src = `${TMP}/loop-${chapter}.mp4`;
    await record({
      chapter,
      from,
      seconds: to - from,
      fps: 30,
      w: 1920,
      h: 1080,
      format: '169',
      crop: 'screen',
      scale: '960x360',
      out: src,
    });
    // Small enough for a card: no audio, modest quality, web-optimised.
    ff(
      '-i',
      src,
      '-c:v',
      'libx264',
      '-crf',
      '26',
      '-preset',
      'slow',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      `public/media/loops/${chapter}.mp4`,
    );
    ff(
      '-i',
      src,
      '-c:v',
      'libvpx-vp9',
      '-crf',
      '38',
      '-b:v',
      '0',
      '-row-mt',
      '1',
      '-an',
      `public/media/loops/${chapter}.webm`,
    );
  }
}

if (want('readme')) {
  mkdirSync('docs/media', { recursive: true });
  const src = `${TMP}/readme.mp4`;
  await record({
    chapter: 'motorway',
    from: 16,
    seconds: 9,
    fps: 20,
    w: 1920,
    h: 1080,
    format: '169',
    crop: 'screen',
    scale: '960x360',
    out: src,
  });
  ff('-i', src, '-c:v', 'libwebp', '-q:v', '60', '-loop', '0', '-an', 'docs/media/highlight.webp');
}

if (want('og')) {
  await stills({ chapter: 'motorway', times: [6], out: TMP });
  // 1920×1008 is 1.905:1 like 1200×630.
  ff(
    '-i',
    `${TMP}/motorway-0006.png`,
    '-vf',
    'crop=1920:1008:0:30,scale=1200:630:flags=lanczos',
    'public/og.png',
  );
}

if (want('highlight')) await cut('highlight', '169', 1920, 1080, 60);
if (want('linkedin')) await cut('linkedin', '45', 1080, 1350, 30);
if (want('full')) {
  const total = 156;
  await record({
    chapter: 'startup',
    from: 0,
    seconds: total,
    fps: 30,
    w: 1920,
    h: 1080,
    format: '169',
    out: 'media/full.mp4',
  });
}

rmSync(TMP, { recursive: true, force: true });
