import { config } from '../config.js';
import { getKnowledge } from '../knowledge.js';
import { approxTokens } from '../limits.js';

// Contract: generate({ env, system, messages }) -> { text, inTokens, outTokens, model }
export async function generate({ env, system, messages }) {
  if (env.AI_PROVIDER === 'mock') return mockGenerate(messages);
  if (!env.AI) throw new Error('Workers AI binding missing');
  const model = config.models.llm;
  const res = await env.AI.run(model, {
    messages: [{ role: 'system', content: system }, ...messages],
    max_tokens: config.limits.maxOutputTokens,
    temperature: 0.4,
  });
  const text = typeof res === 'string' ? res : res?.response ?? '';
  const inTokens = res?.usage?.prompt_tokens ?? approxTokens(system + messages.map((m) => m.content).join(' '));
  const outTokens = res?.usage?.completion_tokens ?? approxTokens(text);
  return { text, inTokens, outTokens, model };
}

// Offline stand-in for UI/pipeline testing: picks the best-matching approved section. Not an AI.
function mockGenerate(messages) {
  const k = getKnowledge();
  const q = (messages.at(-1)?.content || '').toLowerCase().match(/[a-z0-9]{3,}/g) || [];
  let best = null, bestScore = 0;
  for (const s of k.sections) {
    const hay = `${s.title} ${s.text}`.toLowerCase();
    const score = q.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
    if (score > bestScore) { best = s; bestScore = score; }
  }
  if (!best || bestScore < 1) {
    return { text: "The information I have doesn't cover that. You could use the contact section on the site to ask Anuj directly.\nLINKS: contact", inTokens: 10, outTokens: 20, model: 'mock' };
  }
  const first = best.text.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ');
  return { text: `${first}\nLINKS: ${best.links.join(', ')}`, inTokens: 10, outTokens: 40, model: 'mock' };
}
