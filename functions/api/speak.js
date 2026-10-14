import { json, readJson, HttpError } from '../_lib/http.js';
import { config } from '../_lib/config.js';
import { authed, requireMethod } from '../_lib/guard.js';
import { assertBudget, spend, ttsNeurons } from '../_lib/limits.js';
import { synthesize } from '../_lib/providers/tts.js';

export async function onRequestPost({ request, env }) {
  requireMethod(request, 'POST');
  await authed(request, env);
  const body = await readJson(request, 10_000);
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw new HttpError(400, 'empty_text', 'Nothing to speak.');
  if (text.length > config.limits.maxSpeakChars) throw new HttpError(413, 'text_too_long', 'Text too long to speak.');

  await assertBudget(env);
  let res;
  try {
    res = await synthesize({ env, text });
  } catch (e) {
    console.error('tts failed', e && e.message);
    throw new HttpError(502, 'tts_unavailable', 'Voice is unavailable right now.');
  }
  await spend(env, ttsNeurons(text.length));
  return json({ audio: res.audioBase64, mime: res.mime });
}
