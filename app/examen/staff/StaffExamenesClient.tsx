'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { StaffExamenItem } from './page';

interface Props {
  examenes: StaffExamenItem[];
  user: {
    nombre: string;
    rol: string;
    userId: string;
  };
}

const ROL_LABELS: Record<string, string> = {
  admin: '👑 Administrador',
  directivo: '🏛️ Directivo',
  coordinador: '📋 Coordinador',
  supervisor: '👁️ Supervisor',
  docente: '👩‍🏫 Docente',
  estudiante: '🎓 Estudiante',
};

const ESTADO_BADGES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  activo: { label: '🟢 Activo (En Vivo)', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-300' },
  aprobado: { label: '✅ Aprobado', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-300' },
  borrador: { label: '📝 Borrador', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-300' },
  pendiente_aprobacion: { label: '⏳ Pendiente Aprobación', bg: 'bg-orange-50', text: 'text-orange-800', border: 'border-orange-300' },
  cerrado: { label: '🔴 Cerrado', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
};

export default function StaffExamenesClient({ examenes, user }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [seccionTab, setSeccionTab] = useState<'todas' | 'colegio' | 'admision'>('todas');
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [filtroCurso, setFiltroCurso] = useState<string>('todos');
  const [loggingOut, setLoggingOut] = useState(false);

  // Extract unique courses across exams for filter dropdown
  const cursosDisponibles = useMemo(() => {
    const set = new Set<string>();
    examenes.forEach(ex => {
      (ex.cursos || []).forEach(c => set.add(c));
    });
    return Array.from(set).sort();
  }, [examenes]);

  // Filtered exams
  const examenesFiltrados = useMemo(() => {
    return examenes.filter(ex => {
      // 1. Search filter
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const matchTitulo = (ex.titulo || '').toLowerCase().includes(q);
        const matchMateria = (ex.materia || '').toLowerCase().includes(q);
        const matchDesc = (ex.descripcion || '').toLowerCase().includes(q);
        const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));
        if (!matchTitulo && !matchMateria && !matchDesc && !matchCursos) {
          return false;
        }
      }

      // 2. Section Tab
      if (seccionTab === 'colegio' && ex.esAdmision) return false;
      if (seccionTab === 'admision' && !ex.esAdmision) return false;

      // 3. State filter
      if (filtroEstado !== 'todos') {
        if (filtroEstado === 'borrador_pendiente') {
          if (!['borrador', 'pendiente_aprobacion'].includes(ex.estado)) return false;
        } else if (ex.estado !== filtroEstado) {
          return false;
        }
      }

      // 4. Course filter
      if (filtroCurso !== 'todos') {
        if (!ex.cursos.includes(filtroCurso)) return false;
      }

      return true;
    });
  }, [examenes, busqueda, seccionTab, filtroEstado, filtroCurso]);

  const handleExitApp = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.closeApp) {
      (window as any).electronAPI.closeApp();
    } else {
      router.push('/dashboard');
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    router.push('/examen/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-slate-100 flex flex-col">
      {/* ─── Top Header Bar ─────────────────────────────────────────── */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-700/80 px-6 py-4 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center p-1 shadow-md">
              <img
                src="/logo-cnslg.png"
                alt="CNSLG"
                className="w-9 h-9 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
              />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg leading-tight tracking-tight flex items-center gap-2">
                <span>Catálogo de Pruebas</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  Vista en Vivo Alumno
                </span>
              </h1>
              <p className="text-slate-400 text-xs">Colegio Nuevo San Luis Gonzaga — Plataforma Oficial</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* User Info Badge */}
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-1.5 text-right">
              <p className="text-xs font-bold text-slate-200">{user.nombre}</p>
              <p className="text-[11px] text-emerald-400 font-medium">{ROL_LABELS[user.rol] || user.rol}</p>
            </div>

            {/* Link to Full Web Dashboard */}
            <Link
              href="/dashboard"
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              title="Ir al panel web de administración y configuración"
            >
              <span>📊</span>
              <span>Panel Web</span>
            </Link>

            {/* Close Desktop App */}
            <button
              onClick={handleExitApp}
              className="bg-red-600 hover:bg-red-500 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-md shadow-red-600/20"
              title="Cerrar la aplicación de escritorio"
            >
              <span>🚪</span>
              <span>Salir de la App</span>
            </button>

            {/* Logout button */}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium px-3 py-2 rounded-xl text-xs border border-slate-700 transition"
              title="Cerrar sesión"
            >
              {loggingOut ? 'Saliendo...' : '🔒 Cerrar Sesión'}
            </button>
          </div>
        </div>
      </header>

      {/* ─── Main Content Container ─────────────────────────────────── */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1">
        {/* Info Banner */}
        <div className="bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border border-blue-500/30 rounded-2xl p-5 mb-8 shadow-md">
          <div className="flex items-start gap-4">
            <span className="text-3xl flex-shrink-0">✨</span>
            <div className="flex-1">
              <h2 className="font-bold text-white text-base mb-1">
                Visualización e Interacción en Tiempo Real
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Selecciona cualquier prueba para presentarla <strong>exactamente como la ve un estudiante</strong> (con diagramas, navegación y cronómetro).
                Para tu rol (<span className="text-emerald-300 font-semibold">{ROL_LABELS[user.rol]}</span>), <strong>no se requiere clave de examen</strong>, puedes salir de la prueba en cualquier momento para mirar otras, y tus respuestas de prueba <strong>no alterarán la base de datos de producción</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Filters & Search Toolbar ───────────────────────────────── */}
        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-5 mb-8 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
            {/* Search Input */}
            <div className="relative w-full md:w-96">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-base pointer-events-none">
                🔍
              </span>
              <input
                type="text"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar por título, materia o curso..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {busqueda && (
                <button
                  onClick={() => setBusqueda('')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Section Tabs (Todas / Colegio / Admisión) */}
            <div className="flex items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-700 w-full md:w-auto overflow-x-auto">
              <button
                onClick={() => setSeccionTab('todas')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  seccionTab === 'todas'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Todas ({examenes.length})
              </button>
              <button
                onClick={() => setSeccionTab('colegio')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  seccionTab === 'colegio'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🏫 Pruebas Colegio ({examenes.filter(e => !e.esAdmision).length})
              </button>
              <button
                onClick={() => setSeccionTab('admision')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  seccionTab === 'admision'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                📋 Admisiones ({examenes.filter(e => e.esAdmision).length})
              </button>
            </div>
          </div>

          {/* Secondary Filter Pills (State & Course) */}
          <div className="flex items-center justify-between gap-4 flex-wrap pt-3 border-t border-slate-700/60 text-xs">
            {/* State filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-semibold">Estado:</span>
              {[
                { id: 'todos', label: 'Todos' },
                { id: 'activo', label: '🟢 Activos' },
                { id: 'aprobado', label: '✅ Aprobados' },
                { id: 'borrador_pendiente', label: '📝 Borradores / Pendientes' },
                { id: 'cerrado', label: '🔴 Cerrados' },
              ].map(st => (
                <button
                  key={st.id}
                  onClick={() => setFiltroEstado(st.id)}
                  className={`px-3 py-1 rounded-lg font-medium transition border ${
                    filtroEstado === st.id
                      ? 'bg-slate-700 text-white border-slate-500 shadow-xs'
                      : 'bg-slate-900/50 text-slate-400 border-slate-800 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Course Filter Dropdown */}
            {cursosDisponibles.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-semibold">Curso:</span>
                <select
                  value={filtroCurso}
                  onChange={e => setFiltroCurso(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="todos">Todos los Cursos</option>
                  {cursosDisponibles.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ─── Exam Cards Grid ────────────────────────────────────────── */}
        {examenesFiltrados.length === 0 ? (
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-3xl p-12 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h3 className="text-lg font-bold text-white mb-2">No se encontraron pruebas</h3>
            <p className="text-slate-400 text-sm max-w-md mx-auto mb-6">
              No hay evaluaciones que coincidan con los filtros seleccionados o con tu nivel de permisos.
            </p>
            <button
              onClick={() => {
                setBusqueda('');
                setSeccionTab('todas');
                setFiltroEstado('todos');
                setFiltroCurso('todos');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition"
            >
              Restablecer Filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {examenesFiltrados.map(ex => {
              const badge = ESTADO_BADGES[ex.estado] || {
                label: ex.estado,
                bg: 'bg-slate-800',
                text: 'text-slate-300',
                border: 'border-slate-700',
              };

              const canEdit = ['admin', 'directivo'].includes(user.rol) ||
                              ex.creadoPor === user.userId ||
                              ['coordinador', 'docente'].includes(user.rol);

              return (
                <div
                  key={ex._id}
                  className="bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 hover:border-blue-500/50 rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 shadow-xl group"
                >
                  <div>
                    {/* Header: Badges */}
                    <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.label}
                      </span>

                      {ex.esAdmision ? (
                        <span className="text-[11px] bg-purple-900/60 text-purple-200 border border-purple-500/40 font-bold px-2.5 py-0.5 rounded-full">
                          📋 Admisión
                        </span>
                      ) : (
                        <span className="text-[11px] bg-blue-900/60 text-blue-200 border border-blue-500/40 font-bold px-2.5 py-0.5 rounded-full">
                          🏫 Colegio
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-white font-bold text-lg mb-1 leading-snug group-hover:text-blue-400 transition-colors">
                      {ex.titulo}
                    </h3>

                    {/* Subject / Materia */}
                    {ex.materia && (
                      <p className="text-xs text-blue-300 font-semibold mb-3">
                        📚 {ex.materia}
                      </p>
                    )}

                    {/* Description if any */}
                    {ex.descripcion && (
                      <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                        {ex.descripcion}
                      </p>
                    )}

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 text-xs mb-4">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Preguntas:</span>
                        <span className="font-bold text-slate-200 text-sm">
                          {ex.preguntasCount} {ex.preguntasCount === 1 ? 'ítem' : 'ítems'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Duración:</span>
                        <span className="font-bold text-slate-200 text-sm">
                          {ex.duracionMinutos ? `${ex.duracionMinutos} min` : 'Sin límite'}
                        </span>
                      </div>
                    </div>

                    {/* Courses tags */}
                    {Array.isArray(ex.cursos) && ex.cursos.length > 0 && (
                      <div className="mb-4">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                          Cursos asignados:
                        </span>
                        <div className="flex flex-wrap gap-1.5 max-h-16 overflow-y-auto">
                          {ex.cursos.map(c => (
                            <span
                              key={c}
                              className="bg-slate-700/80 text-slate-200 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-slate-600/60"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons Footer */}
                  <div className="pt-4 border-t border-slate-700/60 flex flex-col gap-2">
                    {/* Primary Button: Present / Live Preview */}
                    <Link
                      href={`/examen/${ex._id}/presentar`}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-center text-sm transition shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 group-hover:scale-[1.01]"
                    >
                      <span>👁️ Abrir Prueba en Vivo (Alumno)</span>
                      <span>→</span>
                    </Link>

                    {/* Secondary Button: Edit in Web Panel */}
                    {canEdit && (
                      <Link
                        href={`/examenes/${ex._id}`}
                        className="w-full bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold py-2 rounded-xl text-center text-xs border border-slate-600/50 transition flex items-center justify-center gap-1.5"
                      >
                        <span>✏️ Configurar / Editar en Panel Web</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ─── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-slate-900/90 border-t border-slate-800 text-center py-4 text-xs text-slate-500">
        <p>Colegio Nuevo San Luis Gonzaga — Plataforma de Evaluaciones Oficial</p>
      </footer>
    </div>
  );
}
