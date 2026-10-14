import { json, HttpError } from '../../_lib/http.js';
import { config } from '../../_lib/config.js';
import { hashIp, timingSafeEqual } from '../../_lib/security.js';
import { incr, peek } from '../../_lib/limits.js';

export async function onRequestGet({ request, env }) {
  if (!env.ADMIN_TOKEN || env.ADMIN_TOKEN.length < 16) throw new HttpError(503, 'admin_disabled', 'Admin access is not configured.');

  const ipHash = await hashIp(request, env);
  const hour = new Date().toISOString().slice(0, 13);
  if ((await peek(env, `adminfail:${ipHash}`, hour)) >= config.limits.adminFailuresPerHour) throw new HttpError(429, 'locked', 'Too many failed attempts. Try again later.');

  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!timingSafeEqual(token, env.ADMIN_TOKEN)) {
    await incr(env, `adminfail:${ipHash}`, hour);
    throw new HttpError(401, 'unauthorized', 'Unauthorized');
  }

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const rows = await env.DB.prepare('SELECT id, started_at, name, role, skipped FROM sessions ORDER BY started_at DESC LIMIT ?1').bind(limit).all();
  const totals = await env.DB.prepare(
    "SELECT COUNT(*) AS total, SUM(skipped) AS skipped, SUM(CASE WHEN started_at >= ?1 THEN 1 ELSE 0 END) AS last7 FROM sessions",
  ).bind(new Date(Date.now() - 7 * 864e5).toISOString()).first();

  return json({
    scope: 'Ask Anuj sessions only. These are visitors who opened and started the voice assistant. This is NOT total website traffic.',
    totals: { sessions: totals.total || 0, skippedIntro: totals.skipped || 0, last7Days: totals.last7 || 0 },
    sessions: rows.results.map((r) => ({ id: r.id, startedAt: r.started_at, name: r.name, role: r.role, skipped: !!r.skipped })),
  });
}
