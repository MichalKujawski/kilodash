import type { Severity } from '@/core/alerts/rules';

/**
 * All sounds are synthesized with Web Audio (no sample files): flasher relay
 * tick/tock, alert chimes by severity, and an optional engine note driven by
 * rpm and load. Browsers require a user gesture before audio can start, so call
 * `unlock()` from an input handler.
 */
/** Overall cockpit volume (leaves headroom for chimes over the engine). */
const MASTER_GAIN = 0.6;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private engine: {
    osc: OscillatorNode;
    sub: OscillatorNode;
    filter: BiquadFilterNode;
    gain: GainNode;
  } | null = null;
  muted = false;
  engineSound = false;
  chimeStyle: 'bell' | 'digital' | 'soft' = 'bell';

  get ready(): boolean {
    return this.ctx !== null && this.ctx.state === 'running';
  }

  unlock(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      // Created on the first click anywhere: it must respect a mute set before that.
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.master.connect(this.ctx.destination);
      const len = Math.floor(this.ctx.sampleRate * 0.03);
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    }
    void this.ctx.resume();
  }

  setChimeStyle(style: 'bell' | 'digital' | 'soft'): void {
    this.chimeStyle = style;
  }

  setEngineSound(on: boolean): void {
    this.engineSound = on;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(m ? 0 : MASTER_GAIN, this.ctx.currentTime, 0.02);
  }

  /** Flasher relay: a sharp "tick" when the lamp lights, a softer "tock" when it goes out. */
  tick(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || !this.ready) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = on ? 3200 : 1900;
    bp.Q.value = 6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(on ? 0.9 : 0.6, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 0.04);
  }

  private tone(
    freq: number,
    start: number,
    dur: number,
    type: OscillatorType,
    level: number,
    partial = 0,
  ): void {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(level, start + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    g.connect(this.master!);
    for (const [f, lv] of [
      [freq, 1],
      [freq * 2.01, partial],
    ] as const) {
      if (lv <= 0) continue;
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = lv;
      o.connect(og).connect(g);
      o.start(start);
      o.stop(start + dur + 0.05);
    }
  }

  /** Info: one soft bell. Warning: two descending notes. Critical: three urgent beeps. */
  chime(severity: Severity): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ready) return;
    const t = ctx.currentTime + 0.01;
    // Themes pick a voice: soft sine bells, classic bells, or square-ish digital beeps.
    const wave: OscillatorType = this.chimeStyle === 'digital' ? 'square' : 'sine';
    const level = this.chimeStyle === 'soft' ? 0.6 : this.chimeStyle === 'digital' ? 0.35 : 1;
    if (this.chimeStyle === 'digital' && severity !== 'critical') {
      this.tone(1568, t, 0.09, wave, 0.25 * level);
      if (severity === 'warning') this.tone(1568, t + 0.14, 0.09, wave, 0.25 * level);
      return;
    }
    if (severity === 'info') this.tone(1046, t, 1.1, 'sine', 0.35 * level, 0.25);
    else if (severity === 'warning') {
      this.tone(880, t, 0.7, 'sine', 0.4 * level, 0.3);
      this.tone(659, t + 0.32, 0.9, 'sine', 0.4 * level, 0.3);
    } else {
      for (let i = 0; i < 3; i++) this.tone(1175, t + i * 0.2, 0.14, 'triangle', 0.45);
    }
  }

  private parkOsc: { osc: OscillatorNode; gain: GainNode } | null = null;

  /** Park-distance beep: higher pitch for the front sensors. */
  parkBeep(front: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ready) return;
    this.tone(front ? 1320 : 990, ctx.currentTime + 0.005, 0.07, 'sine', 0.28);
  }

  /** Continuous park-distance tone (very close). */
  parkTone(on: boolean, front: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ready) return;
    if (!this.parkOsc) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(this.master);
      osc.start();
      this.parkOsc = { osc, gain };
    }
    const t = ctx.currentTime;
    this.parkOsc.osc.frequency.setTargetAtTime(front ? 1320 : 990, t, 0.01);
    this.parkOsc.gain.gain.setTargetAtTime(on ? 0.18 : 0, t, 0.02);
  }

  /** Engine note: firing frequency from rpm and cylinder count; brighter under load. */
  updateEngine(rpm: number, load: number, running: boolean, cylinders: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.ready) return;
    if (!this.engine) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      const sub = ctx.createOscillator();
      sub.type = 'sine';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 2;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain).connect(this.master);
      osc.start();
      sub.start();
      this.engine = { osc, sub, filter, gain };
    }
    const e = this.engine;
    const t = ctx.currentTime;
    const firing = Math.max(8, (rpm / 60) * (cylinders / 2));
    e.osc.frequency.setTargetAtTime(firing, t, 0.03);
    e.sub.frequency.setTargetAtTime(firing / 2, t, 0.03);
    e.filter.frequency.setTargetAtTime(250 + load * 22 + rpm * 0.15, t, 0.05);
    const level = this.engineSound && running ? 0.04 + (load / 100) * 0.1 : 0;
    e.gain.gain.setTargetAtTime(level, t, 0.08);
  }
}
