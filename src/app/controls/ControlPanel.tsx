import { useRef, type CSSProperties, type ReactNode } from 'react';
import { MODES } from '@/core/drive/modes';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { LightSwitch, WiperMode } from '@/core/datasource/simulator/vehicle';
import { ICONS, type IconId } from '@/cluster/telltales/icons';
import { usePoll } from '../useSignal';
import { ACTIONS, keyHint, type Action } from './actions';
import type { ControlBus } from './ControlBus';
import './controls.css';

/** Small original glyphs for controls without a telltale equivalent (24×24 grid). */
const GLYPHS: Record<string, string> = {
  view: 'M3 6h8v12H3zM13 6h8v5h-8zM13 13h8v5h-8z',
  back: 'M10 5 4 11l6 6M4 11h10a6 6 0 0 1 0 12',
  home: 'M3 12 12 4l9 8M6 10v10h12V10',
  left: 'M15 5 8 12l7 7',
  right: 'M9 5l7 7-7 7',
  up: 'M5 15l7-7 7 7',
  down: 'M5 9l7 7 7-7',
  acc: 'M4 17a8 8 0 1 1 16 0M12 15l4-5M3 20h18',
  distance: 'M4 6h16M6 10h12M8 14h8M10 18h4',
  cancel: 'M6 6l12 12M18 6 6 18',
  voice: 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM6 11a6 6 0 0 0 12 0M12 17v4',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  mode: 'M4 18a8 8 0 1 1 16 0M12 18l-3-7M7 21h10',
  startStop: 'M12 4a8 8 0 1 0 0.01 0M8 12h8M12 8v8',
  esc: 'M6 14l2-6h8l2 6v3H6zM5 20c2-2 4-2 6 0M13 20c2-2 4-2 6 0',
  hold: 'M12 3a9 9 0 1 0 0.01 0M8.5 16l3.5-9 3.5 9M9.8 13h4.4',
  park: 'M7 20V5h5a4 4 0 0 1 0 8H7M17 6c2 2 2 6 0 8M19.5 4c3 3 3 9 0 12',
  wipe: 'M4 18c4-9 12-9 16 0M12 18 7 8',
  wash: 'M4 18c4-9 12-9 16 0M9 7l1 2M12 6v2M15 7l-1 2',
  power: 'M12 3v8M7 6a8 8 0 1 0 10 0',
};

