import { config } from '../config.js';

// Contract: transcribe({ env, audioBase64 }) -> { text }
export async function transcribe({ env, audioBase64 }) {
  if (env.AI_PROVIDER === 'mock') return { text: env.MOCK_STT_TEXT || 'Tell me about the blood bank system' };
  if (!env.AI) throw new Error('Workers AI binding missing');
  const res = await env.AI.run(config.models.stt, { audio: audioBase64, language: 'en' });
  return { text: String(res?.text || '').trim() };
}
