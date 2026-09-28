'use client';
/** Mechanical audio cues via Web Audio API — no assets, ~50 ms tactile blips. */

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function blip(freq: number, durMs: number, type: OscillatorType = 'square', gain = 0.04) {
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + durMs / 1000);
  } catch { /* audio is decorative — never throw */ }
}

export const sound = {
  /** E-stop / confirmations: low mechanical thunk. */
  click: () => blip(220, 55),
  /** Seal engage: short high tick. */
  seal: () => blip(880, 45, 'sine', 0.05),
  /** Alarm: three descending blips for E-stop trips. */
  alarm: () => {
    blip(440, 70);
    setTimeout(() => blip(330, 70), 90);
    setTimeout(() => blip(220, 110), 180);
  },
};
