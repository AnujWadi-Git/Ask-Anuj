import { config } from './config.js';
import { HttpError } from './http.js';

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function hmacKey(secret) {
  if (!secret || secret.length < 16) throw new HttpError(500, 'misconfigured', 'Server secret not configured');
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signToken(payload, secret) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 2000) throw new HttpError(401, 'bad_token', 'Invalid session');
  const [body, sig] = token.split('.');
  if (!body || !sig) throw new HttpError(401, 'bad_token', 'Invalid session');
  let ok = false;
  try { ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(sig), enc.encode(body)); } catch { /* fallthrough */ }
  if (!ok) throw new HttpError(401, 'bad_token', 'Invalid session');
  const payload = JSON.parse(new TextDecoder().decode(unb64url(body)));
  if (!payload.exp || payload.exp * 1000 < now) throw new HttpError(401, 'expired', 'Session expired');
  return payload;
}

export async function hashIp(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(`${env.SESSION_SECRET || ''}|${ip}`));
  return b64url(digest).slice(0, 22);
}

export function timingSafeEqual(a, b) {
  const x = enc.encode(String(a)), y = enc.encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}

// Visitor-supplied name ends up in a prompt and in the owner's admin page: keep it plain.
export function sanitizeName(raw) {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{M}\p{N} .,'’\-]/gu, '')
    .trim().slice(0, config.maxNameLength);
  return cleaned || null;
}

export function sanitizeRole(raw) {
  return config.roles.includes(raw) ? raw : null;
}

export function validateHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const { maxHistoryMessages, maxHistoryChars } = config.limits;
  return raw.slice(-maxHistoryMessages)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, maxHistoryChars) }));
}
