import type { GloveStyleVariant, WallMaterialKind } from '../types/game';

/**
 * Procedural Web Audio API synthesizer for HIT DAT WALL!:
 * - Cozy, poly, bouncy yet calm forever-loop background groove (Fmaj7 -> G6 -> Em7 -> Am7)
 * - Soft airy sparkle/swoosh ticks for floating glove aura pixels
 * - Rapid punch air-whoosh + material-accurate wall impacts & shatter clatter
 * - Boss failure, overdrive surge, and combo milestone audio
 */
export class PunchAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private bgmGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private masterVolume = 0.8;
  private sfxVolume = 0.85;
  private bgmVolume = 0.42;
  private bgmEnabled = true;
  private muted = false;

  // Cozy loop scheduler state
  private bgmTimerId: number | null = null;
  private bgmPlaying = false;
  private bgmPaused = false;
  private nextStepTime = 0;
  private currentStep = 0;

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.applyVolumes();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setAudioSettings(opts: {
    masterVolume: number;
    bgmVolume: number;
    sfxVolume: number;
    bgmEnabled: boolean;
    muted: boolean;
  }) {
    this.masterVolume = opts.masterVolume;
    this.bgmVolume = opts.bgmVolume;
    this.sfxVolume = opts.sfxVolume;
    this.bgmEnabled = opts.bgmEnabled;
    this.muted = opts.muted;
    this.applyVolumes();
    if (!this.bgmEnabled && this.bgmPlaying) {
      this.stopBgm();
    } else if (this.bgmEnabled && this.ctx && !this.bgmPlaying) {
      this.startBgm();
    }
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.muted ? 0 : this.masterVolume * 0.9,
        now,
        0.03
      );
    }
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, now, 0.03);
    }
    if (this.bgmGain) {
      const targetBgm = this.bgmEnabled ? (this.bgmPaused ? this.bgmVolume * 0.35 : this.bgmVolume * 0.55) : 0;
      this.bgmGain.gain.setTargetAtTime(targetBgm, now, 0.08);
    }
  }

  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.masterVolume * 0.9;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxVolume;
      this.sfxGain.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = this.bgmEnabled ? this.bgmVolume * 0.55 : 0;
      this.bgmGain.connect(this.masterGain);

      this.noiseBuffer = this.buildNoiseBuffer(this.ctx);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    if (this.bgmEnabled && !this.bgmPlaying) {
      this.startBgm();
    }
  }

  public setBgmPaused(paused: boolean) {
    this.bgmPaused = paused;
    this.applyVolumes();
  }

  public startBgm() {
    if (typeof window === 'undefined' || !this.bgmEnabled) return;
    if (!this.ctx) this.unlock();
    if (!this.ctx || !this.bgmGain || this.bgmPlaying) return;

    this.bgmPlaying = true;
    this.nextStepTime = this.ctx.currentTime + 0.05;
    this.bgmTimerId = window.setInterval(() => {
      this.scheduleBgmSteps();
    }, 55);
  }

  public stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimerId !== null) {
      window.clearInterval(this.bgmTimerId);
      this.bgmTimerId = null;
    }
  }

  private scheduleBgmSteps() {
    if (!this.ctx || !this.bgmGain || !this.bgmPlaying || !this.bgmEnabled) return;
    if (this.ctx.state === 'suspended') return;

    // 94 BPM cozy low-poly bounce (16th note = 0.1595s)
    const stepDur = 60 / 94 / 4;
    const lookahead = 0.18;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.triggerBgmStep(this.currentStep, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private triggerBgmStep(step: number, time: number, stepDur: number) {
    const ctx = this.ctx;
    const bgm = this.bgmGain;
    if (!ctx || !bgm) return;

    // 4-bar cozy maj7 / m7 progression: Fmaj7 -> G6 -> Em7 -> Am9
    const bar = Math.floor(step / 16);
    const stepInBar = step % 16;

    const chords = [
      { bass: 174.61, pad: [349.23, 440.0, 523.25, 659.25], melody: [659.25, 783.99, 880.0, 659.25] }, // Fmaj7
      { bass: 196.0, pad: [392.0, 493.88, 587.33, 659.25], melody: [783.99, 659.25, 587.33, 493.88] }, // G6
      { bass: 164.81, pad: [329.63, 392.0, 493.88, 587.33], melody: [587.33, 659.25, 783.99, 987.77] }, // Em7
      { bass: 220.0, pad: [440.0, 523.25, 659.25, 783.99], melody: [880.0, 783.99, 659.25, 523.25] }, // Am7
    ];
    const chord = chords[bar];

    // 1. Warm felt low-poly electric piano chords (steps 0 and 10 for bouncy groove)
    if (stepInBar === 0 || stepInBar === 10) {
      const dur = stepInBar === 0 ? stepDur * 8.5 : stepDur * 5.2;
      const vel = stepInBar === 0 ? 0.085 : 0.055;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(980, time);
      filter.connect(bgm);

      chord.pad.forEach((freq) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq * 0.5, time);
        g.gain.setValueAtTime(0.0005, time);
        g.gain.linearRampToValueAtTime(vel / chord.pad.length, time + 0.035);
        g.gain.exponentialRampToValueAtTime(0.0005, time + dur);
        osc.connect(g);
        g.connect(filter);
        osc.start(time);
        osc.stop(time + dur + 0.02);
      });
    }

    // 2. Smooth rounded sub-bass bounce
    if (stepInBar === 0 || stepInBar === 6 || stepInBar === 10) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const freq = stepInBar === 6 ? chord.bass * 0.75 : chord.bass * 0.5;
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0.001, time);
      g.gain.linearRampToValueAtTime(stepInBar === 0 ? 0.14 : 0.09, time + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, time + stepDur * 3.4);
      osc.connect(g);
      g.connect(bgm);
      osc.start(time);
      osc.stop(time + stepDur * 3.6);
    }

    // 3. Cozy poly kalimba / marimba pluck melody (never erratic, gentle & playful)
    if (stepInBar === 2 || stepInBar === 4 || stepInBar === 8 || stepInBar === 12 || stepInBar === 14) {
      const melIdx =
        stepInBar === 2 ? 0 : stepInBar === 4 ? 1 : stepInBar === 8 ? 2 : stepInBar === 12 ? 3 : 1;
      const freq = chord.melody[melIdx];
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      g.gain.setValueAtTime(0.0008, time);
      g.gain.linearRampToValueAtTime(stepInBar === 8 ? 0.052 : 0.038, time + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0005, time + stepDur * 2.1);
      osc.connect(g);
      g.connect(bgm);
      osc.start(time);
      osc.stop(time + stepDur * 2.2);
    }

    // 4. Ultra-soft lo-fi kick & brushed shaker
    if (stepInBar === 0 || stepInBar === 8) {
      const kick = ctx.createOscillator();
      const kG = ctx.createGain();
      kick.type = 'sine';
      kick.frequency.setValueAtTime(88, time);
      kick.frequency.exponentialRampToValueAtTime(38, time + 0.09);
      kG.gain.setValueAtTime(0.09, time);
      kG.gain.exponentialRampToValueAtTime(0.001, time + 0.11);
      kick.connect(kG);
      kG.connect(bgm);
      kick.start(time);
      kick.stop(time + 0.12);
    }

    if (this.noiseBuffer && (stepInBar === 4 || stepInBar === 12 || stepInBar === 6 || stepInBar === 14)) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const hp = ctx.createBiquadFilter();
      hp.type = 'bandpass';
      hp.frequency.setValueAtTime(stepInBar % 8 === 4 ? 3600 : 5400, time);
      hp.Q.value = 1.6;
      const sG = ctx.createGain();
      sG.gain.setValueAtTime(stepInBar % 8 === 4 ? 0.025 : 0.014, time);
      sG.gain.exponentialRampToValueAtTime(0.0005, time + 0.05);
      src.connect(hp);
      hp.connect(sG);
      sG.connect(bgm);
      src.start(time);
      src.stop(time + 0.06);
    }
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = ctx.sampleRate * 1.4;
    const buf = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  private runAsync(fn: (ctx: AudioContext, sfx: GainNode, now: number) => void) {
    if (this.muted) return;
    if (!this.ctx || !this.sfxGain) this.unlock();
    const ctx = this.ctx;
    const sfx = this.sfxGain;
    if (!ctx || !sfx) return;
    if (ctx.state === 'suspended') void ctx.resume();
    fn(ctx, sfx, ctx.currentTime);
  }

  public playPunchSwing(isCrit: boolean) {
    this.runAsync((ctx, master, now) => {
      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(420, now);
        filter.frequency.exponentialRampToValueAtTime(isCrit ? 2200 : 1450, now + 0.075);
        filter.Q.value = 1.1;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(isCrit ? 0.28 : 0.18, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        src.start(now);
        src.stop(now + 0.1);
      }

      if (isCrit || Math.random() < 0.35) {
        const osc = ctx.createOscillator();
        const formant = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(isCrit ? 185 : 152, now);
        osc.frequency.exponentialRampToValueAtTime(112, now + 0.095);
        formant.type = 'bandpass';
        formant.frequency.setValueAtTime(680, now);
        formant.Q.value = 3.0;
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(isCrit ? 0.18 : 0.1, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.connect(formant);
        formant.connect(gain);
        gain.connect(master);
        osc.start(now);
        osc.stop(now + 0.11);
      }
    });
  }

  public playWallImpact(material: WallMaterialKind, isCrit: boolean, isWeakSpot = false) {
    this.runAsync((ctx, master, now) => {
      const punchLevel = isWeakSpot ? 1.5 : isCrit ? 1.3 : 1.0;

      const thump = ctx.createOscillator();
      const thumpGain = ctx.createGain();
      thump.type = 'sine';
      const startFreq =
        material === 'drywall'
          ? 125
          : material === 'wood'
            ? 145
            : material === 'steel'
              ? 180
              : 135;
      thump.frequency.setValueAtTime(startFreq * (isWeakSpot ? 1.25 : isCrit ? 1.15 : 1), now);
      thump.frequency.exponentialRampToValueAtTime(30, now + (isWeakSpot ? 0.2 : 0.13));
      thumpGain.gain.setValueAtTime(0.42 * punchLevel, now);
      thumpGain.gain.exponentialRampToValueAtTime(0.001, now + (isWeakSpot ? 0.22 : 0.15));
      thump.connect(thumpGain);
      thumpGain.connect(master);
      thump.start(now);
      thump.stop(now + 0.24);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(
          material === 'drywall'
            ? 950
            : material === 'wood'
              ? 1250
              : material === 'brick' || material === 'concrete'
                ? 1750
                : 2900,
          now
        );
        filter.Q.value = material === 'wood' ? 2.2 : 1.2;

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.28 * punchLevel, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + (isCrit ? 0.14 : 0.095));

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(master);
        noise.start(now);
        noise.stop(now + 0.16);
      }

      if (isWeakSpot) {
        // Sharp resonant critical weak-spot ring
        [784, 1174.66].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.025);
          g.gain.setValueAtTime(0.18, now + idx * 0.025);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          osc.connect(g);
          g.connect(master);
          osc.start(now + idx * 0.025);
          osc.stop(now + 0.3);
        });
      }

      if (material === 'steel' || material === 'obsidian' || material === 'diamond') {
        const partials =
          material === 'steel'
            ? [520, 815, 1340]
            : material === 'obsidian'
              ? [680, 1120]
              : [1240, 1890, 2640];
        partials.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = material === 'diamond' ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq * (isCrit ? 1.08 : 1), now);
          g.gain.setValueAtTime((0.12 / (idx + 1)) * punchLevel, now);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
          osc.connect(g);
          g.connect(master);
          osc.start(now);
          osc.stop(now + 0.24);
        });
      }
    });
  }

  public playBagImpact(isCrit: boolean) {
    this.runAsync((ctx, master, now) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isCrit ? 115 : 96, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.14);
      gain.gain.setValueAtTime(isCrit ? 0.45 : 0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
      osc.connect(gain);
      gain.connect(master);
      osc.start(now);
      osc.stop(now + 0.17);

      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, now);
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.22, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(master);
        src.start(now);
        src.stop(now + 0.06);
      }

      const chain = ctx.createOscillator();
      const cGain = ctx.createGain();
      chain.type = 'triangle';
      chain.frequency.setValueAtTime(2450, now + 0.04);
      cGain.gain.setValueAtTime(0.045, now + 0.04);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
      chain.connect(cGain);
      cGain.connect(master);
      chain.start(now + 0.04);
      chain.stop(now + 0.12);
    });
  }

  public playWallShatter(material: WallMaterialKind) {
    this.runAsync((ctx, master, now) => {
      const boom = ctx.createOscillator();
      const boomGain = ctx.createGain();
      boom.type = 'sine';
      boom.frequency.setValueAtTime(110, now);
      boom.frequency.exponentialRampToValueAtTime(24, now + 0.48);
      boomGain.gain.setValueAtTime(0.55, now);
      boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.52);
      boom.connect(boomGain);
      boomGain.connect(master);
      boom.start(now);
      boom.stop(now + 0.54);

      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(material === 'diamond' ? 2400 : 1250, now);
        filter.frequency.exponentialRampToValueAtTime(340, now + 0.55);
        filter.Q.value = 0.8;
        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.42, now);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.58);
        src.connect(filter);
        filter.connect(nGain);
        nGain.connect(master);
        src.start(now);
        src.stop(now + 0.6);
      }

      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + 0.06 + idx * 0.045;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.11, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.34);
      });
    });
  }

  public playPurchase() {
    this.runAsync((ctx, master, now) => {
      [659.25, 987.77].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.055;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    });
  }

  public playAchievementClaim() {
    this.runAsync((ctx, master, now) => {
      [587.33, 739.99, 880, 1174.66].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.05;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.28);
      });
    });
  }

  public playOverdriveActivate() {
    this.runAsync((ctx, master, now) => {
      // Deep power surge drop + rising fifth synth chord
      const sub = ctx.createOscillator();
      const subG = ctx.createGain();
      sub.type = 'sawtooth';
      sub.frequency.setValueAtTime(160, now);
      sub.frequency.exponentialRampToValueAtTime(48, now + 0.35);
      subG.gain.setValueAtTime(0.28, now);
      subG.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      sub.connect(subG);
      subG.connect(master);
      sub.start(now);
      sub.stop(now + 0.42);

      [220, 329.63, 440, 659.25, 880].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.032;
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.04, t + 0.25);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.36);
      });
    });
  }

  public playBossSpawn() {
    this.runAsync((ctx, master, now) => {
      [110, 103.83].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.14;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.18, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    });
  }

  public playComboMilestone(combo: number) {
    this.runAsync((ctx, master, now) => {
      const pitchBoost = combo >= 100 ? 1.5 : combo >= 50 ? 1.25 : 1.0;
      [523.25 * pitchBoost, 783.99 * pitchBoost].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.04;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);
        g.gain.setValueAtTime(0.11, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.24);
      });
    });
  }

  /**
   * Subtle, airy floating swoosh/shimmer tick for floating glove aura pixels.
   */
  public playGloveAuraTick(style: GloveStyleVariant) {
    if (!this.ctx || this.ctx.state !== 'running' || this.muted || !this.sfxGain) return;
    const ctx = this.ctx;
    const sfx = this.sfxGain;
    const now = ctx.currentTime;

    if (this.noiseBuffer) {
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      const baseHz =
        style === 'frost' || style === 'quantum'
          ? 2400
          : style === 'flaming' || style === 'crimson_demon'
            ? 1450
            : 1850;
      filter.frequency.setValueAtTime(baseHz, now);
      filter.frequency.exponentialRampToValueAtTime(baseHz * 1.35, now + 0.14);
      filter.Q.value = 3.2;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0005, now);
      g.gain.linearRampToValueAtTime(0.026, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 0.16);

      src.connect(filter);
      filter.connect(g);
      g.connect(sfx);
      src.start(now);
      src.stop(now + 0.17);
    }

    const chime = ctx.createOscillator();
    const cg = ctx.createGain();
    chime.type = 'sine';
    const note = 880 + Math.random() * 440;
    chime.frequency.setValueAtTime(note, now);
    chime.frequency.exponentialRampToValueAtTime(note * 1.15, now + 0.12);
    cg.gain.setValueAtTime(0.0004, now);
    cg.gain.linearRampToValueAtTime(0.015, now + 0.025);
    cg.gain.exponentialRampToValueAtTime(0.0003, now + 0.14);
    chime.connect(cg);
    cg.connect(sfx);
    chime.start(now);
    chime.stop(now + 0.15);
  }

  public playBossFail() {
    this.runAsync((ctx, master, now) => {
      [220, 196, 164.81, 110].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        const t = now + idx * 0.12;
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.88, t + 0.28);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.setValueAtTime(950, t);
        g.gain.setValueAtTime(0.22, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
        osc.connect(lp);
        lp.connect(g);
        g.connect(master);
        osc.start(t);
        osc.stop(t + 0.36);
      });
    });
  }
}
