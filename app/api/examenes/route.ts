import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { generateExamAccessKey, distribuirPesos, hoy } from '@/lib/utils';
import { ObjectId } from 'mongodb';

// GET /api/examenes - list exams with role-based permissions
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol === 'estudiante') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const { searchParams } = new URL(req.url);
  const estadoParam = searchParams.get('estado');
  const all = searchParams.get('all') === '1';
  const admisionParam = searchParams.get('admision');
  const search = searchParams.get('q')?.trim();

  // Build role-based base filter
  const roleFilter: Record<string, unknown> = {};

  if (all || ['admin', 'directivo', 'coordinador', 'supervisor'].includes(session.rol)) {
    // Admin, Directivo, Coordinador, Supervisor, or full catalog preview: full visibility of all institution exams
    if (estadoParam) roleFilter.estado = estadoParam;
  } else {
    // Docente: see own exams (any state), assigned exams/courses, and all approved/active/closed exams
    const user = await db.collection('ex_usuarios').findOne({ username: session.username.toLowerCase() });
    const userCursos = (user?.cursosAsignados as string[]) || [];
    const userExamenes = (user?.examenesAsignados as string[]) || [];

    const docenteConditions: Record<string, unknown>[] = [
      { creadoPor: session.userId },
      { estado: { $in: ['aprobado', 'activo', 'cerrado'] } },
    ];

    if (userExamenes.length > 0) {
      const objectIds = userExamenes.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
      if (objectIds.length > 0) {
        docenteConditions.push({ _id: { $in: objectIds } });
      }
    }

    if (userCursos.length > 0) {
      docenteConditions.push({ cursos: { $in: userCursos } });
    }

    if (estadoParam) {
      roleFilter.$and = [
        { estado: estadoParam },
        { $or: docenteConditions },
      ];
    } else {
      roleFilter.$or = docenteConditions;
    }
  }

  // Admissions filter
  if (!all && admisionParam !== null) {
    roleFilter.esAdmision = admisionParam === '1';
  }

  // Text search filter
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    roleFilter.$and = [
      ...(roleFilter.$and as Array<Record<string, unknown>> || []),
      {
        $or: [
          { titulo: searchRegex },
          { materia: searchRegex },
          { cursos: searchRegex },
        ],
      },
    ];
  }

  const examenes = await db.collection('ex_examenes')
    .find(roleFilter)
    .sort({ creadoEn: -1 })
    .project({
      titulo: 1,
      materia: 1,
      descripcion: 1,
      estado: 1,
      creadoEn: 1,
      creadoPor: 1,
      cursos: 1,
      esAdmision: 1,
      duracionMinutos: 1,
      claveAcceso: 1,
      activadoPor: 1,
      activadoEn: 1,
      preguntas: { $size: { $ifNull: ['$preguntas', []] } },
    })
    .toArray();

  return NextResponse.json({
    examenes,
    user: {
      nombre: session.nombre,
      rol: session.rol,
      userId: session.userId,
    },
  });
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
