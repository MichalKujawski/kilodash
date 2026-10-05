# Architecture decision records

Short records of the decisions that shape the code: the context, the decision and what it costs. Each is
one page. All six are accepted and in force.

| #   | Decision                                                                                          | In one line                                                                        |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1   | [Canvas renders the cluster; React only draws the page](0001-canvas-renderer-react-for-chrome.md) | 60 fps needs a render loop that doesn't go through React.                          |
| 2   | [A signal store with VSS-style IDs](0002-signal-store-vss-ids.md)                                 | Timestamped, quality-tracked values with industry-style names, outside React.      |
| 3   | [Car behaviour lives in small, tested state machines](0003-behaviour-as-state-machines.md)        | Each assist is a class with plain input and output, tested like a rule book.       |
| 4   | [A deterministic simulator with a fixed 100 Hz step](0004-deterministic-simulator.md)             | Seeded and fixed-step, so tests and videos are repeatable.                         |
| 5   | [Layouts and themes are data; safety colours are fixed](0005-layouts-and-themes-as-data.md)       | Looks change without code; warning lamps can't be themed away.                     |
| 6   | [The guided demo plays inside the live simulation](0006-guided-demo-in-the-live-world.md)         | Chapters fire events into the running car, so a visitor can take over at any time. |

New decisions get the next number and the same three parts: context, decision, consequences.
