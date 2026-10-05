# 5. Layouts and themes are data; safety colours are fixed

**Context.** A cluster has several views (classic, navigation, driver assistance, sport, reduced). Car
makers restyle them often. Warning colours and lamp positions, however, are regulated.

**Decision.**

- Layouts are JSON-like objects: slots, rectangles and candidate widgets per slot
  (`cluster/layouts/`).
- Themes are token sets (colours, fonts, effect strengths).
- Telltale colours and positions come from a fixed table that themes cannot override.

**Consequences.**

- A new view is a data file.
- A theme can't turn a red warning lamp blue.
- Layout resolution is unit-tested, for example "no fuel signal → no fuel gauge".
