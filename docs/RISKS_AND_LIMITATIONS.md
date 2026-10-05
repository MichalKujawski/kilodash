# Risks and limitations

What Kilodash is not, what it simplifies, and what hasn't been tested. Written so a reviewer doesn't
have to find these out alone.

## Not automotive software

- **No functional safety process.** Real cluster software is developed under ISO 26262 with hazard
  analysis, safety goals and independent review. None of that applies here.
- **Not real time.** A browser can pause JavaScript (garbage collection, a busy tab, a hidden tab). A real
  cluster runs on an RTOS or a hypervisor partition with a guaranteed frame and a safety monitor that
  checks the critical telltales are actually drawn. Kilodash has no such monitor.
- **No real vehicle connection.** All data comes from the simulator. An OBD-II (ELM327) client was
  prototyped and set aside; it isn't part of this release.
- **Not tested with drivers.** The HMI follows public conventions ([HMI_AND_SAFETY](HMI_AND_SAFETY.md)),
  but there was no glance-time study or driving-simulator test.

## Simulation simplifications

| Area            | Simplification                                                                                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Physics         | Longitudinal dynamics with a friction limit; the car follows the road's curvature within a grip circle instead of a full tyre model. No crash physics (a last-resort clamp stops the car short of the one ahead). |
| Sensors         | The radar sees only the car in our lane. The camera reads each sign with a fixed probability. No sensor noise model beyond that.                                                                                  |
| Adaptive cruise | Not predictive: it doesn't slow for bends or adopt new limits on its own (the demo driver sets the speed).                                                                                                        |
| Drive modes     | Steering, damper and sound settings are stored and shown but have no physical effect.                                                                                                                             |
| Faults          | Workshop faults are switches that light lamps and show messages. Only the ABS fault changes behaviour.                                                                                                            |
| Traffic         | Other cars follow the Intelligent Driver Model and simple keep-right lane changes. No pedestrians or cyclists.                                                                                                    |
| World           | One fictional route with real-sounding German place names. German limits only (the table supports more countries).                                                                                                |

Each feature doc lists its own assumptions under **Assumptions** ([features](features/)).

## Product gaps

- **No deep settings menu.** The steering-wheel Home, up and down keys work only in the drive-mode list
  and the Individual mode screen. The settings a car would keep in a menu (collision warning, speed
  warning and its tolerance, service) are in the Workshop drawer in Engineer mode. See [MENU_SYSTEM](MENU_SYSTEM.md).
- **English only on the site.** Cluster messages also exist in Polish (`core/i18n/pl.ts`), but there is no
  language switch.
- **Experimental themes** (behind `?dev=1`) are an unpolished experiment and load fonts from Google Fonts
  when chosen. The public site uses only Midnight.
- **Screen readers** get the cluster as one labelled image plus the live caption text in Watch mode. The
  individual readings on the canvas aren't exposed to assistive technology.

## Performance and compatibility

- **Measured, not guaranteed.** On the development machine: 60 fps with 1 dropped frame in 60 s, and a
  Lighthouse mobile performance score of 90 ([PROJECT_STATS](PROJECT_STATS.md)). Slower devices drop
  more; `?lowpower=1` turns off bloom, glass and blur.
- **Safari and real phones** haven't been tested by hand. WebKit runs only in CI. See
  [COMPATIBILITY](COMPATIBILITY.md).

## Data and privacy

- Settings and the trip computer are stored only in the visitor's browser. Analytics are off unless the
  site owner configures them. See [PRIVACY](PRIVACY.md).

## Legal

- Not affiliated with any vehicle manufacturer. No manufacturer designs, artwork, logos or trademarked
  feature names are used; functions have generic names ("Adaptive cruise control", "Lane centering").
  See [DISCLAIMER](../DISCLAIMER.md) and [THIRD_PARTY_NOTICES](../THIRD_PARTY_NOTICES.md).
