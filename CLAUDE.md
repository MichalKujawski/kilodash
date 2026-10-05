# Twindial: standing instructions

**Read `docs/PROGRESS.md` first.** It says where the work is and what comes next.

## Goal

A portfolio project for getting a job. It needs a live demo that, within 10 seconds, looks and behaves
like a real premium car's digital instrument cluster. One experience only (**Midnight**), perfected:
every feature a real modern cluster has, behaving the way real cars behave. The owner must be able to
explain the code in an interview.

Priorities: **realism and polish > feature completeness > breadth.** Something small and perfect beats
something big and rough.

## Scope

- **No hardware work.** The ELM327 client and emulator are parked on branch `wip/elm327-scan`. No Python
  bridge.
- **The simulator may provide every signal a real car could.** Ignore CAN availability limits.
- **One experience: Midnight.** The other themes and the theme editor exist only behind `?dev=1`, labelled
  experimental. Don't improve them.
- **Country defaults: Germany.** 50 km/h in towns, 30 zones, 100 on rural roads, no general limit on
  Autobahn/dual carriageways (130 advisory). Keep limits in a per-country table.
- **Never copy** a manufacturer's design, icon artwork, menu wording, logos or trademarked feature names.
  Use generic names ("Adaptive cruise control", "Lane centering").
- Active spec: `docs/briefs/realism-v2.md` (real car behaviour, drive modes, assists, controls, views).

## Architecture rules

- **High-frequency vehicle data never goes through React.** The canvas renderer reads the `SignalStore`
  every frame; React polls at a few Hz for the UI chrome.
- **Behaviour lives in `src/core`** as small, unit-tested state machines (ACC, lane assist, start-stop…).
  They output plain state that the cluster only draws. Widgets contain no car logic.
- **Scalar vehicle data goes through `SignalStore`** (VSS-style IDs, timestamped, quality-tracked).
  Structured data (traffic objects, lane lines, navigation, signs) goes through the scene snapshot.
- **Themes and layouts are data** (tokens/JSON). Telltale colours and positions are safety-fixed and never
  themed.
- The simulator is deterministic and seeded. Physics constants and thresholds get a short "why"
  comment.
- Keep functions small and clearly named. No clever abstractions.

## Quality bar and process

- **Tests with every feature:** unit tests for logic and state machines, screenshots for visuals.
- **After every visual change:** run `npm run dev`, then `node scripts/screenshots.mjs <dir>` (GPU, fixed
  poses). Look at the images, critique them against the realism rules, iterate.
- **Locked 60 fps at 1920×720.** The screenshot script reports fps and dropped frames, which must be 0.
- **Before committing:** `npm run lint && npm run typecheck && npm test && npm run build && npx playwright test`.
- **Commits:** small, Conventional Commits, one feature per commit where possible. `main` stays
  deployable. End messages with the Co-Authored-By line.
- **When real-car behaviour is uncertain,** pick what mainstream modern cars do and document the
  assumption in `docs/features/<feature>.md`.
- **Every feature gets `docs/features/<feature>.md`:** real behaviour, how it's simulated, a Mermaid
  state diagram, thresholds, and where it appears.
- **No new visible buttons on the control panel.** Any new control goes into the collapsible
  "More controls" drawer.
- **Every finished feature gets an entry in `docs/SHOWCASE_MOMENTS.md`:** feature name, how it would
  be shown in a guided demo (what happens in the world, what appears on the cluster), a one-line
  caption for visitors, and roughly how many seconds it needs.
- **Ask the owner** before large refactors, heavy dependencies, or changes to the public site's
  structure.
- **End of every task/session:** update `docs/PROGRESS.md` and `docs/WALKTHROUGH.md` if the
  architecture changed.

## Commands

```bash
npm run dev                        # http://localhost:5173  (?kiosk=1 ?pose=… ?dev=1 ?profile=1 ?lowpower=1)
npm test                           # Vitest
npx playwright test                # browser smoke test
node scripts/screenshots.mjs dir   # deterministic poses + fps (needs the dev server)
```
