import type { ClusterRenderer } from '@/cluster/renderer/ClusterRenderer';
import type { SimulatorSource } from '@/core/datasource/simulator/SimulatorSource';
import { CHAPTERS, type Caption, type Chapter, type ChapterEvent } from './chapters';

export interface DirectorState {
  index: number;
  chapter: Chapter;
  /** Seconds into the chapter. */
  t: number;
  playing: boolean;
  caption: Caption | null;
}

/**
 * Plays the guided demo: scripted chapters inside the same continuous world.
 * Each chapter sets up a place, time of day and weather, then fires events on
 * a timeline (switch cruise on, change view, a car brakes ahead…) while the
 * Demo driver keeps driving. Chapters can start on their own; the last loops
 * back to the first. Pausing freezes the simulation.
 */
export class Director {
  index = 0;
  t = 0;
  playing = true;
  private fired = 0;
  private liftUntil = -1;
  /** The car that stopped dead in the Safety chapter (cleared on the next setup). */
  private stopped: number | null = null;
  private screenPending = false;

  constructor(
    private src: SimulatorSource,
    private renderer: () => ClusterRenderer | null,
    readonly chapters: Chapter[] = CHAPTERS,
  ) {}

  get chapter(): Chapter {
    return this.chapters[this.index]!;
  }

  get state(): DirectorState {
    const c = this.chapter;
    return {
      index: this.index,
      chapter: c,
      t: this.t,
      playing: this.playing,
      caption: c.captions.find((k) => this.t >= k.t0 && this.t < k.t1) ?? null,
    };
  }

  /** Seconds since the start of the whole demo. */
  get elapsed(): number {
    return this.chapters.slice(0, this.index).reduce((a, c) => a + c.duration, 0) + this.t;
  }

  start(index = 0): void {
    this.index = ((index % this.chapters.length) + this.chapters.length) % this.chapters.length;
    this.t = 0;
    this.fired = 0;
    this.liftUntil = -1;
    this.src.demo.scripted = true;
    this.setup(this.chapter);
    this.playing = true;
    this.src.paused = false;
  }

  goto(id: string): void {
    const i = this.chapters.findIndex((c) => c.id === id);
    if (i >= 0) this.start(i);
  }

  next(): void {
    this.start(this.index + 1);
  }

  prev(): void {
    this.start(this.t > 3 ? this.index : this.index - 1);
  }

  toggle(): void {
    this.playing = !this.playing;
    this.src.paused = !this.playing;
  }

  /** Hand the car to the visitor: the world keeps going from here. */
  release(): void {
    this.playing = false;
    this.src.paused = false;
    this.src.buttons.distracted = false;
    this.src.demo.scripted = false;
    this.src.setAutopilot(false);
  }

  tick(dt: number): void {
    this.applyScreen();
    if (!this.playing) return;
    this.t += dt;
    const events = [...this.chapter.events].sort((a, b) => a.t - b.t);
    while (this.fired < events.length && events[this.fired]!.t <= this.t) {
      this.run(events[this.fired]!);
      this.fired++;
    }
    if (this.liftUntil >= 0 && this.t >= this.liftUntil) {
      this.liftUntil = -1;
      this.src.resumeDemo();
    }
    if (this.t >= this.chapter.duration) this.next();
  }

  private setup(c: Chapter): void {
    const src = this.src;
    const sim = src.sim;
    src.buttons.distracted = false;
    src.buttons.handsOn = true;
    src.assist.switchOff();
    sim.body.autoHighBeam = false;
    src.setEnvironment({
      realTime: false,
      hour: c.hour,
      weather: c.weather,
      temperatureC: c.temperatureC,
    });
    sim.driveModes.select(c.mode ?? 'normal');
    sim.driveModes.state.popup = null;
    if (this.stopped !== null) {
      src.world.traffic.vehicles = src.world.traffic.vehicles.filter((v) => v.id !== this.stopped);
      this.stopped = null;
    }
    const s = c.start;
    if ('bay' in s) {
      src.parkAtStart();
      sim.setIgnition(2);
      sim.state.ready = true;
      sim.state.engineRunning = true;
      sim.state.coolantC = 86;
      src.demo.startReversing(sim);
    } else if ('destination' in s) {
      const route = src.world.route;
      src.startRolling('destination', 12);
      src.world.jumpTo(route.length - s.destination, 0);
      src.demo.resume(sim);
    } else if ('segment' in s) {
      const seg = src.world.route.segments.find((x) => x.name === s.segment)!;
      src.startRolling('motorway', s.kmh);
      src.world.jumpTo(seg.s0 + s.at, s.lane ?? 0);
      src.demo.resume(sim);
    } else {
      src.startRolling(s.place, s.kmh);
    }
    src.resumeDemo();
    this.screenPending = true;
    this.applyScreen();
  }

