import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { formatFechaBogota, formatHoraBogota } from '@/lib/utils';
import ExamenesClient, { ExamenListItem } from './ExamenesClient';

export default async function ExamenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; admision?: string }>;
}) {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const params = await searchParams;
  const esAdmision = params.admision === '1';

  const db = await getDb();
  const filter: Record<string, unknown> = { esAdmision };

  const esCoordinadorOPlus = hasRole(session.rol, 'coordinador');

  const examenes = await db.collection('ex_examenes')
    .find(filter)
    .sort({ creadoEn: -1 })
    .project({ titulo: 1, materia: 1, estado: 1, creadoEn: 1, esAdmision: 1, claveAcceso: 1, activadoPor: 1, activadoEn: 1 })
    .toArray();

  const lista: ExamenListItem[] = examenes.map(ex => {
    const creadoEnDate = ex.creadoEn ? new Date(ex.creadoEn) : new Date();
    const activadoEnDate = ex.activadoEn ? new Date(ex.activadoEn) : undefined;

    return {
      _id: ex._id.toString(),
      titulo: (ex.titulo as string) || 'Sin título',
      materia: (ex.materia as string) || '',
      estado: (ex.estado as string) || 'borrador',
      creadoEn: creadoEnDate.toISOString(),
      creadoEnFormatted: formatFechaBogota(creadoEnDate),
      esAdmision: !!ex.esAdmision,
      claveAcceso: (ex.claveAcceso as string) || null,
      activadoPor: (ex.activadoPor as string) || undefined,
      activadoEn: activadoEnDate ? activadoEnDate.toISOString() : undefined,
      activadoEnFormatted: activadoEnDate ? formatHoraBogota(activadoEnDate) : undefined,
    };
  });

  return (
    <ExamenesClient
      examenes={lista}
      esAdmision={esAdmision}
      esCoordinadorOPlus={esCoordinadorOPlus}
    />
  );
}
