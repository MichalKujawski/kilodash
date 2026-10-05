# 6. The guided demo plays inside the live simulation, not as a video

**Context.** Visitors need to see the best moments in the first 30 seconds. A recorded video would
look real but prove nothing, and would break the moment they take the wheel.

**Decision.**

- A Director plays chapters as data (`app/director/chapters.ts`). Each chapter has a start place, a
  time of day, weather, timed events and captions.
- It fires those events into the running simulator: switch on cruise, change view, a car passes, the
  car ahead brakes.
- "Take the wheel" hands over the same car, mid-chapter.

**Consequences.**

- Every demo moment is real behaviour and is tested headless.
- The visitor can take over at any time without a jump.
- Timing depends on the simulation, so chapter scripts wait for conditions (a clear lane) rather than
  assuming them.
