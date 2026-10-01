import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import Link from 'next/link';

export default async function ResultadosHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const params = await searchParams;
  const tipo = params.tipo || 'todos'; // 'todos' | 'regulares' | 'admisiones'
  const query = params.q?.toLowerCase().trim() || '';

  const db = await getDb();

  // Load all exams
  const examFilter: Record<string, unknown> = {};
  if (tipo === 'regulares') examFilter.esAdmision = { $ne: true };
  if (tipo === 'admisiones') examFilter.esAdmision = true;

  const examenes = await db.collection('ex_examenes')
    .find(examFilter)
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

  // Combine exam info with stats
  const listaExamenes = examenes
    .map(ex => {
      const exId = ex._id.toString();
      const st = statsMap.get(exId) || {
        totalIntentos: 0,
        enviados: 0,
        enProgreso: 0,
        promedio: 0,
        aprobados: 0,
      };
      return {
        _id: exId,
        titulo: ex.titulo as string,
        materia: (ex.materia as string) || '',
        esAdmision: !!ex.esAdmision,
        estado: (ex.estado as string) || 'borrador',
        creadoEn: ex.creadoEn ? new Date(ex.creadoEn) : new Date(),
        totalPreguntas: Array.isArray(ex.preguntas) ? ex.preguntas.length : 0,
        cursos: (ex.cursos as string[]) || [],
        totalIntentos: st.totalIntentos,
        enviados: st.enviados,
        enProgreso: st.enProgreso,
        promedio: st.promedio,
        aprobados: st.aprobados,
      };
    })
    .filter(ex => {
      if (!query) return true;
      return (
        ex.titulo.toLowerCase().includes(query) ||
        ex.materia.toLowerCase().includes(query)
      );
    });

  const totalEvaluacionesPresentadas = stats.reduce((acc, s) => acc + (Number(s.enviados) || 0), 0);
  const totalEnPresentacion = stats.reduce((acc, s) => acc + (Number(s.enProgreso) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumbs & Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Resultados y Calificaciones</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              📊 Panel Central de Resultados
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Consulta en tiempo real los resultados, calificaciones e intentos de cada evaluación.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/examenes"
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition shadow-xs"
            >
              📝 Ver Exámenes
            </Link>
          </div>
        </div>

        {/* Global summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Exámenes Totales</p>
            <p className="text-3xl font-black text-blue-700">{examenes.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Pruebas Enviadas</p>
            <p className="text-3xl font-black text-emerald-600">{totalEvaluacionesPresentadas}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">En Curso (Kiosk)</p>
            <p className="text-3xl font-black text-amber-600">{totalEnPresentacion}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Admisiones Activas</p>
            <p className="text-3xl font-black text-purple-700">
              {examenes.filter(e => e.esAdmision && e.estado === 'activo').length}
            </p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Link
              href="/resultados?tipo=todos"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                tipo === 'todos'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos ({examenes.length})
            </Link>
            <Link
              href="/resultados?tipo=regulares"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                tipo === 'regulares'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Exámenes Regulares
            </Link>
            <Link
              href="/resultados?tipo=admisiones"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                tipo === 'admisiones'
                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
            >
              🎓 Admisiones ({examenes.filter(e => e.esAdmision).length})
            </Link>
          </div>

          <form method="GET" action="/resultados" className="flex items-center gap-2">
            <input type="hidden" name="tipo" value={tipo} />
            <div className="relative">
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Buscar examen por título o materia..."
                className="pl-4 pr-9 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition w-64"
              />
              <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                🔍
              </button>
            </div>
          </form>
        </div>

        {/* Exams List Grid */}
        {listaExamenes.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">📭</div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">No se encontraron evaluaciones</h3>
            <p className="text-slate-400 text-sm">
              {query ? 'Prueba con otro término de búsqueda.' : 'Aún no hay exámenes creados en esta categoría.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {listaExamenes.map(ex => {
              const promedioVal = ex.promedio ? Number(ex.promedio).toFixed(1) : '—';
              const tasaAprobacion = ex.enviados > 0
                ? Math.round((ex.aprobados / ex.enviados) * 100)
                : 0;

              return (
                <div
                  key={ex._id}
                  className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 p-5 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {ex.esAdmision && (
                            <span className="bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full border border-purple-200">
                              🎓 Admisión
                            </span>
                          )}
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                            ex.estado === 'activo'
                              ? 'bg-emerald-100 text-emerald-800'
                              : ex.estado === 'cerrado'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {ex.estado === 'activo' ? '🟢 Activo' : ex.estado === 'cerrado' ? '🔴 Cerrado' : ex.estado}
                          </span>
                          {ex.materia && (
                            <span className="text-xs text-slate-500 font-medium">
                              • {ex.materia}
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-slate-800 text-base leading-snug">
                          {ex.titulo}
                        </h3>
                      </div>
                    </div>

                    {/* Stats bar */}
                    <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 my-3 text-center border border-slate-100">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Respuestas</p>
                        <p className="text-base font-extrabold text-slate-800">{ex.enviados}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Promedio</p>
                        <p className={`text-base font-extrabold ${ex.promedio >= 60 ? 'text-emerald-600' : 'text-slate-700'}`}>
                          {promedioVal}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400">Aprobación</p>
                        <p className="text-base font-extrabold text-blue-600">{tasaAprobacion}%</p>
                      </div>
                    </div>

                    {ex.cursos.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 mb-3">
                        <span className="font-bold text-slate-400 text-[11px]">Cursos:</span>
                        {ex.cursos.map(c => (
                          <span key={c} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[11px] font-semibold border border-blue-100">
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">
                      {ex.totalPreguntas} preguntas
                    </span>
                    <Link
                      href={`/resultados/${ex._id}`}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
                    >
                      <span>Ver Resultados y Respuestas</span>
                      <span>→</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
