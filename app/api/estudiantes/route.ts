import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';

// GET /api/estudiantes - List students with search, filters and pagination
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'supervisor')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim() || '';
  const curso = searchParams.get('curso')?.trim() || '';
  const esAdmision = searchParams.get('admision');
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (q) {
    filter.$or = [
      { nombreCompleto: { $regex: q, $options: 'i' } },
      { numeroDocumento: { $regex: q, $options: 'i' } },
      { nombres: { $regex: q, $options: 'i' } },
      { apellidos: { $regex: q, $options: 'i' } },
    ];
  }

  if (curso) {
    filter.curso = curso;
  }

  if (esAdmision === '1') {
    filter.esAdmision = true;
  } else if (esAdmision === '0') {
    filter.esAdmision = { $ne: true };
  }

  let db = null;
  try {
    db = await getDbReportes();
  } catch (_) {}
  if (!db) {
    db = await getDb();
  }

  const [estudiantes, total] = await Promise.all([
    db.collection('students')
      .find(filter)
      .sort({ nombreCompleto: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection('students').countDocuments(filter),
  ]);

  return NextResponse.json({
    estudiantes,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/estudiantes - Create new student directly in MongoDB
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado para crear estudiantes' }, { status: 401 });
  }

  const body = await req.json();
  const { numeroDocumento, tipoDocumento, nombreCompleto, nombres, apellidos, curso, grado, esAdmision, activo } = body;

  if (!numeroDocumento || !nombreCompleto) {
    return NextResponse.json({ error: 'Número de documento y nombre completo son obligatorios' }, { status: 400 });
  }

  const cleanDoc = String(numeroDocumento).trim();
  const cleanNombre = String(nombreCompleto).trim().toUpperCase();

  const studentDoc = {
    numeroDocumento: cleanDoc,
    tipoDocumento: tipoDocumento ? String(tipoDocumento).trim().toUpperCase() : 'TI',
    nombreCompleto: cleanNombre,
    nombres: nombres ? String(nombres).trim().toUpperCase() : cleanNombre.split(' ')[0] || '',
    apellidos: apellidos ? String(apellidos).trim().toUpperCase() : cleanNombre.split(' ').slice(1).join(' ') || '',
    curso: curso ? String(curso).trim() : '',
    grado: grado ? String(grado).trim() : '',
    esAdmision: Boolean(esAdmision),
    activo: activo !== false,
    creadoPor: session.nombre || session.username,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Upsert in reportes-cnslg database
  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('students').updateOne(
      { numeroDocumento: cleanDoc },
      { $set: studentDoc },
      { upsert: true }
    );
  } catch (err) {
    console.warn('Could not write to reportes DB:', err);
  }

  // Also write to examenes-cnslg database to keep them synced
  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('students').updateOne(
      { numeroDocumento: cleanDoc },
      { $set: studentDoc },
      { upsert: true }
    );
  } catch (err) {
    console.warn('Could not write to examenes DB:', err);
  }

  return NextResponse.json({ ok: true, student: studentDoc }, { status: 201 });
}

