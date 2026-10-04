import { useRef } from 'react';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { S } from '@/core/signals/catalog';
import type { SignalStore } from '@/core/signals/store';
import type { ControlBus } from '../controls/ControlBus';
import { HoldButton } from './HoldButton';
import { useFrame } from './useFrame';

interface Props {
  bus: ControlBus;
  source: SimulatorSource;
  store: SignalStore;
}

/**
 * The indicator stalk on the left of the column. Push up for right, down for
 * left; a tap gives three flashes, a hold latches. The green arrows blink with
 * the cluster's lamps (same signal), and the lever sits in its detent.
 */
export function Stalk({ bus, source, store }: Props) {
  const lever = useRef<SVGGElement>(null);
  const left = useRef<SVGPathElement>(null);
  const right = useRef<SVGPathElement>(null);
  useFrame(() => {
    const inputs = source.sim.inputs;
    const tilt = inputs.rightIndicator ? -9 : inputs.leftIndicator ? 9 : 0;
    lever.current?.setAttribute('transform', `rotate(${tilt} 150 70)`);
    left.current?.classList.toggle('arrow-on', store.value(S.IndicatorLeft) > 0);
    right.current?.classList.toggle('arrow-on', store.value(S.IndicatorRight) > 0);
  });
  return (
    <div className="stalk2" aria-label="Indicator stalk">
      <svg viewBox="0 0 170 140" className="stalk2-art" aria-hidden>
        <defs>
          <linearGradient id="st-lever" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3f47" />
            <stop offset="1" stopColor="#15171b" />
          </linearGradient>
        </defs>
        <path ref={right} className="arrow" d="M70 14 L88 26 L70 38 Z" />
        <path ref={left} className="arrow" d="M88 102 L70 114 L88 126 Z" />
        {/* Column shroud the stalk comes out of. */}
        <rect x="140" y="44" width="34" height="52" rx="10" fill="#121418" />
        <g ref={lever}>
          <rect x="34" y="63" width="122" height="14" rx="7" fill="url(#st-lever)" />
          <path d="M34 64 L150 64" stroke="rgba(255,255,255,0.14)" />
          <rect x="10" y="58" width="44" height="24" rx="12" fill="#2b2f36" />
          <path d="M16 60 L48 60" stroke="rgba(255,255,255,0.12)" strokeLinecap="round" />
        </g>
      </svg>
      <HoldButton
        bus={bus}
        action="indicatorRight"
        className="stalk-zone stalk-up"
        label="Indicate right (push up; tap = 3 flashes, hold = on)"
      >
        <span />
      </HoldButton>
      <HoldButton
        bus={bus}
        action="indicatorLeft"
        className="stalk-zone stalk-down"
        label="Indicate left (push down; tap = 3 flashes, hold = on)"
      >
        <span />
      </HoldButton>
    </div>
  );
}
