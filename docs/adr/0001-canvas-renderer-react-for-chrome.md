# 1. Canvas renders the cluster; React only draws the page around it

**Context.** A cluster redraws needles, lamps and the map 60 times a second. Vehicle data changes at
up to 100 Hz. React re-rendering at that rate would cost frames.

**Decision.**

- One Canvas 2D renderer (`cluster/renderer/ClusterRenderer.ts`) reads the latest values from the
  `SignalStore` in its own `requestAnimationFrame` loop.
- Static parts (dial faces, ticks) are cached and redrawn only when the theme or layout changes.
- React draws the page chrome only (header, captions, controls), polling the store at 4–8 Hz.

**Consequences.**

- 60 fps at 1920×720 with about 2–3 ms CPU per frame.
- Widgets are plain classes with `draw()`, easy to read and to profile one by one.
- The page and the cluster never block each other; the cost is two ways of drawing UI.
