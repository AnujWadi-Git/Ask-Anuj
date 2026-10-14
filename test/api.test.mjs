import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeEnv, call, h, startSession } from './helpers.mjs';
import * as session from '../functions/api/session.js';
import * as chat from '../functions/api/chat.js';
import * as transcribe from '../functions/api/transcribe.js';
import * as speak from '../functions/api/speak.js';
import * as admin from '../functions/api/admin/sessions.js';
import { config } from '../functions/_lib/config.js';

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const fakeWav = 'A'.repeat(2000);

test('session stores only name, role, start time; skip stores no identity', async () => {
  const env = makeEnv();
  const a = await call(h(session), { env, body: { name: 'Dana', role: 'recruiter', extra: 'ignored' } });
  assert.equal(a.status, 200);
  assert.match(a.data.greeting, /Dana/);
  const b = await call(h(session), { env, body: {}, headers: { 'CF-Connecting-IP': '9.9.9.9' } });
  const rows = env.DB._raw.prepare('SELECT * FROM sessions ORDER BY started_at').all();
  assert.equal(rows.length, 2);
  assert.deepEqual(Object.keys(rows[0]).sort(), ['id', 'name', 'role', 'skipped', 'started_at']);
  assert.equal(rows[1].name, null); assert.equal(rows[1].skipped, 1);
  assert.ok(b.data.token);
});

test('chat requires a valid session token', async () => {
  const env = makeEnv();
  assert.equal((await call(h(chat), { env, body: { message: 'hi' } })).status, 401);
  assert.equal((await call(h(chat), { env, body: { message: 'hi' }, headers: auth('garbage') })).status, 401);
});

test('grounded answer returns resolved link cards from the registry only', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  const r = await call(h(chat), { env, body: { message: 'Tell me about Clippy' }, headers: auth(t) });
  assert.equal(r.status, 200);
  assert.match(r.data.answer, /clipboard/i);
  assert.ok(r.data.links.length > 0);
  assert.ok(r.data.links.every((l) => l.url.startsWith('https://')));
  assert.ok(!r.data.answer.includes('LINKS:'));
});

test('unknown question gets an honest not-covered answer', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  const r = await call(h(chat), { env, body: { message: 'zzzz qqqq xxxx' }, headers: auth(t) });
  assert.match(r.data.answer, /doesn't cover/i);
});

test('real provider path: uses Workers AI binding, parses output, filters invented links', async () => {
  const calls = [];
  const env = makeEnv({
    AI_PROVIDER: 'cloudflare',
    AI: { run: async (model, input) => { calls.push({ model, input }); return { response: 'Anuj studied at ASU.\nLINKS: resume, https://evil.com, fake', usage: { prompt_tokens: 3000, completion_tokens: 20 } }; } },
  });
  const t = await startSession(env);
  const r = await call(h(chat), { env, body: { message: 'Where did he study?', history: [{ role: 'user', content: 'hi' }] }, headers: auth(t) });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data.links.map((l) => l.id), ['resume']);
  assert.equal(calls[0].model, config.models.llm);
  assert.equal(calls[0].input.messages[0].role, 'system');
  assert.ok(calls[0].input.max_tokens <= config.limits.maxOutputTokens);
  const spent = env.DB._raw.prepare("SELECT count FROM rate_limits WHERE key='global:neurons'").get();
  assert.ok(spent.count > 0);
});

test('provider failure becomes a friendly 502, not a crash', async () => {
  const env = makeEnv({ AI_PROVIDER: 'cloudflare', AI: { run: async () => { throw new Error('boom'); } } });
  const t = await startSession(env);
  const r = await call(h(chat), { env, body: { message: 'hi there' }, headers: auth(t) });
  assert.equal(r.status, 502); assert.equal(r.data.error, 'llm_unavailable');
});

test('input limits: empty and overlong messages rejected', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  assert.equal((await call(h(chat), { env, body: { message: '   ' }, headers: auth(t) })).status, 400);
  assert.equal((await call(h(chat), { env, body: { message: 'x'.repeat(501) }, headers: auth(t) })).status, 413);
});

