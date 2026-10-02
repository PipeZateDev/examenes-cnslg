import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/estudiante/examen/[id]/iniciar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session = await getSessionFromRequest(req);
  if (!session) {
    try {
      const { getSession } = await import('@/lib/auth');
      session = await getSession();
    } catch (_) {}
  }

  if (!session) {
    return NextResponse.json({ error: 'No autorizado. Por favor inicia sesión.' }, { status: 401 });
  }

  const db = await getDb();

  // ─── STAFF LIVE PREVIEW MODE (Zero DB trace, all states and exams allowed) ───
  if (session.rol !== 'estudiante') {
    let examen = null;
    try {
      examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
    } catch (_) {
      return NextResponse.json({ error: 'ID de examen no válido' }, { status: 400 });
    }

    if (!examen) {
      return NextResponse.json({ error: 'Examen no encontrado en la base de datos' }, { status: 404 });
    }

    const preguntas = (examen.preguntas || []).map((p: any) => ({
      orden: p.orden,
      enunciado: p.enunciado,
      opciones: p.opciones || [],
      peso: p.peso || 0,
      imagen: p.imagen || null,
      area: p.area || null,
      respuestaCorrecta: p.respuestaCorrecta || null,
    }));

    return NextResponse.json({
      ok: true,
      examen: {
        _id: examen._id.toString(),
        titulo: examen.titulo || 'Sin título',
        materia: examen.materia || '',
        descripcion: examen.descripcion || '',
        esAdmision: Boolean(examen.esAdmision),
        duracionMinutos: examen.duracionMinutos || null,
        intentosPermitidos: examen.intentosPermitidos || 1,
        estado: examen.estado,
        preguntas,
      },
      intentoId: 'preview-staff',
      intentoNumero: 1,
      tiempoRestanteSegundos: examen.duracionMinutos ? examen.duracionMinutos * 60 : null,
      isStaffPreview: true,
      usuario: session.nombre,
      rol: session.rol,
    });
  }

  // ─── REGULAR STUDENT FLOW ──────────────────────────────────────────────────
  const studentId = session.username;

  // 1. Get exam (no answer keys sent to student)
  const examen = await db.collection('ex_examenes').findOne(
    { _id: new ObjectId(id), estado: 'activo' },
    {
      projection: {
        titulo: 1, materia: 1, duracionMinutos: 1, esAdmision: 1, intentosPermitidos: 1,
        activadoPor: 1, activadoEn: 1,
        'preguntas.orden': 1,
        'preguntas.enunciado': 1,
        'preguntas.opciones': 1,
        'preguntas.peso': 1,
        'preguntas.imagen': 1,
        'preguntas.area': 1,
        // respuestaCorrecta is intentionally excluded for students
      }
    }
  );

  if (!examen) {
    return NextResponse.json({ error: 'Examen no encontrado o no activo' }, { status: 404 });
  }

  // 1.5 Check aspirante vs regular student authorization
  let student = await db.collection('students').findOne({ numeroDocumento: studentId });
  if (!student) {
    try {
      const { getDbReportes } = await import('@/lib/mongodb');
      const dbReportes = await getDbReportes();
      student = await dbReportes.collection('students').findOne({ numeroDocumento: studentId });
    } catch (_) {}
  }

  if (student) {
    const isAspirante = Boolean(student.esAdmision);
    const isExamenAdmision = Boolean(examen.esAdmision);

    if (isAspirante && !isExamenAdmision) {
      return NextResponse.json({
        error: 'Tu usuario está registrado como aspirante al proceso de admisión. Únicamente puedes presentar pruebas diagnósticas de admisión.',
      }, { status: 403 });
    }

    if (!isAspirante && isExamenAdmision) {
      return NextResponse.json({
        error: 'Este examen es exclusivo para aspirantes al proceso de admisión. Los estudiantes regulares no pueden presentar pruebas de admisión.',
      }, { status: 403 });
    }
  }

  // 2. Check completed attempts and authorized limit
  const intentosCompletados = await db.collection('ex_intentos').countDocuments({
    examenId: id,
    estudianteId: studentId,
    estado: { $in: ['enviado', 'bloqueado'] },
  });

  const habilitacion = await db.collection('ex_habilitaciones').findOne({
    examenId: id,
    estudianteId: studentId,
  });

  const maxIntentos = habilitacion?.intentosPermitidos || examen.intentosPermitidos || 1;

  // 3. Create or resume in-progress attempt
  let intentoId: string;
  let iniciadoEnDate: Date;
  let intentoNumero: number;

  const inProgress = await db.collection('ex_intentos').findOne({
    examenId: id,
    estudianteId: studentId,
    estado: 'en_progreso',
  });

  if (inProgress) {
    intentoId = inProgress._id.toString();
    iniciadoEnDate = inProgress.iniciadoEn ? new Date(inProgress.iniciadoEn) : new Date();
    intentoNumero = inProgress.intentoNumero || (intentosCompletados + 1);
  } else {
    if (intentosCompletados >= maxIntentos) {
      return NextResponse.json({
        error: `Ya has completado tus ${maxIntentos > 1 ? maxIntentos + ' intentos' : 'intento'} para este examen.`,
      }, { status: 403 });
    }

    iniciadoEnDate = new Date();
    intentoNumero = intentosCompletados + 1;

    const result = await db.collection('ex_intentos').insertOne({
      examenId: id,
      estudianteId: studentId,
      estudianteNombre: session.nombre,
      estado: 'en_progreso',
      iniciadoEn: iniciadoEnDate,
      respuestas: [],
      intentoNumero,
      examenActivadoPor: (examen.activadoPor as string) || 'Docente / Staff',
      ...(intentoNumero > 1 ? {
        autorizadoPor: habilitacion?.autorizadoPor || 'Directivo / Administrador',
        autorizadoEn: habilitacion?.autorizadoEn || new Date(),
      } : {}),
    });
    intentoId = result.insertedId.toString();
  }

  let tiempoRestanteSegundos: number | null = null;
  if (examen.duracionMinutos) {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - iniciadoEnDate.getTime()) / 1000));
    tiempoRestanteSegundos = Math.max(0, (examen.duracionMinutos * 60) - elapsedSecs);
  }

  return NextResponse.json({ examen, intentoId, intentoNumero, tiempoRestanteSegundos });
}

