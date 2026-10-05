# How this project was built

Kilodash was built spec-first, with an AI coding assistant doing much of the typing and me deciding
what to build, how it should behave and whether it was good enough. This folder keeps the paper trail.

## The workflow

1. **Spec before code.** Each phase started with a written brief: what real cars do, which behaviour
   to model and the quality bar. Behaviour was researched from how mainstream cars work and from public
   regulations (for example the EU General Safety Regulation), then written down in my own words.
2. **Small steps with a check after each.** Every step had to pass lint, typecheck, unit tests, a
   production build and browser tests before it was committed. Behaviour lives in small state machines,
   so each rule has a test that reads like the rule ("emergency braking on a slower car ends at its
   speed").
3. **Looking at the result.** After every visual change, fixed-pose screenshots were rendered and
   reviewed against a written checklist. Frame rate and dropped frames were measured, not guessed.
4. **Decisions written down.** Engineering decisions are in [ADRs](../adr/). Each feature has a doc
   with the real behaviour, how it's simulated, its thresholds and a state diagram ([features](../features/)).

## What's here

| File or folder                               | What it is                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------- |
| [`PROGRESS.md`](PROGRESS.md)                 | The build log: every step, what was decided, what was found and fixed         |
| [`briefs/`](briefs/)                         | The behaviour spec                                                            |
| [`design/`](design/)                         | The design story: the site before, three concepts, the chosen one, the result |
| [`SHOWCASE_MOMENTS.md`](SHOWCASE_MOMENTS.md) | Each feature as a demo moment (what happens, the caption, how long it takes)  |
| [`RELEASE_AUDIT.md`](RELEASE_AUDIT.md)       | The audit before publishing: repository, IP, licences, quality                |

[`/CLAUDE.md`](../../CLAUDE.md) holds the standing rules the assistant worked under (scope, architecture,
quality bar), and is the best summary of how I wanted the code written.
