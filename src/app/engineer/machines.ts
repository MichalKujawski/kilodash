import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { MODES, type DriveModeId } from '@/core/drive/modes';

export interface MachineState {
  id: string;
  label: string;
  /** Grid position in the diagram (column, row). */
  col: number;
  row: number;
}

export interface Transition {
  from: string;
  to: string;
  /** What causes it, in a few words. */
  on: string;
}

export interface Machine {
  id: string;
  title: string;
  /** Feature doc (docs/features/<doc>.md) for "How it works". */
  doc: string;
  states: MachineState[];
  transitions: Transition[];
  /** The live state, read from the simulator (always one of `states`). */
  read: (src: SimulatorSource) => string;
}

const s = (id: string, col: number, row: number, label = id): MachineState => ({
  id,
  label,
  col,
  row,
});
const t = (from: string, to: string, on: string): Transition => ({ from, to, on });

/**
 * The car's behaviour as the state machines in `src/core` see it. Only the
 * picture lives here (layout, transition labels); the logic and the live
 * state come from the core classes themselves.
 */
export const MACHINES: Machine[] = [
  {
    id: 'acc',
    title: 'Adaptive cruise control',
    doc: 'speed-assist',
    states: [
      s('off', 0, 0),
      s('standby', 1, 0),
      s('active', 2, 0),
      s('overridden', 3, 0),
      s('interrupted', 2, 1),
      s('hold', 3, 1),
    ],
    transitions: [
      t('off', 'standby', 'main button'),
      t('standby', 'active', 'SET'),
      t('active', 'overridden', 'accelerator'),
      t('overridden', 'active', 'foot off'),
      t('active', 'interrupted', 'brake / cancel'),
      t('interrupted', 'active', 'RES'),
      t('active', 'hold', 'stopped behind car'),
      t('hold', 'active', 'RES / car drives off'),
      t('standby', 'off', 'main button'),
    ],
    read: (src) => src.assist.state,
  },
  {
    id: 'lane',
    title: 'Lane assist',
    doc: 'lane-assist',
    states: [
      s('off', 0, 0),
      s('standby', 1, 0),
      s('ready', 2, 0),
      s('centering', 3, 0),
      s('emergency', 3, 1),
    ],
    transitions: [
      t('off', 'standby', 'button'),
      t('standby', 'ready', 'lines, ≥ 60 km/h'),
      t('ready', 'centering', 'cruise engaged'),
      t('centering', 'ready', 'cruise off'),
      t('ready', 'standby', 'no lines / slow'),
      t('centering', 'emergency', 'no hands, no reply'),
      t('emergency', 'standby', 'driver takes over'),
    ],
    read: (src) => src.lane.state,
  },
  {
    id: 'fcw',
    title: 'Collision warning and emergency braking',
    doc: 'collision-assist',
    states: [
      s('distance', 0, 0),
      s('ready', 1, 0),
      s('prewarn', 2, 0),
      s('acute', 3, 0),
      s('unavailable', 0, 1),
      s('off', 1, 1),
      s('hold', 2, 1),
      s('braking', 3, 1),
    ],
    transitions: [
      t('ready', 'distance', 'too close'),
      t('ready', 'prewarn', 'TTC < 2.6 s'),
      t('prewarn', 'acute', 'TTC < 1.8 s'),
      t('acute', 'braking', 'TTC < 1.3 s'),
      t('braking', 'hold', 'stopped'),
      t('braking', 'ready', 'speed matched'),
      t('hold', 'ready', '1.5 s'),
      t('ready', 'unavailable', 'sensor blocked'),
    ],
    read: (src) => src.collision.stage,
  },
  {
    id: 'isa',
    title: 'Speed limit warning',
    doc: 'speed-limits',
    states: [s('off', 0, 0), s('ok', 1, 0), s('visual', 2, 0), s('acoustic', 3, 0)],
    transitions: [
      t('off', 'ok', 'every start'),
      t('ok', 'visual', 'over the limit'),
      t('visual', 'acoustic', 'still over'),
      t('acoustic', 'ok', 'back under'),
      t('visual', 'ok', 'back under'),
    ],
    read: (src) => (src.isa.enabled ? src.isa.level : 'off'),
  },
  {
    id: 'startStop',
    title: 'Start-stop',
    doc: 'powertrain-helpers',
    states: [
      s('off', 0, 0),
      s('ready', 1, 0),
      s('stopped', 2, 0, 'engine off'),
      s('blocked', 1, 1),
      s('restartRequired', 2, 1, 'restart'),
    ],
    transitions: [
      t('off', 'ready', 'every start'),
      t('ready', 'stopped', 'held at standstill'),
      t('stopped', 'ready', 'brake released'),
      t('ready', 'blocked', 'cold, battery, A/C…'),
      t('blocked', 'ready', 'conditions met'),
      t('stopped', 'restartRequired', 'battery low'),
      t('restartRequired', 'ready', 'engine running'),
    ],
    read: (src) => src.startStop.state,
  },
  {
    id: 'driveMode',
    title: 'Drive mode',
    doc: 'drive-modes',
    states: (['eco', 'comfort', 'normal', 'sport', 'individual'] as DriveModeId[]).map((m, i) =>
      s(m, i % 3, Math.floor(i / 3), MODES[m].label),
    ),
    transitions: [
      t('normal', 'eco', 'mode button'),
      t('normal', 'comfort', 'mode button'),
      t('normal', 'sport', 'mode button'),
      t('sport', 'individual', 'mode button'),
    ],
    read: (src) => src.sim.driveModes.state.current,
  },
  {
    id: 'belt',
    title: 'Seat-belt reminder',
    doc: 'warnings',
    states: [
      s('0', 0, 0, 'belted'),
      s('1', 1, 0, 'lamp'),
      s('2', 2, 0, 'flash + chime'),
      s('3', 3, 0, 'lamp (chime over)'),
    ],
    transitions: [
      t('0', '1', 'unbelted'),
      t('1', '2', '> 25 km/h'),
      t('2', '3', 'chime period over'),
      t('3', '0', 'belt fastened'),
      t('2', '0', 'belt fastened'),
    ],
    read: (src) => String(src.belts.stage),
  },
];
