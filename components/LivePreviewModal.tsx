'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export interface LiveExamItem {
  _id: string;
  titulo: string;
  materia?: string;
  descripcion?: string;
  estado: string;
  cursos?: string[];
  esAdmision: boolean;
  duracionMinutos?: number | null;
  preguntas?: number;
  creadoPor?: string;
}

interface LivePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  userRol?: string;
}

const ESTADO_BADGES: Record<string, { label: string; color: string }> = {
  activo: { label: 'Activo ✓', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  aprobado: { label: 'Aprobado', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  borrador: { label: 'Borrador', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  cerrado: { label: 'Cerrado', color: 'bg-red-500/20 text-red-300 border-red-500/40' },
  pendiente_aprobacion: { label: 'Pendiente', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
};

export default function LivePreviewModal({ isOpen, onClose, userRol }: LivePreviewModalProps) {
  const router = useRouter();
  const [examenes, setExamenes] = useState<LiveExamItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [tab, setTab] = useState<'todas' | 'admision' | 'regular' | 'activas'>('todas');

  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    async function loadExams() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch('/api/examenes?all=1');
        if (!res.ok) {
          throw new Error('No se pudo cargar la lista de exámenes.');
        }
        const data = await res.json();
        if (mounted) {
          setExamenes(data.examenes || []);
          setLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err.message || 'Error al cargar exámenes.');
          setLoading(false);
        }
      }
    }

    loadExams();

    return () => {
      mounted = false;
    };
  }, [isOpen]);

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return examenes.filter(ex => {
      // Tab filter
      if (tab === 'admision' && !ex.esAdmision) return false;
      if (tab === 'regular' && ex.esAdmision) return false;
      if (tab === 'activas' && ex.estado !== 'activo' && ex.estado !== 'aprobado') return false;

      // Text query
      if (!q) return true;
      const matchTitulo = (ex.titulo || '').toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));

      return matchTitulo || matchMateria || matchCursos;
    });
  }, [examenes, busqueda, tab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-2xl shadow-inner">
              👁️
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                <span>Vista en Vivo Alumno</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-bold px-2.5 py-0.5 rounded-full border border-emerald-500/40">
                  Simulador 100% Real
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Selecciona la prueba que deseas ver y resolver en tiempo real como estudiante. Sin traza en base de datos.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-lg font-bold transition cursor-pointer border border-slate-700"
          >
            ✕
          </button>
        </div>

        {/* Search and Tabs */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700 w-full sm:w-auto overflow-x-auto">
            <button
              onClick={() => setTab('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'todas'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas ({examenes.length})
            </button>
            <button
              onClick={() => setTab('admision')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'admision'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Admisiones ({examenes.filter(e => e.esAdmision).length})
            </button>
            <button
              onClick={() => setTab('regular')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'regular'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Regulares ({examenes.filter(e => !e.esAdmision).length})
            </button>
            <button
              onClick={() => setTab('activas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                tab === 'activas'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Activas / Aprobadas
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar por título, materia..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Exams List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 max-h-[55vh]">
          {loading ? (
            <div className="py-16 text-center">
              <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Cargando catálogo de pruebas disponibles...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-center text-sm">
              {error}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <span className="text-4xl block mb-2">📭</span>
              <p className="text-sm font-medium">No se encontraron exámenes para el filtro seleccionado.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filtrados.map(ex => {
                const badge = ESTADO_BADGES[ex.estado] || { label: ex.estado, color: 'bg-slate-800 text-slate-400 border-slate-700' };
                return (
                  <div
                    key={ex._id}
                    className="bg-slate-800/70 border border-slate-700/80 hover:border-blue-500/60 rounded-xl p-4 transition-all duration-200 flex flex-col justify-between group hover:bg-slate-800"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                        {ex.esAdmision ? (
                          <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full">
                            Admisión
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">
                            Regular
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-slate-100 text-sm group-hover:text-blue-300 transition-colors line-clamp-2 leading-snug">
                        {ex.titulo}
                      </h3>

                      {ex.materia && (
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                          <span>📚</span>
                          <span className="font-medium text-slate-300">{ex.materia}</span>
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-3 text-[11px] text-slate-400">
                        <span>❓ {ex.preguntas || 0} preguntas</span>
                        {ex.duracionMinutos && <span>⏱️ {ex.duracionMinutos} min</span>}
                        {ex.cursos && ex.cursos.length > 0 && (
                          <span className="truncate">👥 {ex.cursos.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-end">
                      <Link
                        href={`/examen/${ex._id}/presentar`}
                        onClick={onClose}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition shadow-md shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer text-center"
                      >
                        <span>👁️ Probar Examen en Vivo</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>💡 En la vista en vivo podrás salir en cualquier momento usando el botón de la barra superior.</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-semibold transition cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
