# Feature inventory

Everything Kilodash does, where its logic lives, how it's tested and where it's documented. Logic paths
are under `src/`. Counts come from [PROJECT_STATS](PROJECT_STATS.md).

## Driver assistance

| Feature                                                                 | Logic                                          | Tests                           | Doc                                                            |
| ----------------------------------------------------------------------- | ---------------------------------------------- | ------------------------------- | -------------------------------------------------------------- |
| Cruise control, adaptive cruise, stop & go                              | `core/assist/SpeedAssist.ts`                   | `SpeedAssist.test.ts`           | [speed assist](features/speed-assist.md)                       |
| Speed limiter                                                           | `core/assist/SpeedAssist.ts`                   | `SpeedAssist.test.ts`           | [speed assist](features/speed-assist.md)                       |
| Lane keeping, lane centering, hands-off staging, emergency stop in lane | `core/assist/LaneAssist.ts`                    | `LaneAssist.test.ts`            | [lane assist](features/lane-assist.md)                         |
| Forward collision warning, emergency braking, brake assist              | `core/assist/CollisionAssist.ts`               | `CollisionAssist.test.ts`       | [collision assist](features/collision-assist.md)               |
| Blind-spot monitoring, rear cross-traffic alert                         | `core/assist/CollisionAssist.ts`               | `CollisionAssist.test.ts`       | [collision assist](features/collision-assist.md)               |
| Speed-limit recognition (camera + map), supplementary plates            | `core/assist/SpeedLimitRecognition.ts`         | `SpeedLimitRecognition.test.ts` | [speed limits](features/speed-limits.md)                       |
| Speed warning (ISA), tolerance                                          | `core/assist/SpeedLimitRecognition.ts`         | `SpeedLimitRecognition.test.ts` | [speed limits](features/speed-limits.md)                       |
| Park assist with rear camera                                            | `core/body/ParkAssist.ts`                      | `body.test.ts`                  | [parking, lights, fatigue](features/parking-lights-fatigue.md) |
| Auto high beam                                                          | `core/body/lights.ts`                          | `body.test.ts`                  | [parking, lights, fatigue](features/parking-lights-fatigue.md) |
| Fatigue warning                                                         | `core/body/lights.ts`                          | `body.test.ts`                  | [parking, lights, fatigue](features/parking-lights-fatigue.md) |
| Hill descent control                                                    | `core/datasource/simulator/SimulatorSource.ts` | `drive.sim.test.ts`             | [drive modes](features/drive-modes.md)                         |

## Powertrain and drive

| Feature                                                               | Logic                                           | Tests                                           | Doc                                                  |
| --------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------- |
| Drive modes (Eco, Comfort, Normal, Sport, Individual, Snow, Off-road) | `core/drive/DriveModeController.ts`, `modes.ts` | `drive.test.ts`, `drive.sim.test.ts`            | [drive modes](features/drive-modes.md)               |
| Eco coasting, cylinder deactivation                                   | `core/drive/`, `simulator/powertrain.ts`        | `drive.test.ts`, `drive.sim.test.ts`            | [drive modes](features/drive-modes.md)               |
| EV and hybrid: power meter, regeneration levels, one-pedal B          | `core/datasource/simulator/powertrain.ts`       | `drive.sim.test.ts`, `vehicle.test.ts`          | [drive modes](features/drive-modes.md)               |
| Engine start-stop with reasons                                        | `core/drive/StartStop.ts`                       | `stopstart.test.ts`                             | [powertrain helpers](features/powertrain-helpers.md) |
| Auto Hold                                                             | `core/drive/StartStop.ts`                       | `stopstart.test.ts`                             | [powertrain helpers](features/powertrain-helpers.md) |
| Gear advice, shift lights                                             | `core/drive/StartStop.ts`                       | `stopstart.test.ts`                             | [powertrain helpers](features/powertrain-helpers.md) |
| Diesel: glow plugs, particulate filter, exhaust fluid                 | `core/drive/Diesel.ts`                          | `stopstart.test.ts`                             | [powertrain helpers](features/powertrain-helpers.md) |
| Efficiency tips and comfort consumers                                 | `core/drive/efficiency.ts`                      | `drive.test.ts`                                 | [drive modes](features/drive-modes.md)               |
| Trip computer, consumption, range                                     | `core/derived/`                                 | `derived.test.ts`, `ConsumptionHistory.test.ts` | [warnings](features/warnings.md)                     |

## Body, warnings and messages

| Feature                                                        | Logic                                  | Tests                                       | Doc                                  |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------- | ------------------------------------ |
| Warning catalogue with priorities, repeat and turns (48 rules) | `core/alerts/`                         | `AlertEngine.test.ts`, `conditions.test.ts` | [warnings](features/warnings.md)     |
| Seat-belt reminder (front and rear)                            | `core/body/monitors.ts`                | `monitors.test.ts`                          | [warnings](features/warnings.md)     |
| Tyre pressure monitoring (direct and indirect)                 | `core/body/monitors.ts`                | `monitors.test.ts`                          | [warnings](features/warnings.md)     |
| Service interval                                               | `core/body/monitors.ts`                | `monitors.test.ts`                          | [warnings](features/warnings.md)     |
| Lights, indicators, wipers, gearbox interlock, keyless start   | `core/datasource/simulator/vehicle.ts` | `vehicle.test.ts`, `ControlBus.test.ts`     | [car controls](features/controls.md) |

