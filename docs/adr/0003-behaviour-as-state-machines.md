# 3. Car behaviour lives in small, tested state machines

**Context.** Real clusters show what assistance systems are doing: standby, active, overridden,
warning. Putting that logic in widgets would make it untestable and duplicated.

**Decision.**

- Each behaviour is a small class in `src/core` with a `step()` that turns inputs into plain state:
  adaptive cruise, lane assist, collision warning, start-stop, speed-limit warning, seat-belt
  reminder, drive modes.
- Widgets only draw that state.

**Consequences.**

- Each behaviour has unit tests that read like the real car's rules (for example "on a slower car,
  emergency braking ends at its speed").
- The Engineer tab draws the same machines live.
- Adding a behaviour means a class, a test and a widget. No widget contains car logic.
