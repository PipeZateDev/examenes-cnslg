'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface ExamenResultadoItem {
  _id: string;
  titulo: string;
  materia: string;
  esAdmision: boolean;
  estado: string;
  creadoEn: string;
  creadoEnFormatted: string;
  totalPreguntas: number;
  cursos: string[];
  totalIntentos: number;
  enviados: number;
  enProgreso: number;
  promedio: number;
  aprobados: number;
}

interface ResultadosClientProps {
  examenes: ExamenResultadoItem[];
  totalEvaluacionesPresentadas: number;
  totalEnPresentacion: number;
  admisionesActivasCount: number;
}

export default function ResultadosClient({
  examenes,
  totalEvaluacionesPresentadas,
  totalEnPresentacion,
  admisionesActivasCount,
}: ResultadosClientProps) {
  const [busqueda, setBusqueda] = useState('');
  const [tipo, setTipo] = useState<'todos' | 'regulares' | 'admisiones'>('todos');

  const examenesFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return examenes.filter(ex => {
      // Filter by type
      if (tipo === 'regulares' && ex.esAdmision) return false;
      if (tipo === 'admisiones' && !ex.esAdmision) return false;

      // Filter by real-time search query
      if (!q) return true;

      const matchTitulo = ex.titulo.toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));
      const matchEstado = ex.estado.toLowerCase().includes(q);

      return matchTitulo || matchMateria || matchCursos || matchEstado;
    });
  }, [examenes, busqueda, tipo]);

  const totalRegulares = useMemo(() => examenes.filter(e => !e.esAdmision).length, [examenes]);
  const totalAdmisiones = useMemo(() => examenes.filter(e => e.esAdmision).length, [examenes]);

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
              Consulta y filtra en tiempo real los resultados, calificaciones e intentos de cada evaluación.
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
            <p className="text-3xl font-black text-purple-700">{admisionesActivasCount}</p>
          </div>
        </div>

        {/* Real-time Filter & Search Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTipo('todos')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                tipo === 'todos'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Todos ({examenes.length})
            </button>
            <button
              onClick={() => setTipo('regulares')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                tipo === 'regulares'
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Exámenes Regulares ({totalRegulares})
            </button>
            <button
              onClick={() => setTipo('admisiones')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                tipo === 'admisiones'
                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                  : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
              }`}
            >
              🎓 Admisiones ({totalAdmisiones})
            </button>
          </div>

          {/* Real-time search box */}
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en tiempo real por título, materia o curso..."
              className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
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

        {/* Live Filter Counter */}
        {busqueda && (
          <div className="mb-4 text-xs text-slate-500 flex items-center justify-between px-1">
            <span>
              Resultados para &quot;<strong className="text-slate-800">{busqueda}</strong>&quot;: <strong>{examenesFiltrados.length}</strong> encontrados
            </span>
            <button
              onClick={() => setBusqueda('')}
              className="text-blue-600 hover:underline font-semibold text-xs"
            >
              Limpiar filtro
            </button>
          </div>
        )}

        {/* Exams List Grid */}
        {examenesFiltrados.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">📭</div>
            <h3 className="font-bold text-slate-700 text-lg mb-1">No se encontraron evaluaciones</h3>
            <p className="text-slate-400 text-sm">
              {busqueda ? 'No hay exámenes que coincidan con la búsqueda en tiempo real.' : 'Aún no hay exámenes creados en esta categoría.'}
            </p>
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="mt-4 px-4 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-xl hover:bg-blue-100 transition"
              >
                Mostrar todos
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {examenesFiltrados.map(ex => {
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
