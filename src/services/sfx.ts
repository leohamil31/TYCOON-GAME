import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Vibration } from 'react-native';

/**
 * Sons e vibração do jogo.
 *
 * Sons: sintetizados na hora com Web Audio (sem arquivos, sem custo de download). Funcionam no navegador
 * (GitHub Pages, inclusive no celular). No app nativo ficam mudos até ligarmos uma biblioteca de áudio.
 * Vibração: Android (app e Chrome). iPhone não permite vibração curta pelo navegador.
 */

export type Sfx =
  | 'tap'
  | 'pick'
  | 'place'
  | 'invalid'
  | 'clear'
  | 'perfect'
  | 'bomb'
  | 'attackSend'
  | 'attackHit'
  | 'freeze'
  | 'coin'
  | 'levelUp'
  | 'chest'
  | 'countdown'
  | 'go'
  | 'win'
  | 'lose'
  | 'gameOver';

const KEY = '@tycoon/sfx_v1';
let soundOn = true;
let hapticsOn = true;
const listeners = new Set<() => void>();

void AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const v = JSON.parse(raw) as { sound?: boolean; haptics?: boolean };
    soundOn = v.sound !== false;
    hapticsOn = v.haptics !== false;
    listeners.forEach((f) => f());
  })
  .catch(() => undefined);

export const getSfxSettings = () => ({ sound: soundOn, haptics: hapticsOn });
export function setSfxSettings(next: { sound?: boolean; haptics?: boolean }) {
  if (next.sound !== undefined) soundOn = next.sound;
  if (next.haptics !== undefined) hapticsOn = next.haptics;
  void AsyncStorage.setItem(KEY, JSON.stringify({ sound: soundOn, haptics: hapticsOn })).catch(() => undefined);
  listeners.forEach((f) => f());
}
export const onSfxSettings = (f: () => void) => {
  listeners.add(f);
  return () => void listeners.delete(f);
};

/** Na web, áudio e vibração só são liberados depois do primeiro toque/tecla. */
let gestured = Platform.OS !== 'web';

// ---------------------------------------------------------------- vibração
const VIBE = { light: 12, medium: 25, heavy: 45 } as const;
export function haptic(kind: keyof typeof VIBE | number[]) {
  if (!hapticsOn || !gestured || Platform.OS === 'ios') return;
  const pattern = Array.isArray(kind) ? kind : VIBE[kind];
  try {
    if (Platform.OS === 'web') {
      const nav = (globalThis as { navigator?: { vibrate?: (p: number | number[]) => boolean } }).navigator;
      nav?.vibrate?.(pattern);
    } else Vibration.vibrate(pattern as number);
  } catch {
    // aparelho sem vibração
  }
}

// ---------------------------------------------------------------- Web Audio
// Tipos mínimos do Web Audio (o tsconfig do React Native não inclui os tipos do navegador).
type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';
type BiquadFilterType = 'lowpass' | 'highpass' | 'bandpass';
interface Param {
  value: number;
  setValueAtTime(v: number, t: number): void;
  exponentialRampToValueAtTime(v: number, t: number): void;
}
interface AudioNodeLike {
  connect(n: AudioNodeLike | unknown): void;
}
interface GainNode extends AudioNodeLike {
  gain: Param;
}
interface AudioBuffer {
  getChannelData(ch: number): Float32Array;
}
interface Ctx {
  state: string;
  currentTime: number;
  sampleRate: number;
  destination: unknown;
  resume(): Promise<void>;
  createGain(): GainNode;
  createDynamicsCompressor(): AudioNodeLike;
  createBuffer(ch: number, len: number, rate: number): AudioBuffer;
  createOscillator(): AudioNodeLike & { type: OscillatorType; frequency: Param; start(t: number): void; stop(t: number): void };
  createBiquadFilter(): AudioNodeLike & { type: BiquadFilterType; frequency: Param; Q: Param };
  createBufferSource(): AudioNodeLike & { buffer: AudioBuffer | null; start(t: number): void; stop(t: number): void };
}
interface DocLike {
  addEventListener(e: string, f: () => void): void;
  removeEventListener(e: string, f: () => void): void;
}

let ctx: Ctx | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;

const audioCtor = (): (new () => Ctx) | null => {
  if (Platform.OS !== 'web') return null;
  const g = globalThis as { AudioContext?: new () => Ctx; webkitAudioContext?: new () => Ctx };
  return g.AudioContext ?? g.webkitAudioContext ?? null;
};

function ensure(): Ctx | null {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  }
  const C = audioCtor();
  if (!C) return null;
  try {
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.55;
    // Compressor evita estouro quando vários sons tocam juntos.
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch {
    ctx = null;
  }
  return ctx;
}

// Navegadores só liberam áudio depois de um toque: destrava no primeiro gesto.
const doc = (globalThis as { document?: DocLike }).document;
if (Platform.OS === 'web' && doc) {
  const unlock = () => {
    gestured = true;
    ensure();
    doc.removeEventListener('pointerdown', unlock);
    doc.removeEventListener('keydown', unlock);
  };
  doc.addEventListener('pointerdown', unlock);
  doc.addEventListener('keydown', unlock);
}

