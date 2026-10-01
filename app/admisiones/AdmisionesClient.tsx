'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface AdmisionItem {
  _id: string;
  titulo: string;
  materia?: string;
  estado: string;
  creadoEn: string;
  totalPreguntas: number;
  cursos: string[];
  claveActiva: string | null;
  activadoPor?: string;
  activadoEn?: string;
  activadoEnFormatted?: string;
  totalIntentos: number;
  enviados: number;
  promedio: number | null;
}

interface AdmisionesClientProps {
  initialExamenes: AdmisionItem[];
  esCoordinadorOPlus: boolean;
  activeTodayCount: number;
  totalAspirantesEvaluados: number;
}

const ESTADO_LABELS: Record<string, string> = {
  borrador: '📝 Borrador',
  pendiente_aprobacion: '⏳ Pendiente Aprobación',
  aprobado: '✅ Aprobado',
  activo: '🟢 Activo',
  cerrado: '🔴 Cerrado',
};

export default function AdmisionesClient({
  initialExamenes,
  esCoordinadorOPlus,
  activeTodayCount,
  totalAspirantesEvaluados,
}: AdmisionesClientProps) {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const lista = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return initialExamenes.filter(ex => {
      // Filter by estado
      if (estadoFilter && ex.estado !== estadoFilter) return false;

      // Filter by real-time search query
      if (!q) return true;

      const matchTitulo = ex.titulo.toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchClave = (ex.claveActiva || '').toLowerCase().includes(q);
      const matchActivador = (ex.activadoPor || '').toLowerCase().includes(q);
      const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));

      return matchTitulo || matchMateria || matchClave || matchActivador || matchCursos;
    });
  }, [initialExamenes, busqueda, estadoFilter]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Breadcrumb & Title */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Admisiones</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              🎓 Pruebas de Diagnóstico y Admisión
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Evaluaciones diagnósticas para nuevos aspirantes con desglose estructurado en 5 áreas de conocimiento.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/examenes/nuevo"
              className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <span>+ Nueva Prueba de Admisión</span>
            </Link>
          </div>
        </div>

        {/* Global Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Pruebas Registradas</p>
            <p className="text-3xl font-black text-purple-800">{initialExamenes.length}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Activas Hoy (Con Clave)</p>
            <p className="text-3xl font-black text-emerald-600">{activeTodayCount}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Aspirantes Evaluados</p>
            <p className="text-3xl font-black text-blue-700">{totalAspirantesEvaluados}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Áreas Evaluadas</p>
            <p className="text-3xl font-black text-indigo-600">5</p>
          </div>
        </div>

        {/* Real-time Filter & Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {['', 'activo', 'aprobado', 'pendiente_aprobacion', 'borrador', 'cerrado'].map(st => (
              <button
                key={st}
                onClick={() => setEstadoFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  estadoFilter === st
                    ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {st ? ESTADO_LABELS[st] || st : 'Todos los Estados'}
              </button>
            ))}
          </div>

          {/* Real-time search box */}
          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en tiempo real..."
              className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white transition"
              autoComplete="off"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 leading-none rounded-md"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live Search Indicator */}
        {busqueda && (
          <div className="mb-4 text-xs text-slate-500 flex items-center justify-between px-1">
            <span>
              Resultados para &quot;<strong className="text-slate-800">{busqueda}</strong>&quot;: <strong>{lista.length}</strong> encontrados
            </span>
            <button
              onClick={() => setBusqueda('')}
              className="text-purple-700 hover:underline font-semibold text-xs"
            >
              Limpiar filtro
            </button>
          </div>
        )}

        {/* Admissions Exam Cards */}
        {lista.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">🎓</div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">No se encontraron pruebas de admisión</h3>
            <p className="text-slate-400 text-sm mb-4">
              {busqueda ? 'Ninguna prueba coincide con la búsqueda en tiempo real.' : 'Crea tu primer examen de admisión subiendo el archivo de Word o PDF en minutos.'}
            </p>
            {busqueda ? (
              <button
                onClick={() => setBusqueda('')}
                className="px-4 py-1.5 bg-purple-50 text-purple-700 font-semibold text-xs rounded-xl hover:bg-purple-100 transition"
              >
                Mostrar todos
              </button>
            ) : (
              <Link
                href="/examenes/nuevo"
                className="inline-block px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-sm font-bold rounded-xl transition shadow-sm"
              >
                + Crear Examen de Admisión
              </Link>
            )}
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

                      {esCoordinadorOPlus && ex.activadoPor && (
                        <p className="mt-1.5 inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-md font-semibold text-[11px]">
                          <span>🔑</span>
                          <span>Activado por: <strong>{ex.activadoPor}</strong></span>
                          {ex.activadoEnFormatted && (
                            <span className="text-emerald-600/80 font-normal">
                              ({ex.activadoEnFormatted})
                            </span>
                          )}
                        </p>
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
