# Classic view: cluster shape and layout

## Real-world reference

- **Display:** 12.3" cluster displays are typically 1920×720 at 60 Hz, behind a hood, with a shaped
  visible area.
- **Dials:** scale arcs of about 250°, open at the bottom; the gap carries labels.
- **Centre window:** sits between the dials, which frame it.
- **Fixed lower edge:** outside temperature, time, odometer and warning/information symbols.
- **Fuel gauge:** E…F with quarter marks, and an arrow by the pump icon showing the filler side.
- **Coolant gauge:** heavily damped. Everything from about 75 to 105 °C shows as "normal" in the
  middle, so normal thermostat cycling never worries the driver.

## Implementation (data in `cluster/layouts/classic.ts`)

| Element       | Where                             | Notes                                                                                                                                                                                                                                       |
| ------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Display mask  | `mask`                            | 46 px top arch, tapered sides, chamfered lower corners; 32 px vignette. Dials touch the edge.                                                                                                                                               |
| Dials         | r = 280 at x = 355 / 1565         | 250° open arcs. Speedometer gap: cruise/ACC set speed (green active, grey stored), unit. Tach gap: READY, unit, drive mode. Hub: speed digits / gear with program letter (D, S, M; E arrives with drive modes).                             |
| Centre window | 740 × 572, y 66–638               | Page carousel (map, car, trip, efficiency); fades under the dial rims.                                                                                                                                                                      |
| Top strip     | y = 46                            | Speed-limit sign (always visible while driving) + no-overtaking sign; next-turn mini card when the map page isn't shown; cruise/ACC symbol; lane-assist symbol (grey standby, green active ≥ 60 km/h); indicator arrows near each dial top. |
| Bottom strip  | y = 670, every view               | Outside temperature (+ snowflake ≤ 3 °C), trip A, clock (world time), odometer. Telltales: lights & driver aids left of the clock, vehicle warnings right.                                                                                  |
| Side gauges   | outer lower quadrant of each dial | Fuel 0–100 % linear, quarter ticks, red reserve zone, filler-side arrow. Coolant mapped 50→0, 75–105→0.5, 130→1, red zone above ≈119 °C. Strongly damped needles.                                                                           |

## Thresholds

| What                     | Value                     | Why                                     |
| ------------------------ | ------------------------- | --------------------------------------- |
| Coolant "normal" plateau | 75–105 °C → middle        | How real gauges are damped              |
| Coolant red zone         | ≥ 0.78 of scale (≈119 °C) | Matches the coolant alert threshold     |
| Fuel red zone            | ≤ 10 %                    | Reserve                                 |
| Ice symbol               | ≤ 3 °C                    | Typical ice warning threshold (≈ +4 °C) |
