# Prompt: Realism v2 — Real Car Behavior, Drive Modes, Assist Systems, Controls, and Cluster Shape

> Condensed copy of the owner's brief (wording shortened, requirements unchanged).

> Based on research of real digital clusters, owner's manuals and manufacturer documentation (mainly VW Group, plus Hyundai/Kia, BMW, Ford, Renault, and the EU General Safety Regulation). Every behavior below describes how real cars do it. Where cars differ, the brief picks one mainstream behavior; document the choice. Never copy a brand's design, icon artwork, menu wording or trademarked feature names.
>
> Decisions taken with the owner (2026-10-04): default car = new 2022 AWD family SUV; map generated around the world route; lane view/camera in Canvas 2D behind a swappable scene renderer; **German** speed-limit defaults; commit per step.

## 0. What was wrong (from the screenshot review)
1. The "Scenario" row must be deleted; replace with the World simulator (§2) and the real car control panel (§3).
2. The control panel was a grid of web pills; real controls are a steering wheel, stalks, gear selector, drive-mode button, light switch, pedals.
3. Dials were complete circles, very large; real scale arcs are open at the bottom (≈240–260°), the gap carries labels.
4. Empty black bands above/below the dials; floating status rows.
5. No fixed bottom strip (outside temperature, time, odometer, warning/information symbols).
6. Telltales almost absent; at highway speed a real cluster shows several (low beam, ACC, lane assist, auto high beam…).
7. No ACC, set-speed marker, lane view, speed-limit sign, or drive-mode effects.
8. Centre content is just a map; no visible page structure.
9. Fuel/coolant icons, end labels and normal-zone logic must follow real gauges (coolant centred at normal temperature).

## 1. Cluster shape and layout (Classic view)
- 12.3" at 1920×720, 60 Hz. The View button switches between driving layouts.
- Display mask: wider top curve, slightly tapered lower corners, content reaching the mask edges, no empty bands.
- Dials ≈560–600 px; arc ≈250° open at the bottom; the gap holds unit, drive-mode label, gearbox mode/READY, and (speedometer) ACC/limiter set speed. Dial centres move outward so the centre window is ≈760–820 px wide.
- Centre window: full height between top and bottom strips; page carousel (map, assist/lane view, trip, vehicle, media, phone, consumption…).
- Top strip: turn indicators near each dial top, nav next-turn mini card when the nav page isn't shown, speed-limit sign (always visible), ACC/limiter status, lane-assist status, drive-mode badge.
- Fixed bottom strip (every view): outside temperature (+ ice), clock, odometer, trip-A, telltale row grouped: left = lights & driver aids, right = vehicle warnings.
- Side gauges: fuel E…F with ¼ ticks, pump icon with arrow to filler side, low zone red; coolant C…H (50…130 °C), needle centred over the whole normal range (≈75–105 °C maps to mid, damped like real gauges), red zone at top.
- Gear indicator in the tach centre (P R N D + gear, S, M + gear, E in eco gearbox mode).

## 2. World simulator (replaces scenarios)
- Looping route: urban (50), residential/30 zone, rural (100 DE), dual carriageway, Autobahn (no general limit, 130 advisory; signed sections). Curves, gradients, junctions with traffic lights, roundabouts, tunnels, fuel/charging stop, parking area at the end.
- Signs: limits, end-of-limit, end of all restrictions, no-overtaking and end, supplementary plates ("when wet", time ranges), town entry/exit (implicit 50), motorway start/end. Some hidden or temporary (roadworks) so recognition can be imperfect.
- Traffic: vehicles in lanes with own speeds; a lead vehicle that brakes, slows, changes lanes, queues; overtakers (blind spot); a parked-car obstacle (parking sensors); occasional slow vehicle that triggers distance/collision warnings if the driver doesn't react.
- Environment controls (website): time of day (or real time), weather (clear/rain/snow/fog), outside temperature, road surface (dry/wet/icy) → night mode, auto headlights, wipers, ice warning, "when wet" limits, reduced traction.
- Demo drive: follows the route, obeys limits with small deviations, indicates at turns and lane changes, uses ACC on fast roads, stops at red lights, parks at the end, restarts. The user can take over any time; demo resumes after inactivity.
- Navigation uses the same route: turn-by-turn, distances, lane guidance, ETA, street names.

