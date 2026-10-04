/** A comfort feature that costs energy (shown on the efficiency page). */
export interface Consumer {
  id: 'ac' | 'rearDefrost' | 'seatHeating' | 'lights';
  label: string;
  /** Electrical/mechanical load, kW. */
  kW: number;
}

export interface ConsumerInput {
  ambientC: number;
  /** Climate in eco: compressor works less hard. */
  ecoClimate: boolean;
  lowBeam: boolean;
  /** Minutes since ignition on (heaters switch themselves off). */
  minutesOn: number;
}

/**
 * Comfort consumers the climate control switches on by itself, with typical
 * loads: A/C compressor 1–3 kW in summer heat, heated rear window ~0.2 kW for
 * its first 10–15 minutes in the cold, seat heating ~0.1 kW, dipped beam ~0.1 kW.
 */
export function comfortConsumers(i: ConsumerInput): Consumer[] {
  const out: Consumer[] = [];
  if (i.ambientC > 18) {
    const kW = Math.min(3, (i.ambientC - 18) * 0.22) * (i.ecoClimate ? 0.7 : 1);
    out.push({ id: 'ac', label: 'Air conditioning', kW });
  }
  if (i.ambientC < 6 && i.minutesOn < 12)
    out.push({ id: 'rearDefrost', label: 'Rear window heating', kW: 0.2 });
  if (i.ambientC < 10) out.push({ id: 'seatHeating', label: 'Seat heating', kW: 0.1 });
  if (i.lowBeam) out.push({ id: 'lights', label: 'Headlights', kW: 0.1 });
  return out;
}

/**
 * Extra fuel for a load at the crankshaft, L/h. Petrol holds ~8.9 kWh/L and a
 * part-load engine plus alternator turns about 25 % of it into useful work.
 */
export function consumerFuelLh(kW: number): number {
  return kW / (8.9 * 0.25);
}

export interface TipInput {
  speedKmh: number;
  rpm: number;
  throttle: number;
  manualGears: boolean;
  consumersLh: number;
  coasting: boolean;
  ecoMode: boolean;
}

/**
 * One short eco tip, or null. Rules follow what mainstream cars show:
 * shift-up hints, speed above ~130 km/h, comfort consumers above ~0.5 L/h,
 * and a pointer to Eco mode when the driver keeps a light foot.
 */
export function ecoTip(i: TipInput): string | null {
  if (i.coasting) return null;
  if (i.manualGears && i.rpm > 3000 && i.throttle < 0.5) return 'Shift up earlier';
  if (i.speedKmh > 130) return 'Every 10 km/h less saves fuel';
  if (i.consumersLh > 0.5) return 'Comfort consumers raise consumption';
  if (!i.ecoMode && i.speedKmh > 60 && i.throttle < 0.25) return 'Eco mode can save fuel here';
  return null;
}

/** Structured efficiency data the cluster draws (scene snapshot). */
export interface EfficiencyState {
  consumers: Consumer[];
  consumersLh: number;
  tip: string | null;
}
