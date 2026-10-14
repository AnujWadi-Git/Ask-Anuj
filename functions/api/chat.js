import { json, readJson, HttpError } from '../_lib/http.js';
import { config } from '../_lib/config.js';
import { authed, requireMethod } from '../_lib/guard.js';
import { validateHistory } from '../_lib/security.js';
import { enforceSessionTurns, assertBudget, spend, llmNeurons } from '../_lib/limits.js';
import { buildSystemPrompt } from '../_lib/prompt.js';
import { parseModelOutput, resolveLinks } from '../_lib/knowledge.js';
import { generate } from '../_lib/providers/llm.js';

export async function onRequestPost({ request, env }) {
  requireMethod(request, 'POST');
  const { payload } = await authed(request, env);
  const body = await readJson(request, 20_000);

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) throw new HttpError(400, 'empty_message', 'Please say or type something.');
  if (message.length > config.limits.maxTextChars) throw new HttpError(413, 'message_too_long', `Please keep questions under ${config.limits.maxTextChars} characters.`);

  await enforceSessionTurns(env, payload.sid, payload.iat);
  await assertBudget(env);

  const messages = [...validateHistory(body.history), { role: 'user', content: message }];
  let result;
  try {
    result = await generate({ env, system: buildSystemPrompt({ name: payload.name, role: payload.role }), messages });
  } catch (e) {
    console.error('llm failed', e && e.message);
    throw new HttpError(502, 'llm_unavailable', 'I could not reach my language model just now. Please try again in a moment.');
  }
  await spend(env, llmNeurons(result.model, result.inTokens, result.outTokens));

  const wantsDetail = /\b(more|detail|detailed|deeper|elaborate|explain|walk me through|in depth)\b/i.test(message);
  const { text, ids } = parseModelOutput(result.text, config.limits.maxAnswerChars, wantsDetail ? config.limits.maxDetailWords : config.limits.maxSpokenWords);
  if (!text) throw new HttpError(502, 'empty_answer', 'I did not get an answer. Please try rephrasing.');
  return json({ answer: text, links: resolveLinks(ids) });
}
