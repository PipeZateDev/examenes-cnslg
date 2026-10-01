import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/estudiante/examen/[id]/enviar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || session.rol !== 'estudiante') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { intentoId, respuestas } = await req.json();
  // respuestas = { [preguntaOrden]: 'A'|'B'|'C'|'D'|'E' }

  const db = await getDb();

  // Verify intento belongs to this student
  const intento = await db.collection('ex_intentos').findOne({
    _id: new ObjectId(intentoId),
    estudianteId: session.username,
    examenId: id,
    estado: 'en_progreso',
  });

  if (!intento) {
    return NextResponse.json({ error: 'Intento no válido' }, { status: 400 });
  }

  // Get exam with answer keys for grading
  const examen = await db.collection('ex_examenes').findOne({
    _id: new ObjectId(id),
  });

  if (!examen) {
    return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
  }

  // Grade answers
  let calificacionFinal = 0;
  const respuestasGraded = examen.preguntas.map((p: {
    orden: number;
    respuestaCorrecta: string;
    peso: number;
  }) => {
    const opcionSeleccionada = respuestas[p.orden] || null;
    const esCorrecta = opcionSeleccionada !== null && opcionSeleccionada === p.respuestaCorrecta;
    const puntajeObtenido = esCorrecta ? p.peso : 0;
    calificacionFinal += puntajeObtenido;
    return {
      preguntaOrden: p.orden,
      opcionSeleccionada,
      esCorrecta,
      puntajeObtenido,
    };
  });

  // Update intento as submitted
  await db.collection('ex_intentos').updateOne(
    { _id: new ObjectId(intentoId) },
    {
      $set: {
        estado: 'enviado',
        enviadoEn: new Date(),
        respuestas: respuestasGraded,
        calificacionFinal,
      },
    }
  );

  return NextResponse.json({ ok: true, calificacionFinal });
}
