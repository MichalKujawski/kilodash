import { lazy } from 'react';

/*
 * Everything not on the first screen loads on demand, so a phone has less script to
 * run before the cockpit moves. The simulator and the renderer stay in the main bundle.
 */
export const EngineerPanel = lazy(() =>
  import('./engineer/EngineerPanel').then((m) => ({ default: m.EngineerPanel })),
);
export const HowItWorks = lazy(() =>
  import('./engineer/HowItWorks').then((m) => ({ default: m.HowItWorks })),
);
export const DriveDock = lazy(() =>
  import('./dock/DriveDock').then((m) => ({ default: m.DriveDock })),
);
export const ControlPanel = lazy(() =>
  import('./controls/ControlPanel').then((m) => ({ default: m.ControlPanel })),
);
export const ThemeEditor = lazy(() =>
  import('./ThemeEditor').then((m) => ({ default: m.ThemeEditor })),
);