/** Nota com envelope rápido (ataque curto, decaimento exponencial). */
function tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; vol?: number; to?: number } = {}) {
  const c = ctx!;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(freq, at);
  if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  const v = opts.vol ?? 0.3;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(v, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g);
  g.connect(master!);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** Ruído filtrado (estalos, explosões, "whoosh"). */
function noise(at: number, dur: number, opts: { type?: BiquadFilterType; freq?: number; to?: number; q?: number; vol?: number } = {}) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = opts.type ?? 'bandpass';
  f.frequency.setValueAtTime(opts.freq ?? 1200, at);
  if (opts.to) f.frequency.exponentialRampToValueAtTime(opts.to, at + dur);
  f.Q.value = opts.q ?? 1;
  const g = c.createGain();
  const v = opts.vol ?? 0.3;
  g.gain.setValueAtTime(v, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(at);
  src.stop(at + dur + 0.02);
}

// Escala maior pentatônica: qualquer sequência soa "musical".
const PENTA = [0, 2, 4, 7, 9];
const note = (step: number, base = 523.25) => base * Math.pow(2, (PENTA[((step % 5) + 5) % 5] + 12 * Math.floor(step / 5)) / 12);

/**
 * Toca um efeito. `level` muda a intensidade: nas linhas é o combo (o tom sobe a cada combo),
 * no "place" é o tamanho da peça.
 */
export function play(name: Sfx, level = 0) {
  if (!soundOn || !gestured) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime + 0.005;
  switch (name) {
    case 'tap':
      tone(880, t, 0.05, { type: 'triangle', vol: 0.12 });
      break;
    case 'pick':
      tone(660, t, 0.06, { type: 'triangle', vol: 0.14, to: 880 });
      break;
    case 'place': // "clack" de bloco encaixando
      noise(t, 0.05, { freq: 2400, q: 3, vol: 0.35 });
      tone(180 - Math.min(level, 5) * 8, t, 0.09, { type: 'sine', vol: 0.35, to: 90 });
      break;
    case 'invalid':
      tone(220, t, 0.08, { type: 'square', vol: 0.08 });
      tone(165, t + 0.07, 0.1, { type: 'square', vol: 0.08 });
      break;
    case 'clear': {
      // Arpejo que sobe com o combo; mais linhas = mais notas.
      const lines = Math.max(1, Math.min(4, Math.floor(level / 10) || 1));
      const combo = level % 10;
      for (let i = 0; i < 2 + lines; i++) tone(note(i + combo * 2), t + i * 0.05, 0.22, { type: 'triangle', vol: 0.22 });
      noise(t, 0.18, { type: 'highpass', freq: 5000, vol: 0.08 });
      break;
    }
    case 'perfect':
      [0, 2, 4, 5, 7, 9].forEach((s, i) => tone(note(s), t + i * 0.06, 0.4, { type: 'triangle', vol: 0.2 }));
      break;
    case 'bomb':
      noise(t, 0.5, { type: 'lowpass', freq: 1800, to: 120, vol: 0.6 });
      tone(140, t, 0.45, { type: 'sine', vol: 0.55, to: 38 });
      break;
    case 'attackSend':
      noise(t, 0.28, { type: 'bandpass', freq: 600, to: 4200, q: 2, vol: 0.3 });
      tone(330, t + 0.05, 0.18, { type: 'sawtooth', vol: 0.06, to: 990 });
      break;
    case 'attackHit':
      tone(110, t, 0.3, { type: 'square', vol: 0.12, to: 55 });
      noise(t, 0.2, { type: 'lowpass', freq: 900, vol: 0.4 });
      break;
    case 'freeze':
      [2093, 2637, 3136, 2349].forEach((f, i) => tone(f, t + i * 0.04, 0.35, { type: 'sine', vol: 0.08 }));
      noise(t, 0.4, { type: 'highpass', freq: 6000, vol: 0.06 });
      break;
    case 'coin':
      tone(988, t, 0.08, { type: 'square', vol: 0.1 });
      tone(1319, t + 0.07, 0.22, { type: 'square', vol: 0.1 });
      break;
    case 'levelUp':
      [0, 2, 4, 5, 7].forEach((s, i) => tone(note(s, 392), t + i * 0.08, 0.3, { type: 'triangle', vol: 0.22 }));
      tone(note(10, 392), t + 0.42, 0.6, { type: 'triangle', vol: 0.25 });
      break;
    case 'chest':
      noise(t, 0.15, { freq: 900, q: 1, vol: 0.3 });
      [0, 3, 5, 8, 10].forEach((s, i) => tone(note(s, 659), t + 0.12 + i * 0.05, 0.35, { type: 'sine', vol: 0.15 }));
      break;
    case 'countdown':
      tone(660, t, 0.12, { type: 'square', vol: 0.1 });
      break;
    case 'go':
      tone(988, t, 0.3, { type: 'square', vol: 0.12 });
      break;
    case 'win':
      [0, 2, 4, 7].forEach((s, i) => tone(note(s), t + i * 0.1, 0.35, { type: 'triangle', vol: 0.22 }));
      tone(note(9), t + 0.42, 0.7, { type: 'triangle', vol: 0.24 });
      break;
    case 'lose':
    case 'gameOver':
      [4, 2, 0].forEach((s, i) => tone(note(s, 392), t + i * 0.14, 0.32, { type: 'triangle', vol: 0.18 }));
      tone(196, t + 0.42, 0.6, { type: 'sine', vol: 0.18, to: 147 });
      break;
  }
}
