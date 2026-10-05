import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ACTIONS, keyHint, type Action } from './actions';

describe('docs/CONTROLS.md', () => {
  // Table cells are padded by the formatter: compare with runs of spaces collapsed.
  const doc = readFileSync('docs/CONTROLS.md', 'utf8').replace(/ +/g, ' ');

  it('lists every action with its key', () => {
    for (const a of Object.keys(ACTIONS) as Action[])
      expect(doc, a).toContain(`| \`${keyHint(a)}\` | ${ACTIONS[a].label} |`);
  });
});
