import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import StaffExamenesClient from './StaffExamenesClient';

export interface StaffExamenItem {
  _id: string;
  titulo: string;
  materia?: string;
  descripcion?: string;
  estado: string;
  cursos: string[];
  esAdmision: boolean;
  duracionMinutos?: number | null;
  preguntasCount: number;
  creadoPor?: string;
  creadoEn?: string;
  claveAcceso?: string | null;
}

export default async function StaffExamenesPage() {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') {
    redirect('/examen/login');
  }

  const db = await getDb();

  // Role-based visibility query:
  // - Admin & Directivo: all exams (all states)
  // - Coordinador & Supervisor: all approved/active/closed exams in the school + own drafts
  // - Docente: own exams + approved/active/closed exams for their assigned courses/subjects
  const roleFilter: Record<string, unknown> = {};

  if (['admin', 'directivo'].includes(session.rol)) {
    // No restrictions
  } else if (['coordinador', 'supervisor'].includes(session.rol)) {
    roleFilter.$or = [
      { estado: { $in: ['aprobado', 'activo', 'cerrado'] } },
      { creadoPor: session.userId },
    ];
  } else {
    const user = await db.collection('ex_usuarios').findOne({ username: session.username.toLowerCase() });
    const userCursos = (user?.cursosAsignados as string[]) || [];

    const docenteConditions: Record<string, unknown>[] = [
      { creadoPor: session.userId },
    ];

    if (userCursos.length > 0) {
      docenteConditions.push({
        estado: { $in: ['aprobado', 'activo', 'cerrado'] },
        $or: [
          { cursos: { $in: userCursos } },
          { cursos: { $size: 0 } },
          { esAdmision: true },
        ],
      });
    } else {
      docenteConditions.push({
        estado: { $in: ['aprobado', 'activo', 'cerrado'] },
      });
    }

    roleFilter.$or = docenteConditions;
  }

  const examenes = await db.collection('ex_examenes')
    .find(roleFilter)
    .sort({ creadoEn: -1 })
    .project({
      titulo: 1,
      materia: 1,
      descripcion: 1,
      estado: 1,
      cursos: 1,
      esAdmision: 1,
      duracionMinutos: 1,
      creadoPor: 1,
      creadoEn: 1,
      claveAcceso: 1,
      preguntasCount: { $size: { $ifNull: ['$preguntas', []] } },
    })
    .toArray();

  const lista: StaffExamenItem[] = examenes.map(ex => ({
    _id: ex._id.toString(),
    titulo: (ex.titulo as string) || 'Sin título',
    materia: (ex.materia as string) || '',
    descripcion: (ex.descripcion as string) || '',
    estado: (ex.estado as string) || 'borrador',
    cursos: (ex.cursos as string[]) || [],
    esAdmision: Boolean(ex.esAdmision),
    duracionMinutos: ex.duracionMinutos !== undefined ? (ex.duracionMinutos as number) : null,
    preguntasCount: typeof ex.preguntasCount === 'number' ? ex.preguntasCount : 0,
    creadoPor: ex.creadoPor ? String(ex.creadoPor) : undefined,
    creadoEn: ex.creadoEn ? new Date(ex.creadoEn).toISOString() : undefined,
    claveAcceso: (ex.claveAcceso as string) || null,
  }));

  return (
    <StaffExamenesClient
      examenes={lista}
      user={{
        nombre: session.nombre,
        rol: session.rol,
        userId: session.userId,
      }}
    />
  );
}
