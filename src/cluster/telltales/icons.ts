/**
 * Original telltale artwork on a 24×24 grid, following ISO 2575 meanings.
 * Each icon is a list of parts: filled or stroked SVG path data, or short text.
 */
export type IconPart =
  | { kind: 'fill'; d: string }
  | { kind: 'stroke'; d: string; width?: number }
  | { kind: 'text'; text: string; x: number; y: number; size: number; weight?: number };

export type IconId =
  | 'indicatorLeft'
  | 'indicatorRight'
  | 'lowBeam'
  | 'highBeam'
  | 'fog'
  | 'fogRear'
  | 'parkingLights'
  | 'parkingBrake'
  | 'checkEngine'
  | 'battery'
  | 'oilPressure'
  | 'coolantTemp'
  | 'abs'
  | 'airbag'
  | 'seatbelt'
  | 'lowFuel'
  | 'doorOpen'
  | 'tpms'
  | 'tcs'
  | 'escOff'
  | 'glowPlug'
  | 'cruise'
  | 'ice'
  | 'fuel'
  | 'coolant'
  | 'phone'
  | 'signal'
  | 'laneAssist'
  | 'modeEco'
  | 'modeComfort'
  | 'modeNormal'
  | 'modeSport'
  | 'modeIndividual'
  | 'modeSnow'
  | 'modeOffroad'
  | 'hillDescent'
  | 'chargeLevel'
  | 'check'
  | 'acc'
  | 'limiter'
  | 'steering'
  | 'assisted'
  | 'collision'
  | 'collisionOff'
  | 'distance'
  | 'blindSpot'
  | 'crossTraffic'
  | 'autoHold'
  | 'startStop'
  | 'startStopOff'
  | 'dpf'
  | 'def'
  | 'brake'
  | 'steeringFault'
  | 'transmission'
  | 'washer'
  | 'brakePads'
  | 'bulb'
  | 'key'
  | 'service'
  | 'message'
  | 'hood'
  | 'coolantLevel'
  | 'coffee'
  | 'autoHighBeam'
  | 'parkAssist'
  | 'wiperAuto';

const lamp = 'M13.5 5.5C18.5 5.5 21 8.5 21 12s-2.5 6.5-7.5 6.5z';

