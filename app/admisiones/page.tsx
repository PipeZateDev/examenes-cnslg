import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { hoy } from '@/lib/utils';
import Link from 'next/link';

export default async function AdmisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string }>;
}) {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const params = await searchParams;
  const estadoFilter = params.estado || '';
  const query = params.q?.toLowerCase().trim() || '';

  const db = await getDb();
  const filter: Record<string, unknown> = { esAdmision: true };
  if (estadoFilter) filter.estado = estadoFilter;

  const [examenes, claveDoc] = await Promise.all([
    db.collection('ex_examenes')
      .find(filter)
      .sort({ creadoEn: -1 })
      .toArray(),
    db.collection('ex_clave_dia').findOne({ fecha: hoy() }),
  ]);

  const examenesClaves = (claveDoc?.examenesClaves as Array<{ examenId: string; clave: string }>) || [];

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

  const lista = examenes.map(ex => {
    const idStr = ex._id.toString();
    const claveEntry = examenesClaves.find(k => k.examenId === idStr);
    const key = claveEntry?.clave || (ex.estado === 'activo' ? (ex.claveAcceso as string) : null);
    const st = statsMap.get(idStr) || { totalIntentos: 0, enviados: 0, promedio: null };
    return {
      _id: idStr,
      titulo: ex.titulo as string,
      materia: (ex.materia as string) || 'Evaluación Integral de Admisión',
      estado: (ex.estado as string) || 'borrador',
      duracionMinutos: ex.duracionMinutos as number | null,
      cursos: (ex.cursos as string[]) || [],
      totalPreguntas: Array.isArray(ex.preguntas) ? ex.preguntas.length : 0,
      claveActiva: key,
      totalIntentos: st.totalIntentos,
      enviados: st.enviados,
      promedio: st.promedio,
    };
  }).filter(ex => {
    if (!query) return true;
    return ex.titulo.toLowerCase().includes(query) || ex.materia.toLowerCase().includes(query);
  });

  const ESTADO_LABELS: Record<string, string> = {
    borrador: '📝 Borrador',
    pendiente_aprobacion: '⏳ Pendiente Aprobación',
    aprobado: '✅ Aprobado',
    activo: '🟢 Activo',
    cerrado: '🔴 Cerrado',
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Admisiones</span>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-800">
                📋 Módulo de Admisiones y Pruebas Diagnósticas
              </h1>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Evaluaciones integrales con ponderación independiente por las 5 áreas básicas (Matemáticas, Español, Ciencias, Sociales e Inglés).
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/examenes/nuevo"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition shadow-xs flex items-center gap-1.5"
            >
              <span>+ Nuevo Examen de Admisión</span>
            </Link>
          </div>
        </div>

        {/* Areas Banner */}
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 rounded-3xl p-6 mb-6 text-white shadow-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <span className="bg-purple-500/30 text-purple-200 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full border border-purple-400/30 inline-block mb-2">
                Sistema Especializado de Admisión
              </span>
              <h2 className="text-xl font-bold">Evaluación por Áreas Fundamentales</h2>
              <p className="text-purple-200 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                Cada área se califica sobre 100% de manera autónoma. La IA agrupa y clasifica automáticamente las preguntas según su disciplina temática al procesar los documentos Word o PDF.
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {['Matemáticas', 'Español', 'C. Naturales', 'C. Sociales', 'Inglés'].map(area => (
                <span key={area} className="bg-white/10 border border-white/20 px-3 py-1 rounded-xl text-xs font-semibold backdrop-blur-xs">
                  ✓ {area}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {['', 'activo', 'aprobado', 'pendiente_aprobacion', 'borrador', 'cerrado'].map(st => (
              <Link
                key={st}
                href={`/admisiones?${st ? `estado=${st}` : ''}`}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                  estadoFilter === st
                    ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st ? ESTADO_LABELS[st] || st : 'Todos los Estados'}
              </Link>
            ))}
          </div>

          <form method="GET" action="/admisiones" className="relative">
            <input type="hidden" name="estado" value={estadoFilter} />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Buscar prueba de admisión..."
              className="pl-4 pr-8 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white transition w-56"
            />
            <button type="submit" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
              🔍
            </button>
          </form>
        </div>

        {/* Admissions Exam Cards */}
        {lista.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">🎓</div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">No hay exámenes de admisión registrados</h3>
            <p className="text-slate-400 text-sm mb-4">
              Crea tu primer examen de admisión subiendo el archivo de Word o PDF en minutos.
            </p>
            <Link
              href="/examenes/nuevo"
              className="inline-block px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl transition shadow-sm"
            >
              + Crear Examen de Admisión
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {lista.map(ex => (
              <div
                key={ex._id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 p-5 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="bg-purple-100 text-purple-800 font-bold text-[11px] px-2.5 py-0.5 rounded-full border border-purple-200">
                          🎓 Admisión
                        </span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          ex.estado === 'activo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ex.estado === 'cerrado'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {ESTADO_LABELS[ex.estado] || ex.estado}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base leading-snug">
                        {ex.titulo}
                      </h3>
                      {ex.materia && (
                        <p className="text-xs text-slate-500 mt-0.5">{ex.materia}</p>
                      )}
                    </div>

                    {ex.claveActiva && (
                      <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-2.5 text-center flex-shrink-0">
                        <p className="text-[10px] font-bold uppercase text-emerald-700 leading-none">Clave Hoy</p>
                        <p className="text-lg font-mono font-black text-emerald-900 tracking-widest mt-0.5">
                          {ex.claveActiva}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-xl p-3 my-3 text-center border border-slate-100">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Preguntas</p>
                      <p className="text-base font-extrabold text-slate-800">{ex.totalPreguntas}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Aspirantes</p>
                      <p className="text-base font-extrabold text-slate-800">{ex.enviados}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-slate-400">Promedio</p>
                      <p className={`text-base font-extrabold ${ex.promedio !== null && ex.promedio >= 60 ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {ex.promedio !== null ? `${Number(ex.promedio).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                  </div>

                  {ex.cursos.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap text-xs text-slate-500 mb-3">
                      <span className="font-bold text-slate-400 text-[11px]">Nivel/Grado:</span>
                      {ex.cursos.map(c => (
                        <span key={c} className="bg-purple-50 text-purple-800 px-2 py-0.5 rounded text-[11px] font-semibold border border-purple-100">
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <Link
                    href={`/examenes/${ex._id}`}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition"
                  >
                    ⚙️ Parámetros
                  </Link>
                  <Link
                    href={`/resultados/${ex._id}`}
                    className="px-4 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1"
                  >
                    <span>📊 Ver Resultados</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