## 3. Real car control panel (website)
Every control has a keyboard shortcut (on hover), works with touch and gamepad.
- Wheel left (cluster): scroll wheel (up/down, press = OK, long press), left/right, View, Menu/Back, Home.
- Wheel right (assist): ACC on/off, SET−, RES+, distance, cancel; lane assist on/off; voice/phone; volume roller.
- Left stalk: indicators with comfort blink (tap = 3 flashes, latched = continuous), high beam latched/flash, auto high beam.
- Right stalk: wipers off/auto/interval/slow/fast/single, washer.
- Light switch: off/auto/parking/low beam, fog lights.
- Console: gear selector (P R N D/S, M with paddles), drive-mode button, hazard, start-stop disable, ESC (short = TCS off, long = ESC sport), Auto Hold, park-sensor button, engine start/stop (with brake).
- Pedals as vertical sliders + W/S with analog ramp.
- Workshop drawer (collapsed): fault injection, vehicle profile, data inspector, sensor dirt/blockage, forced warnings.

## 4. Drive modes
Eco, Comfort, Normal, Sport, Individual; Snow and Off-road on 4×4. Modes change throttle map, shift points, A/C, steering, dampers; on EVs torque, top speed, regen.
- Eco: dull throttle, early upshifts, **coasting** on dual-clutch/auto (clutch opens, engine idles, gear display "E", gear number disappears, revs drop to idle; any pedal re-engages; never with ACC/cruise). Cylinder deactivation symbol distinct from coasting (revs unchanged).
- Sport: sharp throttle, "S" gearbox holds gears/eager downshifts, no coasting, heavier steering, firm dampers, shift lights.
- Individual: per-subsystem Eco/Normal/Sport; no coasting; configuration parked-only; persisted per driver.
- Normal default; resets to Normal at ignition (setting "Remember last mode", off).
- Off-road (≤≈30 km/h): more slip, Hill Descent Control, page with compass, altitude, steering angle, oil/coolant temp; HDC auto-off above ~30 km/h with message.
- Snow: gentle throttle, early upshifts, pull away in 2nd.

| Parameter | Eco | Comfort | Normal | Sport | Snow | Off-road |
|---|---|---|---|---|---|---|
| Throttle map | progressive/soft | linear-soft | linear | aggressive early | very soft | soft, fine low-end |
| Gearbox | early up, "E" | normal | normal | "S": high shift points, blips | early up, 2nd start | short gears held |
| Coasting | on (not with ACC/cruise) | off | off | off | off | off |
| Steering | light | light | medium | heavy | medium | light |
| Dampers | normal | soft | normal | firm | normal | normal |
| A/C | eco | normal | normal | normal | normal | normal |
| ACC dynamics | gentle | gentle | normal | dynamic | gentle, larger gap | n/a > 30 km/h |
| Engine sound | quiet | quiet | normal | loud | normal | normal |
| ESC | normal | normal | normal | normal | low-grip | more slip, HDC |
| Accent | green | neutral | neutral | red | ice-blue | amber |
| Auto view | Classic + efficiency | Classic | Classic | Sport view | Classic | Off-road page |

Cluster: mode button opens a selection popup (scroll, auto-confirm ≈2 s or OK); accent transition; badge; gear letter D→E/S; coasting hint; cylinder-deactivation hint; eco tips page with top convenience consumers; Individual screen (parked only). EV: Eco caps power/top speed, regen levels D0–D3 via paddles and B mode; power meter CHARGE/ECO/POWER replaces tach; SoC/range replace fuel. Hybrid: power meter + engine on/off + "EV mode available".

