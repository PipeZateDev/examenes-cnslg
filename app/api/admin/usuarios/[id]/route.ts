import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';

// GET /api/admin/usuarios/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const usuario = await db.collection('ex_usuarios').findOne(
    { _id: new ObjectId(id) },
    { projection: { passwordHash: 0 } }
  );

  if (!usuario) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json({ usuario });
}

// PATCH /api/admin/usuarios/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { username, password, nombre, apellido, email, rol, activo, cursosAsignados, materiasAsignadas, examenesAsignados } = body;

  const db = await getDb();
  const updateFields: Record<string, unknown> = {
    actualizadoEn: new Date(),
  };

  if (username) updateFields.username = String(username).trim().toLowerCase();
  if (nombre) updateFields.nombre = String(nombre).trim();
  if (apellido !== undefined) updateFields.apellido = String(apellido).trim();
  if (email !== undefined) updateFields.email = String(email).trim().toLowerCase();
  if (rol) updateFields.rol = rol;
  if (activo !== undefined) updateFields.activo = Boolean(activo);
  if (cursosAsignados !== undefined) updateFields.cursosAsignados = Array.isArray(cursosAsignados) ? cursosAsignados : [];
  if (materiasAsignadas !== undefined) updateFields.materiasAsignadas = Array.isArray(materiasAsignadas) ? materiasAsignadas : [];
  if (examenesAsignados !== undefined) updateFields.examenesAsignados = Array.isArray(examenesAsignados) ? examenesAsignados : [];

  if (password && password.trim().length > 0) {
    updateFields.passwordHash = await bcrypt.hash(password, 10);
  }

  await db.collection('ex_usuarios').updateOne(
    { _id: new ObjectId(id) },
    { $set: updateFields }
  );

  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/usuarios/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  // Prevent deleting self
  if (session.userId === id) {
    return NextResponse.json({ error: 'No puedes eliminar tu propio usuario administrador' }, { status: 400 });
  }

  await db.collection('ex_usuarios').deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
