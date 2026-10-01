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
  const esAdmisionParam = searchParams.get('admision'); // '1' for Aspirantes, '0' for Regulares
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 50)));
  const skip = (page - 1) * limit;

  const dbExamenes = await getDb();
  let dbReportes = null;
  try {
    dbReportes = await getDbReportes();
  } catch (_) {}

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

  let dbToQuery = dbExamenes;

  if (esAdmisionParam === '1') {
    // Aspirantes -> Exclusively stored in examenes DB
    filter.esAdmision = true;
    dbToQuery = dbExamenes;
  } else if (esAdmisionParam === '0') {
    // Regulares -> Matriculados en el colegio
    filter.esAdmision = { $ne: true };
    dbToQuery = dbReportes || dbExamenes;
  } else {
    // All
    dbToQuery = dbReportes || dbExamenes;
  }

  const [estudiantes, total, totalAspirantes, totalRegulares] = await Promise.all([
    dbToQuery.collection('students')
      .find(filter)
      .sort({ nombreCompleto: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    dbToQuery.collection('students').countDocuments(filter),
    dbExamenes.collection('students').countDocuments({ esAdmision: true }),
    (dbReportes || dbExamenes).collection('students').countDocuments({ esAdmision: { $ne: true } }),
  ]);

  return NextResponse.json({
    estudiantes,
    total,
    totalAspirantes,
    totalRegulares,
    page,
    totalPages: Math.ceil(total / limit),
  });
}

// POST /api/estudiantes - Create new student or aspirante directly in MongoDB
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
  const isAspirante = Boolean(esAdmision);

  const studentDoc = {
    numeroDocumento: cleanDoc,
    tipoDocumento: tipoDocumento ? String(tipoDocumento).trim().toUpperCase() : 'TI',
    nombreCompleto: cleanNombre,
    nombres: nombres ? String(nombres).trim().toUpperCase() : cleanNombre.split(' ')[0] || '',
    apellidos: apellidos ? String(apellidos).trim().toUpperCase() : cleanNombre.split(' ').slice(1).join(' ') || '',
    curso: curso ? String(curso).trim() : '',
    grado: grado ? String(grado).trim() : (curso ? String(curso).trim() : ''),
    esAdmision: isAspirante,
    activo: activo !== false,
    creadoPor: session.nombre || session.username,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const dbExamenes = await getDb();

  if (isAspirante) {
    // ASPIRANTE: Save exclusively in examenes-cnslg database to keep them segregated from official enrollment
    await dbExamenes.collection('students').updateOne(
      { numeroDocumento: cleanDoc },
      { $set: studentDoc },
      { upsert: true }
    );
  } else {
    // REGULAR ENROLLED STUDENT: Upsert in reportes and examenes DBs
    try {
      const dbReportes = await getDbReportes();
      await dbReportes.collection('students').updateOne(
        { numeroDocumento: cleanDoc },
        { $set: studentDoc },
        { upsert: true }
      );
    } catch (err) {
      console.warn('Could not write regular student to reportes DB:', err);
    }

    try {
      await dbExamenes.collection('students').updateOne(
        { numeroDocumento: cleanDoc },
        { $set: studentDoc },
        { upsert: true }
      );
    } catch (err) {
      console.warn('Could not write regular student to examenes DB:', err);
    }
  }

  return NextResponse.json({ ok: true, student: studentDoc }, { status: 201 });
}
