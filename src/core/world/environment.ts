import { approach, clamp } from '../math';

export type Weather = 'clear' | 'rain' | 'snow' | 'fog';
export type Surface = 'dry' | 'wet' | 'icy';

export interface EnvironmentSettings {
  /** Use the visitor's local clock for time of day. */
  realTime: boolean;
  /** Hour of day 0–24 when not real time. */
  hour: number;
  weather: Weather;
  temperatureC: number;
  /** null = follows the weather (rain → wet, snow below 1 °C → icy). */
  surface: Surface | null;
}

export const DEFAULT_ENVIRONMENT: EnvironmentSettings = {
  realTime: false,
  hour: 14,
  weather: 'clear',
  temperatureC: 16,
  surface: null,
};

/** Tyre–road friction coefficient by surface (typical published ranges). */
const GRIP: Record<Surface, number> = { dry: 1, wet: 0.7, icy: 0.25 };

/**
 * Time of day, weather and road surface, and what they mean for the car:
 * ambient light (night mode, auto headlights; tunnels darken within a second),
 * grip, wet road (for "when wet" limits), rain for the rain sensor.
 */
export class Environment {
  settings: EnvironmentSettings;
  /** Current hour, advancing in real time when not following the clock. */
  hour: number;
  /** Ambient light seen by the light sensor, 0–100 %. */
  light = 85;

  constructor(
    settings: Partial<EnvironmentSettings> = {},
    private clock: () => Date = () => new Date(),
  ) {
    this.settings = { ...DEFAULT_ENVIRONMENT, ...settings };
    this.hour = this.settings.hour;
  }

  set(patch: Partial<EnvironmentSettings>): void {
    this.settings = { ...this.settings, ...patch };
    if (patch.hour !== undefined) this.hour = patch.hour;
  }

  get surface(): Surface {
    const s = this.settings;
    if (s.surface) return s.surface;
    if (s.weather === 'snow' || (s.weather === 'rain' && s.temperatureC <= 0)) return 'icy';
    if (s.weather === 'rain') return 'wet';
    return 'dry';
  }

  get wet(): boolean {
    return this.surface !== 'dry';
  }

  get grip(): number {
    return GRIP[this.surface];
  }

  /** Rain on the windscreen, 0–1 (rain sensor). */
  get rain(): number {
    return this.settings.weather === 'rain' ? 0.7 : this.settings.weather === 'snow' ? 0.35 : 0;
  }

  /** Daylight outside, 0–100 %, from a simple sun curve (sunrise ≈ 6:30, sunset ≈ 19:30). */
  daylight(hour = this.hour): number {
    const sun = Math.sin(((hour - 6.5) / 13) * Math.PI);
    const base = sun > 0 ? 8 + 80 * Math.min(1, sun * 2.2) : clamp(8 + sun * 40, 2, 8);
    const overcast =
      this.settings.weather === 'clear' ? 1 : this.settings.weather === 'fog' ? 0.45 : 0.6;
    return base * overcast;
  }

  step(dt: number, inTunnel: boolean): void {
    const s = this.settings;
    if (s.realTime) {
      const d = this.clock();
      this.hour = d.getHours() + d.getMinutes() / 60;
    } else {
      this.hour = (this.hour + dt / 3600) % 24;
    }
    // Tunnel lighting is dim; the sensor reacts within about a second.
    const target = inTunnel ? 4 : this.daylight();
    this.light += (target - this.light) * approach(dt, 0.35);
  }
}
