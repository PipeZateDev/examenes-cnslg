import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import type { SessionPayload, Rol } from './types';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-in-production'
);
const COOKIE_NAME = 'ex_session';

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export { COOKIE_NAME };

// ─── Role hierarchy helpers ───────────────────────────────────────────────────
const ROLE_LEVEL: Record<Rol, number> = {
  estudiante: 0,
  docente: 1,
  supervisor: 2,
  coordinador: 3,
  directivo: 4,
  admin: 5,
};

export function hasRole(userRol: Rol, minRol: Rol): boolean {
  return ROLE_LEVEL[userRol] >= ROLE_LEVEL[minRol];
}

export function isAdmin(rol: Rol): boolean {
  return rol === 'admin';
}
