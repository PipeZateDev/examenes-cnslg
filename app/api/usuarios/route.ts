import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/usuarios - list staff users
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const usuarios = await db.collection('ex_usuarios')
    .find({})
    .project({ passwordHash: 0 })
    .sort({ nombre: 1 })
    .toArray();

  return NextResponse.json({ usuarios });
}

// POST /api/usuarios - create user
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'admin')) {
    return NextResponse.json({ error: 'Solo el administrador puede crear usuarios' }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, rol, nombre, apellido, email, cursosAsignados, materiasAsignadas } = body;

  if (!username || !password || !rol || !nombre) {
    return NextResponse.json({ error: 'Campos requeridos: username, password, rol, nombre' }, { status: 400 });
  }

  const db = await getDb();

  // Check duplicate username
  const existing = await db.collection('ex_usuarios').findOne({ username: username.toLowerCase().trim() });
  if (existing) {
    return NextResponse.json({ error: 'El nombre de usuario ya existe' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.collection('ex_usuarios').insertOne({
    username: username.toLowerCase().trim(),
    passwordHash,
    rol,
    nombre,
    apellido: apellido || '',
    email: email || '',
    cursosAsignados: cursosAsignados || [],
    materiasAsignadas: materiasAsignadas || [],
    activo: true,
    creadoEn: new Date(),
  });

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
}
