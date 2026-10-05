# Kilodash

![The cluster on the motorway: a car in the blind spot, then a lane change with lane centering](docs/media/highlight.webp)

**A digital instrument cluster that behaves like a real car's, built for the web.**
Live demo: _(link once deployed)_

Every needle, lamp and warning comes from a simulated car. Physics, adaptive cruise, lane centering,
emergency braking, start-stop and drive modes are small, tested state machines. The cluster only draws
their state, at 60 fps on a Canvas.

## Three ways in

- **Watch:** a 2½-minute guided drive in nine chapters (motorway assists, emergency braking, drive modes,
  city, night, parking). Every chapter has its own link, for example `?chapter=safety`.
- **Drive:** take the wheel. Stalk, wheel buttons, selector and pedals, by mouse, touch, keyboard or
  gamepad. Press `?` for every key.
- **Engineer:** the internals, live. Signals, state diagrams, an event timeline and the data each page draws
  from, plus "How it works" for every feature.

## Run it

```bash
npm install
npm run dev                    # http://localhost:5173
npm test                       # unit tests (Vitest)
npx playwright test            # browser tests
node scripts/make-media.mjs    # rebuild the videos, loops and share image (needs ffmpeg)
```

URL options: `?mode=watch|drive|engineer`, `?chapter=<id>`, `?kiosk=1` (cluster only, for a real
screen), `?record=1` (clean frame for video), `?lowpower=1`.

## Read more

- [Codebase walkthrough](docs/WALKTHROUGH.md): where to start reading.
- [Engineering decisions](docs/adr/): six short ADRs (canvas renderer, signal store, state machines,
  deterministic simulator, layouts as data, live guided demo).
- [Features](docs/features/): real-car behaviour, how it is simulated, thresholds and state diagrams, one
  page per feature.
- [Video script](docs/VIDEO_SCRIPT.md) and [privacy](docs/PRIVACY.md).

## Disclaimer

Kilodash is not affiliated with any vehicle manufacturer and is not a certified automotive product. It
is for demonstration only.

## License

MIT. See [LICENSE](LICENSE).
