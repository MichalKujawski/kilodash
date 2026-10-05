# Demo script

How to show Kilodash live, for example in an interview or on a screen share. There are three lengths:
pick by the time you have. Every step uses the public site; nothing needs to be set up first.

**Before you start:** open the live site in a desktop browser at full width, sound on if the room allows
(switch it on in the header). Keep a second tab on the repository. If the machine is slow, add
`?lowpower=1`.

## 1 minute: "what is it"

| Time | Do                                                                       | Say                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Open the site and let it play.                                           | "This is a digital instrument cluster, the screen behind a modern car's steering wheel. Everything on it comes from a simulated car."                          |
| 0:10 | Watch the Motorway chapter: adaptive cruise, lane centering, blind spot. | "Adaptive cruise is keeping the distance, lane centering keeps us in the lane, and the car in the blind spot flashes the warning as we indicate."              |
| 0:35 | Press → to jump to Safety.                                               | "Here the driver looks away and the traffic ahead brakes: amber warning, red warning with a brake jolt, then automatic braking down to the other car's speed." |
| 0:55 | Point at the header modes.                                               | "It's not a video: you can take the wheel, or open Engineer mode to see the state machines running."                                                           |

## 3 minutes: "it really is a car"

Do the 1-minute version, then:

1. **Take the wheel** (button under the captions). Hold `W`; the car accelerates on the same road.
   "The demo driver just handed over. Same simulator, now on my input."
2. **Indicators:** tap `.` (three flashes), then hold it (latched). "Tap versus hold, like a real stalk.
   Every input goes through one control bus, so mouse, keyboard and gamepad behave the same."
3. **Cruise:** above 30 km/h press `C`, then `-` to set. "Set speed in green on the speedometer, the same
   rules as a real system: brake cancels it, RES brings it back, and adaptive cruise follows the car ahead."
4. **Drive mode:** press `Y` until Sport is highlighted, then wait. "The mode list, like a console button.
   It applies by itself after two seconds. Sport changes the throttle, the gearbox and the accents."
5. **View:** press `V` a few times. "Five layouts plus an automatic one. Speed, warnings and telltales
   never move: those positions are fixed for safety."

## 5 minutes: "how it's built"

Do the 3-minute version, then switch to **Engineer**:

1. **States tab.** "Each assist is a small state machine in `src/core`. These diagrams light up from the
   live classes, and a test checks every live state is in its diagram."
2. **Events tab.** "Every transition, warning and mode change, with the car's speed and context."
3. **Signals tab.** "146 signals with VSS-style IDs. The store tracks quality and the real update rate.
   The renderer reads the store directly at 60 fps; React only polls a few times a second."
4. **Workshop.** Switch on a fault, for example low tyre pressure. "Amber card, gong, lamp, and it comes
   back after five minutes if I acknowledge it, which is how real priority-2 warnings work."
5. **Performance tab.** "Frame time and dropped frames, measured. The numbers in the README come from a
   script, not from memory."
6. **How it works.** Open one from a caption. "Every feature has a doc with the real behaviour, the
   thresholds and a state diagram; the panel renders it from the repo."
7. **The repository.** Show `src/core/assist/CollisionAssist.ts` and its test. "Here's the rule in code,
   and the test that reads like the rule."

## If something goes wrong

| Problem                  | Fix                                                                          |
| ------------------------ | ---------------------------------------------------------------------------- |
| Stutter on a weak laptop | Reload with `?lowpower=1` (no bloom, glass or blur).                         |
| You've lost the demo     | Switch to Watch; the chapter restarts.                                       |
| Want a specific moment   | `?chapter=motorway`, `safety`, `modes`, `city`, `night`, `menus`, `parking`. |
| No sound                 | It's off until switched on in the header; browsers block autoplay audio.     |
| No internet              | Run it locally: `npm ci && npm run build && npm run preview`.                |

See also: [VIDEO_SCRIPT](VIDEO_SCRIPT.md) for the recorded videos and
[process/SHOWCASE_MOMENTS](process/SHOWCASE_MOMENTS.md) for every feature as a demo moment.
