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

// Educational grade sorter: Preescolar -> Primaria (101..) -> Bachillerato (601..1102) -> Admisiones
function parseCourseOrder(nombre: string): number {
  const norm = nombre.toLowerCase().trim().replace(/^(curso|grado)\s+/i, '');

  if (norm.includes('párvulo') || norm.includes('parvulo')) return 10;
  if (norm.includes('pre-jardín') || norm.includes('prejardin') || norm.includes('pre jardín') || norm.includes('pre jardin')) return 20;
  if (norm.includes('jardín') || norm.includes('jardin')) return 30;
  if (norm.includes('kinder') || norm.includes('kínder')) return 40;
  if (norm.includes('transición') || norm.includes('transicion')) return 50;

  // Numeric starting grades like 101, 102, 201, 1101, 1102
  const numMatch = norm.match(/^(\d+)/);
  if (numMatch) {
    return 1000 + parseInt(numMatch[1], 10);
  }

  if (norm.includes('primero') || norm.includes('1°') || norm.includes('1-')) return 1100;
  if (norm.includes('segundo') || norm.includes('2°') || norm.includes('2-')) return 1200;
  if (norm.includes('tercero') || norm.includes('3°') || norm.includes('3-')) return 1300;
  if (norm.includes('cuarto') || norm.includes('4°') || norm.includes('4-')) return 1400;
  if (norm.includes('quinto') || norm.includes('5°') || norm.includes('5-')) return 1500;
  if (norm.includes('sexto') || norm.includes('6°') || norm.includes('6-')) return 1600;
  if (norm.includes('séptimo') || norm.includes('septimo') || norm.includes('7°') || norm.includes('7-')) return 1700;
  if (norm.includes('octavo') || norm.includes('8°') || norm.includes('8-')) return 1800;
  if (norm.includes('noveno') || norm.includes('9°') || norm.includes('9-')) return 1900;
  if (norm.includes('décimo') || norm.includes('decimo') || norm.includes('10°') || norm.includes('10-')) return 2000;
  if (norm.includes('once') || norm.includes('11°') || norm.includes('11-')) return 2100;

  if (norm.includes('admisi')) return 8000;
  return 9000;
}

// Clean course display name (removes redundant "Curso " or "Grado ")
function cleanCourseName(nombre: string): string {
  if (!nombre) return '';
  return nombre.replace(/^(curso|grado)\s+/i, '').trim();
}

