import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { hoy, formatHoraBogota } from '@/lib/utils';
import AdmisionesClient, { AdmisionItem } from './AdmisionesClient';

export default async function AdmisionesPage() {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const db = await getDb();

  const [examenes, claveDoc] = await Promise.all([
    db.collection('ex_examenes')
      .find({ esAdmision: true })
      .sort({ creadoEn: -1 })
      .toArray(),
    db.collection('ex_clave_dia').findOne({ fecha: hoy() }),
  ]);

  const examenesClaves = (claveDoc?.examenesClaves as Array<{
    examenId: string;
    clave: string;
    activadoPor?: string;
    activadoEn?: Date;
  }>) || [];

  // Count applicants for each admission exam
  const stats = await db.collection('ex_intentos').aggregate([
    {
      $match: {
        examenId: { $in: examenes.map(e => e._id.toString()) }
      }
    },
    {
      $group: {
        _id: '$examenId',
        totalIntentos: { $sum: 1 },
        enviados: { $sum: { $cond: [{ $eq: ['$estado', 'enviado'] }, 1, 0] } },
        promedio: { $avg: '$calificacionFinal' },
      }
    }
  ]).toArray();

  const statsMap = new Map<string, { totalIntentos: number; enviados: number; promedio: number | null }>(
    stats.map(s => [s._id.toString(), {
      totalIntentos: Number(s.totalIntentos || 0),
      enviados: Number(s.enviados || 0),
      promedio: s.promedio !== null && s.promedio !== undefined ? Number(s.promedio) : null,
    }])
  );

  const esCoordinadorOPlus = hasRole(session.rol, 'coordinador');

  const lista: AdmisionItem[] = examenes.map(ex => {
    const exId = ex._id.toString();
    const claveItem = examenesClaves.find(k => k.examenId === exId);
    const st = statsMap.get(exId) || { totalIntentos: 0, enviados: 0, promedio: null };

    const activadoEnDate = ex.activadoEn ? new Date(ex.activadoEn) : claveItem?.activadoEn ? new Date(claveItem.activadoEn) : undefined;

    return {
      _id: exId,
      titulo: (ex.titulo as string) || 'Sin título',
      materia: (ex.materia as string) || '',
      estado: (ex.estado as string) || 'borrador',
      creadoEn: ex.creadoEn ? new Date(ex.creadoEn).toISOString() : new Date().toISOString(),
      totalPreguntas: Array.isArray(ex.preguntas) ? ex.preguntas.length : 0,
      cursos: (ex.cursos as string[]) || [],
      claveActiva: claveItem ? claveItem.clave : (ex.estado === 'activo' ? (ex.claveAcceso as string) : null),
      activadoPor: (ex.activadoPor as string) || claveItem?.activadoPor,
      activadoEn: activadoEnDate ? activadoEnDate.toISOString() : undefined,
      activadoEnFormatted: activadoEnDate ? formatHoraBogota(activadoEnDate) : undefined,
      totalIntentos: st.totalIntentos,
      enviados: st.enviados,
      promedio: st.promedio,
    };
  });

  const activeTodayCount = lista.filter(e => e.claveActiva && e.estado === 'activo').length;
  const totalAspirantesEvaluados = lista.reduce((acc, e) => acc + e.enviados, 0);

  return (
    <AdmisionesClient
      initialExamenes={lista}
      esCoordinadorOPlus={esCoordinadorOPlus}
      activeTodayCount={activeTodayCount}
      totalAspirantesEvaluados={totalAspirantesEvaluados}
    />
  );
}
