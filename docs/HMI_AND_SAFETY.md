# HMI and safety

How Kilodash decides what the driver sees and hears, and which public conventions it follows.

> Kilodash is a demonstration, not automotive software. It follows public conventions so the cluster
> behaves the way drivers expect, but it is not certified, has not been tested with drivers, and must
> never be used in a vehicle. See [RISKS_AND_LIMITATIONS](RISKS_AND_LIMITATIONS.md) and
> [DISCLAIMER](../DISCLAIMER.md).

## Principles

1. **Speed is always readable.** Every [view](features/views.md) keeps a speed reading, the gear, the
   speed-limit sign, the telltale row and the warning overlays. Switching views never hides them.
2. **Safety colours and positions are fixed.** Red means danger or stop, amber means caution, green and
   blue show that something is on. Telltale colours and places are set by the layout, not the theme, so a
   theme can't make a warning lamp look harmless ([ADR 5](adr/0005-layouts-and-themes-as-data.md)).
3. **One message at a time, by priority.** The alert engine picks what to show. A red warning replaces
   whatever is on screen at once; an amber one waits for the current card to leave. Several warnings of the
   same priority take turns.
4. **Escalate in stages.** Assists warn visually first, then with sound, then act: collision warning,
   hands-off detection and the speed warning all work this way.
5. **Calm when moving.** Decorative motion (the ambient "breathing" light) pauses while the car moves.
   The display dims at night (to 68 % brightness) to avoid glare.
6. **The driver can always override.** Pressing a pedal, steering or cancelling takes over from cruise,
   lane centering and coasting. Kickdown overrides emergency braking.

## Telltales

- **31 lamps**, each an original drawing in code (`cluster/telltales/icons.ts`) following the ISO 2575
  symbol conventions, so drivers recognise them without copying any manufacturer's artwork.
- **Lamp check:** every lamp lights for a moment at ignition, as in a real car, so a dead lamp would be
  noticed (`cluster/renderer/startup.ts`).
- **Grouping:** lights and driver aids left of the clock, vehicle warnings right of it, indicators near
  the top of each dial ([cluster layout](features/cluster-layout.md)).

## Warnings and sounds

| Priority    | Colour | Sound                      | Can the driver hide it?                                      |
| ----------- | ------ | -------------------------- | ------------------------------------------------------------ |
| 1, critical | red    | three-note gong, repeating | The card can be hidden with OK; the lamp stays lit           |
| 2, warning  | amber  | one gong                   | Yes, with OK; it comes back after 5 minutes if still present |
| Information | white  | soft bell                  | Yes                                                          |

- Rules have a minimum duration and hysteresis, so a value hovering at a threshold doesn't make a card
  flicker (`core/alerts/AlertEngine.ts`).
- Hidden but active warnings stay visible as a small triangle with a count, and the Vehicle messages
  page lists all of them.
- All 48 rules and their texts: [warnings](features/warnings.md).
- On the website, sound is off until the visitor switches it on.

## Driver-assistance HMI

| Function                      | Stages shown to the driver                                                                                          | Doc                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Collision warning and braking | distance symbol → amber pre-warning with chime → red "Brake!" and jolt → partial → full braking                     | [collision assist](features/collision-assist.md)               |
| Hands-off detection           | message (≈ 15 s) → red flashing wheel and chime (≈ 25 s) → brake jolt (≈ 32 s) → stop in lane with hazards (≈ 40 s) | [lane assist](features/lane-assist.md)                         |
| Speed warning (ISA)           | sign flashes → short chime; on at every start                                                                       | [speed limits](features/speed-limits.md)                       |
| Seat belts                    | lamp → flashing lamp with chime every 2 s above 25 km/h for 90 s → steady lamp                                      | [warnings](features/warnings.md)                               |
| Fatigue                       | coffee cup and gong, once more after 15 min                                                                         | [parking, lights, fatigue](features/parking-lights-fatigue.md) |
| Adaptive cruise               | grey stored / green active set speed, target car highlighted, "take over" when braking isn't enough                 | [speed assist](features/speed-assist.md)                       |

## Conventions and regulations it follows

These are followed as **public conventions** for realistic behaviour. Nothing here is a claim of
compliance or certification.

| Source                    | Used for                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| ISO 2575                  | Telltale symbols and colours                                                                |
| Regulation (EU) 2019/2144 | Speed warning (ISA) on at every start, emergency braking always on, fatigue warning         |
| UN ECE R16                | Seat-belt reminder timing                                                                   |
| UN ECE R48                | Hazard lights after an emergency stop from above 50 km/h                                    |
| ISO 15622                 | Adaptive cruise braking authority (3.5 m/s²; beyond that, the driver is asked to take over) |

## Settings that change safety behaviour

Like real cars, the safety functions start **on** at every ignition: collision warning, emergency braking
and the speed warning. On the website they can be switched off only in the Workshop drawer
(Engineer mode), which plays the role of a car's deep settings menu. Individual drive-mode settings can
be changed only when parked ([MENU_SYSTEM](MENU_SYSTEM.md)).
