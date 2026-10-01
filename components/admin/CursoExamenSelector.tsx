'use client';

import { useState, useEffect, useMemo } from 'react';

export interface ExamenSelectorItem {
  _id: string;
  titulo: string;
  materia?: string;
  estado: string;
  cursos: string[];
  esAdmision?: boolean;
  claveAcceso?: string | null;
}

interface CursoItem {
  _id?: string;
  nombre: string;
}

interface CursoExamenSelectorProps {
  selectedCursos: string[];
  onChangeCursos: (cursos: string[]) => void;
  selectedExamenes: string[];
  onChangeExamenes: (examenes: string[]) => void;
}

export default function CursoExamenSelector({
  selectedCursos,
  onChangeCursos,
  selectedExamenes,
  onChangeExamenes,
}: CursoExamenSelectorProps) {
  const [cursosList, setCursosList] = useState<CursoItem[]>([]);
  const [examenesList, setExamenesList] = useState<ExamenSelectorItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [cursoSearch, setCursoSearch] = useState('');
  const [examenSearch, setExamenSearch] = useState('');
  const [soloActivos, setSoloActivos] = useState(false);
  const [soloCursosSeleccionados, setSoloCursosSeleccionados] = useState(true);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/cursos').then(r => r.json()).catch(() => ({ cursos: [] })),
      fetch('/api/examenes?all=1').then(r => r.json()).catch(() => ({ examenes: [] })),
    ]).then(([cursosRes, examenesRes]) => {
      if (isMounted) {
        setCursosList(cursosRes.cursos || []);
        setExamenesList(examenesRes.examenes || []);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Filtered courses
  const filteredCursos = useMemo(() => {
    const q = cursoSearch.toLowerCase().trim();
    if (!q) return cursosList;
    return cursosList.filter(c => c.nombre.toLowerCase().includes(q));
  }, [cursosList, cursoSearch]);

  // Toggle single course
  const toggleCurso = (nombre: string) => {
    if (selectedCursos.includes(nombre)) {
      onChangeCursos(selectedCursos.filter(c => c !== nombre));
    } else {
      onChangeCursos([...selectedCursos, nombre]);
    }
  };

  const selectAllCursos = () => {
    onChangeCursos(cursosList.map(c => c.nombre));
  };

  const clearAllCursos = () => {
    onChangeCursos([]);
  };

  // Filtered exams according to selected courses, active status & search query
  const filteredExamenes = useMemo(() => {
    const q = examenSearch.toLowerCase().trim();

    return examenesList.filter(ex => {
      if (soloActivos && ex.estado !== 'activo') return false;

      // Filter by selected courses if toggle is active and courses are chosen
      if (soloCursosSeleccionados && selectedCursos.length > 0) {
        const exCursos = ex.cursos || [];
        const matchesAnyCourse = exCursos.some(c => selectedCursos.includes(c));
        const isAdmision = !!ex.esAdmision;
        // If admission is selected as course or regular match
        const matchesAdmissionCourse = isAdmision && selectedCursos.some(c => c.toLowerCase().includes('admisi'));
        if (!matchesAnyCourse && !matchesAdmissionCourse && exCursos.length > 0) {
          return false;
        }
      }

      if (!q) return true;

      const matchTitulo = ex.titulo.toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));

      return matchTitulo || matchMateria || matchCursos;
    });
  }, [examenesList, selectedCursos, soloActivos, soloCursosSeleccionados, examenSearch]);

  // Toggle single exam
  const toggleExamen = (id: string) => {
    if (selectedExamenes.includes(id)) {
      onChangeExamenes(selectedExamenes.filter(e => e !== id));
    } else {
      onChangeExamenes([...selectedExamenes, id]);
    }
  };

  // Mark all currently visible exams
  const selectAllVisibleExamenes = () => {
    const visibleIds = filteredExamenes.map(e => e._id);
    const set = new Set([...selectedExamenes, ...visibleIds]);
    onChangeExamenes(Array.from(set));
  };

  // Clear all exams
  const clearAllExamenes = () => {
    onChangeExamenes([]);
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">Cargando catálogo de cursos y exámenes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* ── 1. SELECTOR DE CURSOS / GRADOS (Listbox) ── */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              🏫 Cursos y Grados Asignados ({selectedCursos.length} seleccionados)
            </label>
            <p className="text-[11px] text-slate-500">
              Selecciona los cursos a los que este docente o usuario tendrá acceso y gestión.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={selectAllCursos}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              Seleccionar todos
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={clearAllCursos}
              className="text-slate-500 hover:text-slate-700 font-semibold hover:underline"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Course search */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            value={cursoSearch}
            onChange={e => setCursoSearch(e.target.value)}
            placeholder="Filtrar cursos..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Listbox of courses */}
        <div className="max-h-44 overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 divide-y divide-slate-100 shadow-inner">
          {filteredCursos.length === 0 ? (
            <p className="text-center py-4 text-xs text-slate-400">No se encontraron cursos.</p>
          ) : (
            filteredCursos.map(c => {
              const isSelected = selectedCursos.includes(c.nombre);
              return (
                <label
                  key={c.nombre}
                  onClick={() => toggleCurso(c.nombre)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition text-xs select-none ${
                    isSelected ? 'bg-blue-50/80 text-blue-900 font-bold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by label onClick
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer pointer-events-none"
                    />
                    <span>Curso {c.nombre}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">
                      ✓ Asignado
                    </span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* ── 2. SELECTOR DE EXÁMENES (Checkboxes dinámicas por curso) ── */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 md:p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase">
              📝 Exámenes Asignados ({selectedExamenes.length} seleccionados)
            </label>
            <p className="text-[11px] text-slate-500">
              Marca con checkbox los exámenes específicos que este usuario puede administrar o evaluar.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={selectAllVisibleExamenes}
              className="text-blue-600 hover:text-blue-800 font-semibold hover:underline"
            >
              Marcar visibles
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={clearAllExamenes}
              className="text-slate-500 hover:text-slate-700 font-semibold hover:underline"
            >
              Desmarcar todos
            </button>
          </div>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
            <input
              type="text"
              value={examenSearch}
              onChange={e => setExamenSearch(e.target.value)}
              placeholder="Buscar examen por título o materia..."
              className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="button"
            onClick={() => setSoloCursosSeleccionados(!soloCursosSeleccionados)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              soloCursosSeleccionados && selectedCursos.length > 0
                ? 'bg-blue-100 text-blue-800 border-blue-300'
                : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {soloCursosSeleccionados && selectedCursos.length > 0
              ? `🎯 Solo exámenes de mis ${selectedCursos.length} cursos`
              : '🌐 Ver todos los exámenes'}
          </button>

          <button
            type="button"
            onClick={() => setSoloActivos(!soloActivos)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              soloActivos ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {soloActivos ? '🟢 Solo Activos' : 'Todos los estados'}
          </button>
        </div>

        {/* Checkbox list of exams */}
        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white p-2 divide-y divide-slate-100 shadow-inner">
          {filteredExamenes.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">
              <p className="font-semibold text-slate-600 mb-0.5">No hay exámenes que coincidan con los filtros</p>
              {soloCursosSeleccionados && selectedCursos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSoloCursosSeleccionados(false)}
                  className="text-blue-600 hover:underline mt-1 inline-block"
                >
                  Ver todos los exámenes disponibles sin filtrar por curso →
                </button>
              )}
            </div>
          ) : (
            filteredExamenes.map(ex => {
              const isChecked = selectedExamenes.includes(ex._id);
              return (
                <label
                  key={ex._id}
                  onClick={() => toggleExamen(ex._id)}
                  className={`flex items-start justify-between p-2.5 rounded-xl cursor-pointer transition gap-3 select-none ${
                    isChecked ? 'bg-purple-50/60 border border-purple-200 shadow-2xs' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {}} // handled by label onClick
                      className="mt-0.5 w-4 h-4 text-purple-600 rounded cursor-pointer pointer-events-none flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {ex.titulo}
                        </span>
                        {ex.materia && (
                          <span className="text-[11px] text-slate-500 font-medium">
                            ({ex.materia})
                          </span>
                        )}
                      </div>

                      {/* Course badges */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {ex.esAdmision && (
                          <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded">
                            🎓 Admisión
                          </span>
                        )}
                        {ex.cursos && ex.cursos.length > 0 ? (
                          ex.cursos.map(c => (
                            <span
                              key={c}
                              className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                                selectedCursos.includes(c)
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Sin cursos asignados</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ex.estado === 'activo'
                        ? 'bg-emerald-100 text-emerald-800'
                        : ex.estado === 'cerrado'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {ex.estado === 'activo' ? '🟢 Activo' : ex.estado === 'cerrado' ? '🔴 Cerrado' : ex.estado}
                    </span>
                    {ex.claveAcceso && ex.estado === 'activo' && (
                      <span className="font-mono text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        🔑 {ex.claveAcceso}
                      </span>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
