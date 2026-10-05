# Video script

Every shot is recorded from the live demo, frame by frame on a fake clock, so re-running gives the same
video. `node scripts/make-media.mjs` builds everything; the timings below are `HIGHLIGHT` in that script.

## Highlight cut (≈ 72 s, 1920×1080, 60 fps, no sound needed)

| #   | Chapter     | In → out (s) | What the viewer sees                                                                                                                           | On-screen caption (from the chapter)                      |
| --- | ----------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1   | Start-up    | 0 → 4        | Logo, lamp check, needle sweep; already rolling onto the motorway                                                                              | "A digital instrument cluster, simulated end to end."     |
| 2   | Motorway    | 7 → 25       | Cruise follows the car ahead; the view switches to driver assistance; a fast car passes in the blind spot as we indicate, then we change lanes | Adaptive cruise → lane centering → blind spot             |
| 3   | Safety      | 2 → 12       | Driver looks away; traffic brakes; amber warning, red "Brake!" with jolt, emergency braking down to the car's speed                            | "Traffic ahead brakes hard…"                              |
| 4   | Drive modes | 0 → 3        | The mode list opens and Eco is chosen                                                                                                          | "Eco: the gearbox lets the car roll freely…"              |
| 5   | Drive modes | 10 → 15      | Sport: red accents, shift lights, the sport view                                                                                               | "Sport: sharper throttle, shift lights and red accents."  |
| 6   | City        | 13 → 25      | The lights turn red; the car stops; start-stop switches the engine off                                                                         | "At a red light the engine switches itself off."          |
| 7   | Night       | 0 → 5        | Night: lights on by themselves, dimmed display                                                                                                 | "At night the lights come on by themselves…"              |
| 8   | Parking     | 1 → 10       | Reversing out: camera lines, sensors, the car brakes for cross traffic                                                                         | "Reversing out: sensors, camera lines and cross traffic." |
| 9   | Shutdown    | 3 → 9        | Parked, P, ignition off, trip summary                                                                                                          | "Parked. A trip summary, then standby."                   |

Shots join with a 0.25 s dip to black. Recording mode (`?record=1`) hides the header, the buttons and the
cursor; captions and chapter names stay, so the video works without sound.

## LinkedIn version (4:5, 1080×1350, 30 fps)

Same shots and timing, `?record=1&format=45`: the cluster across the width, and captions twice as large,
for phones and muted autoplay. Post text suggestion:

> I built a digital instrument cluster that behaves like a real car's, in the browser: adaptive cruise,
> lane centering, emergency braking, drive modes. Every needle and warning comes from a simulated car and
> small, tested state machines. Live demo and code in the comments.

## Full demo (2:36, 1920×1080, 30 fps)

All nine chapters in one continuous take from the start.

## Other media

| File                              | What                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `public/media/loops/*.webm, .mp4` | 6 s cluster-only loops for the landing cards (960×360, 30 fps) |
| `docs/media/highlight.webp`       | 9 s animated WebP at the top of the README (lane change)       |
| `public/og.png`                   | 1200×630 share image (Open Graph / social cards)               |
| `media/*.mp4` (not in git)        | Highlight, full and LinkedIn videos, for uploading             |
