import { describe, expect, it } from 'vitest';
import { consoleAction, cruiseLit } from './context';

describe('Drive dock context', () => {
  it('lights the cruise buttons on fast roads at speed', () => {
    expect(cruiseLit('motorway', 110, false)).toBe(true);
    expect(cruiseLit('rural', 80, false)).toBe(true);
    expect(cruiseLit('motorway', 12, false)).toBe(false); // jam
    expect(cruiseLit('urban', 50, false)).toBe(false);
  });

  it('keeps them lit while cruise is on, so it can be switched off anywhere', () => {
    expect(cruiseLit('urban', 40, true)).toBe(true);
  });

  it('offers the start button when the engine is off', () => {
    expect(consoleAction(false)).toBe('start');
    expect(consoleAction(true)).toBe('driveMode');
  });
});