const DEFAULT_CNSLG_COURSES = [
  'Kinder', 'Transición',
  '101', '201', '301', '401', '501',
  '601', '701', '801', '901',
  '1001', '1101', '1102',
  'Admisiones'
];

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
  const [mostrarTodosExamenes, setMostrarTodosExamenes] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch('/api/cursos').then(r => r.json()).catch(() => ({ cursos: [] })),
      fetch('/api/examenes?all=1').then(r => r.json()).catch(() => ({ examenes: [] })),
    ]).then(([cursosRes, examenesRes]) => {
      if (!isMounted) return;

      const loadedCourses: CursoItem[] = cursosRes.cursos || [];
      // Combine with standard courses to ensure full grade coverage
      const existingNames = new Set(loadedCourses.map(c => cleanCourseName(c.nombre).toLowerCase()));
      const combined = [...loadedCourses];

      DEFAULT_CNSLG_COURSES.forEach(defName => {
        if (!existingNames.has(defName.toLowerCase())) {
          combined.push({ nombre: defName });
        }
      });

      setCursosList(combined);
      setExamenesList(examenesRes.examenes || []);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Sorted and filtered courses (3 columns)
  const sortedAndFilteredCursos = useMemo(() => {
    const q = cursoSearch.toLowerCase().trim();

    const sorted = [...cursosList].sort((a, b) => {
      const nameA = cleanCourseName(a.nombre);
      const nameB = cleanCourseName(b.nombre);
      const orderA = parseCourseOrder(nameA);
      const orderB = parseCourseOrder(nameB);
      if (orderA !== orderB) return orderA - orderB;
      return nameA.localeCompare(nameB, 'es', { numeric: true });
    });

    if (!q) return sorted;
    return sorted.filter(c => cleanCourseName(c.nombre).toLowerCase().includes(q));
  }, [cursosList, cursoSearch]);

  // Toggle single course (robust button handler)
  const toggleCurso = (rawNombre: string) => {
    const clean = cleanCourseName(rawNombre);
    const isCurrentlySelected = selectedCursos.some(
      c => cleanCourseName(c).toLowerCase() === clean.toLowerCase()
    );

    if (isCurrentlySelected) {
      onChangeCursos(
        selectedCursos.filter(c => cleanCourseName(c).toLowerCase() !== clean.toLowerCase())
      );
    } else {
      onChangeCursos([...selectedCursos, clean]);
    }
  };

  const selectAllCursos = () => {
    const all = sortedAndFilteredCursos.map(c => cleanCourseName(c.nombre));
    const set = new Set([...selectedCursos, ...all]);
    onChangeCursos(Array.from(set));
  };

  const clearAllCursos = () => {
    onChangeCursos([]);
  };

  // Filtered exams according to selected courses
  const filteredExamenes = useMemo(() => {
    const q = examenSearch.toLowerCase().trim();
    const selectedCleanSet = new Set(selectedCursos.map(c => cleanCourseName(c).toLowerCase()));

    return examenesList.filter(ex => {
      if (soloActivos && ex.estado !== 'activo') return false;

      // If not showing all exams, filter strictly by selected courses
      if (!mostrarTodosExamenes) {
        if (selectedCursos.length === 0) return false;

        const exCursosClean = (ex.cursos || []).map(c => cleanCourseName(c).toLowerCase());
        const hasCourseMatch = exCursosClean.some(c => selectedCleanSet.has(c));
        const isAdmision = !!ex.esAdmision;
        const hasAdmisionSelected = selectedCursos.some(c => c.toLowerCase().includes('admisi'));

        if (!hasCourseMatch && !(isAdmision && hasAdmisionSelected)) {
          return false;
        }
      }

      if (!q) return true;

      const matchTitulo = ex.titulo.toLowerCase().includes(q);
      const matchMateria = (ex.materia || '').toLowerCase().includes(q);
      const matchCursos = (ex.cursos || []).some(c => c.toLowerCase().includes(q));

      return matchTitulo || matchMateria || matchCursos;
    });
  }, [examenesList, selectedCursos, soloActivos, mostrarTodosExamenes, examenSearch]);

  // Toggle single exam
  const toggleExamen = (id: string) => {
    if (selectedExamenes.includes(id)) {
      onChangeExamenes(selectedExamenes.filter(e => e !== id));
    } else {
      onChangeExamenes([...selectedExamenes, id]);
    }
  };

  const selectAllVisibleExamenes = () => {
    const visibleIds = filteredExamenes.map(e => e._id);
    const set = new Set([...selectedExamenes, ...visibleIds]);
    onChangeExamenes(Array.from(set));
  };

  const clearAllExamenes = () => {
    onChangeExamenes([]);
  };

  if (loading) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs">Cargando cursos y catálogo de exámenes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pt-2">
      {/* ── 1. CUADRO DE 3 COLUMNAS: CURSOS / GRADOS EN ORDEN ── */}
      <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              🏫 Cursos y Grados Asignados ({selectedCursos.length} seleccionados)
            </label>
            <p className="text-[11px] text-slate-500">
              Haz clic en los cursos que impartirá o coordinará este usuario.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={selectAllCursos}
              className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
            >
              Seleccionar todos
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={clearAllCursos}
              className="text-slate-500 hover:text-slate-700 font-bold hover:underline cursor-pointer"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Filter input */}
        <div className="relative mb-3">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            value={cursoSearch}
            onChange={e => setCursoSearch(e.target.value)}
            placeholder="Filtrar por grado o curso (ej: Kinder, 101, 1102)..."
            className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* 3-COLUMN GRID OF COURSES */}
        <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3 shadow-inner">
          {sortedAndFilteredCursos.length === 0 ? (
            <p className="text-center py-4 text-xs text-slate-400">No se encontraron cursos coincidentes.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {sortedAndFilteredCursos.map(c => {
                const displayName = cleanCourseName(c.nombre);
                const isSelected = selectedCursos.some(
                  sc => cleanCourseName(sc).toLowerCase() === displayName.toLowerCase()
                );

                return (
                  <button
                    key={displayName}
                    type="button"
                    onClick={() => toggleCurso(displayName)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold border transition text-left cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs ring-1 ring-blue-400/50'
                        : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border transition flex-shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white text-[10px] font-bold'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isSelected && '✓'}
                      </div>
                      <span className="truncate">{displayName}</span>
                    </div>

                    {isSelected && (
                      <span className="text-[10px] bg-blue-200 text-blue-800 px-1.5 py-0.2 rounded font-bold ml-1 flex-shrink-0">
                        Activo
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── 2. SELECCIÓN DE EXÁMENES SEGÚN LOS CURSOS SELECCIONADOS (Checkboxes) ── */}
      <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 md:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
              📝 Exámenes Asignados ({selectedExamenes.length} seleccionados)
            </label>
            <p className="text-[11px] text-slate-500">
              {selectedCursos.length > 0 && !mostrarTodosExamenes
                ? `Mostrando exámenes asociados a tus ${selectedCursos.length} curso(s) seleccionados.`
                : 'Marca los exámenes que este usuario podrá presentar, calificar o supervisar.'}
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {filteredExamenes.length > 0 && (
              <button
                type="button"
                onClick={selectAllVisibleExamenes}
                className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer"
              >
                Marcar visibles ({filteredExamenes.length})
              </button>
            )}
            {selectedExamenes.length > 0 && (
              <>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={clearAllExamenes}
                  className="text-slate-500 hover:text-slate-700 font-bold hover:underline cursor-pointer"
                >
                  Desmarcar todos
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filter and toggle controls */}
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
            onClick={() => setMostrarTodosExamenes(!mostrarTodosExamenes)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              mostrarTodosExamenes
                ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {mostrarTodosExamenes
              ? '🌐 Mostrando Todos los Exámenes'
              : selectedCursos.length > 0
              ? `🎯 Solo Exámenes de Cursos Seleccionados (${selectedCursos.length})`
              : 'Ver todos los exámenes'}
          </button>

          <button
            type="button"
            onClick={() => setSoloActivos(!soloActivos)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              soloActivos ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold' : 'bg-white text-slate-600 border-slate-200'
            }`}
          >
            {soloActivos ? '🟢 Solo Activos' : 'Todos los estados'}
          </button>
        </div>

        {/* Checkbox list of exams */}
        <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl bg-white p-3 shadow-inner">
          {selectedCursos.length === 0 && !mostrarTodosExamenes ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-4xl mb-2">👈</div>
              <p className="text-xs font-bold text-slate-700 mb-1">
                Selecciona uno o más cursos en el cuadro de arriba
              </p>
              <p className="text-[11px] text-slate-500 max-w-sm mx-auto mb-3">
                Los exámenes creados para esos grados aparecerán aquí automáticamente para que los puedas asignar con checkbox.
              </p>
              <button
                type="button"
                onClick={() => setMostrarTodosExamenes(true)}
                className="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition border border-blue-200 cursor-pointer"
              >
                Ver todos los exámenes sin filtrar por curso →
              </button>
            </div>
          ) : filteredExamenes.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="text-3xl mb-1">📭</div>
              <p className="text-xs font-bold text-slate-700 mb-1">
                No hay exámenes registrados para los cursos seleccionados
              </p>
              <p className="text-[11px] text-slate-500 mb-2">
                Puedes seleccionar otros cursos o mostrar todos los exámenes del sistema.
              </p>
              {!mostrarTodosExamenes && (
                <button
                  type="button"
                  onClick={() => setMostrarTodosExamenes(true)}
                  className="text-blue-600 hover:underline text-xs font-semibold"
                >
                  Ver todos los exámenes disponibles →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredExamenes.map(ex => {
                const isChecked = selectedExamenes.includes(ex._id);

                return (
                  <button
                    key={ex._id}
                    type="button"
                    onClick={() => toggleExamen(ex._id)}
                    className={`w-full flex items-start justify-between p-3 rounded-xl border text-left transition cursor-pointer select-none gap-3 ${
                      isChecked
                        ? 'bg-purple-50/70 border-purple-300 shadow-2xs ring-1 ring-purple-300/60'
                        : 'bg-white border-slate-200 hover:border-purple-200 hover:bg-slate-50/80'
                    }`}
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div
                        className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center border transition flex-shrink-0 ${
                          isChecked
                            ? 'bg-purple-600 border-purple-600 text-white text-[10px] font-bold'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && '✓'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">
                            {ex.titulo}
                          </span>
                          {ex.materia && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({ex.materia})
                            </span>
                          )}
                        </div>

                        {/* Badges of courses and type */}
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {ex.esAdmision && (
                            <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-200">
                              🎓 Admisión
                            </span>
                          )}

                          {ex.cursos && ex.cursos.length > 0 ? (
                            ex.cursos.map(c => {
                              const cleanC = cleanCourseName(c);
                              const isMatched = selectedCursos.some(
                                sc => cleanCourseName(sc).toLowerCase() === cleanC.toLowerCase()
                              );
                              return (
                                <span
                                  key={c}
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                                    isMatched
                                      ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                                      : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {cleanC}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Sin cursos específicos</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                        ex.estado === 'activo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : ex.estado === 'cerrado'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {ex.estado === 'activo' ? '🟢 Activo' : ex.estado === 'cerrado' ? '🔴 Cerrado' : ex.estado}
                      </span>
                      {ex.claveAcceso && ex.estado === 'activo' && (
                        <span className="font-mono text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          🔑 {ex.claveAcceso}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

