import { NextRequest, NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// Standard courses list for CNSLG (canonical grades)
const DEFAULT_CNSLG_COURSES = [
  'Kinder', 'Transición',
  '101', '201', '301', '401', '501',
  '601', '701', '801', '901',
  '1001', '1101', '1102'
];

// Educational grade sorter: Preescolar -> Primaria (101..) -> Bachillerato (601..1102) -> Otros
function parseCourseOrder(nombre: string): number {
  const norm = nombre.toLowerCase().trim().replace(/^(curso|grado)\s+/i, '');

  if (norm.includes('párvulo') || norm.includes('parvulo')) return 10;
  if (norm.includes('pre-jardín') || norm.includes('prejardin') || norm.includes('pre jardín') || norm.includes('pre jardin')) return 20;
  if (norm.includes('jardín') || norm.includes('jardin')) return 30;
  if (norm.includes('kinder') || norm.includes('kínder')) return 40;
  if (norm.includes('transición') || norm.includes('transicion')) return 50;

  const numMatch = norm.match(/^(\d+)/);
  if (numMatch) {
    return 1000 + parseInt(numMatch[1], 10);
  }

  if (norm.includes('primero') || norm.includes('1°') || norm.includes('1-')) return 1100;
  if (norm.includes('segundo') || norm.includes('2°') || norm.includes('2-')) return 1200;
  if (norm.includes('tercero') || norm.includes('3°') || norm.includes('3-')) return 1300;
  if (norm.includes('cuarto') || norm.includes('4°') || norm.includes('4-')) return 1400;
  if (norm.includes('quinto') || norm.includes('5°') || norm.includes('5-')) return 1500;
  if (norm.includes('sexto') || norm.includes('6°') || norm.includes('6-')) return 1600;
  if (norm.includes('séptimo') || norm.includes('septimo') || norm.includes('7°') || norm.includes('7-')) return 1700;
  if (norm.includes('octavo') || norm.includes('8°') || norm.includes('8-')) return 1800;
  if (norm.includes('noveno') || norm.includes('9°') || norm.includes('9-')) return 1900;
  if (norm.includes('décimo') || norm.includes('decimo') || norm.includes('10°') || norm.includes('10-')) return 2000;
  if (norm.includes('once') || norm.includes('11°') || norm.includes('11-')) return 2100;

  if (norm.includes('admisi')) return 8000;
  return 9000;
}

// GET /api/cursos - List courses with student counts per course & unassigned students
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || session.rol === 'estudiante') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let dbReportes = null;
  try {
    dbReportes = await getDbReportes();
  } catch (_) {}
  const dbExamenes = await getDb();
  const dbStudents = dbReportes || dbExamenes;

  // 1. Fetch courses from DB
  let dbCourses = await dbStudents.collection('courses').find({}).toArray();
  if (!dbCourses || dbCourses.length === 0) {
    dbCourses = await dbExamenes.collection('courses').find({}).toArray();
  }

  // Course list from DB, or defaults if DB has no courses
  let allCoursesList: Array<{ _id?: string; nombre: string; anioLectivo?: number; totalEstudiantes?: number }> = [];
  if (dbCourses && dbCourses.length > 0) {
    allCoursesList = dbCourses.map(c => ({
      _id: c._id.toString(),
      nombre: String(c.nombre).trim(),
      anioLectivo: c.anioLectivo,
    }));
  } else {
    allCoursesList = DEFAULT_CNSLG_COURSES.map(defName => ({
      nombre: defName,
    }));
  }

  // 2. Count students per course in MongoDB
  const [studentCounts, sinCursoCount, totalEstudiantes] = await Promise.all([
    dbStudents.collection('students').aggregate([
      { $match: { esAdmision: { $ne: true } } },
      { $group: { _id: '$curso', count: { $sum: 1 } } }
    ]).toArray(),
    dbStudents.collection('students').countDocuments({
      esAdmision: { $ne: true },
      $or: [
        { curso: { $exists: false } },
        { curso: null },
        { curso: '' },
        { curso: 'Sin Curso' },
        { curso: 'sin_curso' }
      ]
    }),
    dbStudents.collection('students').countDocuments({ esAdmision: { $ne: true } }),
  ]);

  const countMap = new Map<string, number>();
  studentCounts.forEach(s => {
    if (s._id) {
      const cleanKey = String(s._id).trim().toLowerCase();
      countMap.set(cleanKey, (countMap.get(cleanKey) || 0) + Number(s.count || 0));
    }
  });

  // Attach student count to each course
  const cursosConConteo = allCoursesList.map(c => {
    const cleanName = c.nombre.toLowerCase();
    const count = countMap.get(cleanName) || 0;
    return {
      ...c,
      totalEstudiantes: count,
    };
  });

  // Sort courses by educational grade order
  cursosConConteo.sort((a, b) => {
    const orderA = parseCourseOrder(a.nombre);
    const orderB = parseCourseOrder(b.nombre);
    if (orderA !== orderB) return orderA - orderB;
    return a.nombre.localeCompare(b.nombre, 'es', { numeric: true });
  });

  return NextResponse.json({
    cursos: cursosConConteo,
    sinCursoCount,
    totalEstudiantes,
  });
}

