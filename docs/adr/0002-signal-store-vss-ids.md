# 2. A signal store with VSS-style IDs, timestamps and quality

**Context.** The same cluster should run from a simulator, a recording or (later) a real car. Real data
arrives late, at different rates, or not at all.

**Decision.**

- Every scalar is a sample with an ID, a value, a timestamp and a source.
- IDs follow the COVESA Vehicle Signal Specification style (`Vehicle.Speed`,
  `Vehicle.ADAS.CruiseControl.State`).
- The store (`core/signals/store.ts`) tracks the rate and the quality (live, stale, estimated,
  unavailable).
- Structured data (traffic, lanes, navigation) goes through a separate scene snapshot.

**Consequences.**

- Data sources are swappable behind one interface.
- Layouts pick widgets by which signals exist, and the cluster can show stale data honestly.
- Engineer → Signals is just a view of the store.
