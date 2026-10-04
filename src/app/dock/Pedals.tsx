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
          <rect x="35" y="0" width="10" height="44" rx="3" fill="#1a1d22" />
          <g ref={brake} className="pad" style={{ transformOrigin: '40px 40px' }}>
            <path d="M8 40 L72 40 L66 96 Q40 102 14 96 Z" className="pad-face" />
            {[52, 62, 72, 82].map((y) => (
              <path key={y} d={`M16 ${y} L64 ${y}`} className="pad-rib" />
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
            <path d="M8 6 Q25 2 42 6 L44 104 L6 104 Z" className="pad-face" />
            {[22, 34, 46, 58, 70, 82].map((y) => (
              <path key={y} d={`M14 ${y} L36 ${y}`} className="pad-rib" />
            ))}
          </g>
          <rect x="4" y="102" width="42" height="6" rx="2" fill="#15171b" />
        </svg>
      </HoldButton>
    </div>
  );
}
