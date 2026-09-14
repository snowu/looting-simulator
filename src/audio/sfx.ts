/**
 * Every sound is synthesised with WebAudio — no asset files. The context is
 * created lazily on the first user gesture (browsers require it).
 */

export type SfxName =
  | 'step' | 'swing' | 'hit' | 'crit' | 'hurt' | 'block' | 'door' | 'locked' | 'unlock'
  | 'pickup' | 'gold' | 'chest' | 'break' | 'death' | 'enemyDie' | 'stairs' | 'shoot'
   | 'magic' | 'study' | 'winded' | 'secret' | 'ui' | 'craft' | 'drink' | 'alert' | 'miss' | 'sell' | 'recall' | 'parry'
  | 'kingturn' | 'snuff' | 'splash' | 'retrieve' | 'sigil' | 'sigil_land' | 'drip' | 'plop';

export interface PlayOpts {
  volume?: number;
  /** -1 left … 1 right */
  pan?: number;
  /** Pitch multiplier. */
  rate?: number;
}

const VOLUME_KEY = 'looting-simulator-audio-volume';
const MUTED_KEY = 'looting-simulator-audio-muted';

function loadStoredVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw === null) return 0.7;
    const v = Number(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.7;
  } catch {
    return 0.7;
  }
}

function loadStoredMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private ambient: { stop: () => void } | null = null;
  muted = loadStoredMuted();
  volume = loadStoredVolume();

  /** Persist the current volume/mute choice; device preference, not save data. */
  private persist(): void {
    try {
      localStorage.setItem(VOLUME_KEY, String(this.volume));
      localStorage.setItem(MUTED_KEY, this.muted ? '1' : '0');
    } catch {
      // Storage blocked: the game keeps running, the choice just won't stick.
    }
  }

  /** Re-read stored prefs (e.g. after boot before first unlock). */
  loadPrefs(): void {
    this.muted = loadStoredMuted();
    this.volume = loadStoredVolume();
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
  }

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
    this.master.gain.value = this.muted ? 0 : this.volume;
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
    this.volume = Math.min(1, Math.max(0, v));
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this.persist();
  }

  setMuted(m: boolean): boolean {
    this.muted = m;
    if (this.master) this.master.gain.value = this.muted ? 0 : this.volume;
    this.persist();
    return this.muted;
  }

  toggleMute(): boolean {
    return this.setMuted(!this.muted);
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
      // A block that rings rather than thuds: brighter, and it hangs in the air.
      case 'parry':
        this.tone(o, 'triangle', 2600 * r, 3100 * r, 0.5, 0.3);
        this.tone(o, 'triangle', 3900 * r, 4300 * r, 0.35, 0.18);
        this.tone(o, 'square', 700 * r, 900 * r, 0.09, 0.22);
        this.noiseBurst(o, 0.05, 'highpass', 5000, 4000, 0.5);
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
      /*
       * Learning something at a bench: paper, leather, and a low fifth that
       * settles. Deliberately not a rising figure — a quick upward sweep is
       * the arcade power-up formula, and this is a night spent over a book.
       */
      case 'study':
        this.noiseBurst(o, 0.17, 'bandpass', 2500 * r, 850, 0.14, 1.2);
        this.noiseBurst(o, 0.13, 'bandpass', 1800 * r, 650, 0.1, 1.2, 0.15);
        this.tone(o, 'sine', 120 * r, 74, 0.26, 0.26, 0.02);
        // Kept under a second: identifying is something you do item after
        // item, and a long tail would stack into a drone.
        this.tone(o, 'sine', 147, 143, 0.85, 0.17, 0.18);
        this.tone(o, 'sine', 220, 214, 0.7, 0.09, 0.21);
        break;
      // A spent exhale, not a grunt of pain: this fires when you try to swing
      // on an empty bar, which is a mistake to notice, not an injury.
      case 'winded':
        this.noiseBurst(o, 0.22, 'lowpass', 850 * r, 240, 0.11, 0.8);
        this.noiseBurst(o, 0.15, 'bandpass', 480 * r, 190, 0.06, 1.5, 0.1);
        break;
      case 'secret':
        this.noiseBurst(o, 1.2, 'lowpass', 220, 90, 0.6, 2);
        this.tone(o, 'sine', 55, 45, 1.2, 0.5);
        for (let i = 0; i < 3; i++) this.tone(o, 'sine', 523 * Math.pow(1.26, i), 523 * Math.pow(1.26, i), 0.4, 0.15, 1.1 + i * 0.12);
        break;
      // The King turns. Built like 'secret' — a long low shove followed by a
      // figure — but the figure falls instead of rising, because this is not a
      // discovery. The detuned fifth under it is what makes it read as wrong.
      case 'kingturn':
        this.noiseBurst(o, 1.4, 'lowpass', 300, 60, 0.7, 2);
        this.tone(o, 'sine', 62, 38, 1.5, 0.55);
        this.tone(o, 'sine', 93, 57, 1.5, 0.3);
        for (let i = 0; i < 3; i++) this.tone(o, 'triangle', 440 / Math.pow(1.19, i), 330 / Math.pow(1.19, i), 0.5, 0.16, 0.25 + i * 0.16);
        break;
      // Every flame in the room going out at once: a soft pressure thump and a
      // long breath of air, no pitch to it at all.
      case 'snuff':
        this.noiseBurst(o, 0.5, 'lowpass', 700, 120, 0.4, 1.2);
        this.noiseBurst(o, 0.9, 'highpass', 1800, 500, 0.16, 0.7, 0.05);
        break;
      // Water reads as a surface break plus the small rising plinks of
      // entrained air bubbles, not as one envelope of white noise.
      case 'splash':
        this.noiseBurst(o, 0.11, 'bandpass', 1900 * r, 420, 0.11, 1.3);
        this.noiseBurst(o, 0.045, 'highpass', 5200 * r, 1700, 0.05, 1, 0.012);
        this.tone(o, 'sine', 760 * r, 1240 * r, 0.14, 0.045, 0.028);
        this.tone(o, 'sine', 1180 * r, 1960 * r, 0.09, 0.03, 0.06);
        break;
      // A cave drip: a short glassy plink as the drop necks off. Kept quiet
      // on purpose — the call site spreads volume and pan so distance, not
      // loudness, is what varies from drip to drip. Distant drips only.
      case 'drip':
        this.tone(o, 'sine', 1900 * r, 760 * r, 0.07, 0.09);
        this.tone(o, 'sine', 2900 * r, 1450 * r, 0.045, 0.04, 0.008);
        break;
      // A drop landing in shallow water up close: the soft impact transient
      // plus the bubble it leaves behind, ringing as a short rising blip.
      // The rise is the tell — impact noise alone reads as a click, a falling
      // tone alone reads as glass, but noise into a rising ring reads as wet.
      case 'plop':
        this.noiseBurst(o, 0.05, 'bandpass', 2600 * r, 700, 0.10, 1.2);
        this.tone(o, 'sine', 820 * r, 1420 * r, 0.10, 0.09, 0.012);
        this.tone(o, 'sine', 1640 * r, 2500 * r, 0.05, 0.03, 0.02);
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
      case 'retrieve':
        this.noiseBurst(o, 0.18, 'bandpass', 700 * r, 2600 * r, 0.25, 2);
        this.tone(o, 'triangle', 260 * r, 820 * r, 0.28, 0.2);
        break;
      // Starting a cast: a low swell that rises, so holding still has a sound.
      case 'sigil':
        this.tone(o, 'sine', 150 * r, 72 * r, 0.5, 0.35);
        this.tone(o, 'triangle', 440 * r, 330 * r, 0.4, 0.16, 0.04);
        break;
      // Landing: a struck bell over the swell, which is the moment itself. The
      // cast used to have one cue for both ends and so had no moment at all.
      case 'sigil_land':
        this.tone(o, 'sine', 880 * r, 1320 * r, 0.7, 0.22);
        this.tone(o, 'triangle', 587 * r, 587 * r, 0.9, 0.14, 0.02);
        this.tone(o, 'sine', 220 * r, 110 * r, 1.1, 0.2, 0.03);
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
