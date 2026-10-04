import { useRef } from 'react';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { ControlBus } from '../controls/ControlBus';
import { Glyph } from '../controls/ControlPanel';
import { HoldButton } from './HoldButton';
import { useFrame } from './useFrame';

/** Wheel drawing space: the top of a 480 mm-ish wheel seen over the dash. */
const W = 640;
const H = 260;
/**
 * The picture turns with the real wheel, damped and limited: enough to feel the
 * car steer through a bend, little enough that the spoke buttons stay readable.
 */
const ANGLE_SHARE = 0.35;
const ANGLE_LIMIT = 15;

/** Places an HTML button on the drawing, in drawing units. */
const at = (x: number, y: number, w: number, h: number) => ({
  left: `${(x / W) * 100}%`,
  top: `${(y / H) * 100}%`,
  width: `${(w / W) * 100}%`,
  height: `${(h / H) * 100}%`,
});

interface Props {
  bus: ControlBus;
  source: SimulatorSource;
  /** Cruise buttons backlit (fast road or cruise on). */
  cruiseLit: boolean;
}

/**
 * The steering wheel as you see it over the dash: left spoke runs the cluster
 * (scroll/OK rocker, View), right spoke the cruise control (on/off,
 * RES+/SET− rocker, distance). The cruise buttons are always there and only
 * light up where cruise makes sense, like a real wheel's backlight.
 */
export function Wheel({ bus, source, cruiseLit }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFrame(() => {
    const real = source.sim.state.steeringDeg * ANGLE_SHARE;
    const deg = Math.max(-ANGLE_LIMIT, Math.min(ANGLE_LIMIT, real));
    if (ref.current) ref.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
  });
  const cruiseOn = source.assist.state !== 'off';
  const engaged = source.assist.state === 'active';
  return (
    <div className="wheel2" ref={ref} aria-label="Steering wheel">
      <svg viewBox={`0 0 ${W} ${H}`} className="wheel2-art" aria-hidden>
        <defs>
          <linearGradient id="w2-rim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#40454d" />
            <stop offset="0.25" stopColor="#262a30" />
            <stop offset="1" stopColor="#111316" />
          </linearGradient>
          <linearGradient id="w2-spoke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2a2e35" />
            <stop offset="1" stopColor="#101215" />
          </linearGradient>
          <radialGradient id="w2-hub" cx="50%" cy="20%" r="80%">
            <stop offset="0" stopColor="#24282e" />
            <stop offset="1" stopColor="#0c0d10" />
          </radialGradient>
        </defs>
        {/* Rim: leather with a soft top highlight and a stitched inner edge. */}
        <circle cx="320" cy="262" r="238" fill="none" stroke="url(#w2-rim)" strokeWidth="34" />
        <path
          d="M118 120 A238 238 0 0 1 522 120"
          fill="none"
          stroke="rgba(255,255,255,0.13)"
          strokeWidth="2"
          strokeLinecap="round"
          transform="translate(0 -14)"
        />
        <circle
          cx="320"
          cy="262"
          r="225"
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth="1"
          strokeDasharray="3 5"
        />
        {/* Spokes with a bright trim line along their top edge. */}
        <path d="M94 176 Q170 164 246 172 L246 252 Q170 246 88 240 Z" fill="url(#w2-spoke)" />
        <path d="M546 176 Q470 164 394 172 L394 252 Q470 246 552 240 Z" fill="url(#w2-spoke)" />
        <path d="M96 176 Q170 164 246 172" stroke="rgba(210,220,232,0.22)" fill="none" />
        <path d="M544 176 Q470 164 394 172" stroke="rgba(210,220,232,0.22)" fill="none" />
        {/* Recessed piano-black button panels. */}
        <rect
          x="112"
          y="180"
          width="124"
          height="66"
          rx="12"
          fill="#07080a"
          stroke="rgba(255,255,255,0.05)"
        />
        <rect
          x="404"
          y="180"
          width="124"
          height="66"
          rx="12"
          fill="#07080a"
          stroke="rgba(255,255,255,0.05)"
        />
        {/* Hub (airbag cover). */}
        <path
          d="M244 262 L244 196 Q244 160 290 158 L350 158 Q396 160 396 196 L396 262 Z"
          fill="url(#w2-hub)"
        />
        <path d="M262 190 Q320 176 378 190" stroke="rgba(255,255,255,0.06)" fill="none" />
        <circle
          cx="320"
          cy="214"
          r="13"
          fill="none"
          stroke="rgba(255,255,255,0.14)"
          strokeWidth="2"
        />
      </svg>

      {/* Left spoke: cluster */}
      <div className="rocker" style={at(124, 184, 40, 58)} role="group" aria-label="Scroll wheel">
        <HoldButton bus={bus} action="scrollUp" className="rocker-up" label="Scroll up">
          <Glyph name="up" size={14} />
        </HoldButton>
        <HoldButton bus={bus} action="ok" className="rocker-ok" label="OK (hold for long press)">
          OK
        </HoldButton>
        <HoldButton bus={bus} action="scrollDown" className="rocker-down" label="Scroll down">
          <Glyph name="down" size={14} />
        </HoldButton>
      </div>
      <HoldButton bus={bus} action="view" className="spoke-btn" style={at(176, 194, 48, 38)}>
        <span className="spoke-text">VIEW</span>
      </HoldButton>

      {/* Right spoke: cruise */}
      <HoldButton
        bus={bus}
        action="accMain"
        className="spoke-btn"
        style={at(411, 194, 34, 38)}
        lit={cruiseLit}
        active={cruiseOn}
        disabled={!cruiseLit}
        label="Cruise control on/off (hold for speed limiter)"
      >
        <Glyph name="acc" size={18} />
      </HoldButton>
      <div className="rocker" style={at(451, 184, 38, 58)} role="group" aria-label="Cruise speed">
        <HoldButton
          bus={bus}
          action="accRes"
          className="rocker-up"
          lit={cruiseLit}
          disabled={!cruiseLit}
          label="RES / + (hold for +10)"
        >
          <span className="spoke-text">RES+</span>
        </HoldButton>
        <HoldButton
          bus={bus}
          action="accSet"
          className="rocker-down"
          lit={cruiseLit}
          active={engaged}
          disabled={!cruiseLit}
          label="SET / − (hold for −10)"
        >
          <span className="spoke-text">SET−</span>
        </HoldButton>
      </div>
      <HoldButton
        bus={bus}
        action="accDistance"
        className="spoke-btn"
        style={at(495, 194, 34, 38)}
        lit={cruiseLit}
        disabled={!cruiseLit}
      >
        <Glyph name="distance" size={18} />
      </HoldButton>
    </div>
  );
}
