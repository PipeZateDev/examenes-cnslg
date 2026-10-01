import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET /api/cursos - List courses
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol === 'estudiante') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let db = null;
  try {
    db = await getDbReportes();
  } catch (_) {}
  if (!db) {
    db = await getDb();
  }

  let cursos = await db.collection('courses').find({}).sort({ nombre: 1 }).toArray();

  if (!cursos || cursos.length === 0) {
    // Also try other DB
    try {
      const dbAlt = await getDb();
      cursos = await dbAlt.collection('courses').find({}).sort({ nombre: 1 }).toArray();
    } catch (_) {}
  }

  return NextResponse.json({ cursos: cursos || [] });
}

// POST /api/cursos - Create new course
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { nombre, anioLectivo, grado } = body;

  if (!nombre) {
    return NextResponse.json({ error: 'El nombre del curso es obligatorio' }, { status: 400 });
  }

  const cleanNombre = String(nombre).trim();
  const courseDoc = {
    nombre: cleanNombre,
    anioLectivo: anioLectivo ? Number(anioLectivo) : new Date().getFullYear(),
    grado: grado ? String(grado).trim() : '',
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('courses').insertOne(courseDoc);
  } catch (_) {}

  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('courses').insertOne(courseDoc);
  } catch (_) {}

  return NextResponse.json({ ok: true, course: courseDoc }, { status: 201 });
}

// PATCH /api/cursos - Update course
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { id, nombre, anioLectivo, grado, activo } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID de curso requerido' }, { status: 400 });
  }

  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (nombre) updateDoc.nombre = String(nombre).trim();
  if (anioLectivo) updateDoc.anioLectivo = Number(anioLectivo);
  if (grado !== undefined) updateDoc.grado = String(grado).trim();
  if (activo !== undefined) updateDoc.activo = Boolean(activo);

  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { nombre: id };

  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('courses').updateOne(filter, { $set: updateDoc });
  } catch (_) {}

  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('courses').updateOne(filter, { $set: updateDoc });
  } catch (_) {}

  return NextResponse.json({ ok: true });
}
