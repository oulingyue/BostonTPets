// Generates the game's 8-bit sound effects as WAV files in assets/sfx/. Run: npm run sfx
// Everything is synthesized here (square/triangle/noise waves with envelopes), so the sounds are
// original and license-free. Noise uses a fixed seed, so regenerating gives identical files.
// To tweak a sound, edit its recipe in SOUNDS and rerun.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RATE = 22050;
const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets', 'sfx');

// Note frequencies (Hz)
const N = { A3: 220, C4: 262, E4: 330, G4: 392, A4: 440, C5: 523, D5: 587, E5: 659, G5: 784, A5: 880, C6: 1047, E6: 1319, G6: 1568, C7: 2093, E7: 2637 };

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

function track(seconds) {
  return new Float32Array(Math.ceil(seconds * RATE));
}

/** A pitched tone. Pitch slides exponentially from f0 to f1. `decay` (per second) makes it percussive. */
function tone(out, { at = 0, dur, f0, f1 = f0, wave = 'square', vol = 0.25, duty = 0.5, attack = 0.004, release = 0.04, decay = 0, vibrato = 0, vibratoHz = 7 }) {
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let phase = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    const f = f0 * Math.pow(f1 / f0, i / n) * (1 + vibrato * Math.sin(2 * Math.PI * vibratoHz * t));
    phase = (phase + f / RATE) % 1;
    let v;
    if (wave === 'square') v = phase < duty ? 1 : -1;
    else if (wave === 'triangle') v = 1 - 4 * Math.abs(phase - 0.5);
    else v = Math.sin(2 * Math.PI * phase);
    const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release) * Math.exp(-decay * t);
    out[start + i] += v * vol * Math.max(0, env);
  }
}

/** Filtered white noise. `smooth` 0..1: lower is darker (a one-pole low-pass). `gate(t)` shapes rhythm. */
function noise(out, { at = 0, dur, vol = 0.2, smooth = 1, attack = 0.002, release = 0.05, decay = 0, seed = 1, gate = () => 1 }) {
  const rng = makeRng(seed);
  const start = Math.floor(at * RATE);
  const n = Math.floor(dur * RATE);
  let y = 0;
  for (let i = 0; i < n && start + i < out.length; i++) {
    const t = i / RATE;
    y += smooth * (rng() * 2 - 1 - y);
    const env = Math.min(1, t / attack) * Math.min(1, (dur - t) / release) * Math.exp(-decay * t) * gate(t);
    out[start + i] += y * vol * Math.max(0, env);
  }
}

/** Short high blips, for sparkles. */
function twinkles(out, at, notes, gap, vol = 0.14) {
  notes.forEach((f, i) => tone(out, { at: at + i * gap, dur: 0.07, f0: f, wave: 'square', duty: 0.25, vol, decay: 30 }));
}

