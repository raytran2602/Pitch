export type SoundType =
  | 'click'
  | 'tab'
  | 'swap'
  | 'whistle'
  | 'kickoff'
  | 'fulltime'
  | 'goal'
  | 'card'
  | 'sub'
  | 'shot'
  | 'accept'
  | 'reject'
  | 'tick';

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  startAt: number,
  duration: number,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  volume: number
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, startAt);
  if (freqEnd !== freqStart) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), startAt + duration);
  }
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + Math.min(0.015, duration * 0.2));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.01);
}

function playFilteredNoise(
  ctx: AudioContext,
  startAt: number,
  duration: number,
  filterType: BiquadFilterType,
  freq: number,
  q: number,
  volume: number
) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(freq, startAt);
  filter.Q.setValueAtTime(q, startAt);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + Math.min(0.08, duration * 0.25));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  noise.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  noise.start(startAt);
  noise.stop(startAt + duration + 0.01);
}

function playWhistleBurst(ctx: AudioContext, startAt: number, duration: number, volume = 0.045) {
  const osc = ctx.createOscillator();
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(2560, startAt);
  osc.frequency.setValueAtTime(2720, startAt + duration * 0.35);
  osc.frequency.setValueAtTime(2500, startAt + duration * 0.72);

  // Referee pea-whistle trill
  lfo.type = 'sine';
  lfo.frequency.setValueAtTime(34, startAt);
  lfoGain.gain.setValueAtTime(95, startAt);

  lfo.connect(lfoGain);
  lfoGain.connect(osc.frequency);

  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + 0.02);
  gain.gain.setValueAtTime(volume, startAt + Math.max(0.03, duration - 0.04));
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startAt);
  lfo.start(startAt);
  osc.stop(startAt + duration + 0.01);
  lfo.stop(startAt + duration + 0.01);
}

export function playSound(type: SoundType, enabled: boolean): void {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (type) {
      case 'click': {
        playTone(ctx, now, 0.055, 'triangle', 540, 290, 0.05);
        break;
      }
      case 'tab': {
        playTone(ctx, now, 0.045, 'sine', 640, 820, 0.038);
        break;
      }
      case 'tick': {
        playTone(ctx, now, 0.03, 'sine', 880, 620, 0.025);
        break;
      }
      case 'swap': {
        playTone(ctx, now, 0.08, 'sine', 420, 660, 0.065);
        playTone(ctx, now + 0.045, 0.07, 'triangle', 660, 840, 0.04);
        break;
      }
      case 'whistle':
      case 'kickoff': {
        playWhistleBurst(ctx, now, 0.28, 0.048);
        break;
      }
      case 'fulltime': {
        playWhistleBurst(ctx, now, 0.16, 0.045);
        playWhistleBurst(ctx, now + 0.22, 0.16, 0.045);
        playWhistleBurst(ctx, now + 0.44, 0.36, 0.052);
        playFilteredNoise(ctx, now + 0.12, 0.7, 'bandpass', 720, 0.8, 0.035);
        break;
      }
      case 'goal': {
        // Stadium crowd roar + brass fanfare triad
        playFilteredNoise(ctx, now, 0.95, 'bandpass', 820, 0.7, 0.075);
        playTone(ctx, now, 0.22, 'triangle', 523.25, 523.25, 0.075);
        playTone(ctx, now + 0.09, 0.22, 'triangle', 659.25, 659.25, 0.075);
        playTone(ctx, now + 0.18, 0.42, 'triangle', 783.99, 1046.5, 0.085);
        break;
      }
      case 'shot': {
        // Low ball kick thump + brief crowd murmur
        playTone(ctx, now, 0.09, 'sine', 150, 52, 0.09);
        playFilteredNoise(ctx, now + 0.02, 0.14, 'bandpass', 1100, 1.1, 0.025);
        break;
      }
      case 'card': {
        playWhistleBurst(ctx, now, 0.14, 0.042);
        playTone(ctx, now + 0.16, 0.12, 'square', 440, 330, 0.028);
        break;
      }
      case 'sub': {
        // Electronic board double chime
        playTone(ctx, now, 0.09, 'sine', 587.33, 587.33, 0.055);
        playTone(ctx, now + 0.09, 0.14, 'sine', 880, 880, 0.06);
        break;
      }
      case 'accept': {
        playTone(ctx, now, 0.09, 'sine', 493.88, 587.33, 0.065);
        playTone(ctx, now + 0.09, 0.18, 'triangle', 659.25, 783.99, 0.07);
        break;
      }
      case 'reject': {
        playTone(ctx, now, 0.12, 'sawtooth', 260, 200, 0.045);
        playTone(ctx, now + 0.11, 0.16, 'sawtooth', 195, 145, 0.045);
        break;
      }
    }
  } catch {
    // Ignore audio errors in headless or restricted contexts
  }
}
