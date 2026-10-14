import { config } from './config.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message || code);
    this.status = status; this.code = code; this.extra = extra;
  }
}

export function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;
  const extra = (env.EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const self = new URL(request.url).origin;
  return [...config.allowedOrigins, ...extra, self].includes(origin) ? origin : false;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
  });
}

export async function readJson(request, maxBytes = 1_200_000) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > maxBytes) throw new HttpError(413, 'too_large', 'Request too large');
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, 'too_large', 'Request too large');
  try { return JSON.parse(text || '{}'); } catch { throw new HttpError(400, 'bad_json', 'Invalid JSON'); }
}
