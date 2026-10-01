import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import { getDb, getDbReportes } from '@/lib/mongodb';
import EstudiantesManager from './EstudiantesManager';

export default async function EstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; curso?: string; admision?: string; tab?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasRole(session.rol, 'supervisor')) redirect('/dashboard');

  const params = await searchParams;
  const q = params.q || '';
  const cursoFilter = params.curso || '';
  const tab = (params.tab === 'aspirantes' || params.tab === 'cursos') ? params.tab : 'estudiantes';
  const page = Math.max(1, Number(params.page || 1));
  const limit = 48;
  const skip = (page - 1) * limit;

  const filter: Record<string, unknown> = {};

  if (q) {
    filter.$or = [
      { nombreCompleto: { $regex: q, $options: 'i' } },
      { numeroDocumento: { $regex: q, $options: 'i' } },
    ];
  }

  if (cursoFilter) {
    const escaped = cursoFilter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const courseRegex = { $regex: `^${escaped}$`, $options: 'i' };
    filter.$or = [
      { curso: courseRegex },
      { grado: courseRegex },
    ];
  }

  if (tab === 'aspirantes') {
    filter.esAdmision = true;
  } else if (tab === 'estudiantes') {
    filter.esAdmision = { $ne: true };
  }

  const dbExamenes = await getDb();
  let dbReportes = null;
  try {
    dbReportes = await getDbReportes();
  } catch (_) {}

  const dbToQuery = tab === 'aspirantes' ? dbExamenes : (dbReportes || dbExamenes);

  const [estudiantesDocs, total, totalAspirantes, totalRegulares, cursosDocs] = await Promise.all([
    dbToQuery.collection('students')
      .find(filter)
      .sort({ nombreCompleto: 1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    dbToQuery.collection('students').countDocuments(filter),
    dbExamenes.collection('students').countDocuments({ esAdmision: true }),
    (dbReportes || dbExamenes).collection('students').countDocuments({ esAdmision: { $ne: true } }),
    (dbReportes || dbExamenes).collection('courses').find({}).sort({ ordenDisplay: 1, nombre: 1 }).toArray(),
  ]);

  const estudiantes = estudiantesDocs.map(est => ({
    _id: est._id.toString(),
    numeroDocumento: est.numeroDocumento as string,
    tipoDocumento: (est.tipoDocumento as string) || 'TI',
    nombreCompleto: (est.nombreCompleto as string) || '',
    nombres: (est.nombres as string) || '',
    apellidos: (est.apellidos as string) || '',
    curso: (est.curso as string) || '',
    grado: (est.grado as string) || '',
    esAdmision: Boolean(est.esAdmision),
    activo: est.activo !== false,
    foto: est.foto || null,
    fotoPosicionX: est.fotoPosicionX ?? 50,
    fotoPosicionY: est.fotoPosicionY ?? 50,
  }));

  const cursos = cursosDocs.map(c => ({
    _id: c._id.toString(),
    nombre: c.nombre as string,
    anioLectivo: c.anioLectivo as number | undefined,
    grado: c.grado as string | undefined,
  }));

  const totalPages = Math.ceil(total / limit);
  const canEdit = hasRole(session.rol, 'coordinador');

  return (
    <EstudiantesManager
      initialEstudiantes={estudiantes}
      initialCursos={cursos}
      initialTab={tab}
      total={total}
      totalRegulares={totalRegulares}
      totalAspirantes={totalAspirantes}
      page={page}
      totalPages={totalPages}
      query={q}
      cursoFilter={cursoFilter}
      canEdit={canEdit}
    />
  );
}