const SOUNDS = {
  // Card taps the reader: a quick double beep.
  tap: () => {
    const o = track(0.16);
    tone(o, { at: 0, dur: 0.05, f0: N.G6, duty: 0.25, vol: 0.2 });
    tone(o, { at: 0.07, dur: 0.07, f0: N.C7, duty: 0.25, vol: 0.2 });
    return o;
  },
  // Rarity lights climbing: one rising note per tier.
  tier1: () => tierNote(N.C5),
  tier2: () => tierNote(N.E5),
  tier3: () => tierNote(N.G5),
  tier4: () => tierNote(N.C6, 0.3),
  // The station flashes the result: a bright chord over a noise burst.
  flash: () => {
    const o = track(0.6);
    noise(o, { dur: 0.3, vol: 0.18, smooth: 0.8, decay: 9 });
    for (const f of [N.C6, N.E6, N.G6]) tone(o, { dur: 0.55, f0: f, wave: 'triangle', vol: 0.12, decay: 5 });
    return o;
  },
  // Legendary: a short fanfare.
  legendary: () => {
    const o = track(1.0);
    [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(o, { at: i * 0.08, dur: 0.09, f0: f, duty: 0.25, vol: 0.18 }));
    for (const f of [N.C6, N.E6, N.G6]) tone(o, { at: 0.32, dur: 0.65, f0: f, duty: 0.5, vol: 0.09, vibrato: 0.012, release: 0.3 });
    return o;
  },
  // Train pulling in: wheels clacking on the rails, a low hum winding down, a little brake squeal.
  arrive: () => {
    const o = track(1.35);
    const clack = (t) => {
      const beat = 0.11 + t * 0.12; // clacks slow down as the train brakes
      const p = (t % beat) / beat;
      return 0.35 + 0.65 * Math.exp(-p * 9);
    };
    noise(o, { dur: 1.3, vol: 0.32, smooth: 0.12, attack: 0.15, release: 0.35, gate: clack, seed: 7 });
    tone(o, { dur: 1.25, f0: 82, f1: 55, wave: 'triangle', vol: 0.18, attack: 0.2, release: 0.3 });
    tone(o, { at: 1.0, dur: 0.3, f0: 2200, f1: 1900, wave: 'sine', vol: 0.05, attack: 0.05, release: 0.15 });
    return o;
  },
  // Doors open: a two-note chime, then a soft whoosh.
  doors: () => {
    const o = track(0.75);
    tone(o, { dur: 0.22, f0: N.A5, wave: 'triangle', vol: 0.22, decay: 6, release: 0.08 });
    tone(o, { at: 0.18, dur: 0.3, f0: N.E5, wave: 'triangle', vol: 0.22, decay: 5, release: 0.1 });
    noise(o, { at: 0.35, dur: 0.38, vol: 0.12, smooth: 0.25, attack: 0.08, release: 0.2, seed: 3 });
    return o;
  },
  // Pet appears: a springy rising boing.
  pop: () => {
    const o = track(0.22);
    tone(o, { dur: 0.13, f0: N.E4, f1: N.E6, duty: 0.25, vol: 0.2 });
    tone(o, { at: 0.12, dur: 0.08, f0: N.C7, duty: 0.25, vol: 0.12, decay: 25 });
    return o;
  },
  // Line variants, gold, and legendaries: a twinkle.
  sparkle: () => {
    const o = track(0.55);
    twinkles(o, 0, [N.C7, N.G6, N.E7, N.C7, N.G6, N.E7], 0.07);
    return o;
  },
  // NEW! / TURNED GOLD! stamp landing.
  stamp: () => {
    const o = track(0.16);
    noise(o, { dur: 0.08, vol: 0.3, smooth: 0.35, decay: 40, seed: 5 });
    tone(o, { dur: 0.12, f0: 140, f1: 90, duty: 0.5, vol: 0.18, decay: 22 });
    return o;
  },
  // EXP bar filling: a rising, stuttering sweep.
  exp: () => {
    const o = track(0.48);
    tone(o, { dur: 0.46, f0: N.A4, f1: N.A5 * 1.5, duty: 0.25, vol: 0.12, release: 0.05 });
    // chop it into ticks
    for (let i = 0; i < o.length; i++) if (Math.floor((i / RATE) * 32) % 2 === 1) o[i] *= 0.35;
    return o;
  },
  // Level up: a quick arpeggio into a held chord, with a twinkle.
  levelup: () => {
    const o = track(1.0);
    [N.C5, N.E5, N.G5, N.C6, N.E6, N.G6].forEach((f, i) => tone(o, { at: i * 0.055, dur: 0.07, f0: f, duty: 0.25, vol: 0.16 }));
    for (const f of [N.C6, N.G6]) tone(o, { at: 0.33, dur: 0.5, f0: f, duty: 0.5, vol: 0.09, vibrato: 0.01, release: 0.25 });
    twinkles(o, 0.45, [N.E7, N.C7, N.E7], 0.08, 0.08);
    return o;
  },
  // Opening a pet you own (collection, pet sheet): a soft chirp.
  open: () => {
    const o = track(0.2);
    tone(o, { dur: 0.08, f0: N.E5, f1: N.A5, wave: 'triangle', vol: 0.24 });
    tone(o, { at: 0.08, dur: 0.1, f0: N.E6, wave: 'triangle', vol: 0.16, decay: 18 });
    return o;
  },
  // Opening a pet you haven't found: a low, muted blip.
  locked: () => {
    const o = track(0.14);
    tone(o, { dur: 0.12, f0: N.A3, f1: 180, wave: 'triangle', vol: 0.22, decay: 10 });
    return o;
  },
  // Tapping your pet: a tiny hop.
  hop: () => {
    const o = track(0.11);
    tone(o, { dur: 0.09, f0: N.A4, f1: N.E5 * 1.3, duty: 0.25, vol: 0.14 });
    return o;
  },
};

function tierNote(f, dur = 0.18) {
  const o = track(dur + 0.02);
  tone(o, { dur, f0: f, duty: 0.25, vol: 0.18, release: 0.06 });
  tone(o, { dur, f0: f * 2, wave: 'triangle', vol: 0.06, release: 0.06 });
  return o;
}

function writeWav(file, samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  // Normalize every sound to the same peak, so each one is clearly audible on a phone speaker (and never clips).
  const TARGET_PEAK = 0.8;
  const gain = peak > 0 ? TARGET_PEAK / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * gain)) * 32767), i * 2));
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(RATE, 24);
  header.writeUInt32LE(RATE * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(file, Buffer.concat([header, data]));
}

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, make] of Object.entries(SOUNDS)) {
  const samples = make();
  writeWav(path.join(OUT_DIR, `${name}.wav`), samples);
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)}s`);
}
