# Themes

A theme is plain data (`Theme` in `src/cluster/themes/types.ts`). The renderer contains no
theme-specific code. Everything visual comes from the tokens below, so a theme can be exported,
edited by hand and imported again.

Safety colours are deliberately **not** themeable. Telltales and alert severities always use
ISO 2575 conventions (red = danger, amber = caution, green/blue = information). They sit in fixed,
layout-defined positions.

## Built-in themes

| id                | Look                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| `midnight`        | Deep black, off-white numerals, red emissive needles (default)                                 |
| `neon-grid`       | Synthwave: magenta/cyan glow, radial Orbitron numerals, animated perspective grid road         |
| `racing`          | Procedural carbon fibre, yellow/red, aggressive ticks, italic numerals, stiff needle           |
| `analog-heritage` | Cream faces, chrome bezels, serif italic numerals, orange needles with a tail, readout windows |
| `arctic`          | Light frosted daytime theme. Switches to `midnight` at night (`nightVariant`)                  |
| `eco`             | Teal and green, rounded ticks, soft needle, drifting particles                                 |
| `retro-lcd`       | 80s amber LCD: segmented bar dials and procedural 7-segment digits                             |

## Schema overview

```jsonc
{
  "id": "my-theme",              // unique
  "name": "My theme",
  "background": "#000000",
  "nightVariant": "midnight",    // optional: theme to use when it is dark outside
  "text": { "primary", "secondary", "tertiary", "accent" },      // primary ≈ 94% white, never pure
  "fonts": {
    "primary": "CSS font stack",
    "numerals": "CSS font stack",
    "readout": "CSS font stack | \"segment\"",                   // "segment" = 7-segment digits
    "load": ["Orbitron:wght@500;700"]                            // Google Fonts specs, loaded on demand
  },
  "backdrop": { "kind": "solid|gradient|carbon|grid|particles", "colors": ["…"] },
  "dial": {
    "mode": "needle|segments",
    "startDeg": 140, "sweepDeg": 260,                            // 0° = 3 o'clock, clockwise
    "bezel":    { "width", "dark", "light", "highlight" },       // width as a fraction of radius
    "tickBand": { "width", "full", "inner", "outer", "shadow" },
    "face":     { "center", "edge", "texture" },
    "hub":      { "radius", "fill", "ring", "shadow", "text", "textSecondary" },
    "ticks":    { "major": {"length","width","color"}, "mid": {…}, "minor": {…}, "minorPerMajor": 4, "cap": "butt|round" },
    "numerals": { "size", "weight", "color", "lit", "litRangeDeg", "inset", "orientation": "upright|radial", "italic" },
    "redline":  { "band", "glow" },
    "needle":   { "style": "blade|line|arrow", "baseWidth", "tipWidth", "color", "core", "glow",
                  "afterglowDeg", "afterglow", "tail", "cap" },
    "segments": { "count", "on", "ghost" }                       // used when mode = "segments"
  },
  "sideGauge": { "track", "fill", "marker" },
  "panel": { "surface", "divider" },
  "map": { "ground", "block", "park", "water", "road", "roadMajor", "roadEdge", "route", "routeGlow", "vehicle", "label" },
  "chart": { "good", "neutral", "bad" },
  "car": { "paintDark", "paintLight", "glass", "outline" },
  "effects": { "bloom", "bloomRadius", "glass", "dither", "vignette", "ambient", "ambientBreath" },
  "needlePhysics": { "stiffness", "damping", "maxVelocity" },   // spring–damper; maxVelocity in sweeps/s
  "sounds": { "chime": "bell|digital|soft" }
}
```

Notes on a few tokens:

- **A small hub** (`dial.hub.radius` < 0.3) switches a dial to the classic analogue layout: a
  chrome centre cap, a needle with a counterweight `tail`, and readouts in a recessed window
  below the pivot.
- **`effects.bloom`** scales the glow pass for emissive elements (needles, lit telltales, the
  redline). Low-power mode turns off bloom, glass and blur whatever the theme says.
- **`effects.ambientBreath`** is the idle "breathing" of the ambient light. It pauses while the car
  is moving.

## Importing and validation

`parseTheme()` (`src/cluster/themes/validate.ts`) merges an imported file onto Midnight:

- **Missing fields** fall back to Midnight's values.
- **Unknown keys and wrong types** are ignored and reported as warnings, so an old or hand-edited
  file cannot break the renderer.
- **Imports that reuse a built-in theme's `id`** are saved under a `-copy` id instead.

## Theme editor

On the website, choose **Theme editor**, then **Duplicate & edit** on any theme. The editor
covers colours, fonts, glow, glass, afterglow, hub size, sweep, needle feel, dial mode, numeral
orientation, backdrop and chime voice. Every change applies live. User themes are saved in
`localStorage` (`twindial.userThemes`) and can be exported or imported as JSON.
