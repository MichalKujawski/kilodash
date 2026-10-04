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
| 1    | World simulator + demo drive + route map/nav (scenarios removed)                                     | done  |
| 2    | Control panel (wheel, stalks, light switch, console, pedals, Workshop drawer)                        | done  |
| 3    | Cluster shape: open dials, top strip, fixed bottom strip, grouped telltales, real fuel/coolant logic | done  |
| 4    | Drive modes (Eco coasting, Sport, Individual, Snow/Off-road, EV power meter/regen)                   | done  |
| 5    | ACC, cruise, limiter                                                                                 | done  |
| 6    | Speed-limit recognition / ISA                                                                        | done  |
| 7    | Lane keeping/centering, hands-off staging, Driver Assistance view                                    | next  |
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
- The 2022 AWD family SUV became the default car in step 4.

## Notes from step 2

- Controls: `app/controls/` (keymap, ControlBus semantics, keyboard + gamepad, on-screen panel).
  Docs: `docs/features/controls.md`.
- Buttons whose systems come later (ACC, lane assist, start-stop, Auto Hold, park assist, drive modes,
  views) keep their state now. (Drive modes and the assist pad became live in steps 4 and 5.)
- World controls (time, weather, road, temperature, Demo drive, jumps) are in `app/WorldPanel.tsx`.
  The Workshop drawer has faults, vehicle profile, hands-on-wheel and a data inspector.

## Notes from step 3

- Classic view shape: open-bottom dials with mode/unit/status rows in the gap, a top strip (limit,
  next turn, cruise, lane assist, mode) and a fixed bottom strip (temperature, trip, clock, odometer,
  grouped telltales). Fuel and coolant are side gauges with real damping (75–105 °C reads "normal").
  Docs: `docs/features/cluster-layout.md`.

## Notes from step 4

- `src/core/drive/`: mode table, selection state machine, coasting rule, cylinder deactivation,
  comfort consumers, eco tips. Docs: `docs/features/drive-modes.md`.
- New default car: `profiles/family-suv-2022.json` (1.5 L turbo with cylinder deactivation, 7-speed
  dual-clutch, AWD, adaptive dampers). Unit tests that need sports-car numbers pin the coupé
  explicitly.
- The engine model became torque-based (pedal → torque request; boost only above the NA torque
  level). Cruise consumption is now realistic: about 5.5 L/h at 100 km/h for the SUV, previously
  about 10.
- EV: power meter instead of the tachometer, regen levels 0–3 on the paddles, B on the selector.
  Hybrids get the power meter and an EV indicator.
- New review poses: `eco`, `sport`, `modes` (list held open), `offroad`. `?car=<profile id>` picks a
  car (e.g. `?car=ev-2023`).
- ACC "gentle/dynamic" settings and the step-9 shift lights are carried as mode data but not yet used.

## Notes from step 5

- `core/assist/SpeedAssist.ts`: one state machine for ACC (stop & go, take-over), plain cruise and
  the limiter. It outputs pedals that `SimulatorSource.applyAssist` merges with the driver's. The
  old built-in cruise code in `vehicle.ts` is gone. Docs: `docs/features/speed-assist.md`.
- `core/assist/PedalController.ts` is the acceleration → pedal controller, now shared by the Demo
  driver and the assists.
- The Demo drive uses ACC on the Autobahn (about 260 s per loop) and adjusts the set speed for
  limits.
- Equipment flag `acc` per profile; the 2016 estate and 2008 hatchback have plain cruise.
- New poses: `acc` (following the queue at the roadworks), `limiter` (50 in town).

## Notes from step 6

- `core/assist/SpeedLimitRecognition.ts`: camera + map fusion (`SpeedLimitRecognition`) and the ISA
  warning cascade (`IsaWarning`). The cluster now draws the recognised limit from signals, not
  `scene.legal`. Docs: `docs/features/speed-limits.md`.
- `Route.mapLegalAt` is the "map database" (no temporary signs).
- The tunnel's 100 sign is deliberately unreadable, so the demo shows one realistic recognition miss.
  The recognition seed is chosen so the town at the start reads cleanly.
- Fixed: the town-exit limit now applies from the sign, not from the next segment.
- New poses: `isa` (56 in a 50, red ring), `rain` (130 with the "when wet" plate). New jump place:
  `wetLimit`.

## Known issues / open questions

- `docs/briefs/` holds only the active brief. The original Phase 1, Milestone 1.5,
  experiences-and-menus and Phase 2 briefs need to be added by the owner.
- The Cockpit Contract (view models + renderer registry + parity test) is not formalised yet. Core
  state machines with plain outputs are the first half of it.
