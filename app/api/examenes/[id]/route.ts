import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { generateExamAccessKey, hoy } from '@/lib/utils';
import { ObjectId } from 'mongodb';

// GET /api/examenes/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol === 'estudiante') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
  if (!examen) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });

  return NextResponse.json({ examen });
}

// PATCH /api/examenes/[id] - update exam / change estado
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { action, ...data } = body;
  const db = await getDb();

  if (action === 'submit_approval') {
    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { estado: 'pendiente_aprobacion' } }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'approve' && hasRole(session.rol, 'directivo')) {
    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { estado: 'aprobado', aprobadoPor: session.userId, aprobadoEn: new Date() } }
    );
    return NextResponse.json({ ok: true });
  }

  // Admin reopens a closed exam -> transitions back to 'aprobado' (ready for teacher/supervisor to activate)
  if ((action === 'reopen' || action === 'reabrir') && session.rol === 'admin') {
    const currentEx = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
    if (!currentEx) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    if (currentEx.estado !== 'cerrado') {
      return NextResponse.json({ error: 'Solo los exámenes en estado cerrado pueden ser reabiertos.' }, { status: 400 });
    }

    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          estado: 'aprobado',
          claveAcceso: null,
        },
        $unset: {
          cerradoPor: '',
          cerradoPorId: '',
          cerradoPorRol: '',
          cerradoEn: '',
        },
      }
    );

    return NextResponse.json({
      ok: true,
      estado: 'aprobado',
      mensaje: 'Prueba reabierta exitosamente. Ahora el docente o supervisor a cargo puede activarla para generar el nuevo código.',
    });
  }

  if (action === 'activate' && hasRole(session.rol, 'docente')) {
    const today = hoy();
    const currentEx = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
    if (!currentEx) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });

    // REGLA: Si el examen está cerrado, el Admin debe primero reabrirlo
    if (currentEx.estado === 'cerrado') {
      return NextResponse.json({
        error: 'Este examen fue cerrado por el docente. El Administrador del sistema debe reabrir la prueba antes de poder activarla.',
      }, { status: 403 });
    }

    // Si está en borrador o pendiente de aprobación, requiere aprobación previa a menos que sea admin/directivo
    if (['borrador', 'pendiente_aprobacion'].includes(currentEx.estado) && !hasRole(session.rol, 'directivo')) {
      return NextResponse.json({
        error: 'El examen debe ser aprobado antes de poder ser activado.',
      }, { status: 400 });
    }

    // Generate unique 6-character access key for today
    let clave = '';
    let isUnique = false;
    for (let attempts = 0; attempts < 15; attempts++) {
      clave = generateExamAccessKey();
      const duplicateInDia = await db.collection('ex_clave_dia').findOne({
        fecha: today,
        'examenesClaves.clave': clave,
        'examenesClaves.examenId': { $ne: id },
      });
      const duplicateInExam = await db.collection('ex_examenes').findOne({
        _id: { $ne: new ObjectId(id) },
        estado: 'activo',
        claveAcceso: clave,
      });
      if (!duplicateInDia && !duplicateInExam) {
        isUnique = true;
        break;
      }
    }
    if (!isUnique) {
      clave = generateExamAccessKey();
    }
    
    // Mantener siempre el último usuario que activa la prueba (docente, supervisor, etc.)
    const activadorNombre = session.nombre || session.username;
    const activadorId = session.userId;
    const activadorRol = session.rol;
    const now = new Date();

    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          estado: 'activo',
          claveAcceso: clave,
          fechaActivacion: today,
          activadoPor: activadorNombre,
          activadoPorId: activadorId,
          activadoPorRol: activadorRol,
          activadoEn: now,
        },
        $unset: {
          cerradoPor: '',
          cerradoPorId: '',
          cerradoPorRol: '',
          cerradoEn: '',
        },
      }
    );

    // Upsert daily key document cleanly (pull old entry for this exam if any, then push new)
    await db.collection('ex_clave_dia').updateOne(
      { fecha: today },
      { $pull: { examenesClaves: { examenId: id } } as never },
      { upsert: true }
    );
    await db.collection('ex_clave_dia').updateOne(
      { fecha: today },
      {
        $push: {
          examenesClaves: {
            examenId: id,
            clave,
            titulo: currentEx.titulo || '',
            activadoPor: activadorNombre,
            activadoPorId: activadorId,
            activadoEn: now,
          },
        } as never,
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, clave, activadoPor: activadorNombre, estado: 'activo' });
  }

  if (action === 'close' && hasRole(session.rol, 'docente')) {
    const today = hoy();
    const cerradorNombre = session.nombre || session.username;
    const cerradorId = session.userId;
    const cerradorRol = session.rol;
    const now = new Date();

    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          estado: 'cerrado',
          cerradoPor: cerradorNombre,
          cerradoPorId: cerradorId,
          cerradoPorRol: cerradorRol,
          cerradoEn: now,
        },
      }
    );
    await db.collection('ex_clave_dia').updateOne(
      { fecha: today },
      { $pull: { examenesClaves: { examenId: id } } as never }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'update') {
    const examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
    if (!examen) return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });

    const canEdit = session.rol === 'admin' ||
                    hasRole(session.rol, 'directivo') ||
                    examen.creadoPor === session.userId ||
                    hasRole(session.rol, 'docente');

    if (!canEdit) {
      return NextResponse.json({ error: 'No tienes permisos para modificar este examen' }, { status: 403 });
    }

    const { preguntas, titulo, descripcion, materia, materiaId, duracionMinutos, cursos } = data;
    const updateFields: Record<string, unknown> = {};

    if (titulo !== undefined) updateFields.titulo = String(titulo).trim();
    if (descripcion !== undefined) updateFields.descripcion = String(descripcion).trim();
    if (materia !== undefined) updateFields.materia = String(materia).trim();
    if (materiaId !== undefined) updateFields.materiaId = materiaId;
    if (duracionMinutos !== undefined) {
      updateFields.duracionMinutos = duracionMinutos ? Number(duracionMinutos) : null;
    }
    if (cursos !== undefined) {
      updateFields.cursos = Array.isArray(cursos) ? cursos : [];
    }
    if (preguntas !== undefined) {
      updateFields.preguntas = preguntas;
    }

    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );
    return NextResponse.json({ ok: true });
  }

  if ((action === 'segundo_intento' || action === 'habilitar_intento') && hasRole(session.rol, 'directivo')) {
    const { estudianteId, intentosPermitidos } = data;
    if (!estudianteId) {
      return NextResponse.json({ error: 'El número de documento del estudiante es requerido' }, { status: 400 });
    }

    const docStr = String(estudianteId).trim();
    const nuevosIntentos = Math.max(2, Number(intentosPermitidos || 2));

    await db.collection('ex_habilitaciones').updateOne(
      { examenId: id, estudianteId: docStr },
      {
        $set: {
          examenId: id,
          estudianteId: docStr,
          intentosPermitidos: nuevosIntentos,
          autorizadoPor: session.nombre || session.username,
          autorizadoPorId: session.userId,
          autorizadoEn: new Date(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({
      ok: true,
      estudianteId: docStr,
      intentosPermitidos: nuevosIntentos,
      mensaje: `Segundo intento habilitado exitosamente para el estudiante ${docStr}. Los intentos anteriores se mantienen guardados.`,
    });
  }

  if (action === 'revocar_intento' && hasRole(session.rol, 'directivo')) {
    const { estudianteId } = data;
    if (!estudianteId) {
      return NextResponse.json({ error: 'El número de documento del estudiante es requerido' }, { status: 400 });
    }
    const docStr = String(estudianteId).trim();
    await db.collection('ex_habilitaciones').deleteOne({
      examenId: id,
      estudianteId: docStr,
    });
    return NextResponse.json({ ok: true, estudianteId: docStr });
  }

  return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}

// DELETE /api/examenes/[id]
// Reglas:
// 1. Solo se puede borrar si NO tiene respuestas de estudiantes.
// 2. Si ya fue aprobado (aprobado, activo, cerrado), NO lo pueden borrar docentes ni coordinadores; solo directivos o admins.
// 3. En estado borrador o pendiente_aprobacion, docentes y superiores pueden borrarlo si no tiene respuestas.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
  if (!examen) {
    return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
  }

  // Regla 1: Validar si el examen tiene intentos/respuestas
  const intentosCount = await db.collection('ex_intentos').countDocuments({ examenId: id });
  if (intentosCount > 0) {
    return NextResponse.json({
      error: 'El examen no se puede borrar porque ya tiene respuestas e intentos de estudiantes registrados.'
    }, { status: 400 });
  }

  // Regla 2: Si el examen ya está aprobado, activo o cerrado, coordinadores y docentes no pueden borrarlo
  const estadosAprobados = ['aprobado', 'activo', 'cerrado'];
  if (estadosAprobados.includes(examen.estado as string)) {
    if (!hasRole(session.rol, 'directivo')) {
      return NextResponse.json({
        error: 'Este examen ya fue aprobado y no puede ser borrado por docentes ni coordinadores. Solo directivos o administradores pueden gestionarlo.'
      }, { status: 403 });
    }
  }

  // Eliminar examen de la base de datos
  await db.collection('ex_examenes').deleteOne({ _id: new ObjectId(id) });
  return NextResponse.json({ ok: true });
}