test('per-session turn limit', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  const original = config.limits.turnsPerSession;
  config.limits.turnsPerSession = 2;
  try {
    for (let i = 0; i < 2; i++) assert.equal((await call(h(chat), { env, body: { message: 'resume' }, headers: auth(t) })).status, 200);
    const r = await call(h(chat), { env, body: { message: 'resume' }, headers: auth(t) });
    assert.equal(r.status, 429); assert.equal(r.data.error, 'session_limit');
  } finally { config.limits.turnsPerSession = original; }
});

test('per-IP burst limit', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  const original = config.limits.ipPerMinute;
  config.limits.ipPerMinute = 3;
  try {
    const statuses = [];
    for (let i = 0; i < 5; i++) statuses.push((await call(h(chat), { env, body: { message: 'resume' }, headers: auth(t) })).status);
    assert.ok(statuses.includes(429), statuses.join());
  } finally { config.limits.ipPerMinute = original; }
});

test('global daily Neuron budget stops service gracefully', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  const day = new Date().toISOString().slice(0, 10);
  env.DB._raw.prepare("INSERT INTO rate_limits VALUES ('global:neurons', ?, ?)").run(day, config.limits.globalDailyNeurons);
  const r = await call(h(chat), { env, body: { message: 'resume' }, headers: auth(t) });
  assert.equal(r.status, 503); assert.equal(r.data.error, 'resting');
  assert.equal((await call(h(speak), { env, body: { text: 'hello' }, headers: auth(t) })).status, 503);
});

test('transcribe validates and bounds audio; speak returns audio', async () => {
  const env = makeEnv();
  const t = await startSession(env);
  assert.equal((await call(h(transcribe), { env, body: { audio: 'not base64!!' }, headers: auth(t) })).status, 400);
  assert.equal((await call(h(transcribe), { env, body: { audio: 'A'.repeat(config.limits.maxAudioBase64Chars + 4) }, headers: auth(t) })).status, 413);
  const ok = await call(h(transcribe), { env, body: { audio: fakeWav }, headers: auth(t) });
  assert.equal(ok.status, 200); assert.ok(ok.data.text);
  const sp = await call(h(speak), { env, body: { text: 'Hello there' }, headers: auth(t) });
  assert.equal(sp.status, 200); assert.ok(sp.data.audio && sp.data.mime);
  assert.equal((await call(h(speak), { env, body: { text: 'x'.repeat(701) }, headers: auth(t) })).status, 413);
});

test('CORS: allowed origin echoed, foreign origin blocked, no wildcard', async () => {
  const env = makeEnv();
  const ok = await call(h(session), { env, body: {}, origin: 'https://anujwadi.com' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'https://anujwadi.com');
  const bad = await call(h(session), { env, body: {}, origin: 'https://evil.example' });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('access-control-allow-origin'), null);
});

test('admin: token required, lockout after failures, data excludes nothing public', async () => {
  const env = makeEnv();
  await startSession(env, { name: 'Dana', role: 'engineer' });
  await startSession(env, {});
  assert.equal((await call(h(admin, 'onRequestGet'), { env, method: 'GET', path: '/api/admin/sessions' })).status, 401);
  const ok = await call(h(admin, 'onRequestGet'), { env, method: 'GET', path: '/api/admin/sessions', headers: auth(env.ADMIN_TOKEN) });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.totals.sessions, 2); assert.equal(ok.data.totals.skippedIntro, 1);
  assert.match(ok.data.scope, /NOT total website traffic/);
  assert.ok(ok.data.sessions.some((s) => s.name === 'Dana' && s.role === 'engineer'));
  for (let i = 0; i < 10; i++) await call(h(admin, 'onRequestGet'), { env, method: 'GET', path: '/api/admin/sessions', headers: auth('wrong') });
  const locked = await call(h(admin, 'onRequestGet'), { env, method: 'GET', path: '/api/admin/sessions', headers: auth(env.ADMIN_TOKEN) });
  assert.equal(locked.status, 429);
});

test('admin disabled when ADMIN_TOKEN unset', async () => {
  const env = makeEnv({ ADMIN_TOKEN: undefined });
  assert.equal((await call(h(admin, 'onRequestGet'), { env, method: 'GET', path: '/api/admin/sessions', headers: auth('x') })).status, 503);
});
