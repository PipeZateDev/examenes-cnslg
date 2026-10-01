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

  // Get exam (no answer keys sent to student)
  const examen = await db.collection('ex_examenes').findOne(
    { _id: new ObjectId(id), estado: 'activo' },
    {
      projection: {
        titulo: 1, materia: 1, duracionMinutos: 1, esAdmision: 1,
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

  // Check attempts
  const existingAttempt = await db.collection('ex_intentos').findOne({
    examenId: id,
    estudianteId: session.username,
    estado: { $in: ['enviado', 'bloqueado'] },
  });

  if (existingAttempt) {
    return NextResponse.json({ error: 'Ya presentaste este examen' }, { status: 403 });
  }

  // Create or resume in-progress attempt
  let intentoId: string;
  let iniciadoEnDate: Date;
  const inProgress = await db.collection('ex_intentos').findOne({
    examenId: id,
    estudianteId: session.username,
    estado: 'en_progreso',
  });

  if (inProgress) {
    intentoId = inProgress._id.toString();
    iniciadoEnDate = inProgress.iniciadoEn ? new Date(inProgress.iniciadoEn) : new Date();
  } else {
    iniciadoEnDate = new Date();
    const result = await db.collection('ex_intentos').insertOne({
      examenId: id,
      estudianteId: session.username,
      estudianteNombre: session.nombre,
      estado: 'en_progreso',
      iniciadoEn: iniciadoEnDate,
      respuestas: [],
      intentoNumero: 1,
    });
    intentoId = result.insertedId.toString();
  }

  let tiempoRestanteSegundos: number | null = null;
  if (examen.duracionMinutos) {
    const elapsedSecs = Math.max(0, Math.floor((Date.now() - iniciadoEnDate.getTime()) / 1000));
    tiempoRestanteSegundos = Math.max(0, (examen.duracionMinutos * 60) - elapsedSecs);
  }

  return NextResponse.json({ examen, intentoId, tiempoRestanteSegundos });
}