## 5. Gearbox, engine, efficiency
- Gear display P R N D S + number, M + gear; "E" in eco gearbox. Paddle tap in D gives temporary manual mode returning to D after steady driving.
- Gear recommendation arrows (manual cars / M), suppressed in Sport. Shift lights fill toward redline, flash at the shift point.
- Start-stop: stops when stationary with brake held if conditions met (tach to 0, green auto-stop indicator). Blocking reasons (engine not warm, battery low, climate demand, steep gradient, large steering angle, door/belt/hood, driver intervention) show crossed/grey indicator + reason on vehicle page (not faults; real fault = separate yellow message). Re-enabled at every ignition; button disables for the trip. "Engine start required" if driver must restart.
- Auto Hold: holds at standstill without pedal; green indicator.
- Oil temperature on a page. Diesel: glow plug, DPF "keep driving" message, AdBlue range warnings (≈2 400 km yellow, later red, no restart at 0 — approximate). Fuel: low-fuel telltale + chime at reserve (≈7 L), repeated; refuel resets "since refuel".

## 6. Driver assistance (simulated with the world)
6.1 ACC/cruise/limiter: off → standby (grey, dashes) → active (green, set speed) → overridden (accelerator: white) → interrupted (brake/cancel: grey, speed stored). Set-speed marker on the speedometer (green active, grey interrupted). 4–5 distance bars, lead-vehicle symbol moving with real distance, flashes when the lead drives off in stop&go. Takeover request: red flashing + sound. SET−/RES+: short ±1 km/h, long to next multiple of 10. Distance default per mode. Stop&go hold; resume after a few seconds needs RES or throttle. Optional predictive (limits, curves). Plain cruise and speed limiter (limiter flashes + chime if exceeded downhill).
6.2 Lane keeping/centering: lane view; lines grey (not detected) / white (detected) / green (assisting) / amber flashing (departure + correction). Lane keeping above ≈60 km/h; centering with ACC at all ACC speeds. Hands-off staging: message + white wheel → red wheel + chime → brake jolt + louder chime → cancel (optional emergency stop assist). Assisted driving icon when ACC + centering active.
6.3 FCW/AEB: distance warning (≈60–210 km/h); advance warning (≈30–210 km/h, chime + red symbol, brakes prepared); acute warning brake jolt (+ cluster shake); staged automatic braking; at ≈5–30 km/h may brake without warning. On at every ignition; off only in settings; status indicator; sensor blocked → yellow message. Workshop "distracted driver" toggle.
6.4 Blind spot: amber indicator; flashes + chime when indicating toward an occupied lane. Rear cross traffic when reversing out of parking.
6.5 Speed limits / ISA (EU 2019/2144, all new cars since 7 July 2024): limit always visible; warning = flashing sign then short acoustic; on at every start; driver can switch off (deep Assist menu) and see status; optional +0…+10 km/h offset. Additional signs (no overtaking, when wet, end of limit). Recognition imperfect on purpose; map fallback.
6.6 Fatigue: active above ≈65 km/h, ≈15 min to evaluate, coffee-cup message + gong ≈5 s, repeats once after 15 min, then stops; resets after a break (≈15 min stopped/engine off/door). Optional "consider a break" after ≈2 h.
6.7 Parking assist: auto in reverse; button below ≈10 km/h; off above ≈10 km/h. Top-down sectors green/yellow/red; beep interval shortens, continuous at ≈30 cm front/rear (≈20 cm sides); different pitch front/rear; mute. Reverse camera with static + steering-dependent guide lines. "Sensor dirty" fault.
6.8 Auto high beam (off for oncoming traffic and in towns), Hill Hold/HDC, emergency brake light + auto hazards after emergency braking.

