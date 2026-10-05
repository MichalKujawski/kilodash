# Progress

_Last updated: 2026-10-05_

## Status: complete

Realism v2 and the UX and website phase are finished. The UX brief's acceptance checklist (§14):

| Item                                                                                       | State                                                             |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Owner approved one of three concepts before implementation                                 | ✅ Concept A, with B's spoke buttons and C's wider cluster        |
| Opens in Watch, cockpit moving within ~1.5 s, no control panel                             | ✅ 0.25–0.5 s on the production build                             |
| Header auto-hides in Watch; mode switch updates the URL                                    | ✅                                                                |
| Glow follows drive mode; premium hood presentation                                         | ✅                                                                |
| Chapters play, loop, jump, share via URL; captions never overlap the cluster               | ✅ plus the caption spotlight (§5.4)                              |
| Take the wheel continues from the current world state                                      | ✅ unit and browser tests                                         |
| Drive: ≤ 8 controls at rest, car-like, contextual groups, More controls, coach once        | ✅                                                                |
| Engineer: state machines, signals, events, view model, Workshop, performance; How it works | ✅                                                                |
| Landing sections with Show me and real clips                                               | ✅                                                                |
| Responsive incl. phone portrait/landscape and the old-browser fallback                     | ✅                                                                |
| Highlight, full and LinkedIn videos, loops, README media, OG image                         | ✅ `node scripts/make-media.mjs`                                  |
| Analytics off by default and documented; UX testing kit; video script                      | ✅                                                                |
| Design rubric on every screen; Lighthouse targets                                          | ✅ desktop 99–100; mobile perf 90–97, a11y/best practices/SEO 100 |

Deliberate difference from the brief: the chapter bar has play/pause and next only (no previous or
restart buttons), as in the approved concept; ← goes back.

**Owner to do:** About details and the repository URL in `src/app/site.ts`; after deploying, the live
link in the README and an absolute `og:image` URL; optional analytics via `.env.local`; five test visitors
with `docs/UX_TESTING.md`. CI (`.github/workflows/ci.yml`) publishes to GitHub Pages from `main` once
Pages is set to "GitHub Actions".

## History

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
| 9    | Start-stop, Auto Hold, gear recommendation, shift lights, diesel DPF/exhaust fluid                   | done  |
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

| Step |                                                                                                                                                               | State |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| 0    | Audit, 3 concepts, owner chose A (+ wider cluster, calm chapters, spoke buttons)                                                                              | done  |
| 1    | Shell: header with Watch/Drive/Engineer, stage (light, hood, feathered display, glow by drive mode, reflection), rolling start at midday, larger cluster text | done  |
| 2    | 3D map (tilted, extruded buildings, labels, glowing route)                                                                                                    | done  |
| 3    | Demo Director: 9 chapters (2:36), captions, chapter bar, Space/←/→, `?chapter=`, Take the wheel                                                               | done  |
| 4    | Drive dock (wheel with spoke buttons, stalk, lever, pedals, contextual cruise, "?" overlay, coach marks)                                                      | done  |
| 5    | Engineer mode (6 tabs, live state diagrams, event timeline, How it works sheet)                                                                               | done  |
| 6    | Cinematic intro (≤ 4 s, skippable, first visit only)                                                                                                          | done  |
| 7    | Landing sections (pitch, highlights, live data path, ADRs, about, footer)                                                                                     | done  |
| 8    | Responsive behaviour and fallbacks (laptop, tablet, phone portrait/landscape, old browsers)                                                                   | done  |
| 9    | Recording pipeline, clips, README media, OG images                                                                                                            | done  |
| 10   | Analytics (off by default), privacy, UX testing kit, self-hosted fonts                                                                                        | done  |
| 11   | Final rubric polish, Lighthouse                                                                                                                               | done  |

- `node scripts/site-shots.mjs docs/design/progress name=query@WxH` screenshots the site and reports
  time-to-moving, fps and dropped frames (`@WxH+s` waits s extra seconds). Step screenshots live in
  `docs/design/progress/`.
- Step 3: `src/app/director/` (chapters as data, `Director` plays them in the live world, `WatchPanel`).
  The Demo driver gained `scripted` (no lane changes of its own), `lookAway()` and
  `requestOvertake()`; it waits for a gap before changing lanes. Docs: `docs/features/guided-demo.md`.
  "How it works →" opens Engineer for now; step 5 gives it the explanation sheet.
- Step 4: `src/app/dock/` (feature doc `docs/features/drive-dock.md`). The old ControlPanel is the More
  controls sheet. Fixed: after a key or pointer release, the pedal value stuck at its last ramp value
  (the zero was never sent).
- Fixes after step 4 (owner review):
  - **Touch targets:** each wheel button has an invisible ≥ 44×44 px target (e2e-measured). There are
    two geometry limits at the current wheel size. OK sits between up and down (45×16). RES+/SET− sit
    between buttons 31 px apart (33×45). A bigger rocker or wheel would fix both.
  - **Brake pedal:** redrawn as a rubber pad in a metal bezel.
- The three owner checks, verified and fixed:
  1. **Safety braking and warning stages.** Two fixes:
     - The demo driver had switched cruise back on during Safety; the Director now keeps it off.
     - AEB on a moving car now brakes until our speed matches it (it used to release while still
       closing at 5 km/h).

     The stages are now visibly different: amber pre-warning, pulsing red "Brake!" with the jolt,
     then "Emergency braking", which replaces it at once. After AEB, the driver drops back gently
     (improved-IDM braking limit) instead of braking hard to 24 km/h. Tests: `Director.test.ts`,
     `CollisionAssist.test.ts`.

  2. **Clean handover mid-chapter.** Verified in unit and e2e tests: same place and speed, demo
     driver off, no script state left, and cruise stays as it was.
  3. **Muted autoplay.** Fixed: the first click anywhere unlocked audio at full volume although the
     header showed muted. The e2e test checks that the gain stays 0 until the sound toggle.

