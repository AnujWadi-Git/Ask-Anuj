import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { onRequest as middleware } from '../functions/api/_middleware.js';

export function makeDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  const prepare = (sql) => ({
    bind: (...args) => ({
      first: async () => db.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      run: async () => { db.prepare(sql).run(...args); return {}; },
    }),
  });
  return { prepare, _raw: db };
}

export function makeEnv(overrides = {}) {
  return { DB: makeDb(), SESSION_SECRET: 'test-secret-test-secret-123456', ADMIN_TOKEN: 'admin-token-1234567890', AI_PROVIDER: 'mock', ...overrides };
}

export async function call(handler, { env, method = 'POST', path = '/api/x', body, headers = {}, origin = 'https://anujwadi.com' }) {
  const h = { 'Content-Type': 'application/json', 'CF-Connecting-IP': '1.2.3.4', ...headers };
  if (origin) h.Origin = origin;
  const request = new Request(`https://ask-anuj.pages.dev${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  const res = await middleware({ request, env, next: () => handler.fn({ request, env }) });
  let data = null;
  try { data = await res.clone().json(); } catch { /* no body */ }
  return { status: res.status, data, headers: res.headers };
}

export const h = (mod, name = 'onRequestPost') => ({ fn: mod[name] });

export async function startSession(env, body = { name: 'Dana', role: 'recruiter' }) {
  const mod = await import('../functions/api/session.js');
  const r = await call(h(mod), { env, body });
  return r.data.token;
}
