'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface ExamenListItem {
  _id: string;
  titulo: string;
  materia?: string;
  estado: string;
  creadoEn: string;
  creadoEnFormatted: string;
  esAdmision: boolean;
  claveAcceso?: string | null;
  activadoPor?: string;
  activadoEn?: string;
  activadoEnFormatted?: string;
}

interface ExamenesClientProps {
  examenes: ExamenListItem[];
  esAdmision: boolean;
  esCoordinadorOPlus: boolean;
}

const ESTADO_COLORS: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  pendiente_aprobacion: 'bg-amber-100 text-amber-700',
  aprobado: 'bg-blue-100 text-blue-700',
  activo: 'bg-green-100 text-green-700',
  cerrado: 'bg-red-100 text-red-600',
};

const ESTADO_LABELS: Record<string, string> = {
  borrador: 'Borrador',
  pendiente_aprobacion: 'Pendiente Aprobación',
  aprobado: 'Aprobado',
  activo: 'Activo ✓',
  cerrado: 'Cerrado',
};

export default function ExamenesClient({
  examenes,
  esAdmision,
  esCoordinadorOPlus,
}: ExamenesClientProps) {
  const [busqueda, setBusqueda] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return examenes.filter(ex => {
      // Filter by estado
      if (estadoFilter && ex.estado !== estadoFilter) return false;

      // Filter by real-time search query
      if (!q) return true;

      const matchTitulo = ex.titulo.toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchClave = (ex.claveAcceso || '').toLowerCase().includes(q);
      const matchActivador = (ex.activadoPor || '').toLowerCase().includes(q);
      const matchEstado = ex.estado.toLowerCase().includes(q);

      return matchTitulo || matchMateria || matchClave || matchActivador || matchEstado;
    });
  }, [examenes, busqueda, estadoFilter]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-blue-600 hover:underline text-sm font-medium">
              ← Dashboard
            </Link>
            <h1 className="font-bold text-slate-800 text-2xl">
              {esAdmision ? '📋 Exámenes de Admisión' : '📝 Exámenes'}
            </h1>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/examenes?admision=0"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                !esAdmision
                  ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                  : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50'
              }`}
            >
              Regulares
            </Link>
            <Link
              href="/examenes?admision=1"
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                esAdmision
                  ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                  : 'bg-white text-purple-700 border-purple-300 hover:bg-purple-50'
              }`}
            >
              Admisiones
            </Link>
            <Link
              href="/examenes/nuevo"
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1"
            >
              <span>+ Nuevo Examen</span>
            </Link>
          </div>
        </div>

        {/* Filter and Real-Time Search bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex gap-2 flex-wrap items-center">
            {['', 'borrador', 'pendiente_aprobacion', 'aprobado', 'activo', 'cerrado'].map(e => (
              <button
                key={e}
                onClick={() => setEstadoFilter(e)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  estadoFilter === e
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {e ? ESTADO_LABELS[e] || e : 'Todos'}
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

        {/* Live Filter Indicator */}
        {busqueda && (
          <div className="mb-4 text-xs text-slate-500 flex items-center justify-between px-1">
            <span>
              Resultados para &quot;<strong className="text-slate-800">{busqueda}</strong>&quot;: <strong>{filtrados.length}</strong> encontrados
            </span>
            <button
              onClick={() => setBusqueda('')}
              className="text-blue-600 hover:underline font-semibold text-xs"
            >
              Limpiar filtro
            </button>
          </div>
        )}

        {/* Exams list */}
        {filtrados.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm font-medium">
              {busqueda ? 'No se encontraron exámenes que coincidan con la búsqueda en tiempo real.' : 'No hay exámenes en esta categoría.'}
            </p>
            {busqueda ? (
              <button
                onClick={() => setBusqueda('')}
                className="mt-4 px-4 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-xl hover:bg-blue-100 transition"
              >
                Mostrar todos
              </button>
            ) : (
              <Link href="/examenes/nuevo" className="mt-4 inline-block text-blue-600 hover:underline text-sm font-semibold">
                Crear el primer examen →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(ex => (
              <Link
                key={ex._id}
                href={`/examenes/${ex._id}`}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 p-5 flex items-center justify-between transition group flex-wrap gap-4"
              >
                <div className="flex-1 min-w-[280px]">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition text-base">
                      {ex.titulo}
                    </h3>
                    {ex.materia && (
                      <span className="text-xs text-slate-500 font-medium">({ex.materia})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span>
                      📅 Creado: {ex.creadoEnFormatted}
                    </span>

                    {/* Show who activated the code for Coordinador and above */}
                    {esCoordinadorOPlus && ex.activadoPor && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-md font-semibold text-[11px]">
                        <span>🔑</span>
                        <span>Activado por: <strong>{ex.activadoPor}</strong></span>
                        {ex.activadoEnFormatted && (
                          <span className="text-emerald-600/80 font-normal">
                            ({ex.activadoEnFormatted})
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {ex.claveAcceso && ex.estado === 'activo' && (
                    <span className="font-mono text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                      Clave: {ex.claveAcceso}
                    </span>
                  )}
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[ex.estado] || 'bg-gray-100 text-gray-500'}`}>
                    {ESTADO_LABELS[ex.estado] || ex.estado}
                  </span>
                  <span className="text-slate-400 text-lg group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
