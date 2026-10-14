import { config } from '../config.js';

// Minimal valid 0.1 s silent WAV for mock mode.
const SILENT_WAV = (() => {
  const n = 1600, buf = new Uint8Array(44 + n * 2), v = new DataView(buf.buffer);
  const s = (o, t) => [...t].forEach((c, i) => (buf[o + i] = c.charCodeAt(0)));
  s(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 2, true);
  return btoa(String.fromCharCode(...buf));
})();

// Contract: synthesize({ env, text }) -> { audioBase64, mime }
export async function synthesize({ env, text }) {
  if (env.AI_PROVIDER === 'mock') return { audioBase64: SILENT_WAV, mime: 'audio/wav' };
  if (!env.AI) throw new Error('Workers AI binding missing');
  const res = await env.AI.run(config.models.tts, { prompt: text, lang: 'en' });
  const audioBase64 = typeof res === 'string' ? res : res?.audio;
  if (!audioBase64 || typeof audioBase64 !== 'string') throw new Error('TTS returned no audio');
  return { audioBase64, mime: 'audio/mpeg' };
}
