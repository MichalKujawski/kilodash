# 4. A deterministic simulator with a fixed 100 Hz step

**Context.** Screenshots, tests and the guided demo must show the same thing every time. Frame-rate
dependent physics would make tests flaky and the demo drift.

**Decision.**

- Physics and world advance in fixed 10 ms steps, decoupled from rendering. The renderer smooths
  between samples (short prediction and spring-damped needles).
- Traffic, weather and scenery come from a seeded generator.
- Tests can fast-forward the simulation instantly.

**Consequences.**

- Every chapter of the guided demo is reproducible and tested headless (for example, in the Safety
  chapter emergency braking must match the slower car's speed without coming closer than 2 m).
- Screenshot poses are pixel-stable.
- The cost: anything random must go through the seed.
