import crypto from 'crypto';

const SESSION_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

export function generateSessionToken(): { token: string; expires: number } {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + SESSION_TTL;
  return { token, expires };
}

export function verifySessionToken(sessionCookie: string | undefined): boolean {
  if (!sessionCookie) return false;

  const [token, expiresStr] = sessionCookie.split(':');
  if (!token || !expiresStr) return false;

  const expires = parseInt(expiresStr, 10);
  return Date.now() / 1000 < expires;
}
