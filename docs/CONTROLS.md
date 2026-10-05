# Controls

Every control a driver can reach, and how to operate it on the website. The real-car behaviour behind
each one (comfort blink, gearbox interlock, light logic) is in [features/controls.md](features/controls.md).

## Ways to drive

| Input           | Where                                  | Notes                                                                              |
| --------------- | -------------------------------------- | ---------------------------------------------------------------------------------- |
| Mouse and touch | Drive mode: the dock under the cockpit | Stalk, steering-wheel buttons, selector, pedals. The rest is in **More controls**. |
| Keyboard        | Drive and Engineer modes               | Keys below. Press `?` in Drive mode for the overlay. In Watch, keys run the demo.  |
| Gamepad         | Drive and Engineer modes               | Standard mapping; the triggers are the pedals. See the gamepad table.              |

All three go through one `ControlBus` (`app/controls/ControlBus.ts`), so a tap and a hold mean the same
thing whichever device you use:

- **Tap or hold.** Indicators: a tap gives three flashes, a hold latches. OK: a hold is a long press.
  Cruise SET/RES: a tap is ±1 km/h, a hold steps to the next 10. ESC: a tap turns traction control off,
  a hold selects ESC Sport.
- **Pedals ramp in** from the keyboard, so a key press isn't a full-throttle step.
- **Taking over.** "Take the wheel" in Watch, or switching to Drive, hands you the car where it is. With
  Demo drive on, the demo driver takes over again 10 s after your last input.

## Keyboard

### Pedals and paddles

| Key | Control     |
| --- | ----------- |
| `W` | Accelerator |
| `S` | Brake       |
| `E` | Paddle +    |
| `Q` | Paddle −    |

### Left stalk

| Key | Control                                      |
| --- | -------------------------------------------- |
| `,` | Indicator left (tap = 3 flashes, hold = on)  |
| `.` | Indicator right (tap = 3 flashes, hold = on) |
| `H` | High beam (push stalk)                       |
| `J` | Headlight flash (pull stalk)                 |
| `U` | Auto high beam                               |

### Right stalk

| Key | Control       |
| --- | ------------- |
| `]` | Wipers faster |
| `[` | Wipers slower |
| `\` | Single wipe   |
| `'` | Washer (hold) |

### Light switch

| Key | Control                                        |
| --- | ---------------------------------------------- |
| `L` | Light switch (off / auto / parking / low beam) |
| `F` | Front fog lights                               |
| `G` | Rear fog light                                 |

### Selector and console

| Key     | Control                                |
| ------- | -------------------------------------- |
| `1`     | Selector P                             |
| `2`     | Selector R                             |
| `3`     | Selector N                             |
| `4`     | Selector D                             |
| `5`     | Selector S                             |
| `6`     | Selector M (paddles)                   |
| `K`     | Engine start/stop (with brake = start) |
| `Space` | Hazard lights                          |
| `Y`     | Drive mode                             |
| `O`     | Start-stop off                         |
| `I`     | ESC (tap = traction off, hold = sport) |
| `A`     | Auto Hold                              |
| `B`     | Park assist                            |

### Steering wheel, left (cluster)

| Key     | Control                                    |
| ------- | ------------------------------------------ |
| `↑`     | Scroll up                                  |
| `↓`     | Scroll down                                |
| `Enter` | OK (press scroll wheel, hold = long press) |
| `←`     | Left                                       |
| `→`     | Right                                      |
| `V`     | View                                       |
| `Esc`   | Menu / back                                |
| `Home`  | Home                                       |

### Steering wheel, right (assist)

| Key    | Control                              |
| ------ | ------------------------------------ |
| `C`    | Cruise / ACC on-off (hold = limiter) |
| `-`    | SET − (hold = −10)                   |
| `=`    | RES + (hold = +10)                   |
| `X`    | Cancel                               |
| `Z`    | Distance                             |
| `N`    | Lane assist                          |
| `M`    | Voice                                |
| `PgUp` | Volume +                             |
| `PgDn` | Volume −                             |

### Website

| Key | Control                      |
| --- | ---------------------------- |
| `P` | Demo drive on/off            |
| ``` | Night mode (auto / on / off) |
| `/` | Sound on/off                 |

## Gamepad (standard mapping)

| Button                       | Control                        |
| ---------------------------- | ------------------------------ |
| Right trigger / left trigger | Accelerator / brake (analogue) |
| Left stick left / right      | Indicator left / right         |
| LB / RB                      | Paddle − / +                   |
| D-pad                        | Scroll up / down, left / right |
| A / B                        | OK / back                      |
| X                            | Cruise / ACC on-off            |
| Y                            | View                           |
| Back / Start                 | Hazard lights / engine start   |

Source: `PAD_BUTTONS` in `app/controls/useControlInputs.ts`.

## Guided demo (Watch mode)

| Key   | Does                    |
| ----- | ----------------------- |
| Space | Pause / play            |
| ← / → | Previous / next chapter |

## URL options

| Option                                      | Does                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `?mode=watch\|drive\|engineer`              | Open in that mode                                                                                          |
| `?chapter=<id>`                             | Start the guided demo at a chapter (`motorway`, `safety`, `modes`, `city`, `night`, `menus`, `parking`, …) |
| `?view=<id>`                                | Start in a cluster view                                                                                    |
| `?kiosk=1`                                  | Cluster only, for a real 1920×720 screen                                                                   |
| `?lowpower=1`                               | No bloom, glass or blur                                                                                    |
| `?spotlight=0`                              | No caption spotlight                                                                                       |
| `?record=1`                                 | Clean frame for video capture                                                                              |
| `?pose=idle\|city\|highway\|redline\|night` | Fixed simulator state for screenshots                                                                      |
| `?dev=1`                                    | Developer mode: experimental themes and theme editor                                                       |
| `?profile=1`                                | Collect render-phase timings (Engineer → Performance)                                                      |
