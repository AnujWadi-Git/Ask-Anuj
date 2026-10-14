import { allowedOrigin, json, HttpError } from '../_lib/http.js';

const SECURITY = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' };

export async function onRequest({ request, env, next }) {
  const origin = allowedOrigin(request, env);
  if (origin === false) return json({ error: 'forbidden_origin' }, 403, SECURITY);

  const cors = origin ? {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
  } : {};

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...SECURITY, ...cors } });

  let res;
  try {
    res = await next();
  } catch (err) {
    if (err instanceof HttpError) res = json({ error: err.code, message: err.message, ...err.extra }, err.status);
    else {
      console.error('unhandled', err && err.stack || err);
      res = json({ error: 'server_error', message: 'Something went wrong.' }, 500);
    }
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries({ ...SECURITY, ...cors })) out.headers.set(k, v);
  return out;
}
