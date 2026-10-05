import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, sourcePaths } from './markdown';

describe('feature-doc Markdown', () => {
  it('parses headings, paragraphs, nested lists, tables and code', () => {
    const md = [
      '# Title',
      '',
      'Some **bold** text',
      'continues here.',
      '',
      '- one',
      '  - one.a',
      '    wrapped',
      '- two',
      '',
      '| A | B |',
      '| - | - |',
      '| 1 | 2 |',
      '',
      '```mermaid',
      'stateDiagram-v2',
      '```',
    ].join('\n');
    const b = parseMarkdown(md);
    expect(b.map((x) => x.type)).toEqual(['h', 'p', 'list', 'table', 'code']);
    expect(b[1]).toEqual({ type: 'p', text: 'Some **bold** text continues here.' });
    const list = b[2] as Extract<(typeof b)[number], { type: 'list' }>;
    expect(list.items.map((i) => i.text)).toEqual(['one', 'two']);
    expect(list.items[0]!.children[0]!.text).toBe('one.a wrapped');
    expect(b[3]).toEqual({ type: 'table', head: ['A', 'B'], rows: [['1', '2']] });
    expect(b[4]).toEqual({ type: 'code', lang: 'mermaid', text: 'stateDiagram-v2' });
  });

  it('splits inline bold, code and links', () => {
    expect(parseInline('a **b** `c` [d](e)')).toEqual([
      { t: 'text', v: 'a ' },
      { t: 'bold', v: 'b' },
      { t: 'text', v: ' ' },
      { t: 'code', v: 'c' },
      { t: 'text', v: ' ' },
      { t: 'link', v: 'd', href: 'e' },
    ]);
  });

  it('finds the source files a doc mentions', () => {
    expect(
      sourcePaths(
        'See `core/assist/LaneAssist.ts`, `cluster/lanes/`, `src/app/App.tsx` and `step`.',
      ),
    ).toEqual(['src/core/assist/LaneAssist.ts', 'src/cluster/lanes/', 'src/app/App.tsx']);
  });
});