- Step 5: `src/app/engineer/` (doc `docs/features/engineer-mode.md`).
  - Captions now open the How it works sheet in Watch, without leaving Watch.
  - First click no longer costs ~40 ms: the audio context is only created once sound is switched on.
  - **Owner to confirm:** the repository URL in `src/app/site.ts` (source links and header) is a guess:
    `github.com/MichalKujawski/kilodash`.

- Step 6: `src/app/shell/intro.ts` (doc `docs/features/intro.md`). `?record=1` already skips it; the
  recording pipeline in step 9 builds on that.
- Step 7: `src/app/landing/` (doc `docs/features/landing.md`), six ADRs in `docs/adr/`, `docs/PRIVACY.md`.
  - **Owner to fill in** `ABOUT` in `src/app/site.ts`: name spelling (Michal / Michał), the bio line,
    LinkedIn and CV links. Empty links are hidden.
- Own car in the lane view: `src/cluster/lanes/egoCar.ts`. A smooth hatchback seen from behind and
  above: contact shadow, wheels, tinted glass with a reflection, a roof highlight and a full-width light
  bar that glows when braking (brake pedal or standstill). It uses the lane camera's projection, so it
  stays in perspective; original artwork. Traffic keeps the simpler shaded boxes, so our car stands out.
- Step 11 (final polish):
  - **Lighthouse** (production build):
    - Desktop: performance 99–100, accessibility 100, best practices 100, SEO 100 (Watch, Drive and
      Engineer).
    - Mobile: accessibility 100, best practices 100, SEO 100; performance 90–97 across runs (median 96)
      after the start-up work below.
  - **Accessibility and SEO fixes:**
    - `--text-3` raised to 4.5:1 contrast.
    - Chapter segments labelled, with 24 px targets.
    - A `<main>` landmark and a `robots.txt`.
    - Space reserved for the captions on portrait screens, so the page no longer shifts (CLS 0).
  - **Speed:**
    - Off-screen UI loads on demand (Engineer, the doc sheet, the Drive dock, More controls, the theme
      editor).
    - The route builds 2× faster: adaptive sub-steps, at most 6.5 mm off the old geometry.
    - The first chapter adopts the already-rolling car instead of rebuilding the world (`Director.adopt`).
    - The cockpit now moves after 0.5–0.7 s on the dev server (was ≈ 1.1 s).
    - Start-up split into short tasks for phones. The renderer is created in its own task after
      React's commit (ClusterView holds it in state). The map's scenery is built in idle time
      (plain ground for a moment). Route sub-steps go up to 0.05 rad, still within 6.2 mm of the original.
      Mobile total blocking time fell from ≈ 500 ms to 40–190 ms.
  - **Design checklist** (1440×900, 1920×1080, phone): passes.
    - Squint test: the cluster dominates; the green "Take the wheel" is the only accent.
    - Controls: ≤ 8 groups in Drive.
    - Alignment fixed: captions now share the chapter bar's columns.
    - One accent colour.
    - Contrast meets AA.
    - No overflow at any tested size.
- Step 10: `src/app/analytics.ts` (doc `docs/features/analytics.md`), `docs/PRIVACY.md`,
  `docs/UX_TESTING.md`, `.env.example`.
  - Fonts are self-hosted now (Google Fonts shared visitors' IPs); a visit contacts no other host.
  - **Measure performance on the production build** (`npm run build && npx vite preview`, `?debug`):
    the cockpit moves after 0.25–0.5 s with 0 dropped frames. The dev server adds React dev overhead
    and an occasional single drop.
  - **Owner:** to switch analytics on, create `.env.local` from `.env.example` (Plausible or Umami).
- Step 9: `?record=1`, `scripts/record-video.mjs` (fake-clock frame stepping → ffmpeg),
  `scripts/make-media.mjs`, `docs/VIDEO_SCRIPT.md`, card loops, README WebP, `public/og.png`, share meta.
  - Recording exposed three chapters that didn't match their captions (Motorway in a busy world, City
    without a red light, Shutdown not switching off); fixed, with tests.
  - **Owner:** once deployed, make `og:image` an absolute URL in `index.html` and add the live link to
    the README. The long videos are in the git-ignored media folder, for uploading.
- Step 8: `src/app/shell/device.ts`, `src/cluster/renderer/compat.ts` (doc `docs/features/responsive.md`).
  Phones have no Drive (Watch + Engineer); portrait screens no longer leave an empty screen under the
  cockpit.

## Known issues / open questions

- Entering Engineer drops about one frame (production build: ~50–90 ms task as React mounts the panel and
  the page lays it out). The canvas is no longer resized on mode changes.

- Rare single dropped frame (about 1 in 30 pose runs). Partly explained in step 9: traffic's
  O(n²) leader search cost 0.4 ms per simulation step in the roadworks queue. It now uses a sorted
  scan (75 µs), and queue poses showed 0 drops in 8 runs. Keep watching the other poses.

- `docs/briefs/` holds only the active brief. The original Phase 1, Milestone 1.5,
  experiences-and-menus and Phase 2 briefs need to be added by the owner.
- The Cockpit Contract (view models + renderer registry + parity test) is not formalised yet. Core
  state machines with plain outputs are the first half of it.
