import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { formatFechaBogota } from '@/lib/utils';
import ResultadosClient, { ExamenResultadoItem } from './ResultadosClient';

export default async function ResultadosHubPage() {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const db = await getDb();

  // Load all exams
  const examenes = await db.collection('ex_examenes')
    .find({})
    .sort({ creadoEn: -1 })
    .toArray();

  // Load all attempts counts and averages grouped by examId
  const stats = await db.collection('ex_intentos').aggregate([
    {
      $group: {
        _id: '$examenId',
        totalIntentos: { $sum: 1 },
        enviados: {
          $sum: { $cond: [{ $eq: ['$estado', 'enviado'] }, 1, 0] }
        },
        enProgreso: {
          $sum: { $cond: [{ $eq: ['$estado', 'en_progreso'] }, 1, 0] }
        },
        promedio: { $avg: '$calificacionFinal' },
        aprobados: {
          $sum: { $cond: [{ $gte: ['$calificacionFinal', 60] }, 1, 0] }
        }
      }
    }
  ]).toArray();

  const statsMap = new Map<string, {
    totalIntentos: number;
    enviados: number;
    enProgreso: number;
    promedio: number;
    aprobados: number;
  }>(stats.map(s => [s._id.toString(), {
    totalIntentos: Number(s.totalIntentos || 0),
    enviados: Number(s.enviados || 0),
    enProgreso: Number(s.enProgreso || 0),
    promedio: s.promedio !== null && s.promedio !== undefined ? Number(s.promedio) : 0,
    aprobados: Number(s.aprobados || 0),
  }]));

  // Combine exam info with stats into serializable objects for client component
  const listaExamenes: ExamenResultadoItem[] = examenes.map(ex => {
    const exId = ex._id.toString();
    const st = statsMap.get(exId) || {
      totalIntentos: 0,
      enviados: 0,
      enProgreso: 0,
      promedio: 0,
      aprobados: 0,
    };
    const creadoEnDate = ex.creadoEn ? new Date(ex.creadoEn) : new Date();

    return {
      _id: exId,
      titulo: (ex.titulo as string) || 'Sin título',
      materia: (ex.materia as string) || '',
      esAdmision: !!ex.esAdmision,
      estado: (ex.estado as string) || 'borrador',
      creadoEn: creadoEnDate.toISOString(),
      creadoEnFormatted: formatFechaBogota(creadoEnDate),
      totalPreguntas: Array.isArray(ex.preguntas) ? ex.preguntas.length : 0,
      cursos: (ex.cursos as string[]) || [],
      totalIntentos: st.totalIntentos,
      enviados: st.enviados,
      enProgreso: st.enProgreso,
      promedio: st.promedio,
      aprobados: st.aprobados,
    };
  });

  const totalEvaluacionesPresentadas = stats.reduce((acc, s) => acc + (Number(s.enviados) || 0), 0);
  const totalEnPresentacion = stats.reduce((acc, s) => acc + (Number(s.enProgreso) || 0), 0);
  const admisionesActivasCount = examenes.filter(e => e.esAdmision && e.estado === 'activo').length;

  return (
    <ResultadosClient
      examenes={listaExamenes}
      totalEvaluacionesPresentadas={totalEvaluacionesPresentadas}
      totalEnPresentacion={totalEnPresentacion}
      admisionesActivasCount={admisionesActivasCount}
    />
  );
}
