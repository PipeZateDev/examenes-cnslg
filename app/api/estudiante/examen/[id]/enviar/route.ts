import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// POST /api/estudiante/examen/[id]/enviar
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { intentoId, respuestas } = await req.json();
  const db = await getDb();

  // ─── STAFF PREVIEW SUBMIT (In-memory grading, zero DB writes) ──────────────
  if (session.rol !== 'estudiante') {
    const examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
    if (!examen) {
      return NextResponse.json({ error: 'Examen no encontrado' }, { status: 404 });
    }

    let calificacionFinal = 0;
    const respuestasGraded = (examen.preguntas || []).map((p: any) => {
      const opcionSeleccionada = respuestas[p.orden] || null;
      const esCorrecta = opcionSeleccionada !== null && opcionSeleccionada === p.respuestaCorrecta;
      const puntajeObtenido = esCorrecta ? (p.peso || 0) : 0;
      calificacionFinal += puntajeObtenido;
      return {
        preguntaOrden: p.orden,
        opcionSeleccionada,
        esCorrecta,
        puntajeObtenido,
        area: p.area || 'General',
      };
    });

    let calificacionesPorArea: Array<{ area: string; puntaje: number; correctas: number; totalPreguntas: number }> = [];
    if (examen.esAdmision) {
      const areasMap = new Map<string, { total: number; correctas: number; pesoTotal: number; pesoObtenido: number }>();
      for (const p of examen.preguntas || []) {
        const a = p.area || 'General';
        if (!areasMap.has(a)) areasMap.set(a, { total: 0, correctas: 0, pesoTotal: 0, pesoObtenido: 0 });
        const item = areasMap.get(a)!;
        item.total += 1;
        item.pesoTotal += (p.peso || 0);
        const opcionSeleccionada = respuestas[p.orden] || null;
        if (opcionSeleccionada !== null && opcionSeleccionada === p.respuestaCorrecta) {
          item.correctas += 1;
          item.pesoObtenido += (p.peso || 0);
        }
      }

      calificacionesPorArea = Array.from(areasMap.entries()).map(([area, data]) => {
        const puntaje = data.pesoTotal > 0
          ? Math.round((data.pesoObtenido / data.pesoTotal) * 100)
          : (data.total > 0 ? Math.round((data.correctas / data.total) * 100) : 0);
        return { area, puntaje, correctas: data.correctas, totalPreguntas: data.total };
      });

      if (calificacionesPorArea.length > 0) {
        calificacionFinal = Math.round(
          calificacionesPorArea.reduce((sum, a) => sum + a.puntaje, 0) / calificacionesPorArea.length
        );
      }
    }

    return NextResponse.json({
      ok: true,
      isStaffPreview: true,
      calificacionFinal,
      calificacionesPorArea,
      respuestasGraded,
    });
  }

  // ─── REGULAR STUDENT FLOW ──────────────────────────────────────────────────

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
    area?: string;
  }) => {
    const opcionSeleccionada = respuestas[p.orden] || null;
    const esCorrecta = opcionSeleccionada !== null && opcionSeleccionada === p.respuestaCorrecta;
    const puntajeObtenido = esCorrecta ? (p.peso || 0) : 0;
    calificacionFinal += puntajeObtenido;
    return {
      preguntaOrden: p.orden,
      opcionSeleccionada,
      esCorrecta,
      puntajeObtenido,
      area: p.area || 'General',
    };
  });

  // Calculate calificacionesPorArea if esAdmision
  let calificacionesPorArea: Array<{
    area: string;
    puntaje: number;
    correctas: number;
    totalPreguntas: number;
  }> = [];

  if (examen.esAdmision) {
    const areasMap = new Map<string, { total: number; correctas: number; pesoTotal: number; pesoObtenido: number }>();
    for (const p of examen.preguntas) {
      const a = p.area || 'General';
      if (!areasMap.has(a)) {
        areasMap.set(a, { total: 0, correctas: 0, pesoTotal: 0, pesoObtenido: 0 });
      }
      const item = areasMap.get(a)!;
      item.total += 1;
      item.pesoTotal += (p.peso || 0);
      const opcionSeleccionada = respuestas[p.orden] || null;
      if (opcionSeleccionada !== null && opcionSeleccionada === p.respuestaCorrecta) {
        item.correctas += 1;
        item.pesoObtenido += (p.peso || 0);
      }
    }

    calificacionesPorArea = Array.from(areasMap.entries()).map(([area, data]) => {
      // Score in percentage (0 to 100%)
      const puntaje = data.pesoTotal > 0
        ? Math.round((data.pesoObtenido / data.pesoTotal) * 100)
        : (data.total > 0 ? Math.round((data.correctas / data.total) * 100) : 0);
      return {
        area,
        puntaje,
        correctas: data.correctas,
        totalPreguntas: data.total,
      };
    });

    // Calificación final is average of the areas (0 to 100)
    if (calificacionesPorArea.length > 0) {
      calificacionFinal = Math.round(
        calificacionesPorArea.reduce((sum, a) => sum + a.puntaje, 0) / calificacionesPorArea.length
      );
    }
  }

  // Update intento as submitted
  await db.collection('ex_intentos').updateOne(
    { _id: new ObjectId(intentoId) },
    {
      $set: {
        estado: 'enviado',
        enviadoEn: new Date(),
        respuestas: respuestasGraded,
        calificacionFinal,
        ...(examen.esAdmision ? { calificacionesPorArea } : {}),
      },
    }
  );

  return NextResponse.json({ ok: true, calificacionFinal, calificacionesPorArea });
}
