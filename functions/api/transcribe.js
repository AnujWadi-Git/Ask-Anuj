import { json, readJson, HttpError } from '../_lib/http.js';
import { config } from '../_lib/config.js';
import { authed, requireMethod } from '../_lib/guard.js';
import { assertBudget, spend, sttNeurons } from '../_lib/limits.js';
import { transcribe } from '../_lib/providers/stt.js';

export async function onRequestPost({ request, env }) {
  requireMethod(request, 'POST');
  await authed(request, env);
  const body = await readJson(request, config.limits.maxAudioBase64Chars + 1000);
  const audio = body.audio;
  if (typeof audio !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(audio) || audio.length < 400) throw new HttpError(400, 'bad_audio', 'No audio received.');
  if (audio.length > config.limits.maxAudioBase64Chars) throw new HttpError(413, 'audio_too_long', 'That recording was too long. Try a shorter question.');

  await assertBudget(env);
  const seconds = (audio.length * 0.75) / 32000;   // 16 kHz mono 16-bit WAV
  let res;
  try {
    res = await transcribe({ env, audioBase64: audio });
  } catch (e) {
    console.error('stt failed', e && e.message);
    throw new HttpError(502, 'stt_unavailable', 'I could not transcribe that. You can type your question instead.');
  }
  await spend(env, sttNeurons(seconds));
  return json({ text: (res.text || '').slice(0, config.limits.maxTextChars) });
}
