// Web Audio Synthesizer for WhatsApp Web Incoming Call Ringtone
let audioCtx = null;
let isRinging = false;
let ringTimeout = null;

const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
};

// Play a single marimba/chime note with harmonic envelope
const playNote = (ctx, freq, startTime, duration = 0.22) => {
  if (!ctx) return;
  
  // Fundamental tone
  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(freq, startTime);

  // Harmonic overtone for bell/marimba brightness
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = 'triangle';
  osc2.frequency.setValueAtTime(freq * 2, startTime);

  // Volume envelopes (quick attack, smooth exponential decay)
  gain1.gain.setValueAtTime(0.001, startTime);
  gain1.gain.linearRampToValueAtTime(0.3, startTime + 0.012);
  gain1.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  gain2.gain.setValueAtTime(0.001, startTime);
  gain2.gain.linearRampToValueAtTime(0.09, startTime + 0.01);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration * 0.7);

  osc1.connect(gain1);
  osc2.connect(gain2);
  gain1.connect(ctx.destination);
  gain2.connect(ctx.destination);

  osc1.start(startTime);
  osc1.stop(startTime + duration);
  osc2.start(startTime);
  osc2.stop(startTime + duration);
};

// WhatsApp Web call ringtone phrase (repeats until answered or dismissed)
const playPhrase = () => {
  if (!isRinging) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  
  // WhatsApp distinctive marimba phrase: F#5 -> D5 -> A4 -> D5 -> F#5 -> A5
  const notes = [
    { freq: 739.99, delay: 0.00, dur: 0.18 }, // F#5
    { freq: 587.33, delay: 0.15, dur: 0.18 }, // D5
    { freq: 440.00, delay: 0.30, dur: 0.20 }, // A4
    { freq: 587.33, delay: 0.48, dur: 0.18 }, // D5
    { freq: 739.99, delay: 0.63, dur: 0.18 }, // F#5
    { freq: 880.00, delay: 0.80, dur: 0.35 }, // A5
  ];

  notes.forEach(({ freq, delay, dur }) => {
    playNote(ctx, freq, now + delay, dur);
  });

  // Loop every 2.4 seconds
  if (isRinging) {
    ringTimeout = setTimeout(() => {
      if (isRinging) playPhrase();
    }, 2400);
  }
};

export const startRingtone = () => {
  if (isRinging) return;
  isRinging = true;
  playPhrase();
};

export const stopRingtone = () => {
  isRinging = false;
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
};
