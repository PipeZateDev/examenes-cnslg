import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { createSession, COOKIE_NAME } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import type { ExUsuario } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Usuario y contraseña requeridos' }, { status: 400 });
    }

    const db = await getDb();
    const user = await db.collection<ExUsuario>('ex_usuarios').findOne({
      username: username.toLowerCase().trim(),
      activo: true,
    });

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    const token = await createSession({
      userId: user._id!.toString(),
      username: user.username,
      rol: user.rol,
      nombre: user.nombre,
    });

    const res = NextResponse.json({ ok: true, rol: user.rol });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('Login error:', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
