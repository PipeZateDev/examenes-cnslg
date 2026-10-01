import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/estudiante/examen/[id]/iniciar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'estudiante') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
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
        // respuestaCorrecta is intentionally excluded
      }
    }
  );

  if (!examen) {
    return NextResponse.json({ error: 'Examen no encontrado o no activo' }, { status: 404 });
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

