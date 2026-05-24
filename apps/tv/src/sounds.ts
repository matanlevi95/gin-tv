/**
 * Tiny Web Audio synth — no external assets, no licensing concerns.
 * Each sound is a short envelope on a synthetic waveform. Triggered by name.
 */

type SoundName =
  | "click"
  | "deal"
  | "draw"
  | "discard"
  | "ready"
  | "turn"
  | "win"
  | "knock"
  | "gin"
  | "undercut"
  | "error";

let ctx: AudioContext | null = null;
let muted = false;
let gestureUnlocked = false;

// Chrome's autoplay policy blocks AudioContext until a user gesture has
// happened on the page. We unlock the context on the FIRST gesture so the
// initial deal/draw sounds actually play.
function installGestureUnlock() {
  if (typeof document === "undefined") return;
  const unlock = () => {
    gestureUnlocked = true;
    const c = ctx ?? getCtx();
    if (c?.state === "suspended") c.resume().catch(() => {});
    document.removeEventListener("click", unlock);
    document.removeEventListener("touchstart", unlock);
    document.removeEventListener("keydown", unlock);
  };
  document.addEventListener("click", unlock, { once: false });
  document.addEventListener("touchstart", unlock, { once: false });
  document.addEventListener("keydown", unlock, { once: false });
}
if (typeof document !== "undefined") installGestureUnlock();
try {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("ginTv:muted") : null;
  muted = stored === "1";
} catch {}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return ctx;
}

export function setMuted(v: boolean) {
  muted = v;
  try {
    localStorage.setItem("ginTv:muted", v ? "1" : "0");
  } catch {}
}
export function isMuted() {
  return muted;
}

/**
 * Beep helper: schedules a tone at `freq` Hz, duration `dur`s, with attack/release envelope.
 */
function tone(
  c: AudioContext,
  startAt: number,
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  peakGain = 0.18
) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
  osc.connect(g).connect(c.destination);
  osc.start(startAt);
  osc.stop(startAt + dur + 0.05);
}

/**
 * "Whoosh" of filtered white noise — used for card slide / shuffle.
 */
function noiseWhoosh(c: AudioContext, startAt: number, dur: number, cutoff = 1500, peakGain = 0.12) {
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(cutoff, startAt);
  filt.frequency.exponentialRampToValueAtTime(Math.max(cutoff * 0.5, 200), startAt + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(peakGain, startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, startAt + dur);
  src.connect(filt).connect(g).connect(c.destination);
  src.start(startAt);
  src.stop(startAt + dur + 0.05);
}

export function play(name: SoundName) {
  if (muted) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  // Skip silently if the user hasn't interacted yet (Chrome blocks).
  if (!gestureUnlocked && c.state !== "running") return;
  const t = c.currentTime;
  switch (name) {
    case "click":
      tone(c, t, 700, 0.05, "square", 0.08);
      break;
    case "deal":
      // Several quick whooshes — sound of a hand being dealt.
      for (let i = 0; i < 5; i++) noiseWhoosh(c, t + i * 0.08, 0.08, 2200, 0.07);
      break;
    case "draw":
      noiseWhoosh(c, t, 0.13, 1800, 0.11);
      break;
    case "discard":
      noiseWhoosh(c, t, 0.10, 1200, 0.10);
      tone(c, t + 0.05, 220, 0.05, "triangle", 0.06);
      break;
    case "ready":
      tone(c, t, 660, 0.08, "sine", 0.15);
      tone(c, t + 0.08, 990, 0.10, "sine", 0.13);
      break;
    case "turn":
      tone(c, t, 880, 0.08, "sine", 0.12);
      break;
    case "win":
      // Major-chord arpeggio
      tone(c, t, 523.25, 0.22, "triangle", 0.16); // C5
      tone(c, t + 0.12, 659.25, 0.22, "triangle", 0.16); // E5
      tone(c, t + 0.24, 783.99, 0.22, "triangle", 0.16); // G5
      tone(c, t + 0.36, 1046.5, 0.45, "triangle", 0.18); // C6
      break;
    case "knock":
      // Two quick low knocks
      tone(c, t, 180, 0.06, "square", 0.18);
      tone(c, t + 0.10, 200, 0.06, "square", 0.16);
      break;
    case "gin":
      // Bright sparkle
      tone(c, t, 1318.5, 0.18, "sine", 0.16); // E6
      tone(c, t + 0.08, 1567.98, 0.18, "sine", 0.15); // G6
      tone(c, t + 0.16, 2093, 0.30, "sine", 0.17); // C7
      break;
    case "undercut":
      // Dramatic descending tone
      const oscU = c.createOscillator();
      const gU = c.createGain();
      oscU.type = "sawtooth";
      oscU.frequency.setValueAtTime(440, t);
      oscU.frequency.exponentialRampToValueAtTime(110, t + 0.5);
      gU.gain.setValueAtTime(0.15, t);
      gU.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      oscU.connect(gU).connect(c.destination);
      oscU.start(t);
      oscU.stop(t + 0.55);
      break;
    case "error":
      tone(c, t, 220, 0.18, "square", 0.12);
      break;
  }
}
