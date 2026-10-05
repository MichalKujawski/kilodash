import { useEffect, useState } from 'react';
import type { Machine } from './machines';

const CELL_W = 120;
const CELL_H = 58;
const NODE_W = 108;
const NODE_H = 32;
/** Every diagram is drawn on a 4-column canvas so they all share one scale. */
const GRID_COLS = 4;
/** How long the last transition stays lit, ms. */
const FLASH_MS = 1600;

const centre = (col: number, row: number): [number, number] => [
  col * CELL_W + CELL_W / 2,
  row * CELL_H + CELL_H / 2,
];

/** Point where the line towards (tx, ty) leaves a node's box. */
function edgeOf(cx: number, cy: number, tx: number, ty: number): [number, number] {
  const dx = tx - cx;
  const dy = ty - cy;
  const k = Math.min(NODE_W / 2 / Math.abs(dx || 1e-6), NODE_H / 2 / Math.abs(dy || 1e-6));
  return [cx + dx * k, cy + dy * k];
}

interface Props {
  machine: Machine;
  current: string;
  onHow: (doc: string) => void;
}

/**
 * One live state machine: states on a small grid, transitions as arrows, the
 * current state lit and the transition that led to it flashing for a moment.
 */
export function StateDiagram({ machine, current, onHow }: Props) {
  // Remember the transition that led here (React's "state from the previous render" pattern).
  const [shown, setShown] = useState(current);
  const [flash, setFlash] = useState<{ from: string; to: string } | null>(null);
  if (shown !== current) {
    setShown(current);
    setFlash({ from: shown, to: current });
  }
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [flash]);
  const cols = Math.max(...machine.states.map((s) => s.col)) + 1;
  const rows = Math.max(...machine.states.map((s) => s.row)) + 1;
  // Narrower machines are centred on the shared canvas.
  const shift = ((GRID_COLS - cols) * CELL_W) / 2;
  const pos = new Map(
    machine.states.map((s) => {
      const [x, y] = centre(s.col, s.row);
      return [s.id, [x + shift, y] as [number, number]];
    }),
  );
  const pairs = new Set(machine.transitions.map((t) => `${t.from}>${t.to}`));
  const active = machine.transitions.find(
    (t) => flash && t.from === flash.from && t.to === flash.to,
  );
  return (
    <figure className="sm" aria-label={`${machine.title}: ${current}`}>
      <figcaption>
        <span>{machine.title}</span>
        <button className="sm-how" onClick={() => onHow(machine.doc)}>
          How it works →
        </button>
      </figcaption>
      <svg viewBox={`0 0 ${GRID_COLS * CELL_W} ${rows * CELL_H}`} className="sm-svg">
        <defs>
          <marker
            id="sm-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="rgba(255,255,255,0.35)" />
          </marker>
          <marker
            id="sm-arrow-on"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 Z" fill="#22d36b" />
          </marker>
        </defs>
        {machine.transitions.map((t) => {
          const [ax, ay] = pos.get(t.from)!;
          const [bx, by] = pos.get(t.to)!;
          // Two-way pairs: draw each direction slightly to one side.
          const both = pairs.has(`${t.to}>${t.from}`);
          const len = Math.hypot(bx - ax, by - ay) || 1;
          const ox = both ? (-(by - ay) / len) * 5 : 0;
          const oy = both ? ((bx - ax) / len) * 5 : 0;
          const [x1, y1] = edgeOf(ax + ox, ay + oy, bx + ox, by + oy);
          const [x2, y2] = edgeOf(bx + ox, by + oy, ax + ox, ay + oy);
          const on = t === active;
          return (
            <line
              key={`${t.from}>${t.to}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              className={on ? 'sm-edge sm-edge-on' : 'sm-edge'}
              markerEnd={on ? 'url(#sm-arrow-on)' : 'url(#sm-arrow)'}
            >
              <title>{t.on}</title>
            </line>
          );
        })}
        {machine.states.map((s) => {
          const [cx, cy] = pos.get(s.id)!;
          const on = s.id === current;
          return (
            <g key={s.id} className={on ? 'sm-node sm-node-on' : 'sm-node'}>
              <rect x={cx - NODE_W / 2} y={cy - NODE_H / 2} width={NODE_W} height={NODE_H} rx="8" />
              <text x={cx} y={cy + 4}>
                {s.label}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="sm-last">{active ? `${active.from} → ${active.to}: ${active.on}` : ' '}</p>
    </figure>
  );
}
