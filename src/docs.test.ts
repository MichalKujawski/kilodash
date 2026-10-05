import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Every Markdown file a reader of the repository sees: the root, docs/ and .github/. */
function markdownFiles(): string[] {
  const root = readdirSync('.').filter((f) => f.endsWith('.md'));
  const nested = ['docs', '.github'].flatMap((dir) =>
    readdirSync(dir, { recursive: true })
      .map((f) => join(dir, String(f)))
      .filter((f) => f.endsWith('.md') && statSync(f).isFile()),
  );
  return [...root, ...nested];
}

/** Relative link targets in a Markdown file, outside code blocks and code spans. */
function relativeLinks(md: string): string[] {
  const prose = md.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  return [...prose.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1]!)
    .filter((href) => !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#'));
}

describe('documentation links', () => {
  it('every relative link in the docs points at a file that exists', () => {
    const broken: string[] = [];
    for (const file of markdownFiles())
      for (const href of relativeLinks(readFileSync(file, 'utf8'))) {
        const target = join(dirname(file), decodeURIComponent(href.split('#')[0]!));
        if (!existsSync(target)) broken.push(`${file}: ${href}`);
      }
    expect(broken).toEqual([]);
  });
});
