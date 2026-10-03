import { describe, expect, it } from 'vitest';
import { midnight } from '@/cluster/themes/midnight';
import { alphaOf, getPath, setPath, toHex, withHex } from './themeStore';

describe('theme editor helpers', () => {
  it('converts colours to hex for colour inputs', () => {
    expect(toHex('#FF3326')).toBe('#ff3326');
    expect(toHex('#abc')).toBe('#aabbcc');
    expect(toHex('rgba(240, 243, 247, 0.94)')).toBe('#f0f3f7');
  });

  it('keeps alpha when a new hex colour is picked', () => {
    expect(alphaOf('rgba(1,2,3,0.5)')).toBe(0.5);
    expect(withHex('rgba(1,2,3,0.5)', '#ff0000')).toBe('rgba(255, 0, 0, 0.5)');
    expect(withHex('#123456', '#ff0000')).toBe('#ff0000');
  });

  it('reads and immutably writes nested paths', () => {
    expect(getPath(midnight, 'dial.needle.color')).toBe('#ff3326');
    const next = setPath(midnight, 'dial.needle.color', '#00ff00');
    expect(next.dial.needle.color).toBe('#00ff00');
    expect(midnight.dial.needle.color).toBe('#ff3326');
  });
});
