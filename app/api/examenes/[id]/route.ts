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

  if (action === 'activate' && hasRole(session.rol, 'directivo')) {
    // Generate daily key for this exam
    const clave = generateExamAccessKey();
    const today = hoy();
    
    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { estado: 'activo' } }
    );

    // Upsert daily key
    await db.collection('ex_clave_dia').updateOne(
      { fecha: today },
      { $push: { examenesClaves: { examenId: id, clave } } as never },
      { upsert: true }
    );

    return NextResponse.json({ ok: true, clave });
  }

  if (action === 'close' && hasRole(session.rol, 'directivo')) {
    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { estado: 'cerrado' } }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'update' && hasRole(session.rol, 'docente')) {
    const { preguntas, titulo, descripcion, materia, duracionMinutos } = data;
    await db.collection('ex_examenes').updateOne(
      { _id: new ObjectId(id) },
      { $set: { preguntas, titulo, descripcion, materia, duracionMinutos } }
    );
    return NextResponse.json({ ok: true });
  }

  if (action === 'segundo_intento' && hasRole(session.rol, 'admin')) {
    const { estudianteId } = data;
    await db.collection('ex_intentos').updateMany(
      { examenId: id, estudianteId, estado: { $in: ['enviado', 'bloqueado'] } },
      { $set: { estado: 'bloqueado' } }
    );
    // Allow new attempt by removing blocked status — admin creates fresh chance
    await db.collection('ex_intentos').deleteMany({
      examenId: id, estudianteId, estado: 'bloqueado'
    });
    return NextResponse.json({ ok: true });
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