export const ICONS: Record<IconId, IconPart[]> = {
  indicatorLeft: [{ kind: 'fill', d: 'M2 12 11 3.5V8.5H22V15.5H11V20.5Z' }],
  indicatorRight: [{ kind: 'fill', d: 'M22 12 13 3.5V8.5H2V15.5H13V20.5Z' }],
  lowBeam: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 7.5 3.5 10M11 11 3.5 13.5M11 14.5 3.5 17', width: 1.8 },
  ],
  highBeam: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 7H3M11 10.3H3M11 13.7H3M11 17H3', width: 1.8 },
  ],
  fog: [
    { kind: 'fill', d: lamp },
    { kind: 'stroke', d: 'M11 8H4M11 12H4M11 16H4', width: 1.6 },
    { kind: 'stroke', d: 'M8 5.5c1.5 1.6-1.5 3.2 0 4.8s-1.5 3.2 0 4.8 1.5 3.2 0 3.6', width: 1.4 },
  ],
  fogRear: [
    // Lamp facing right (towards the rear), horizontal rays crossed by a wavy line.
    { kind: 'fill', d: 'M10.5 5.5C5.5 5.5 3 8.5 3 12s2.5 6.5 7.5 6.5z' },
    { kind: 'stroke', d: 'M13 8h7M13 12h7M13 16h7', width: 1.6 },
    { kind: 'stroke', d: 'M16 5.5c1.5 1.6-1.5 3.2 0 4.8s-1.5 3.2 0 4.8 1.5 3.2 0 3.6', width: 1.4 },
  ],
  parkingLights: [
    // Two small lamps facing away from each other with short rays.
    { kind: 'stroke', d: 'M9.5 8a4 4 0 0 0 0 8M14.5 8a4 4 0 0 1 0 8', width: 1.8 },
    {
      kind: 'stroke',
      d: 'M6 9.5 3 8.5M6 14.5l-3 1M18 9.5l3-1M18 14.5l3 1M5.5 12H2.5M18.5 12h3',
      width: 1.5,
    },
  ],
  parkingBrake: [
    { kind: 'stroke', d: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z', width: 1.8 },
    { kind: 'stroke', d: 'M4 6.5a10 10 0 0 0 0 11M20 6.5a10 10 0 0 1 0 11', width: 1.6 },
    { kind: 'text', text: 'P', x: 12, y: 16.2, size: 10, weight: 700 },
  ],
  checkEngine: [
    {
      kind: 'stroke',
      d: 'M3 10.5h2V9h2V7h3V5.5h5V7h-2v1h3.5l2 2H21V8h1.5v7.5H21v-2h-2.5v3h-2l-2 2H8l-1.5-1.5H5v-1.5H3z',
      width: 1.7,
    },
  ],
  battery: [
    { kind: 'stroke', d: 'M3 7.5h18v11H3z', width: 1.8 },
    { kind: 'fill', d: 'M5.5 5h3.5v2.5H5.5zM15 5h3.5v2.5H15z' },
    { kind: 'stroke', d: 'M6 13h4M15 13h4M17 11v4', width: 1.6 },
  ],
  oilPressure: [
    { kind: 'stroke', d: 'M2.5 9.5h3l1.5-1.5h6l7 3.5-1 1-3-1.2V16H5V12H2.5z', width: 1.6 },
    { kind: 'stroke', d: 'M9.5 8V6.2h2.5', width: 1.6 },
    { kind: 'fill', d: 'M21 14.5c.8 1.2 1.2 2 1.2 2.6a1.2 1.2 0 0 1-2.4 0c0-.6.4-1.4 1.2-2.6z' },
  ],
  coolantTemp: [
    { kind: 'stroke', d: 'M12 3v10M12 6h3M12 8.8h3M12 11.6h3', width: 1.8 },
    { kind: 'fill', d: 'M12 12.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z' },
    { kind: 'stroke', d: 'M3 19.5c1.5-1 3-1 4.5 0s3 1 4.5 0 3-1 4.5 0 3 1 4.5 0', width: 1.5 },
  ],
  abs: [
    { kind: 'stroke', d: 'M12 4.5a7.5 7.5 0 1 1 0 15a7.5 7.5 0 1 1 0-15z', width: 1.6 },
    { kind: 'stroke', d: 'M3.8 6.5a10 10 0 0 0 0 11M20.2 6.5a10 10 0 0 1 0 11', width: 1.5 },
    { kind: 'text', text: 'ABS', x: 12, y: 14.6, size: 6.6, weight: 700 },
  ],
  airbag: [
    { kind: 'fill', d: 'M7 3.2a2 2 0 1 1 0 4a2 2 0 1 1 0-4z' },
    { kind: 'stroke', d: 'M6.5 9v6.5h5l2 5M6.5 12.5H10', width: 1.9 },
    { kind: 'fill', d: 'M17 8.5a4.3 4.3 0 1 1 0 8.6a4.3 4.3 0 1 1 0-8.6z' },
  ],
  seatbelt: [
    { kind: 'fill', d: 'M11 2.8a2.2 2.2 0 1 1 0 4.4a2.2 2.2 0 1 1 0-4.4z' },
    { kind: 'stroke', d: 'M8 21v-6l-1-5.5h8l-1 5.5v6', width: 1.8 },
    { kind: 'stroke', d: 'M15.5 9 7.5 17.5', width: 2 },
  ],
  lowFuel: [
    {
      kind: 'stroke',
      d: 'M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M2.5 20h12',
      width: 1.8,
    },
    { kind: 'fill', d: 'M6 6.5h5v4H6z' },
    { kind: 'stroke', d: 'M13 10h2.5l1.5 1.5v6a1.3 1.3 0 0 0 2.6 0V9l-2-2.5', width: 1.6 },
  ],
  doorOpen: [
    { kind: 'stroke', d: 'M8 3.5h8l1.5 3v12l-1.5 2H8l-1.5-2v-12z', width: 1.7 },
    { kind: 'stroke', d: 'M8.5 8h7M8.5 16h7', width: 1.3 },
    { kind: 'stroke', d: 'M6.5 9.5 2.5 13.5', width: 2 },
  ],
  tpms: [
    {
      kind: 'stroke',
      d: 'M6 5.5C3.5 8 3.2 14 5 17.5l1.2 1.5h11.6l1.2-1.5c1.8-3.5 1.5-9.5-1-12',
      width: 1.8,
    },
    { kind: 'stroke', d: 'M6.5 21h1.8M11.1 21h1.8M15.7 21h1.8', width: 1.6 },
    { kind: 'stroke', d: 'M12 7.5v6', width: 2 },
    { kind: 'fill', d: 'M12 15.4a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z' },
  ],
  tcs: [
    { kind: 'stroke', d: 'M5 13l1.5-4.5h11L19 13v3H5zM7.5 16v1.5M16.5 16v1.5', width: 1.7 },
    {
      kind: 'stroke',
      d: 'M6 20.5c1-1 2-1 3 0M10.5 20.5c1-1 2-1 3 0M15 20.5c1-1 2-1 3 0M9 3.5c-1 1-1 2 0 3M15 3.5c-1 1-1 2 0 3',
      width: 1.4,
    },
  ],
  escOff: [
    // Skidding car with "OFF" underneath.
    { kind: 'stroke', d: 'M5 11l1.5-4h11L19 11v3H5zM7.5 14v1.5M16.5 14v1.5', width: 1.6 },
    { kind: 'text', text: 'OFF', x: 12, y: 22, size: 6.5, weight: 700 },
  ],
  glowPlug: [
    {
      kind: 'stroke',
      d: 'M3 12h3c0-3 2.5-3 2.5 0s2.5 3 2.5 0 2.5-3 2.5 0 2.5 3 2.5 0H21',
      width: 1.8,
    },
    { kind: 'stroke', d: 'M3 7h18M3 17h18', width: 1.2 },
  ],
  cruise: [
    { kind: 'stroke', d: 'M4.5 17a8 8 0 1 1 15 0', width: 1.8 },
    { kind: 'stroke', d: 'M12 15 16 9.5', width: 2 },
    { kind: 'stroke', d: 'M3 20h7', width: 1.6 },
  ],
  ice: [
    {
      kind: 'stroke',
      d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2',
      width: 1.6,
    },
  ],
  fuel: [
    {
      kind: 'stroke',
      d: 'M4 20V5.5A1.5 1.5 0 0 1 5.5 4h6A1.5 1.5 0 0 1 13 5.5V20M2.5 20h12',
      width: 1.8,
    },
    { kind: 'fill', d: 'M6 6.5h5v4H6z' },
    { kind: 'stroke', d: 'M13 10h2.5l1.5 1.5v6a1.3 1.3 0 0 0 2.6 0V9l-2-2.5', width: 1.6 },
  ],
  coolant: [
    { kind: 'stroke', d: 'M12 3v10M12 6h3M12 8.8h3', width: 1.8 },
    { kind: 'fill', d: 'M12 12.2a2.6 2.6 0 1 1 0 5.2a2.6 2.6 0 1 1 0-5.2z' },
    { kind: 'stroke', d: 'M4 20c1.3-.9 2.7-.9 4 0s2.7.9 4 0 2.7-.9 4 0 2.7.9 4 0', width: 1.5 },
  ],
  phone: [
    {
      kind: 'stroke',
      d: 'M7 3.5h3l1.5 4-2 1.5a10 10 0 0 0 5.5 5.5l1.5-2 4 1.5v3a2 2 0 0 1-2 2A15 15 0 0 1 5 5.5a2 2 0 0 1 2-2z',
      width: 1.6,
    },
  ],
  signal: [{ kind: 'fill', d: 'M3 17h3v3H3zM8 13h3v7H8zM13 9h3v11h-3zM18 5h3v15h-3z' }],
  laneAssist: [
    // Lane markings in perspective with the car between them.
    { kind: 'stroke', d: 'M3.5 21 8 4M20.5 21 16 4', width: 1.8 },
    { kind: 'fill', d: 'M9.2 13.5h5.6l1 3v3.5h-1.6v-1.2H9.8v1.2H8.2V16.5z' },
  ],
  // Driving modes (original generic symbols).
  modeEco: [
    { kind: 'stroke', d: 'M5 19.5C4 10.5 10 4.5 20 4c.5 9.5-5.5 15.5-15 15.5z', width: 1.8 },
    { kind: 'stroke', d: 'M5 19.5 14.5 10', width: 1.6 },
  ],
  modeComfort: [
    { kind: 'stroke', d: 'M3 9c3-2.5 6-2.5 9 0s6 2.5 9 0', width: 1.8 },
    { kind: 'stroke', d: 'M3 15c3-2.5 6-2.5 9 0s6 2.5 9 0', width: 1.8 },
  ],
  modeNormal: [
    {
      kind: 'stroke',
      d: 'M3 15.5v-2.5l2.5-1 2.5-3.5h7l3 3.5 3 1v2.5h-2M3 15.5h2.2M9.8 15.5h4.4',
      width: 1.6,
    },
    {
      kind: 'stroke',
      d: 'M7.5 17.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 1 0 0 3.6zM16.5 17.3a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 1 0 0 3.6z',
      width: 1.5,
    },
  ],
  modeSport: [
    { kind: 'stroke', d: 'M4.5 17.5a8 8 0 1 1 15 0', width: 1.8 },
    { kind: 'stroke', d: 'M12 15 18 10.5', width: 2.2 },
    { kind: 'fill', d: 'M15.5 5.2l1.6.9-.9 1.6-1.6-.9zM18.4 7.8l1.2 1.3-1.3 1.2-1.2-1.3z' },
  ],
  modeIndividual: [
    { kind: 'stroke', d: 'M6 4v16M12 4v16M18 4v16', width: 1.4 },
    { kind: 'fill', d: 'M3.8 13h4.4v3H3.8zM9.8 7h4.4v3H9.8zM15.8 11h4.4v3h-4.4z' },
  ],
  modeSnow: [
    {
      kind: 'stroke',
      d: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M10 4.5l2 2 2-2M10 19.5l2-2 2 2',
      width: 1.6,
    },
  ],
  modeOffroad: [
    { kind: 'fill', d: 'M1.5 20 8.5 8.5l3.8 5.6 2.8-3.9L22.5 20z' },
    { kind: 'stroke', d: 'M15.5 6.5a1.8 1.8 0 1 0 0-.01', width: 1.4 },
  ],
  hillDescent: [
    { kind: 'stroke', d: 'M2.5 8 21.5 20', width: 1.6 },
    {
      kind: 'fill',
      d: 'M6.2 7.2l7 4.4-1 1.6-.9-.6-.6 1-1.4-.9.6-1-3.4-2.1-.6 1-1.4-.9.6-1-.8-.5z',
    },
    { kind: 'stroke', d: 'M18 3.5v6M15.8 7.5l2.2 2.3 2.2-2.3', width: 1.6 },
  ],
  chargeLevel: [
    { kind: 'stroke', d: 'M7 5.5h10v15H7zM10 3.5h4', width: 1.7 },
    { kind: 'fill', d: 'M12.8 7.8 9.5 13.3h2.3l-.6 4.9 3.3-5.5h-2.3z' },
  ],
  check: [{ kind: 'stroke', d: 'M5 12.5 10 17.5 19.5 7', width: 2.2 }],
  // Adaptive cruise: speedometer arc with a car ahead (original symbol).
  acc: [
    { kind: 'stroke', d: 'M3.5 19a8.5 8.5 0 0 1 17 0', width: 1.7 },
    { kind: 'stroke', d: 'M12 18.5 15.5 13', width: 1.9 },
    { kind: 'fill', d: 'M8.6 3h6.8l1.1 2.6v3H15v-1H9v1H7.5v-3z' },
  ],
  // Steering wheel (hands-off warnings).
  steering: [
    { kind: 'stroke', d: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17z', width: 1.8 },
    { kind: 'stroke', d: 'M3.8 11.2h5.4l1.6 2.3h2.4l1.6-2.3h5.4M12 13.5v6.8', width: 1.8 },
  ],
  // Assisted driving: steering wheel between lane lines.
  assisted: [
    { kind: 'stroke', d: 'M2.5 21 6 3M21.5 21 18 3', width: 1.6 },
    { kind: 'stroke', d: 'M12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11z', width: 1.6 },
    { kind: 'stroke', d: 'M6.8 11.5h3.4l1 1.4h1.6l1-1.4h3.4M12 12.9v4.4', width: 1.4 },
  ],
  // Collision warning: car from behind with impact marks above.
  collision: [
    { kind: 'fill', d: 'M6.5 13.5 8.3 9h7.4l1.8 4.5v5h-2v-1.5h-7v1.5h-2z' },
    { kind: 'stroke', d: 'M12 2.5v3.2M7.2 4l1.4 2.4M16.8 4l-1.4 2.4', width: 1.8 },
  ],
  collisionOff: [
    { kind: 'fill', d: 'M3.5 13.5 5.3 9h7.4l1.8 4.5v5h-2v-1.5h-7v1.5h-2z' },
    { kind: 'stroke', d: 'M9 2.5v3.2M4.2 4l1.4 2.4M13.8 4l-1.4 2.4', width: 1.6 },
    { kind: 'text', text: 'OFF', x: 19, y: 23, size: 7, weight: 700 },
  ],
  // Distance warning: two cars one behind the other with a short gap.
  distance: [
    { kind: 'fill', d: 'M8.5 5.5 9.4 3h5.2l.9 2.5v3h-1.4v-1h-4.4v1H8.5z' },
    { kind: 'fill', d: 'M6.5 13.5 8.3 9h7.4l1.8 4.5v5h-2v-1.5h-7v1.5h-2z' },
    { kind: 'stroke', d: 'M4 11h1.5M18.5 11H20', width: 1.4 },
  ],
  // Blind spot: car with waves to the side.
  blindSpot: [
    { kind: 'fill', d: 'M9 6.5h6l1 2v10h-8v-10z' },
    { kind: 'stroke', d: 'M18.5 9a5 5 0 0 1 0 7M21 7a8 8 0 0 1 0 11', width: 1.5 },
  ],
  // Rear cross traffic: car seen from above with arrows crossing behind it.
  crossTraffic: [
    { kind: 'fill', d: 'M9 2.5h6l1 2v9H8v-9z' },
    { kind: 'stroke', d: 'M3 18h18M6 15.5 3 18l3 2.5M18 15.5l3 2.5-3 2.5', width: 1.6 },
  ],
  // Auto Hold: a circled A between brake-drum brackets.
  autoHold: [
    { kind: 'stroke', d: 'M12 5a7 7 0 1 0 0 14a7 7 0 1 0 0-14z', width: 1.7 },
    { kind: 'stroke', d: 'M3.5 7.5a10 10 0 0 0 0 9M20.5 7.5a10 10 0 0 1 0 9', width: 1.6 },
    { kind: 'text', text: 'A', x: 12, y: 15.6, size: 9, weight: 700 },
  ],
  // Start-stop: an A inside a circular arrow (ISO 2575 meaning).
  startStop: [
    { kind: 'stroke', d: 'M18.5 7.5A8 8 0 1 0 20 12', width: 1.8 },
    { kind: 'fill', d: 'M21 4.5v5.2h-5.2z' },
    { kind: 'text', text: 'A', x: 12, y: 15.8, size: 10, weight: 700 },
  ],
  startStopOff: [
    { kind: 'stroke', d: 'M18.5 7.5A8 8 0 1 0 20 12', width: 1.8 },
    { kind: 'fill', d: 'M21 4.5v5.2h-5.2z' },
    { kind: 'text', text: 'A', x: 12, y: 15.8, size: 10, weight: 700 },
    { kind: 'stroke', d: 'M4 20 20 4', width: 1.8 },
  ],
  // Particulate filter: a filter block with soot dots and exhaust flow.
  dpf: [
    { kind: 'stroke', d: 'M5 7h14v10H5zM2 12h3M19 12h3', width: 1.6 },
    {
      kind: 'fill',
      d: 'M8 9.3h1.6v1.6H8zM11.2 9.3h1.6v1.6h-1.6zM14.4 9.3H16v1.6h-1.6zM9.6 13h1.6v1.6H9.6zM12.8 13h1.6v1.6h-1.6z',
    },
  ],
  // Diesel exhaust fluid: a filler drop with a nozzle.
  def: [
    { kind: 'stroke', d: 'M12 5c3 4 5 6.5 5 9a5 5 0 0 1-10 0c0-2.5 2-5 5-9z', width: 1.7 },
    { kind: 'stroke', d: 'M15 3.5h5l1 2', width: 1.5 },
    { kind: 'text', text: 'DEF', x: 12, y: 16.5, size: 5.5, weight: 700 },
  ],
  // Brake system: exclamation in a circle between two arcs (ISO 2575).
  brake: [
    { kind: 'stroke', d: 'M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', width: 1.8 },
    { kind: 'stroke', d: 'M4.5 6.5a8.5 8.5 0 0 0 0 11M19.5 6.5a8.5 8.5 0 0 1 0 11', width: 1.6 },
    { kind: 'stroke', d: 'M12 8.5v4.5', width: 2 },
    { kind: 'fill', d: 'M11 14.6h2v2h-2z' },
  ],
  // Power steering fault: steering wheel with an exclamation mark.
  steeringFault: [
    { kind: 'stroke', d: 'M10 4a7.5 7.5 0 1 0 6.5 4', width: 1.7 },
    { kind: 'stroke', d: 'M3 11.5h4.7l1.4 2h1.8M9 13.5v6', width: 1.6 },
    { kind: 'stroke', d: 'M19 2.5v6', width: 2 },
    { kind: 'fill', d: 'M18 10.2h2v2h-2z' },
  ],
  // Gearbox temperature: gear wheel with a thermometer.
  transmission: [
    {
      kind: 'stroke',
      d: 'M9 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM9 3.5v2M9 18.5v2M3.5 12h-2M16.5 12h-2',
      width: 1.6,
    },
    { kind: 'stroke', d: 'M19.5 3.5v11', width: 1.6 },
    { kind: 'fill', d: 'M19.5 14a2.3 2.3 0 1 1 0 4.6a2.3 2.3 0 1 1 0-4.6z' },
  ],
  // Washer fluid: windscreen with a spray fan.
  washer: [
    { kind: 'stroke', d: 'M3 18c5-3 13-3 18 0M5 18l1.5-7h11l1.5 7', width: 1.6 },
    { kind: 'stroke', d: 'M12 11V6M9 7l3-2.5L15 7M7.5 9.5 12 4.5l4.5 5', width: 1.3 },
  ],
  // Brake pads worn: disc in brackets with dashed wear marks.
  brakePads: [
    { kind: 'stroke', d: 'M12 6a6 6 0 1 0 0 12a6 6 0 1 0 0-12z', width: 1.6 },
    { kind: 'stroke', d: 'M4.5 6.5a8.5 8.5 0 0 0 0 11M19.5 6.5a8.5 8.5 0 0 1 0 11', width: 1.6 },
    { kind: 'stroke', d: 'M2 12h1.5M20.5 12H22M12 9v6', width: 1.4 },
  ],
  // Bulb failure: lamp bulb with an exclamation mark.
  bulb: [
    {
      kind: 'stroke',
      d: 'M9 17h6M9.5 19.5h5M8.5 15c-1.6-1.3-2.5-3-2.5-5a6 6 0 0 1 12 0c0 2-.9 3.7-2.5 5z',
      width: 1.6,
    },
    { kind: 'stroke', d: 'M12 6.5v4', width: 1.8 },
    { kind: 'fill', d: 'M11.1 11.7h1.8v1.8h-1.8z' },
  ],
  // Key battery: key fob with a small battery.
  key: [
    {
      kind: 'stroke',
      d: 'M7 3.5h6a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z',
      width: 1.6,
    },
    { kind: 'stroke', d: 'M17.5 8.5h3.5v6h-3.5zM18.5 7.5h1.5', width: 1.3 },
    { kind: 'fill', d: 'M8 7h4v2.2H8z' },
  ],
  // Service due: spanner.
  service: [
    {
      kind: 'stroke',
      d: 'M14.5 4a4.5 4.5 0 0 0-4.3 5.8L3.7 16.3a1.6 1.6 0 0 0 2.3 2.3l6.5-6.5A4.5 4.5 0 0 0 18.4 8l-2.6 2.6-2.4-.6-.6-2.4L15.4 5A4.5 4.5 0 0 0 14.5 4z',
      width: 1.6,
    },
  ],
  // Vehicle messages waiting: warning triangle.
  message: [
    { kind: 'stroke', d: 'M12 3.5 21.5 20h-19z', width: 1.7 },
    { kind: 'stroke', d: 'M12 9.5v5', width: 1.9 },
    { kind: 'fill', d: 'M11 16.2h2v2h-2z' },
  ],
  // Bonnet open: car from the side with the front lid raised.
  hood: [
    { kind: 'stroke', d: 'M3 17h18v-3.5l-3-1-3-4H9.5', width: 1.6 },
    { kind: 'stroke', d: 'M3 17v-3l6-1.5L4 7', width: 1.6 },
    { kind: 'stroke', d: 'M7 19a1.5 1.5 0 1 0 0-.01M17 19a1.5 1.5 0 1 0 0-.01', width: 1.5 },
  ],
  // Coolant level: tank with a level line and waves.
  coolantLevel: [
    { kind: 'stroke', d: 'M6 4h12v11H6zM6 9h12', width: 1.6 },
    { kind: 'stroke', d: 'M4 20c1.3-.9 2.7-.9 4 0s2.7.9 4 0 2.7-.9 4 0 2.7.9 4 0', width: 1.5 },
  ],
  // Fatigue: a cup of coffee with steam.
  coffee: [
    {
      kind: 'stroke',
      d: 'M4.5 10h11v4.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5zM15.5 11.5h1.8a2.2 2.2 0 0 1 0 4.4h-2.2',
      width: 1.7,
    },
    {
      kind: 'stroke',
      d: 'M8 3.5c-1 1.5 1 2.5 0 4M11.5 3.5c-1 1.5 1 2.5 0 4M3 21.5h15',
      width: 1.5,
    },
  ],
  // Auto high beam: headlamp with straight rays and an A.
  autoHighBeam: [
    { kind: 'fill', d: 'M12.5 6C17 6 19.5 8.5 19.5 12s-2.5 6-7 6z' },
    { kind: 'stroke', d: 'M3 7h7M3 10.3h7M3 13.7h7M3 17h7', width: 1.6 },
    { kind: 'text', text: 'A', x: 15.8, y: 15.3, size: 8, weight: 800 },
  ],
  // Park assist: car from above with sensor arcs at both ends.
  parkAssist: [
    { kind: 'stroke', d: 'M9 6.5h6v11H9z', width: 1.6 },
    {
      kind: 'stroke',
      d: 'M8 4a6 6 0 0 1 8 0M7 1.8a9 9 0 0 1 10 0M8 20a6 6 0 0 0 8 0M7 22.2a9 9 0 0 0 10 0',
      width: 1.4,
    },
  ],
  // Rain-sensing wipers active: wiper arc with an A.
  wiperAuto: [
    { kind: 'stroke', d: 'M3 17a10 10 0 0 1 18 0M12 17 6.5 9.5', width: 1.7 },
    { kind: 'text', text: 'A', x: 15, y: 15.5, size: 8, weight: 800 },
  ],
  // Speed limiter: speedometer arc with a stop bar at the top.
  limiter: [
    { kind: 'stroke', d: 'M4.5 18a7.5 7.5 0 0 1 15 0', width: 1.7 },
    { kind: 'stroke', d: 'M12 17.5 15 12', width: 1.9 },
    { kind: 'stroke', d: 'M8 4.5h8', width: 2.2 },
  ],
};

const cache = new Map<string, Path2D>();

function path(d: string): Path2D {
  let p = cache.get(d);
  if (!p) {
    p = new Path2D(d);
    cache.set(d, p);
  }
  return p;
}

/** Draw an icon centred at (x, y), `size` px square, in one colour. */
export function drawIcon(
  ctx: CanvasRenderingContext2D,
  id: IconId,
  x: number,
  y: number,
  size: number,
  color: string,
  family = 'sans-serif',
): void {
  const s = size / 24;
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const part of ICONS[id]) {
    if (part.kind === 'fill') ctx.fill(path(part.d));
    else if (part.kind === 'stroke') {
      ctx.lineWidth = part.width ?? 1.8;
      ctx.stroke(path(part.d));
    } else {
      ctx.font = `${part.weight ?? 600} ${part.size}px ${family}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(part.text, part.x, part.y);
    }
  }
  ctx.restore();
}
