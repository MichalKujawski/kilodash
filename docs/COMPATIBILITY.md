# Compatibility

## Supported browsers

The build targets Vite's "baseline widely available" set: **Chrome and Edge 111+, Firefox 114+, Safari
and iOS Safari 16.4+**. The site needs Canvas 2D, `ResizeObserver` and CSS container queries. Where a
browser lacks the canvas or `ResizeObserver`, the page shows a one-line note instead of the cockpit
([responsive](features/responsive.md)). `roundRect` and `requestIdleCallback` have fallbacks.

## What was tested where

| Browser / device            | How                                                                    | Result                     | Date       |
| --------------------------- | ---------------------------------------------------------------------- | -------------------------- | ---------- |
| Chrome (desktop, Linux)     | Playwright browser tests on the production build                       | 16 / 16 pass               | 2026-10-05 |
| Firefox (desktop, Linux)    | Playwright browser tests on the production build                       | 16 / 16 pass               | 2026-10-05 |
| WebKit (Safari's engine)    | Playwright in CI on Ubuntu (can't run on the dev machine)              | runs on the first CI push  | –          |
| Chrome, phone size          | Playwright with an emulated phone viewport                             | pass                       | 2026-10-05 |
| Chrome, mobile emulation    | Lighthouse mobile preset (4× CPU slowdown, slow 4G)                    | performance 90, others 100 | 2026-10-05 |
| Chrome (desktop), GPU       | `scripts/screenshots.mjs` and `npm run stats`: 60 s of the guided demo | 60 fps, 1 dropped frame    | 2026-10-05 |
| Real iPhone (Safari)        | –                                                                      | **not tested yet**         | –          |
| Real Android phone (Chrome) | –                                                                      | **not tested yet**         | –          |
| Safari on macOS             | –                                                                      | **not tested yet**         | –          |

Real-device checks are an owner step before launch.

## Input

| Input          | Supported                                                                               |
| -------------- | --------------------------------------------------------------------------------------- |
| Mouse          | Everything                                                                              |
| Touch          | Watch and Engineer everywhere; Drive on tablets (phones get Watch, as Drive needs room) |
| Keyboard       | Everything; every control has a key ([CONTROLS](CONTROLS.md))                           |
| Gamepad        | Standard mapping (Chrome, Edge, Firefox)                                                |
| Screen reader  | Page chrome, captions (live region) and controls; the cluster is one labelled image     |
| Reduced motion | Respected: no intro animation, no spotlight, no autoplaying loops                       |

## Performance on slower devices

`?lowpower=1` turns off bloom, glass and blur, the most expensive passes. The site doesn't switch to it on
its own.
