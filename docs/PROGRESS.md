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

| Step | | State |
|---|---|---|
| 0 | CLAUDE.md, PROGRESS.md, WALKTHROUGH.md | done |
| 1 | World simulator + demo drive + route map/nav (scenarios removed) | next |
| 2 | Control panel (wheel, stalks, light switch, console, pedals, Workshop drawer) | |
| 3 | Cluster shape: open dials, top strip, fixed bottom strip, grouped telltales, real fuel/coolant logic | |
| 4 | Drive modes (Eco coasting, Sport, Individual, Snow/Off-road, EV power meter/regen) | |
| 5 | ACC, cruise, limiter | |
| 6 | Speed-limit recognition / ISA | |
| 7 | Lane keeping/centering, hands-off staging, Driver Assistance view | |
| 8 | Collision warning/AEB, blind spot, rear cross traffic | |
| 9 | Start-stop, Auto Hold, gear recommendation, shift lights, diesel DPF/AdBlue | |
| 10 | Warnings catalogue, seatbelt escalation, TPMS, service | |
| 11 | Fatigue, parking sensors + camera, auto high beam, lights/body/wipers | |
| 12 | Views (Classic, Navigation, Reduced, Driver Assistance, Sport, Auto view) | |

## Done earlier

- **M1:** skeleton (signal store, physics simulator, spring needles, data-driven layout).
- **M1.5:** visual realism for Midnight Classic. The checklist passes, at 60 fps with 0 dropped frames
  on the GPU.
- **M2:** powertrains (ICE/EV/hybrid), faults/DTCs, telltales + self-test, alert engine, chimes,
  start-up/shut-down.
- **M3:** theme system (experimental themes behind `?dev=1`).
- **Parked on `wip/elm327-scan`:** ELM327 client, emulator, capability detection, OBDb signalsets.

## Known issues / open questions

- `docs/briefs/` holds only the active brief. The original Phase 1, Milestone 1.5,
  experiences-and-menus and Phase 2 briefs need to be added by the owner.
- The Cockpit Contract (view models + renderer registry + parity test) is not formalised yet. Core
  state machines with plain outputs are the first half of it.
