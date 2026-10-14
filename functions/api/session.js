import { json, readJson, HttpError } from '../_lib/http.js';
import { config } from '../_lib/config.js';
import { signToken, hashIp, sanitizeName, sanitizeRole } from '../_lib/security.js';
import { enforceIpLimits, enforceSessionStarts, purgeOld } from '../_lib/limits.js';
import { GREETING } from '../_lib/prompt.js';
import { requireMethod } from '../_lib/guard.js';

export async function onRequestPost({ request, env }) {
  requireMethod(request, 'POST');
  const ipHash = await hashIp(request, env);
  await enforceIpLimits(env, ipHash);
  await enforceSessionStarts(env, ipHash);

  const body = await readJson(request, 2000);
  const name = sanitizeName(body.name);
  const role = sanitizeRole(body.role);
  const skipped = !name && !role;

  const id = crypto.randomUUID();
  const startedAt = new Date().toISOString();
  try {
    await env.DB.prepare('INSERT INTO sessions (id, started_at, name, role, skipped) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(id, startedAt, name, role, skipped ? 1 : 0).run();
    await purgeOld(env);
  } catch (e) {
    console.error('session insert failed', e);
    throw new HttpError(503, 'storage_unavailable', 'Could not start a session right now.');
  }

  const iat = Math.floor(Date.now() / 1000);
  const token = await signToken({ sid: id, iat, exp: iat + config.sessionTtlSeconds, name, role }, env.SESSION_SECRET);
  return json({ token, expiresInSeconds: config.sessionTtlSeconds, name, role, greeting: GREETING(name) });
}