  /** A new cluster renderer (remounts): show this chapter's view on it too. */
  rendererChanged(): void {
    this.screenPending = true;
    this.applyScreen();
  }

  /** The chapter's view and page, as soon as the cluster exists (it may start after us). */
  private applyScreen(): void {
    const r = this.renderer();
    if (!this.screenPending || !r) return;
    this.screenPending = false;
    r.selectView(this.chapter.view ?? 'classic', false);
    r.showPage(this.chapter.page ?? 'map');
  }

  private run(e: ChapterEvent): void {
    const src = this.src;
    const sim = src.sim;
    const world = src.world;
    switch (e.do) {
      case 'welcome':
        this.renderer()?.playWelcome();
        break;
      case 'acc':
        if (src.assist.state === 'off') src.assist.pressMain();
        src.assist.pressSet(false, sim.speedKmh);
        src.assist.setSpeed(e.kmh);
        break;
      case 'accOff':
        src.assist.switchOff();
        break;
      case 'view':
        this.renderer()?.selectView(e.view);
        break;
      case 'page':
        this.renderer()?.showPage(e.page);
        break;
      case 'mode': {
        // Press the mode button and scroll to the mode: the list shows, then confirms itself.
        const dm = sim.driveModes;
        dm.pressButton();
        for (let i = 0; i < 8 && dm.state.popup && dm.state.popup.highlight !== e.mode; i++)
          dm.move(1);
        break;
      }
      case 'overtake':
        src.demo.requestOvertake();
        break;
      case 'passer': {
        // A much faster car coming up in the next lane, about to pass us (no limit here).
        const ego = world.ego;
        const lane = Math.round(ego.lane) + 1;
        world.traffic.vehicles = world.traffic.vehicles.filter(
          (x) => x.oncoming || Math.abs(x.lane - lane) > 0.5 || Math.abs(x.s - ego.s) > 120,
        );
        const v = sim.state.speedMs + 12;
        const car = world.traffic.spawnAt(ego.s - 38, lane, v);
        car.freeSpeed = v;
        car.lcTimer = -20; // stays in its lane while it passes
        break;
      }
      case 'lead': {
        const ego = world.ego;
        world.traffic.vehicles = world.traffic.vehicles.filter(
          (v) =>
            v.oncoming || Math.abs(v.lane - ego.lane) > 0.5 || v.s < ego.s || v.s > ego.s + 250,
        );
        world.traffic.spawnAt(ego.s + e.gap + 4.6, ego.lane, e.kmh / 3.6);
        break;
      }
      case 'leadBrake': {
        const lead = src.scene().lead;
        const v = lead && world.traffic.vehicles.find((x) => x.id === lead.id);
        if (v) {
          // Hard braking down to jam speed for a stretch of road, then it drives on.
          v.brakeUntil = world.time + 2.5;
          v.cap = { v: e.kmh / 3.6, until: v.s + 260 };
          this.stopped = v.id;
        }
        break;
      }
      case 'lookAway':
        src.demo.lookAway(e.seconds);
        break;
      case 'distracted':
        src.buttons.distracted = e.on;
        break;
      case 'lift':
        // The driver lifts off: the Demo driver steps back for a few seconds.
        src.liftOff();
        this.liftUntil = this.t + e.seconds;
        break;
      case 'autoHighBeam':
        sim.body.autoHighBeam = true;
        break;
    }
  }
}