export function Glyph({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <path
        d={GLYPHS[name]}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A telltale icon rendered as SVG (same artwork as in the cluster). */
export function Icon({ id, size = 18 }: { id: IconId; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      {ICONS[id].map((p, i) =>
        p.kind === 'fill' ? (
          <path key={i} d={p.d} fill="currentColor" />
        ) : p.kind === 'stroke' ? (
          <path
            key={i}
            d={p.d}
            fill="none"
            stroke="currentColor"
            strokeWidth={p.width ?? 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <text
            key={i}
            x={p.x}
            y={p.y}
            fontSize={p.size}
            fontWeight={p.weight ?? 600}
            textAnchor="middle"
            fill="currentColor"
          >
            {p.text}
          </text>
        ),
      )}
    </svg>
  );
}

interface KeyProps {
  bus: ControlBus;
  action: Action;
  children: ReactNode;
  className?: string;
  active?: boolean;
  /** Indicator LED colour when active. */
  led?: 'green' | 'amber' | 'red' | 'blue';
  style?: CSSProperties;
  label?: string;
}

/**
 * One physical control. Pointer down/up map to press/release so holds and long
 * presses behave like the real button; keyboard focus + Enter/Space clicks it.
 */
function Key({ bus, action, children, className = '', active, led, style, label }: KeyProps) {
  const held = useRef(false);
  const info = ACTIONS[action];
  const hint = keyHint(action);
  const end = (): void => {
    if (held.current) bus.release(action);
    held.current = false;
  };
  return (
    <button
      type="button"
      className={`ck ${className} ${active ? 'ck-on' : ''}`}
      style={style}
      aria-label={label ?? info.label}
      aria-pressed={active}
      title={`${info.label} [${hint}]`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        held.current = true;
        bus.press(action);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          bus.click(action);
        }
      }}
    >
      {children}
      {led && <span className={`ck-led ck-led-${led} ${active ? 'ck-led-on' : ''}`} aria-hidden />}
      <span className="ck-hint" aria-hidden>
        {hint}
      </span>
    </button>
  );
}

function SteeringWheel({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const b = source.buttons;
  // The main button's LED shows the system is on (standby or engaged).
  const cruise = source.assist.state !== 'off';
  const angle = Math.max(-120, Math.min(120, source.sim.state.steeringDeg));
  return (
    <div className="wheel" aria-label="Steering wheel">
      <svg
        className="wheel-svg"
        viewBox="0 0 360 360"
        style={{ transform: `rotate(${angle}deg)` }}
        aria-hidden
      >
        <defs>
          <radialGradient id="rim" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#3a3f47" />
            <stop offset="100%" stopColor="#14161a" />
          </radialGradient>
          <linearGradient id="spoke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a2e35" />
            <stop offset="100%" stopColor="#121418" />
          </linearGradient>
        </defs>
        <circle cx="180" cy="180" r="160" fill="none" stroke="url(#rim)" strokeWidth="26" />
        <circle
          cx="180"
          cy="180"
          r="160"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
        <path d="M30 170 Q90 150 120 170 L135 205 Q90 215 34 205Z" fill="url(#spoke)" />
        <path d="M330 170 Q270 150 240 170 L225 205 Q270 215 326 205Z" fill="url(#spoke)" />
        <path d="M155 235 L205 235 L215 330 Q180 342 145 330Z" fill="url(#spoke)" />
        <circle cx="180" cy="190" r="58" fill="#16181c" stroke="rgba(255,255,255,0.08)" />
        <circle
          cx="180"
          cy="190"
          r="12"
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="2"
        />
      </svg>
      <div className="wheel-pad wheel-pad-left" aria-label="Cluster controls">
        <Key bus={bus} action="view" className="ck-sm">
          <Glyph name="view" />
        </Key>
        <div className="scroll">
          <Key bus={bus} action="scrollUp" className="scroll-half">
            <Glyph name="up" size={14} />
          </Key>
          <Key
            bus={bus}
            action="ok"
            className="scroll-ok"
            label="OK (press the scroll wheel; hold for long press)"
          >
            OK
          </Key>
          <Key bus={bus} action="scrollDown" className="scroll-half">
            <Glyph name="down" size={14} />
          </Key>
        </div>
        <div className="pad-row">
          <Key bus={bus} action="left" className="ck-sm">
            <Glyph name="left" />
          </Key>
          <Key bus={bus} action="right" className="ck-sm">
            <Glyph name="right" />
          </Key>
        </div>
        <div className="pad-row">
          <Key bus={bus} action="back" className="ck-sm">
            <Glyph name="back" />
          </Key>
          <Key bus={bus} action="home" className="ck-sm">
            <Glyph name="home" />
          </Key>
        </div>
      </div>
      <div className="wheel-pad wheel-pad-right" aria-label="Assist controls">
        <div className="pad-row">
          <Key bus={bus} action="accMain" className="ck-sm" active={cruise} led="green">
            <Glyph name="acc" />
          </Key>
          <Key bus={bus} action="laneAssist" className="ck-sm" active={b.laneAssist} led="green">
            <Icon id="laneAssist" />
          </Key>
        </div>
        <div className="pad-row">
          <Key bus={bus} action="accRes" className="ck-sm">
            RES
            <Glyph name="plus" size={12} />
          </Key>
          <Key bus={bus} action="accDistance" className="ck-sm">
            <Glyph name="distance" />
          </Key>
        </div>
        <div className="pad-row">
          <Key bus={bus} action="accSet" className="ck-sm">
            SET
            <Glyph name="minus" size={12} />
          </Key>
          <Key bus={bus} action="accCancel" className="ck-sm">
            <Glyph name="cancel" />
          </Key>
        </div>
        <div className="pad-row">
          <Key bus={bus} action="voice" className="ck-sm">
            <Glyph name="voice" />
          </Key>
          <div className="roller" aria-label="Volume">
            <Key bus={bus} action="volumeUp" className="roller-half">
              <Glyph name="plus" size={12} />
            </Key>
            <Key bus={bus} action="volumeDown" className="roller-half">
              <Glyph name="minus" size={12} />
            </Key>
          </div>
        </div>
      </div>
      <Key bus={bus} action="paddleDown" className="paddle paddle-left">
        −
      </Key>
      <Key bus={bus} action="paddleUp" className="paddle paddle-right">
        +
      </Key>
    </div>
  );
}

function LeftStalk({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const sim = source.sim;
  const tilt = sim.inputs.rightIndicator ? -12 : sim.inputs.leftIndicator ? 12 : 0;
  const shift = sim.body.highBeamLatched ? 8 : sim.body.highBeamFlash ? -8 : 0;
  return (
    <div className="stalk" aria-label="Left stalk: indicators and high beam">
      <svg viewBox="0 0 160 60" className="stalk-svg" aria-hidden>
        <g
          style={{
            transform: `translateX(${shift}px) rotate(${tilt}deg)`,
            transformOrigin: '150px 30px',
            transition: 'transform 0.15s',
          }}
        >
          <rect x="18" y="24" width="132" height="12" rx="6" fill="#23262b" />
          <rect x="8" y="20" width="34" height="20" rx="10" fill="#2e3238" />
          <text
            x="25"
            y="34"
            fontSize="10"
            textAnchor="middle"
            fill={sim.body.autoHighBeam ? '#3fa7ff' : '#7d848d'}
          >
            A
          </text>
        </g>
      </svg>
      <div className="stalk-keys">
        <Key bus={bus} action="indicatorRight" active={sim.indicating('right')} led="green">
          ▲ Right
        </Key>
        <Key bus={bus} action="indicatorLeft" active={sim.indicating('left')} led="green">
          ▼ Left
        </Key>
        <Key bus={bus} action="highBeam" active={sim.body.highBeamLatched} led="blue">
          <Icon id="highBeam" /> Push
        </Key>
        <Key bus={bus} action="flash" active={sim.body.highBeamFlash}>
          Pull · flash
        </Key>
        <Key bus={bus} action="autoHighBeam" active={sim.body.autoHighBeam} led="green">
          Auto high beam
        </Key>
      </div>
    </div>
  );
}

const WIPERS: { mode: WiperMode; label: string }[] = [
  { mode: 'fast', label: 'Fast' },
  { mode: 'slow', label: 'Slow' },
  { mode: 'interval', label: 'Interval' },
  { mode: 'auto', label: 'Auto' },
  { mode: 'off', label: 'Off' },
];

function RightStalk({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const sim = source.sim;
  const idx = WIPERS.findIndex((w) => w.mode === sim.body.wipers);
  return (
    <div className="stalk" aria-label="Right stalk: wipers">
      <svg viewBox="0 0 160 60" className="stalk-svg" aria-hidden>
        <g
          style={{
            transform: `rotate(${(2 - idx) * -7}deg)`,
            transformOrigin: '10px 30px',
            transition: 'transform 0.15s',
          }}
        >
          <rect x="10" y="24" width="132" height="12" rx="6" fill="#23262b" />
          <rect x="118" y="20" width="34" height="20" rx="10" fill="#2e3238" />
        </g>
      </svg>
      <div className="wiper-gate" role="radiogroup" aria-label="Wiper position">
        {WIPERS.map((w) => (
          <button
            key={w.mode}
            type="button"
            role="radio"
            aria-checked={sim.body.wipers === w.mode}
            className={`ck ck-xs ${sim.body.wipers === w.mode ? 'ck-on' : ''}`}
            onClick={() => source.setWipers(w.mode)}
            title={`Wipers: ${w.label} [${keyHint('wipersUp')}/${keyHint('wipersDown')}]`}
          >
            {w.label}
          </button>
        ))}
      </div>
      <div className="stalk-keys">
        <Key bus={bus} action="singleWipe">
          <Glyph name="wipe" /> Single
        </Key>
        <Key bus={bus} action="washer" active={sim.body.washer}>
          <Glyph name="wash" /> Wash
        </Key>
      </div>
    </div>
  );
}

const LIGHTS: { pos: LightSwitch; label: string; angle: number }[] = [
  { pos: 'off', label: '0', angle: -60 },
  { pos: 'auto', label: 'AUTO', angle: -20 },
  { pos: 'parking', label: 'Parking', angle: 20 },
  { pos: 'low', label: 'Low beam', angle: 60 },
];

function LightSwitchKnob({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const body = source.sim.body;
  const current = LIGHTS.find((l) => l.pos === body.lightSwitch)!;
  return (
    <div className="lights" aria-label="Light switch">
      <div className="knob-wrap">
        <svg viewBox="0 0 120 120" className="knob" aria-hidden>
          <circle cx="60" cy="64" r="34" fill="#1b1e23" stroke="#2f343b" strokeWidth="3" />
          <g
            style={{
              transform: `rotate(${current.angle}deg)`,
              transformOrigin: '60px 64px',
              transition: 'transform 0.2s',
            }}
          >
            <rect x="57" y="34" width="6" height="22" rx="3" fill="#e9edf2" />
          </g>
        </svg>
        {LIGHTS.map((l) => (
          <button
            key={l.pos}
            type="button"
            className={`knob-pos ${l.pos === body.lightSwitch ? 'knob-pos-on' : ''}`}
            style={{
              left: `${50 + Math.sin((l.angle * Math.PI) / 180) * 46}%`,
              top: `${53 - Math.cos((l.angle * Math.PI) / 180) * 50}%`,
            }}
            onClick={() => source.setLightSwitch(l.pos)}
            title={`Lights: ${l.label} [${keyHint('lightSwitch')}]`}
            aria-pressed={l.pos === body.lightSwitch}
          >
            {l.pos === 'low' ? (
              <Icon id="lowBeam" size={16} />
            ) : l.pos === 'parking' ? (
              <Icon id="parkingLights" size={16} />
            ) : (
              l.label
            )}
          </button>
        ))}
      </div>
      <div className="pad-row">
        <Key bus={bus} action="fog" active={body.fog} led="green" className="ck-sm">
          <Icon id="fog" />
        </Key>
        <Key bus={bus} action="fogRear" active={body.fogRear} led="amber" className="ck-sm">
          <Icon id="fogRear" />
        </Key>
      </div>
    </div>
  );
}

function Console({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const sim = source.sim;
  const sel = sim.state.selector;
  const prog = sim.gearProgram;
  const b = source.buttons;
  const gate: { a: Action; label: string; on: boolean }[] = [
    { a: 'gearP', label: 'P', on: sel === 'P' },
    { a: 'gearR', label: 'R', on: sel === 'R' },
    { a: 'gearN', label: 'N', on: sel === 'N' },
    { a: 'gearD', label: 'D', on: sel === 'D' && prog === 'D' },
  ];
  return (
    <div className="console" aria-label="Centre console">
      <div className="selector" role="group" aria-label="Gear selector">
        <div className="gate">
          {gate.map((g) => (
            <Key key={g.a} bus={bus} action={g.a} active={g.on} className="gate-pos">
              {g.label}
            </Key>
          ))}
        </div>
        {sim.isElectric ? (
          <div className="gate gate-side">
            <Key
              bus={bus}
              action="gearS"
              active={sel === 'D' && sim.state.evB}
              className="gate-pos"
            >
              B
            </Key>
          </div>
        ) : (
          <div className="gate gate-side">
            <Key bus={bus} action="gearS" active={sel === 'D' && prog === 'S'} className="gate-pos">
              S
            </Key>
            <Key bus={bus} action="gearM" active={sel === 'D' && prog === 'M'} className="gate-pos">
              M
            </Key>
          </div>
        )}
      </div>
      <div className="console-grid">
        <Key bus={bus} action="driveMode" active={sim.driveModes.state.current !== 'normal'}>
          <Glyph name="mode" /> {MODES[sim.driveModes.state.current].label}
        </Key>
        <Key bus={bus} action="hazard" active={sim.body.hazard} className="ck-hazard">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path
              d="M12 3 22 20H2z M12 8 17.5 17.5H6.5z"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </Key>
        <Key bus={bus} action="startStop" active={b.startStopOff} led="amber">
          <Glyph name="startStop" /> Off
        </Key>
        <Key bus={bus} action="esc" active={b.esc !== 'on'} led="amber">
          <Glyph name="esc" /> {b.esc === 'sport' ? 'Sport' : 'Off'}
        </Key>
        <Key bus={bus} action="autoHold" active={b.autoHold} led="green">
          <Glyph name="hold" /> Hold
        </Key>
        <Key bus={bus} action="parkAssist" active={b.parkAssist} led="amber">
          <Glyph name="park" />
        </Key>
      </div>
      <Key bus={bus} action="start" className="start-btn" active={sim.state.ready} led="green">
        <Glyph name="power" size={20} />
        <span>
          ENGINE
          <br />
          START STOP
        </span>
      </Key>
    </div>
  );
}

function Pedal({
  bus,
  which,
  value,
}: {
  bus: ControlBus;
  which: 'throttle' | 'brake';
  value: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (clientY: number): void => {
    const r = ref.current!.getBoundingClientRect();
    bus.setPedal(which, Math.max(0, Math.min(1, (clientY - r.top) / r.height)));
  };
  const label = which === 'brake' ? 'Brake' : 'Accelerator';
  return (
    <div className={`pedal pedal-${which}`}>
      <div
        ref={ref}
        className="pedal-track"
        role="slider"
        aria-label={`${label} pedal`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(value * 100)}
        tabIndex={0}
        title={`${label} [${keyHint(which)}] — drag down`}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e.clientY);
        }}
        onPointerMove={(e) => {
          if (e.buttons) set(e.clientY);
        }}
        onPointerUp={() => bus.setPedal(which, null)}
        onPointerCancel={() => bus.setPedal(which, null)}
      >
        <div
          className="pedal-pad"
          style={{ transform: `translateY(${value * 46}%) rotateX(${value * 18}deg)` }}
        />
      </div>
      <span className="pedal-label">{label}</span>
    </div>
  );
}

/**
 * The car's controls, laid out like a cockpit: light switch, left stalk,
 * steering wheel (cluster pad, assist pad, paddles), right stalk, centre
 * console (selector, buttons, start), pedals.
 */
export function ControlPanel({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  usePoll(12);
  const pedals = { throttle: source.sim.state.throttle, brake: source.sim.state.brake };
  return (
    <section className="cockpit-controls" aria-label="Car controls">
      <LightSwitchKnob bus={bus} source={source} />
      <LeftStalk bus={bus} source={source} />
      <SteeringWheel bus={bus} source={source} />
      <RightStalk bus={bus} source={source} />
      <Console bus={bus} source={source} />
      <div className="pedals" aria-label="Pedals">
        <Pedal bus={bus} which="brake" value={pedals.brake} />
        <Pedal bus={bus} which="throttle" value={pedals.throttle} />
      </div>
    </section>
  );
}