## 7. Warnings, messages, telltales
- Colours: red = stop/danger, yellow = attention, green/blue/white = status.
- Priority 1 (red, "stop safely", gong ×3, persists) and priority 2 (yellow, single gong, acknowledgeable, returns later). Multiple messages cycle; "Vehicle messages" list.
- Catalogue (each with telltale, colour, text, sound, condition, repeat): oil pressure, coolant temp/level, brake system, power steering (yellow/red), alternator, hood open, transmission overheated, airbag, ABS, ESC active (flashing)/off, check engine, glow plugs, DPF, AdBlue, low fuel, washer fluid, tyre pressure, brake pads, bulb failure, seatbelt, door/trunk (car graphic), key battery low, parking brake while driving, ice warning (≤≈+4 °C, chime once), assists not available.
- Seatbelt: rear belt status ≈30 s at start; unbuckled above ≈25 km/h → chime + flashing escalating ≈90 s, then continuous red.
- Self-test ≈2 s at ignition. TPMS direct (per-wheel pressure + temperature) vs indirect (warn only, "store pressures"). Service countdown (km/days) at ignition when due within 30 days / 1 000 km.

## 8. Views (View button)
1. Classic: two dials + centre page. 2. Navigation/wide: map full width, compact readouts in strips. 3. Reduced: two large digital values (+ nav arrow when guiding). 4. Driver assistance: large lane view with lead vehicle, distance bars, lines, traffic. 5. Sport: single central dial (tach + digital speed), shift lights, power/torque %, boost, oil temp, G-meter, lap timer. 6. Auto view: follows drive mode. All views share the bottom strip and telltale layout.

## 9. Lights, body, environment
Light switch + auto headlights (dusk, tunnel within ≈1 s, rain with wipers), parking lights, fog front/rear, DRL; comfort indicators; hazard; ≈80/min, double rate if a bulb fails; rain sensor → wiper icon; washer fluid low; doors/trunk/hood/windows on the car graphic with warnings when moving; coming/leaving-home hint at standby; cabin climate feeding the convenience-consumers page.

## 10. Order
1 World + demo drive + nav. 2 Control panel. 3 Cluster shape + bottom strip. 4 Drive modes. 5 ACC/cruise/limiter. 6 ISA. 7 Lane assist + DA view. 8 FCW/AEB, BSD, RCTA. 9 Start-stop, Auto Hold, gear rec, shift lights, diesel. 10 Warnings catalogue. 11 Fatigue, parking, auto high beam, lights/body. 12 Views. After each: tests, screenshot review, fps, PROGRESS.md.

## 11. Docs and tests
`docs/features/<feature>.md` per feature (real behaviour, simulation, Mermaid state diagram, thresholds, where it appears). Unit tests for every state machine (ACC, lane staging, FCW staging, ISA cascade, start-stop, coasting, seatbelt, parking beeps, fatigue). Update inventory, MENU_SYSTEM, HMI_AND_SAFETY, WALKTHROUGH, README screenshots.

## 12. Acceptance checklist
- [ ] Scenario row and code removed; continuous world with real signs, traffic, junctions, tunnels, parking.
- [ ] Realistic control layout; every control works and has a shortcut.
- [ ] Fixed bottom strip, populated telltale row, no empty bands, open-bottom dials, correct fuel/coolant logic.
- [ ] Drive modes change throttle, shifting, steering, sound, ACC, accent and (Auto view) layout; Eco coasting shows "E", hides gear, drops RPM; never with ACC.
- [ ] Individual configuration works and persists; resets to Normal at ignition by default.
- [ ] ACC states, set-speed marker, distance bars, moving lead symbol flashing when the lead drives off.
- [ ] Speed-limit sign always visible; exceeding flashes then adds a short acoustic warning; ISA on after each ignition.
- [ ] Lane lines grey/white/green/amber; hands-off staging escalates and cancels.
- [ ] FCW: distance warning → advance warning → brake jolt → automatic braking.
- [ ] Blind-spot indicator flashes when indicating toward an occupied lane.
- [ ] Start-stop stops at red lights when allowed, shows blocking reason otherwise.
- [ ] Parking beeps faster, continuous at ≈30 cm; camera guidelines bend with steering.
- [ ] Fatigue warning after a long monotonous stretch with "tired"; repeats once after 15 min.
- [ ] All five views share the bottom strip; Auto view follows drive mode.
- [ ] Every feature has `docs/features/*.md` and tests.
