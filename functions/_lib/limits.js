import { config } from './config.js';
import { HttpError } from './http.js';

const day = (d = new Date()) => d.toISOString().slice(0, 10);
const minute = (d = new Date()) => d.toISOString().slice(0, 16);

export async function incr(env, key, window, by = 1) {
  const row = await env.DB.prepare(
    'INSERT INTO rate_limits (key, window, count) VALUES (?1, ?2, ?3) ON CONFLICT(key, window) DO UPDATE SET count = count + ?3 RETURNING count',
  ).bind(key, window, by).first();
  return row.count;
}

export async function peek(env, key, window) {
  const row = await env.DB.prepare('SELECT count FROM rate_limits WHERE key = ?1 AND window = ?2').bind(key, window).first();
  return row ? row.count : 0;
}

export async function purgeOld(env) {
  await env.DB.prepare('DELETE FROM rate_limits WHERE window < ?1').bind(day()).run();
}

// Per-IP burst + daily limits for every API call.
export async function enforceIpLimits(env, ipHash) {
  const { ipPerMinute, ipPerDay } = config.limits;
  if ((await incr(env, `ip:${ipHash}`, minute())) > ipPerMinute) throw new HttpError(429, 'rate_limited', 'Too many requests. Please slow down a little.');
  if ((await incr(env, `ipd:${ipHash}`, day())) > ipPerDay) throw new HttpError(429, 'daily_limit', 'Daily limit reached for this visitor.');
}

export async function enforceSessionTurns(env, sid, iat) {
  const d = day(new Date(iat * 1000));
  if ((await incr(env, `sess:${sid}`, d)) > config.limits.turnsPerSession) throw new HttpError(429, 'session_limit', 'This session has reached its question limit. Please start a new one.');
}

export async function enforceSessionStarts(env, ipHash) {
  if ((await incr(env, `ipsess:${ipHash}`, day())) > config.limits.sessionsPerIpPerDay) throw new HttpError(429, 'daily_limit', 'Too many sessions started today.');
}

// Global daily budget tied to the Workers AI free quota.
export async function assertBudget(env) {
  if ((await peek(env, 'global:neurons', day())) >= config.limits.globalDailyNeurons) {
    throw new HttpError(503, 'resting', 'Ask Anuj has reached its free daily capacity and is resting until tomorrow.');
  }
}

export async function spend(env, neurons) {
  await incr(env, 'global:neurons', day(), Math.max(1, Math.ceil(neurons)));
}

export function llmNeurons(model, inTokens, outTokens) {
  const r = config.neurons[model] || config.neurons.fallback;
  return inTokens * r.inPerToken + outTokens * r.outPerToken;
}
export const sttNeurons = (seconds) => seconds * config.neurons.sttPerSecond;
export const ttsNeurons = (chars) => chars * config.neurons.ttsPerChar;
export const approxTokens = (text) => Math.ceil(text.length / 3.6);
