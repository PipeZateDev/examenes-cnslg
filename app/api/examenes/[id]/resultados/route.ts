import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET /api/examenes/[id]/resultados
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  
  // Get all attempts for this exam, preserving history and sorting by student name and attempt number
  const intentos = await db.collection('ex_intentos')
    .find({ examenId: id })
    .sort({ estudianteNombre: 1, intentoNumero: 1, enviadoEn: -1 })
    .toArray();

  // Get all authorizations for this exam
  const habilitaciones = await db.collection('ex_habilitaciones')
    .find({ examenId: id })
    .toArray();

  return NextResponse.json({
    intentos,
    habilitaciones,
    esDirectivo: hasRole(session.rol, 'directivo'),
    esAdmin: session.rol === 'admin',
  });
}

// DELETE /api/examenes/[id]/resultados - Delete answers and reset attempts
// Scope: 'intento' (single attempt) | 'estudiante' (all attempts of a student) | 'curso' (all students of a course) | 'todos' (all attempts of this exam)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'admin')) {
    return NextResponse.json({ error: 'Solo los administradores pueden borrar respuestas y restablecer intentos' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  let scope = searchParams.get('scope') || 'estudiante';
  let estudianteId = searchParams.get('estudianteId')?.trim();
  let intentoId = searchParams.get('intentoId')?.trim();
  let curso = searchParams.get('curso')?.trim();

  // Fallback: Also support JSON body if sent via fetch with body
  try {
    const body = await req.json().catch(() => null);
    if (body) {
      if (body.scope) scope = body.scope;
      if (body.estudianteId) estudianteId = String(body.estudianteId).trim();
      if (body.intentoId) intentoId = String(body.intentoId).trim();
      if (body.curso) curso = String(body.curso).trim();
    }
  } catch (_) {}

  const db = await getDb();

  // 1. Delete a single attempt
  if (scope === 'intento' || (intentoId && ObjectId.isValid(intentoId))) {
    const targetId = intentoId ? new ObjectId(intentoId) : null;
    if (!targetId) {
      return NextResponse.json({ error: 'ID de intento inválido' }, { status: 400 });
    }

    const intento = await db.collection('ex_intentos').findOne({ _id: targetId, examenId: id });
    if (!intento) {
      return NextResponse.json({ error: 'Intento no encontrado' }, { status: 404 });
    }

    await db.collection('ex_intentos').deleteOne({ _id: targetId });

    // If no more attempts remain for this student, also remove habilitacion
    const remaining = await db.collection('ex_intentos').countDocuments({
      examenId: id,
      estudianteId: intento.estudianteId,
    });
    if (remaining === 0) {
      await db.collection('ex_habilitaciones').deleteOne({
        examenId: id,
        estudianteId: intento.estudianteId,
      });
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Intento eliminado exitosamente para el estudiante ${intento.estudianteNombre}. El proceso ha sido restablecido.`,
      deletedCount: 1,
      estudianteId: intento.estudianteId,
    });
  }

  // 2. Delete all attempts for a specific student
  if (scope === 'estudiante') {
    if (!estudianteId) {
      return NextResponse.json({ error: 'Número de documento del estudiante requerido' }, { status: 400 });
    }

    const [delIntentos] = await Promise.all([
      db.collection('ex_intentos').deleteMany({
        examenId: id,
        estudianteId: estudianteId,
      }),
      db.collection('ex_habilitaciones').deleteMany({
        examenId: id,
        estudianteId: estudianteId,
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mensaje: `Se eliminaron ${delIntentos.deletedCount} intento(s) y respuestas del estudiante ${estudianteId}. Ahora puede iniciar la prueba desde cero (Intento 1).`,
      deletedCount: delIntentos.deletedCount,
      estudianteId,
    });
  }

  // 3. Delete all attempts for a specific course
  if (scope === 'curso') {
    if (!curso) {
      return NextResponse.json({ error: 'Nombre del curso requerido' }, { status: 400 });
    }

    // Find all student documents in this course
    const escaped = curso.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const courseRegex = { $regex: `^${escaped}$`, $options: 'i' };

    let dbStudents = db;
    try {
      const dbReportes = await getDbReportes();
      dbStudents = dbReportes;
    } catch (_) {}

    const studentsInCourse = await dbStudents.collection('students')
      .find({
        $or: [{ curso: courseRegex }, { grado: courseRegex }],
      })
      .project({ numeroDocumento: 1 })
      .toArray();

    const studentDocs = studentsInCourse.map(s => String(s.numeroDocumento).trim()).filter(Boolean);

    let delIntentosCount = 0;
    if (studentDocs.length > 0) {
      const [resDel] = await Promise.all([
        db.collection('ex_intentos').deleteMany({
          examenId: id,
          estudianteId: { $in: studentDocs },
        }),
        db.collection('ex_habilitaciones').deleteMany({
          examenId: id,
          estudianteId: { $in: studentDocs },
        }),
      ]);
      delIntentosCount = resDel.deletedCount;
    }

    return NextResponse.json({
      ok: true,
      mensaje: `Se eliminaron ${delIntentosCount} intento(s) y respuestas de todos los estudiantes del curso ${curso}. Los estudiantes pueden volver a presentar la prueba desde cero.`,
      deletedCount: delIntentosCount,
      curso,
      estudiantesAfectados: studentDocs.length,
    });
  }

  // 4. Delete all attempts for the entire exam
  if (scope === 'todos') {
    const [resDel] = await Promise.all([
      db.collection('ex_intentos').deleteMany({ examenId: id }),
      db.collection('ex_habilitaciones').deleteMany({ examenId: id }),
    ]);

    return NextResponse.json({
      ok: true,
      mensaje: `Se eliminaron ${resDel.deletedCount} intento(s) de todos los estudiantes para este examen. Todo el proceso ha sido restablecido a cero.`,
      deletedCount: resDel.deletedCount,
    });
  }

  return NextResponse.json({ error: 'Alcance (scope) de eliminación no válido' }, { status: 400 });
}
