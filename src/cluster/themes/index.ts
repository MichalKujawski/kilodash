import { arctic } from './arctic';
import { eco } from './eco';
import { heritage } from './heritage';
import { midnight } from './midnight';
import { neonGrid } from './neonGrid';
import { racing } from './racing';
import { retroLcd } from './retroLcd';
import type { Theme } from './types';

export const THEMES: Theme[] = [midnight, neonGrid, racing, heritage, arctic, eco, retroLcd];
export const DEFAULT_THEME = midnight;
export const THEME_BY_ID: ReadonlyMap<string, Theme> = new Map(THEMES.map((t) => [t.id, t]));
export type { Theme } from './types';
