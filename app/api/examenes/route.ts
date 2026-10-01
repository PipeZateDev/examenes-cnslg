import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { generateExamAccessKey, distribuirPesos, hoy } from '@/lib/utils';
import { ObjectId } from 'mongodb';

// GET /api/examenes - list exams
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol === 'estudiante') return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const estado = searchParams.get('estado');
  const all = searchParams.get('all') === '1';
  const admisionParam = searchParams.get('admision');

  const filter: Record<string, unknown> = {};
  if (!all && admisionParam !== null) {
    filter.esAdmision = admisionParam === '1';
  }
  if (estado) filter.estado = estado;

  const examenes = await db.collection('ex_examenes')
    .find(filter)
    .sort({ creadoEn: -1 })
    .project({
      titulo: 1,
      materia: 1,
      estado: 1,
      creadoEn: 1,
      cursos: 1,
      esAdmision: 1,
      claveAcceso: 1,
      preguntas: { $size: '$preguntas' }
    })
    .toArray();

  return NextResponse.json({ examenes });
}

// POST /api/examenes - create exam
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { titulo, descripcion, materia, materiaId, cursos, anioLectivo, duracionMinutos, esAdmision, preguntas } = body;

  if (!titulo || !preguntas?.length) {
    return NextResponse.json({ error: 'Título y preguntas son requeridos' }, { status: 400 });
  }

  // Auto-assign weights if not set
  const preguntasConPeso = preguntas.map((p: { peso?: number }, i: number) => ({
    ...p,
    peso: p.peso ?? distribuirPesos(preguntas.length)[i],
  }));

  const db = await getDb();
  const result = await db.collection('ex_examenes').insertOne({
    titulo,
    descripcion: descripcion || '',
    materia: materia || '',
    materiaId: materiaId || null,
    cursos: cursos || [],
    anioLectivo: anioLectivo || new Date().getFullYear(),
    esAdmision: esAdmision ?? false,
    estado: hasRole(session.rol, 'directivo') ? 'aprobado' : 'borrador',
    creadoPor: session.userId,
    creadoEn: new Date(),
    duracionMinutos: duracionMinutos || null,
    intentosPermitidos: 1,
    preguntas: preguntasConPeso,
    claveAcceso: null,
  });

  return NextResponse.json({ id: result.insertedId.toString() }, { status: 201 });
}
