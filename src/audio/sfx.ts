/**
 * Every sound is synthesised with WebAudio — no asset files. The context is
 * created lazily on the first user gesture (browsers require it).
 */

export type SfxName =
  | 'step' | 'swing' | 'hit' | 'crit' | 'hurt' | 'block' | 'door' | 'locked' | 'unlock'
  | 'pickup' | 'gold' | 'chest' | 'break' | 'death' | 'enemyDie' | 'stairs' | 'shoot'
  | 'magic' | 'secret' | 'ui' | 'craft' | 'drink' | 'alert' | 'miss' | 'sell' | 'recall';

export interface PlayOpts {
  volume?: number;
  /** -1 left … 1 right */
  pan?: number;
  /** Pitch multiplier. */
  rate?: number;
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: { stop: () => void } | null = null;
  muted = false;
  volume = 0.7;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  /** Silence everything (sound effects and ambience) while the app is in the background. */
  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.setVolume(this.volume);
    return this.muted;
  }

  private out(opts: PlayOpts): { ctx: AudioContext; dest: AudioNode; t: number; rate: number } | null {
    if (!this.ctx || !this.master || this.muted) return null;
    const g = this.ctx.createGain();
    g.gain.value = opts.volume ?? 1;
    let dest: AudioNode = g;
    if (opts.pan) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      p.connect(this.master);
    } else {
      g.connect(this.master);
    }
    dest = g;
    return { ctx: this.ctx, dest, t: this.ctx.currentTime, rate: opts.rate ?? 1 };
  }

  private noiseBurst(
    o: { ctx: AudioContext; dest: AudioNode; t: number },
    dur: number,
    type: BiquadFilterType,
    f0: number,
    f1: number,
    gain: number,
    q = 1,
    delay = 0,
  ): void {
    const src = o.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = o.ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    const t = o.t + delay;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = o.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.01, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(o.dest);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.05);
  }

  private tone(
    o: { ctx: AudioContext; dest: AudioNode; t: number },
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number,
    delay = 0,
  ): void {
    const osc = o.ctx.createOscillator();
    osc.type = type;
    const t = o.t + delay;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = o.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(o.dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  play(name: SfxName, opts: PlayOpts = {}): void {
    const o = this.out(opts);
    if (!o) return;
    const r = o.rate * (0.94 + Math.random() * 0.12);
    switch (name) {
      case 'step':
        this.noiseBurst(o, 0.09, 'lowpass', 500 * r, 120, 0.35);
        break;
      case 'swing':
        this.noiseBurst(o, 0.18, 'bandpass', 600 * r, 2600 * r, 0.5, 1.5);
        break;
      case 'miss':
        this.noiseBurst(o, 0.14, 'bandpass', 1400 * r, 500, 0.25, 2);
        break;
      case 'hit':
        this.noiseBurst(o, 0.12, 'lowpass', 1800 * r, 200, 0.8);
        this.tone(o, 'sine', 140 * r, 50, 0.16, 0.7);
        break;
      case 'crit':
        this.noiseBurst(o, 0.18, 'lowpass', 3000 * r, 200, 0.9);
        this.tone(o, 'square', 90 * r, 40, 0.25, 0.4);
        this.tone(o, 'triangle', 1200 * r, 600, 0.12, 0.2, 0.02);
        break;
      case 'hurt':
        this.tone(o, 'sawtooth', 180 * r, 60, 0.25, 0.35);
        this.noiseBurst(o, 0.2, 'lowpass', 900, 100, 0.6);
        break;
      case 'block':
        this.tone(o, 'square', 420 * r, 380 * r, 0.12, 0.25);
        this.tone(o, 'triangle', 1900 * r, 1700 * r, 0.25, 0.15);
        this.noiseBurst(o, 0.06, 'highpass', 3000, 2000, 0.4);
        break;
      case 'door':
        this.tone(o, 'sawtooth', 70 * r, 110 * r, 0.5, 0.12);
        this.tone(o, 'sawtooth', 95 * r, 60 * r, 0.4, 0.1, 0.25);
        this.noiseBurst(o, 0.3, 'lowpass', 300, 100, 0.3, 1, 0.45);
        break;
      case 'locked':
        this.tone(o, 'square', 220, 200, 0.06, 0.2);
        this.tone(o, 'square', 200, 180, 0.06, 0.2, 0.09);
        break;
      case 'unlock':
        this.tone(o, 'triangle', 900, 900, 0.05, 0.3);
        this.tone(o, 'triangle', 1300, 1300, 0.08, 0.3, 0.07);
        this.noiseBurst(o, 0.05, 'highpass', 4000, 3000, 0.3, 1, 0.07);
        break;
      case 'pickup':
        this.tone(o, 'triangle', 520 * r, 780 * r, 0.09, 0.3);
        this.tone(o, 'triangle', 780 * r, 1040 * r, 0.1, 0.25, 0.07);
        break;
      case 'gold':
      case 'sell':
        for (let i = 0; i < 4; i++) this.tone(o, 'triangle', (1400 + i * 260) * r, (1500 + i * 260) * r, 0.07, 0.18, i * 0.045);
        break;
      case 'chest':
        this.tone(o, 'sawtooth', 110, 160, 0.35, 0.1);
        for (let i = 0; i < 3; i++) this.tone(o, 'sine', 660 * (1 + i * 0.25), 660 * (1 + i * 0.25), 0.18, 0.2, 0.3 + i * 0.08);
        break;
      case 'break':
        this.noiseBurst(o, 0.25, 'bandpass', 2400 * r, 600, 0.7, 0.8);
        this.noiseBurst(o, 0.12, 'highpass', 5000, 2000, 0.4, 1, 0.08);
        break;
      case 'enemyDie':
        this.tone(o, 'sawtooth', 240 * r, 50, 0.5, 0.2);
        this.noiseBurst(o, 0.4, 'lowpass', 1200, 80, 0.5);
        break;
      case 'death':
        this.tone(o, 'sawtooth', 200, 30, 1.6, 0.3);
        this.tone(o, 'sine', 60, 30, 2.0, 0.6);
        this.noiseBurst(o, 1.4, 'lowpass', 600, 40, 0.5);
        break;
      case 'stairs':
        this.tone(o, 'sine', 90, 40, 1.2, 0.6);
        this.noiseBurst(o, 1.0, 'lowpass', 400, 60, 0.4);
        break;
      case 'shoot':
        this.noiseBurst(o, 0.2, 'bandpass', 3000 * r, 900, 0.4, 3);
        this.tone(o, 'triangle', 300 * r, 150, 0.08, 0.2);
        break;
      case 'magic':
        this.tone(o, 'sine', 300 * r, 1200 * r, 0.35, 0.25);
        this.tone(o, 'triangle', 450 * r, 1800 * r, 0.35, 0.12, 0.03);
        break;
      case 'secret':
        this.noiseBurst(o, 1.2, 'lowpass', 220, 90, 0.6, 2);
        this.tone(o, 'sine', 55, 45, 1.2, 0.5);
        for (let i = 0; i < 3; i++) this.tone(o, 'sine', 523 * Math.pow(1.26, i), 523 * Math.pow(1.26, i), 0.4, 0.15, 1.1 + i * 0.12);
        break;
      case 'ui':
        this.tone(o, 'square', 700, 700, 0.03, 0.08);
        break;
      case 'craft':
        for (let i = 0; i < 3; i++) {
          this.tone(o, 'square', 380 * r, 360 * r, 0.1, 0.2, i * 0.18);
          this.tone(o, 'triangle', 2100 * r, 1900 * r, 0.3, 0.12, i * 0.18);
        }
        break;
      case 'drink':
        for (let i = 0; i < 5; i++) this.tone(o, 'sine', 300 + Math.random() * 300, 600 + Math.random() * 300, 0.06, 0.2, i * 0.07);
        break;
      case 'alert':
        this.tone(o, 'sawtooth', 160 * r, 220 * r, 0.18, 0.15);
        this.noiseBurst(o, 0.15, 'bandpass', 800, 1400, 0.25, 2);
        break;
      case 'recall':
        for (let i = 0; i < 6; i++) this.tone(o, 'sine', 400 * Math.pow(1.19, i), 400 * Math.pow(1.19, i), 0.3, 0.15, i * 0.1);
        break;
    }
  }

  /** Low drone + filtered noise wind, tinted per biome. */
  startAmbient(baseHz: number, brightness: number): void {
    this.stopAmbient();
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 2);
    g.connect(this.master);
    const oscs = [1, 1.498, 2.003].map((m, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'sine' : 'triangle';
      o.frequency.value = baseHz * m;
      o.detune.value = (Math.random() - 0.5) * 12;
      const og = ctx.createGain();
      og.gain.value = i === 0 ? 0.5 : 0.12;
      o.connect(og).connect(g);
      o.start();
      return o;
    });
    const n = ctx.createBufferSource();
    n.buffer = this.noise;
    n.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 200 + brightness * 400;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain).connect(f.frequency);
    const ng = ctx.createGain();
    ng.gain.value = 0.35;
    n.connect(f).connect(ng).connect(g);
    n.start();
    lfo.start();
    this.ambient = {
      stop: () => {
        const t = ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(0, t + 0.8);
        setTimeout(() => {
          for (const o of oscs) o.stop();
          n.stop();
          lfo.stop();
          g.disconnect();
        }, 900);
      },
    };
  }

  stopAmbient(): void {
    this.ambient?.stop();
    this.ambient = null;
  }
}

export const audio = new AudioEngine();