// POST /api/cursos - Create new course
export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { nombre, anioLectivo, grado } = body;

  if (!nombre) {
    return NextResponse.json({ error: 'El nombre del curso es obligatorio' }, { status: 400 });
  }

  const cleanNombre = String(nombre).trim();
  const courseDoc = {
    nombre: cleanNombre,
    anioLectivo: anioLectivo ? Number(anioLectivo) : new Date().getFullYear(),
    grado: grado ? String(grado).trim() : cleanNombre,
    activo: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('courses').updateOne(
      { nombre: cleanNombre },
      { $set: courseDoc },
      { upsert: true }
    );
  } catch (_) {}

  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('courses').updateOne(
      { nombre: cleanNombre },
      { $set: courseDoc },
      { upsert: true }
    );
  } catch (_) {}

  return NextResponse.json({ ok: true, course: courseDoc }, { status: 201 });
}

// PATCH /api/cursos - Update course
export async function PATCH(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'coordinador')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const { id, nombre, anioLectivo, grado, activo } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID de curso requerido' }, { status: 400 });
  }

  const updateDoc: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (nombre) updateDoc.nombre = String(nombre).trim();
  if (anioLectivo) updateDoc.anioLectivo = Number(anioLectivo);
  if (grado !== undefined) updateDoc.grado = String(grado).trim();
  if (activo !== undefined) updateDoc.activo = Boolean(activo);

  const filter = ObjectId.isValid(id) ? { _id: new ObjectId(id) } : { nombre: id };

  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('courses').updateOne(filter, { $set: updateDoc });
  } catch (_) {}

  try {
    const dbExamenes = await getDb();
    await dbExamenes.collection('courses').updateOne(filter, { $set: updateDoc });
  } catch (_) {}

  return NextResponse.json({ ok: true });
}

// DELETE /api/cursos - Delete course (Admin only)
export async function DELETE(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'admin')) {
    return NextResponse.json({ error: 'Solo los administradores pueden eliminar cursos' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id')?.trim();
  const nombreParam = searchParams.get('nombre')?.trim();
  const courseIdentifier = nombreParam || id;

  if (!courseIdentifier) {
    return NextResponse.json({ error: 'ID o nombre del curso requerido' }, { status: 400 });
  }

  const isObjectId = ObjectId.isValid(courseIdentifier);
  const filter = isObjectId ? { _id: new ObjectId(courseIdentifier) } : { nombre: courseIdentifier };

  let courseName = courseIdentifier;

  // 1. Find course name before deleting
  try {
    const dbReportes = await getDbReportes();
    const found = await dbReportes.collection('courses').findOne(filter);
    if (found?.nombre) courseName = found.nombre;
  } catch (_) {}

  const dbExamenes = await getDb();
  if (courseName === courseIdentifier && isObjectId) {
    try {
      const foundEx = await dbExamenes.collection('courses').findOne(filter);
      if (foundEx?.nombre) courseName = foundEx.nombre;
    } catch (_) {}
  }

  const cleanCourseName = String(courseName).trim();
  const escapedName = cleanCourseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const courseNameRegex = { $regex: `^${escapedName}$`, $options: 'i' };

  // 2. Delete course from courses collection in both DBs
  try {
    const dbReportes = await getDbReportes();
    await dbReportes.collection('courses').deleteMany({
      $or: [
        filter,
        { nombre: courseNameRegex }
      ]
    });
  } catch (_) {}

  try {
    await dbExamenes.collection('courses').deleteMany({
      $or: [
        filter,
        { nombre: courseNameRegex }
      ]
    });
  } catch (_) {}

  // 3. Unset course on any students assigned to this course (they become unassigned / "Sin Curso")
  let unassignedCount = 0;
  try {
    const dbReportes = await getDbReportes();
    const resRep = await dbReportes.collection('students').updateMany(
      { curso: courseNameRegex },
      { $set: { curso: '', updatedAt: new Date() } }
    );
    unassignedCount += resRep.modifiedCount;
  } catch (_) {}

  try {
    const resEx = await dbExamenes.collection('students').updateMany(
      { curso: courseNameRegex },
      { $set: { curso: '', updatedAt: new Date() } }
    );
    unassignedCount += resEx.modifiedCount;
  } catch (_) {}

  // 4. Remove this course from any exams assigned to it
  try {
    await dbExamenes.collection('ex_examenes').updateMany(
      { cursos: courseNameRegex },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $pull: { cursos: cleanCourseName } as any }
    );
  } catch (_) {}

  return NextResponse.json({
    ok: true,
    deletedCourse: cleanCourseName,
    unassignedStudentsCount: unassignedCount,
  });
}
