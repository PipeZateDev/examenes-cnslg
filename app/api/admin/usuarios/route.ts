import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET /api/admin/usuarios
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const usuarios = await db.collection('ex_usuarios')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ nombre: 1 })
    .toArray();

  return NextResponse.json({ usuarios });
}

// POST /api/admin/usuarios - Create user
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, nombre, apellido, email, rol, cursosAsignados, materiasAsignadas, examenesAsignados } = body;

  if (!username || !password || !nombre || !rol) {
    return NextResponse.json({ error: 'Usuario, contraseña, nombre y rol son obligatorios' }, { status: 400 });
  }

  const cleanUsername = String(username).trim().toLowerCase();
  const db = await getDb();

  const existing = await db.collection('ex_usuarios').findOne({ username: cleanUsername });
  if (existing) {
    return NextResponse.json({ error: 'El nombre de usuario ya se encuentra registrado' }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await db.collection('ex_usuarios').insertOne({
    username: cleanUsername,
    passwordHash,
    nombre: String(nombre).trim(),
    apellido: apellido ? String(apellido).trim() : '',
    email: email ? String(email).trim().toLowerCase() : '',
    rol,
    cursosAsignados: Array.isArray(cursosAsignados) ? cursosAsignados : [],
    materiasAsignadas: Array.isArray(materiasAsignadas) ? materiasAsignadas : [],
    examenesAsignados: Array.isArray(examenesAsignados) ? examenesAsignados : [],
    activo: true,
    creadoEn: new Date(),
    actualizadoEn: new Date(),
  });

  return NextResponse.json({ ok: true, id: result.insertedId.toString() }, { status: 201 });
}
