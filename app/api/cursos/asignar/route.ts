import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';

// POST /api/cursos/asignar - Assign or move students to a specific course
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { curso, studentDocumentos } = body;

  if (curso === undefined || !Array.isArray(studentDocumentos) || studentDocumentos.length === 0) {
    return NextResponse.json({ error: 'Curso y lista de documentos requeridos' }, { status: 400 });
  }

  const cleanCurso = String(curso).trim();
  const cleanDocs = studentDocumentos.map(d => String(d).trim()).filter(Boolean);

  const updateFields: Record<string, unknown> = {
    curso: cleanCurso,
    updatedAt: new Date(),
  };
  if (cleanCurso) {
    updateFields.grado = cleanCurso;
  }

  const filter = { numeroDocumento: { $in: cleanDocs } };

  // Update in reportes-cnslg database
  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('students').updateMany(filter, { $set: updateFields });
  } catch (err) {
    console.warn('Could not update students course in reportes DB:', err);
  }

  // Update in examenes-cnslg database
  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('students').updateMany(filter, { $set: updateFields });
  } catch (err) {
    console.warn('Could not update students course in examenes DB:', err);
  }

  return NextResponse.json({
    ok: true,
    curso: cleanCurso,
    updatedCount: cleanDocs.length,
  });
}
