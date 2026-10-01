import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySession } from './lib/auth';

// Routes that don't require auth
const PUBLIC_PATHS = [
  '/login',
  '/examen/login',
  '/api/auth/login',
  '/api/estudiante/login',
  '/api/estudiante/examenes-activos',
  '/api/estudiante/examen',
  '/_next',
  '/favicon',
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files
  if (pathname.match(/\.(ico|png|jpg|svg|css|js|woff2?)$/)) {
    return NextResponse.next();
  }

  // Check JWT session
  const token = request.cookies.get('ex_session')?.value;
  if (!token) {
    // Redirect to appropriate login
    const isExamenPath = pathname.startsWith('/examen');
    const loginUrl = new URL(isExamenPath ? '/examen/login' : '/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const session = await verifySession(token);
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Students can only access /examen routes
  if (session.rol === 'estudiante' && !pathname.startsWith('/examen') && !pathname.startsWith('/api/estudiante')) {
    return NextResponse.redirect(new URL('/examen/login', request.url));
  }

  // Staff cannot access student exam routes
  if (session.rol !== 'estudiante' && pathname.startsWith('/examen/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