## The cluster

| Feature                                                                      | Logic                                            | Tests                          | Doc                                            |
| ---------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------ | ---------------------------------------------- |
| Classic layout: dials, side gauges, strips, telltales (31)                   | `cluster/layouts/classic.ts`, `cluster/widgets/` | `resolve.test.ts`, screenshots | [cluster layout](features/cluster-layout.md)   |
| Six views and Auto view                                                      | `cluster/layouts/views.ts`                       | `views.test.ts`                | [views](features/views.md)                     |
| Centre pages: map, assistance, vehicle, trip, efficiency, off-road, messages | `cluster/widgets/center/`                        | `views.test.ts`                | [menu system](MENU_SYSTEM.md)                  |
| 3D navigation map with procedural scenery                                    | `cluster/nav/`                                   | screenshots                    | [world simulator](features/world-simulator.md) |
| Lane view with traffic and our car                                           | `cluster/lanes/`                                 | screenshots                    | [lane assist](features/lane-assist.md)         |
| Start-up and shut-down: needle sweep, lamp check, trip summary               | `cluster/renderer/startup.ts`                    | `startup.test.ts`              | [intro](features/intro.md)                     |
| Needle physics (spring–damper)                                               | `core/smoothing/spring.ts`                       | `spring.test.ts`               | [WALKTHROUGH](WALKTHROUGH.md)                  |
| Night dimming, low-power mode                                                | `cluster/renderer/ClusterRenderer.ts`            | screenshots, e2e               | [ARCHITECTURE](ARCHITECTURE.md)                |
| Themes as data (Midnight; experiments behind `?dev=1`)                       | `cluster/themes/`                                | `themes.test.ts`               | [THEMES](THEMES.md)                            |

## Simulation

| Feature                                                                       | Logic                        | Tests                                                   | Doc                                            |
| ----------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------- | ---------------------------------------------- |
| Vehicle physics at 100 Hz, deterministic                                      | `core/datasource/simulator/` | `vehicle.test.ts`                                       | [ADR 4](adr/0004-deterministic-simulator.md)   |
| Six car profiles (petrol, diesel, hybrid, EV; manual, automatic, dual-clutch) | `profiles/*.json`            | `vehicle.test.ts`                                       | [ARCHITECTURE](ARCHITECTURE.md)                |
| Route, German limits, traffic lights, weather, time of day                    | `core/world/`                | `route.test.ts`, `environment.test.ts`, `world.test.ts` | [world simulator](features/world-simulator.md) |
| Traffic (Intelligent Driver Model, keep-right lane changes)                   | `core/world/traffic.ts`      | `world.test.ts`                                         | [world simulator](features/world-simulator.md) |
| Demo driver                                                                   | `core/world/DemoDriver.ts`   | `demo.drive.test.ts`                                    | [world simulator](features/world-simulator.md) |
| Signal store: quality, rate, interpolation (146 signals)                      | `core/signals/`              | `store.test.ts`                                         | [SIGNALS](SIGNALS.md)                          |
| OBD-II PID encoding and decoding                                              | `core/obd/`                  | `obd.test.ts`                                           | [SIGNALS](SIGNALS.md)                          |

## The website

| Feature                                                                           | Logic                        | Tests                                        | Doc                                        |
| --------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | ------------------------------------------ |
| Watch: guided demo in nine chapters, captions, spotlight                          | `app/director/`              | `Director.test.ts`, `chapters.test.ts`, e2e  | [guided demo](features/guided-demo.md)     |
| Drive: dock with stalk, wheel, selector, pedals                                   | `app/dock/`, `app/controls/` | `context.test.ts`, `ControlBus.test.ts`, e2e | [drive dock](features/drive-dock.md)       |
| Engineer: signals, live state diagrams, events, view model, Workshop, performance | `app/engineer/`              | `engineer.test.ts`, `markdown.test.ts`, e2e  | [engineer mode](features/engineer-mode.md) |
| Intro and first visit                                                             | `app/shell/intro.ts`         | `intro.test.ts`, `e2e/intro.spec.ts`         | [intro](features/intro.md)                 |
| Landing sections                                                                  | `app/landing/`               | e2e                                          | [landing](features/landing.md)             |
| Phones, tablets, laptops                                                          | `app/shell/device.ts`        | e2e                                          | [responsive](features/responsive.md)       |
| Sound (synthesized)                                                               | `app/audio/`                 | –                                            | [warnings](features/warnings.md)           |
| Optional cookieless analytics                                                     | `app/analytics.ts`           | `analytics.test.ts`                          | [analytics](features/analytics.md)         |
| Deterministic video recording                                                     | `scripts/record-video.mjs`   | e2e (`?record`)                              | [recording](features/recording.md)         |
