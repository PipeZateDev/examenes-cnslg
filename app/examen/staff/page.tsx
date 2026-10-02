import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
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
  activadoPor?: string;
}

export default async function StaffExamenesPage() {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') {
    redirect('/examen/login');
  }

  const db = await getDb();

  // All staff roles have full visibility of all exams (regular & admissions, all states) in the live preview catalog
  const roleFilter: Record<string, unknown> = {};

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
      activadoPor: 1,
      preguntas: 1,
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
    preguntasCount: Array.isArray(ex.preguntas) ? ex.preguntas.length : 0,
    creadoPor: ex.creadoPor ? String(ex.creadoPor) : undefined,
    creadoEn: ex.creadoEn ? new Date(ex.creadoEn).toISOString() : undefined,
    claveAcceso: (ex.claveAcceso as string) || null,
    activadoPor: (ex.activadoPor as string) || undefined,
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

