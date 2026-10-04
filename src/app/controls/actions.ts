/** Everything the driver can operate, plus a few demo controls. */
export type Action =
  // pedals and paddles
  | 'throttle'
  | 'brake'
  | 'paddleUp'
  | 'paddleDown'
  // left stalk
  | 'indicatorLeft'
  | 'indicatorRight'
  | 'highBeam'
  | 'flash'
  | 'autoHighBeam'
  // right stalk
  | 'wipersUp'
  | 'wipersDown'
  | 'singleWipe'
  | 'washer'
  // light switch
  | 'lightSwitch'
  | 'fog'
  | 'fogRear'
  // console
  | 'gearP'
  | 'gearR'
  | 'gearN'
  | 'gearD'
  | 'gearS'
  | 'gearM'
  | 'start'
  | 'hazard'
  | 'driveMode'
  | 'startStop'
  | 'esc'
  | 'autoHold'
  | 'parkAssist'
  // steering wheel, left (cluster)
  | 'scrollUp'
  | 'scrollDown'
  | 'ok'
  | 'left'
  | 'right'
  | 'view'
  | 'back'
  | 'home'
  // steering wheel, right (assist)
  | 'accMain'
  | 'accSet'
  | 'accRes'
  | 'accCancel'
  | 'accDistance'
  | 'laneAssist'
  | 'voice'
  | 'volumeUp'
  | 'volumeDown'
  // demo
  | 'demo'
  | 'night'
  | 'mute';

export interface ActionInfo {
  label: string;
  /** Keyboard keys (KeyboardEvent.key, lower case for letters). */
  keys: string[];
}

/** Keyboard map, shown in tooltips and the help overlay. */
export const ACTIONS: Record<Action, ActionInfo> = {
  throttle: { label: 'Accelerator', keys: ['w'] },
  brake: { label: 'Brake', keys: ['s'] },
  paddleUp: { label: 'Paddle +', keys: ['e'] },
  paddleDown: { label: 'Paddle −', keys: ['q'] },
  indicatorLeft: { label: 'Indicator left (tap = 3 flashes, hold = on)', keys: [','] },
  indicatorRight: { label: 'Indicator right (tap = 3 flashes, hold = on)', keys: ['.'] },
  highBeam: { label: 'High beam (push stalk)', keys: ['h'] },
  flash: { label: 'Headlight flash (pull stalk)', keys: ['j'] },
  autoHighBeam: { label: 'Auto high beam', keys: ['u'] },
  wipersUp: { label: 'Wipers faster', keys: [']'] },
  wipersDown: { label: 'Wipers slower', keys: ['['] },
  singleWipe: { label: 'Single wipe', keys: ['\\'] },
  washer: { label: 'Washer (hold)', keys: ["'"] },
  lightSwitch: { label: 'Light switch (off / auto / parking / low beam)', keys: ['l'] },
  fog: { label: 'Front fog lights', keys: ['f'] },
  fogRear: { label: 'Rear fog light', keys: ['g'] },
  gearP: { label: 'Selector P', keys: ['1'] },
  gearR: { label: 'Selector R', keys: ['2'] },
  gearN: { label: 'Selector N', keys: ['3'] },
  gearD: { label: 'Selector D', keys: ['4'] },
  gearS: { label: 'Selector S', keys: ['5'] },
  gearM: { label: 'Selector M (paddles)', keys: ['6'] },
  start: { label: 'Engine start/stop (with brake = start)', keys: ['k'] },
  hazard: { label: 'Hazard lights', keys: [' '] },
  driveMode: { label: 'Drive mode', keys: ['y'] },
  startStop: { label: 'Start-stop off', keys: ['o'] },
  esc: { label: 'ESC (tap = traction off, hold = sport)', keys: ['i'] },
  autoHold: { label: 'Auto Hold', keys: ['a'] },
  parkAssist: { label: 'Park assist', keys: ['b'] },
  scrollUp: { label: 'Scroll up', keys: ['arrowup'] },
  scrollDown: { label: 'Scroll down', keys: ['arrowdown'] },
  ok: { label: 'OK (press scroll wheel, hold = long press)', keys: ['enter'] },
  left: { label: 'Left', keys: ['arrowleft'] },
  right: { label: 'Right', keys: ['arrowright'] },
  view: { label: 'View', keys: ['v'] },
  back: { label: 'Menu / back', keys: ['escape', 'backspace'] },
  home: { label: 'Home', keys: ['home'] },
  accMain: { label: 'Cruise / ACC on-off (hold = limiter)', keys: ['c'] },
  accSet: { label: 'SET − (hold = −10)', keys: ['-'] },
  accRes: { label: 'RES + (hold = +10)', keys: ['='] },
  accCancel: { label: 'Cancel', keys: ['x'] },
  accDistance: { label: 'Distance', keys: ['z'] },
  laneAssist: { label: 'Lane assist', keys: ['n'] },
  voice: { label: 'Voice', keys: ['m'] },
  volumeUp: { label: 'Volume +', keys: ['pageup'] },
  volumeDown: { label: 'Volume −', keys: ['pagedown'] },
  demo: { label: 'Demo drive on/off', keys: ['p'] },
  night: { label: 'Night mode (auto / on / off)', keys: ['`'] },
  mute: { label: 'Sound on/off', keys: ['/'] },
};

export function keyHint(a: Action): string {
  const k = ACTIONS[a].keys[0] ?? '';
  const names: Record<string, string> = {
    ' ': 'Space',
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    enter: 'Enter',
    escape: 'Esc',
    pageup: 'PgUp',
    pagedown: 'PgDn',
    home: 'Home',
  };
  return names[k] ?? k.toUpperCase();
}

export const KEY_TO_ACTION: ReadonlyMap<string, Action> = new Map(
  (Object.entries(ACTIONS) as [Action, ActionInfo][]).flatMap(([a, info]) =>
    info.keys.map((k) => [k, a] as const),
  ),
);
