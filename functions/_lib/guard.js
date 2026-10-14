import { HttpError } from './http.js';
import { verifyToken, hashIp } from './security.js';
import { enforceIpLimits } from './limits.js';

// Common gate for every visitor-facing call after session creation.
export async function authed(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const payload = await verifyToken(token, env.SESSION_SECRET);
  const ipHash = await hashIp(request, env);
  await enforceIpLimits(env, ipHash);
  return { payload, ipHash };
}

export function requireMethod(request, method) {
  if (request.method !== method) throw new HttpError(405, 'method_not_allowed', 'Method not allowed');
}
