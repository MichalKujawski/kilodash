# Changelog

All notable changes to Kilodash. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [semantic versioning](https://semver.org/).

## [1.0.0] - unreleased

The first public release: a digital instrument cluster that behaves like a modern car's, in the browser.

### The cluster

- Midnight design at 1920×720 with a shaped display, bloom, glass and night dimming.
- Six views: Classic, Navigation, Reduced, Driver assistance, Sport, and Auto view, which follows the
  drive mode.
- Classic view with two dials, side gauges for fuel and coolant, a top and bottom strip, 31 telltales in
  fixed positions, and seven centre pages: map, driver assistance, vehicle status, trip, efficiency,
  off-road and vehicle messages.
- A tilted 3D navigation map, built from the simulated route.
- A lane view with lane lines, traffic, the car adaptive cruise is following, blind-spot zones and a
  detailed model of our own car.
- Start-up and shut-down: needle sweep, lamp check and a trip summary.

### Car behaviour

- Adaptive cruise control with stop & go, cruise control and a speed limiter.
- Lane keeping and lane centering, with staged hands-off warnings ending in a stop in lane.
- Forward collision warning and emergency braking with distinct warning stages, blind-spot monitoring
  and rear cross-traffic alert.
- Speed-limit recognition from camera and map, with supplementary plates, and a speed warning (ISA).
- Drive modes (Eco, Comfort, Normal, Sport, Individual, Snow, Off-road), Eco coasting, cylinder
  deactivation, hill descent control.
- Electric and hybrid cars: power meter, regeneration levels, one-pedal driving.
- Engine start-stop with reasons, Auto Hold, gear advice, shift lights, and diesel glow plugs,
  particulate filter and exhaust fluid.
- 48 warnings with priorities, repeat and turn-taking; seat-belt reminder; direct and indirect tyre
  monitoring; service interval.
- Park assist with a rear camera, auto high beam and fatigue warning.

### Simulation

- A deterministic, seeded simulator stepping at 100 Hz, with six car profiles (petrol, diesel, hybrid
  and electric; manual, automatic and dual-clutch).
- A ~21 km route through town, country roads, a tunnel and the Autobahn, with German speed limits,
  traffic lights, weather and time of day.
- Traffic using the Intelligent Driver Model with keep-right lane changes, and a demo driver.
- 146 vehicle signals with VSS-style IDs in a quality-tracked signal store, and OBD-II PID codecs.

### The website

- Watch: a guided drive in nine chapters with captions and a spotlight, each chapter linkable.
- Drive: a control dock with an indicator stalk, steering-wheel buttons, selector and pedals, by mouse,
  touch, keyboard or gamepad.
- Engineer: live signals, state diagrams, an event timeline, the view model, a Workshop for faults and
  settings, and performance figures, plus a "How it works" sheet for every feature.
- First-visit intro, a landing page, layouts for laptops, tablets and phones, and a fallback note for
  browsers that can't run the cluster.
- Optional cookieless analytics (off by default) and self-hosted fonts.
- A deterministic video recording pipeline for the videos, card loops and share image.

### Project

- Unit tests (Vitest) and browser tests (Playwright) in Chromium, Firefox and WebKit; CI with GitHub
  Pages deployment.
- `npm run stats` measures every number used in the README.
- Docs: architecture, six decision records, a page per feature, HMI and safety, menu system, controls,
  signals, risks and limitations, compatibility, and a demo script.

[1.0.0]: https://github.com/MichalKujawski/kilodash/releases/tag/v1.0.0
