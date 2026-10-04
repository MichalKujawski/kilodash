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
| 7    | Lane keeping/centering, hands-off staging, Driver Assistance view                                    | done  |
| 8    | Collision warning/AEB, blind spot, rear cross traffic                                                | done  |
| 9    | Start-stop, Auto Hold, gear recommendation, shift lights, diesel DPF/AdBlue                          | done  |
| 10   | Warnings catalogue, seatbelt escalation, TPMS, service                                               | done  |
| 11   | Fatigue, parking sensors + camera, auto high beam, lights/body/wipers                                | done  |
| 12   | Views (Classic, Navigation, Reduced, Driver Assistance, Sport, Auto view)                            | done  |

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

## Notes from step 7

- The world now has lateral motion (`World.stepLateral`). Driver and lane assist steer through a
  lateral acceleration passed to `World.step`.
- `core/assist/LaneAssist.ts`: lane keeping, centering (with ACC), hands-off staging up to the
  emergency stop. The driver steering model is `driverSteer`. Docs:
  `docs/features/lane-assist.md`.
- The lane view is `cluster/lanes/`: a plain view model plus `Canvas2DLaneRenderer` behind the
  `LaneSceneRenderer` interface, so Three.js can replace it. For now it is the "assist" carousel
  page; the full Driver Assistance _view_ (its own layout) comes with step 12.
- Workshop: "Distracted driver" toggle.
- New poses: `lanes`, `departure`, `handsoff`. The screenshot script presses → for them to show the
  assist page.

## Notes from step 8

- `core/assist/CollisionAssist.ts`: FCW/AEB stages (distance → pre-warning → acute jolt → partial and
  full braking → hold), blind spot, rear cross traffic. Docs: `docs/features/collision-assist.md`.
- The distracted Demo driver glances at the road 0.6 s every 2.5 s, so warnings happen for real.
- A car crosses the car-park aisle as we reverse out of the bay, which triggers RCTA in every loop.
- `SimulatorSource.paused` freezes the simulation while the cluster keeps drawing. Review poses of
  short events use it (`departure`, `blindspot`, `aeb`).
- Workshop: "Collision warning", "Sensor blocked".

## Notes from step 9

- `core/drive/StartStop.ts` (start-stop, Auto Hold, gear advice, shift lights) and
  `core/drive/Diesel.ts` (glow time, particulate filter, exhaust fluid). Docs:
  `docs/features/powertrain-helpers.md`.
- The vehicle got `autoStop()` / `autoRestart()` (0.35 s restart), glow-before-crank and
  `startBlocked`.
- The diesel exhaust fluid uses the generic name everywhere (the brand name is a trademark).
- Fixed: `ClusterSession.fastForward` rounded small durations to zero steps. It now runs exactly
  the time asked for.
- New poses: `autostop`, `advice`, `shiftlights`, `diesel` (with `?car=estate-2016`, set
  automatically by the screenshot script).

## Notes from step 10

- Alert engine: P2 warnings return 5 min after OK, same-priority messages take turns, and a
  waiting-messages indicator sits in the bottom strip. New "Vehicle messages" carousel page. Docs:
  `docs/features/warnings.md`.
- `core/body/monitors.ts`: seat-belt reminder (EU-style), indirect TPMS, service interval.
- 12 new Workshop faults, plus occupant controls and service buttons. Direct TPMS shows tyre
  temperatures; the 2016 estate has indirect TPMS ("Store tyre pressures").
- The right telltale group now holds 16 lamps at 32 px spacing; the odometer moved to x = 1690.
- Info popups are white (neutral). Colour is kept for warnings and dangers.
- New poses: `belts`, `door`, `service`, `messages`.

## Notes from steps 11–12

- Step 11: `core/body/ParkAssist.ts`, `core/body/lights.ts` (auto high beam, fatigue), park view
  with rear camera. Docs: `docs/features/parking-lights-fatigue.md`.
- Step 12: the views in `cluster/layouts/views.ts` and the View button. Docs:
  `docs/features/views.md`.
- All twelve Realism v2 steps are done.

## UX and website phase (`docs/briefs/` → UX prompt; design in `docs/design/`)

| Step | | State |
| --- | --- | --- |
| 0 | Audit, 3 concepts, owner chose A (+ wider cluster, calm chapters, spoke buttons) | done |
| 1 | Shell: header with Watch/Drive/Engineer, stage (light, hood, feathered display, glow by drive mode, reflection), rolling start at midday, larger cluster text | done |
| 2 | 3D map (tilted, extruded buildings, labels, glowing route) | done |
| 3 | Demo Director: 9 chapters (2:36), captions, chapter bar, Space/←/→, `?chapter=`, Take the wheel | done |
| 4 | Drive dock (wheel with spoke buttons, stalk, lever, pedals, contextual cruise) | next |
| 5 | Engineer mode | |
| 6–11 | Intro, landing sections, responsive, recording, analytics, polish | |

- `node scripts/site-shots.mjs docs/design/progress name=query@WxH` screenshots the site and reports
  time-to-moving, fps and dropped frames (`@WxH+s` waits s extra seconds). Step screenshots live in
  `docs/design/progress/`.
- Step 3: `src/app/director/` (chapters as data, `Director` plays them in the live world, `WatchPanel`).
  The Demo driver gained `scripted` (no lane changes of its own), `lookAway()` and
  `requestOvertake()`; it waits for a gap before changing lanes. Docs: `docs/features/guided-demo.md`.
  "How it works →" opens Engineer for now; step 5 gives it the explanation sheet.

## Known issues / open questions

- **Later (owner):** a nicer 3D-looking model of our own car in the lane view; the current one is boxy.

- Rare single dropped frame (about 1 in 30 pose runs). Partly explained in step 9: traffic's
  O(n²) leader search cost 0.4 ms per simulation step in the roadworks queue. It now uses a sorted
  scan (75 µs), and queue poses showed 0 drops in 8 runs. Keep watching the other poses.

- `docs/briefs/` holds only the active brief. The original Phase 1, Milestone 1.5,
  experiences-and-menus and Phase 2 briefs need to be added by the owner.
- The Cockpit Contract (view models + renderer registry + parity test) is not formalised yet. Core
  state machines with plain outputs are the first half of it.
