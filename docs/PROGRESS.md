# Progress

_Last updated: 2026-10-04_

## Current work

**Realism v2** (`docs/briefs/realism-v2.md`), approved with these decisions:

- Default car: new **2022 AWD family SUV** (dual-clutch, adaptive dampers, start-stop, cylinder
  deactivation). The other profiles stay.
- Map generated around the world route (replaces the procedural grid city).
- Lane view and rear camera in Canvas 2D, behind a scene interface so a Three.js renderer can replace
  them.
- German speed-limit defaults.
- Commit per step; small steps may be batched.

| Step |                                                                                                      | State |
| ---- | ---------------------------------------------------------------------------------------------------- | ----- |
| 0    | CLAUDE.md, PROGRESS.md, WALKTHROUGH.md                                                               | done  |
| 1    | World simulator + demo drive + route map/nav (scenarios removed)                                     | next  |
| 2    | Control panel (wheel, stalks, light switch, console, pedals, Workshop drawer)                        |       |
| 3    | Cluster shape: open dials, top strip, fixed bottom strip, grouped telltales, real fuel/coolant logic |       |
| 4    | Drive modes (Eco coasting, Sport, Individual, Snow/Off-road, EV power meter/regen)                   |       |
| 5    | ACC, cruise, limiter                                                                                 |       |
| 6    | Speed-limit recognition / ISA                                                                        |       |
| 7    | Lane keeping/centering, hands-off staging, Driver Assistance view                                    |       |
| 8    | Collision warning/AEB, blind spot, rear cross traffic                                                |       |
| 9    | Start-stop, Auto Hold, gear recommendation, shift lights, diesel DPF/AdBlue                          |       |
| 10   | Warnings catalogue, seatbelt escalation, TPMS, service                                               |       |
| 11   | Fatigue, parking sensors + camera, auto high beam, lights/body/wipers                                |       |
| 12   | Views (Classic, Navigation, Reduced, Driver Assistance, Sport, Auto view)                            |       |

## Done earlier

- **M1:** skeleton (signal store, physics simulator, spring needles, data-driven layout).
- **M1.5:** visual realism for Midnight Classic. The checklist passes, at 60 fps with 0 dropped frames
  on the GPU.
- **M2:** powertrains (ICE/EV/hybrid), faults/DTCs, telltales + self-test, alert engine, chimes,
  start-up/shut-down.
- **M3:** theme system (experimental themes behind `?dev=1`).
- **Parked on `wip/elm327-scan`:** ELM327 client, emulator, capability detection, OBDb signalsets.

## Notes from step 1

- The world is one deterministic ~21 km route (`core/world/template.ts`). The Demo drive takes about
  21 minutes per loop. "Jump to" places exist for demos and screenshots.
- The steering wheel isn't simulated. The car follows the road, and an indicator held on a
  multi-lane road becomes a lane change.
- The 2022 AWD family SUV profile is still to come (with drive modes, step 4). The default is still
  the sports coupé.

## Notes from step 2

- Controls: `app/controls/` (keymap, ControlBus semantics, keyboard + gamepad, on-screen panel).
  Docs: `docs/features/controls.md`.
- Buttons whose systems come later (ACC, lane assist, start-stop, Auto Hold, park assist, drive modes,
  views) keep their state now. The assist pad drives plain cruise control until step 5.
- World controls (time, weather, road, temperature, Demo drive, jumps) are in `app/WorldPanel.tsx`.
  The Workshop drawer has faults, vehicle profile, hands-on-wheel and a data inspector.

## Known issues / open questions

- `docs/briefs/` holds only the active brief. The original Phase 1, Milestone 1.5,
  experiences-and-menus and Phase 2 briefs need to be added by the owner.
- The Cockpit Contract (view models + renderer registry + parity test) is not formalised yet. Core
  state machines with plain outputs are the first half of it.
