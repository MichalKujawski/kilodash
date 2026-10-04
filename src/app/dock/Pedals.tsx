import { useRef } from 'react';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import type { ControlBus } from '../controls/ControlBus';
import { HoldButton } from './HoldButton';
import { useFrame } from './useFrame';

/**
 * Brake (wide pad on an arm) and accelerator (floor-hinged organ pedal). Hold
 * to press: the keyboard-style ramp gives a smooth push. The pads tilt with
 * the real pedal position, whoever is pressing (you or brake assist).
 */
export function Pedals({ bus, source }: { bus: ControlBus; source: SimulatorSource }) {
  const brake = useRef<SVGGElement>(null);
  const gas = useRef<SVGGElement>(null);
  useFrame(() => {
    const st = source.sim.state;
    // Brake pad swings forward on its arm; the organ pedal tips about its floor hinge.
    if (brake.current)
      brake.current.style.transform = `translateY(${(st.brake * 8).toFixed(1)}px) scaleY(${(1 - st.brake * 0.16).toFixed(3)})`;
    if (gas.current) gas.current.style.transform = `scaleY(${(1 - st.throttle * 0.3).toFixed(3)})`;
    brake.current?.classList.toggle('pad-pressed', st.brake > 0.05);
    gas.current?.classList.toggle('pad-pressed', st.throttle > 0.05);
  });
  return (
    <div className="pedals2" aria-label="Pedals">
      <HoldButton bus={bus} action="brake" className="pedal2 pedal2-brake" label="Brake (hold)">
        <svg viewBox="0 0 80 110" aria-hidden>
          <defs>
            <linearGradient id="pd-rubber" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a2e34" />
              <stop offset="1" stopColor="#16181c" />
            </linearGradient>
          </defs>
          {/* Short arm stub; the rest is hidden under the dash. */}
          <rect x="34" y="14" width="12" height="34" rx="4" fill="#121418" />
          <g ref={brake} className="pad" style={{ transformOrigin: '40px 46px' }}>
            {/* Metal bezel, then the rubber pad with shallow moulded grooves. */}
            <rect x="9" y="42" width="62" height="56" rx="14" className="pad-bezel" />
            <rect
              x="12"
              y="45"
              width="56"
              height="50"
              rx="12"
              fill="url(#pd-rubber)"
              className="pad-face"
            />
            {[56, 64, 72, 80].map((y) => (
              <g key={y}>
                <path d={`M20 ${y} L60 ${y}`} className="pad-groove" />
                <path d={`M20 ${y + 1.6} L60 ${y + 1.6}`} className="pad-groove-lit" />
              </g>
            ))}
          </g>
        </svg>
      </HoldButton>
      <HoldButton
        bus={bus}
        action="throttle"
        className="pedal2 pedal2-gas"
        label="Accelerator (hold)"
      >
        <svg viewBox="0 0 50 110" aria-hidden>
          <g ref={gas} className="pad" style={{ transformOrigin: '25px 106px' }}>
            <path d="M6 8 Q25 2 44 8 L46 104 L4 104 Z" className="pad-bezel" />
            <path
              d="M9 10 Q25 5 41 10 L43 101 L7 101 Z"
              fill="url(#pd-rubber)"
              className="pad-face"
            />
            {[24, 36, 48, 60, 72, 84].map((y) => (
              <g key={y}>
                <path d={`M15 ${y} L35 ${y}`} className="pad-groove" />
                <path d={`M15 ${y + 1.6} L35 ${y + 1.6}`} className="pad-groove-lit" />
              </g>
            ))}
          </g>
          <rect x="4" y="102" width="42" height="6" rx="2" fill="#15171b" />
        </svg>
      </HoldButton>
    </div>
  );
}
