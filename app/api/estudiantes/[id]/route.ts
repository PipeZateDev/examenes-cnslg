import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET /api/estudiantes/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let student = null;
  const isObjectId = ObjectId.isValid(id);

  try {
    const dbReportes = await getDbReportes();
    student = isObjectId
      ? await dbReportes.collection('students').findOne({ _id: new ObjectId(id) })
      : await dbReportes.collection('students').findOne({ numeroDocumento: id });
  } catch (_) {}

  if (!student) {
    const dbExamenes = await getDb();
    student = isObjectId
      ? await dbExamenes.collection('students').findOne({ _id: new ObjectId(id) })
      : await dbExamenes.collection('students').findOne({ numeroDocumento: id });
  }

  if (!student) {
    return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
  }

  return NextResponse.json({ student });
}

// PATCH /api/estudiantes/[id] - Update student directly in MongoDB
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado para editar estudiantes' }, { status: 401 });
  }

  const body = await req.json();
  const { numeroDocumento, tipoDocumento, nombreCompleto, nombres, apellidos, curso, grado, esAdmision, activo } = body;

  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (numeroDocumento !== undefined) updateDoc.numeroDocumento = String(numeroDocumento).trim();
  if (tipoDocumento !== undefined) updateDoc.tipoDocumento = String(tipoDocumento).trim().toUpperCase();
  if (nombreCompleto !== undefined) updateDoc.nombreCompleto = String(nombreCompleto).trim().toUpperCase();
  if (nombres !== undefined) updateDoc.nombres = String(nombres).trim().toUpperCase();
  if (apellidos !== undefined) updateDoc.apellidos = String(apellidos).trim().toUpperCase();
  if (curso !== undefined) updateDoc.curso = String(curso).trim();
  if (grado !== undefined) updateDoc.grado = String(grado).trim();
  if (esAdmision !== undefined) updateDoc.esAdmision = Boolean(esAdmision);
  if (activo !== undefined) updateDoc.activo = Boolean(activo);

  const isObjectId = ObjectId.isValid(id);
  const filter = isObjectId ? { _id: new ObjectId(id) } : { numeroDocumento: id };

  // Update in reportes DB
  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('students').updateOne(filter, { $set: updateDoc });
  } catch (err) {
    console.warn('Could not update student in reportes DB:', err);
  }

  // Update in examenes DB
  try {
    const dbExamenes = await getDb();
    const docToMatch = updateDoc.numeroDocumento || id;
    await dbExamenes.collection('students').updateOne(
      { $or: [filter, { numeroDocumento: docToMatch as string }] },
      { $set: updateDoc },
      { upsert: true }
    );
  } catch (err) {
    console.warn('Could not update student in examenes DB:', err);
  }

  return NextResponse.json({ ok: true, updateDoc });
}

// DELETE /api/estudiantes/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'directivo')) {
    return NextResponse.json({ error: 'No autorizado para eliminar estudiantes' }, { status: 403 });
  }

  const isObjectId = ObjectId.isValid(id);
  const filter = isObjectId ? { _id: new ObjectId(id) } : { numeroDocumento: id };

  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('students').deleteOne(filter);
  } catch (_) {}

  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('students').deleteOne(filter);
  } catch (_) {}

  return NextResponse.json({ ok: true });
}
