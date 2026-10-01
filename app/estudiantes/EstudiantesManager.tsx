'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface StudentItem {
  _id: string;
  numeroDocumento: string;
  tipoDocumento?: string;
  nombreCompleto: string;
  nombres?: string;
  apellidos?: string;
  curso?: string;
  grado?: string;
  esAdmision?: boolean;
  activo?: boolean;
  foto?: { data: string; contentType: string } | null;
  fotoPosicionX?: number;
  fotoPosicionY?: number;
}

interface CourseItem {
  _id?: string;
  nombre: string;
  anioLectivo?: number;
  grado?: string;
}

interface EstudiantesManagerProps {
  initialEstudiantes: StudentItem[];
  initialCursos: CourseItem[];
  initialTab?: string;
  total: number;
  totalRegulares: number;
  totalAspirantes: number;
  page: number;
  totalPages: number;
  query: string;
  cursoFilter: string;
  canEdit: boolean;
}

export default function EstudiantesManager({
  initialEstudiantes,
  initialCursos,
  initialTab = 'estudiantes',
  total,
  totalRegulares,
  totalAspirantes,
  page,
  totalPages,
  query,
  cursoFilter,
  canEdit,
}: EstudiantesManagerProps) {
  const [estudiantes, setEstudiantes] = useState<StudentItem[]>(initialEstudiantes);
  const [cursos, setCursos] = useState<CourseItem[]>(initialCursos);
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'aspirantes' | 'cursos'>(
    initialTab === 'aspirantes' ? 'aspirantes' : initialTab === 'cursos' ? 'cursos' : 'estudiantes'
  );

  // Modals state
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [isCreatingAspirante, setIsCreatingAspirante] = useState(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Real-time live search and filters state
  const [searchTerm, setSearchTerm] = useState(query || '');
  const [selectedCurso, setSelectedCurso] = useState(cursoFilter || '');
  const [searchingLive, setSearchingLive] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(page || 1);
  const [currentTotal, setCurrentTotal] = useState(total || 0);
  const [currentTotalPages, setCurrentTotalPages] = useState(totalPages || 1);
  const [countRegulares, setCountRegulares] = useState(totalRegulares || 0);
  const [countAspirantes, setCountAspirantes] = useState(totalAspirantes || 0);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  };

  // Debounced real-time fetch from API when search, course or tab changes
  useEffect(() => {
    if (activeTab === 'cursos') return;

    const handler = setTimeout(async () => {
      setSearchingLive(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.set('q', searchTerm.trim());
        if (selectedCurso) params.set('curso', selectedCurso);
        params.set('admision', activeTab === 'aspirantes' ? '1' : '0');
        params.set('page', '1');

        const res = await fetch(`/api/estudiantes?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEstudiantes(data.estudiantes || []);
          setCurrentTotal(data.total || 0);
          setCurrentPage(data.page || 1);
          setCurrentTotalPages(data.totalPages || 1);
          if (data.totalRegulares !== undefined) setCountRegulares(data.totalRegulares);
          if (data.totalAspirantes !== undefined) setCountAspirantes(data.totalAspirantes);
        }
      } catch (err) {
        console.error('Error in real-time student search:', err);
      } finally {
        setSearchingLive(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [searchTerm, selectedCurso, activeTab]);

  // Form for student / aspirante editing/creation
  const [formData, setFormData] = useState({
    numeroDocumento: '',
    tipoDocumento: 'TI',
    nombreCompleto: '',
    nombres: '',
    apellidos: '',
    curso: '',
    grado: '',
    esAdmision: false,
    activo: true,
  });

  const openEditModal = (st: StudentItem) => {
    setEditingStudent(st);
    setFormData({
      numeroDocumento: st.numeroDocumento || '',
      tipoDocumento: st.tipoDocumento || 'TI',
      nombreCompleto: st.nombreCompleto || '',
      nombres: st.nombres || '',
      apellidos: st.apellidos || '',
      curso: st.curso || '',
      grado: st.grado || '',
      esAdmision: Boolean(st.esAdmision),
      activo: st.activo !== false,
    });
  };

  const openCreateStudentModal = () => {
    setIsCreatingStudent(true);
    setIsCreatingAspirante(false);
    setFormData({
      numeroDocumento: '',
      tipoDocumento: 'TI',
      nombreCompleto: '',
      nombres: '',
      apellidos: '',
      curso: '',
      grado: '',
      esAdmision: false,
      activo: true,
    });
  };

  const openCreateAspiranteModal = () => {
    setIsCreatingAspirante(true);
    setIsCreatingStudent(false);
    setFormData({
      numeroDocumento: '',
      tipoDocumento: 'TI',
      nombreCompleto: '',
      nombres: '',
      apellidos: '',
      curso: 'Admisión',
      grado: '',
      esAdmision: true,
      activo: true,
    });
  };

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.numeroDocumento.trim() || !formData.nombreCompleto.trim()) {
      showToast('error', 'Número de documento y nombre son obligatorios');
      return;
    }

    setLoading(true);
    try {
      if (editingStudent) {
        // Update student
        const res = await fetch(`/api/estudiantes/${editingStudent._id || editingStudent.numeroDocumento}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Error al actualizar');
          return;
        }

        setEstudiantes(prev =>
          prev.map(st =>
            st._id === editingStudent._id || st.numeroDocumento === editingStudent.numeroDocumento
              ? { ...st, ...formData }
              : st
          )
        );
        showToast('success', '✓ Datos actualizados correctamente en MongoDB');
        setEditingStudent(null);
      } else {
        // Create student or aspirante
        const res = await fetch('/api/estudiantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast('error', data.error || 'Error al crear');
          return;
        }

        setEstudiantes(prev => [data.student, ...prev]);
        if (formData.esAdmision) {
          setCountAspirantes(c => c + 1);
        } else {
          setCountRegulares(c => c + 1);
        }
        showToast(
          'success',
          formData.esAdmision
            ? '✓ Aspirante registrado exitosamente para pruebas de admisión'
            : '✓ Estudiante matriculado registrado correctamente en MongoDB'
        );
        setIsCreatingStudent(false);
        setIsCreatingAspirante(false);
      }
    } catch {
      showToast('error', 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: newCourseName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Error al crear curso');
        return;
      }
      setCursos(prev => [...prev, data.curso]);
      setNewCourseName('');
      setIsCreatingCourse(false);
      showToast('success', `✓ Curso ${data.curso.nombre} creado exitosamente en MongoDB`);
    } catch {
      showToast('error', 'Error al crear curso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Toast Alert */}
        {toast && (
          <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-top-4">
            <div
              className={`px-5 py-3 rounded-2xl shadow-xl border text-sm font-bold flex items-center gap-2 ${
                toast.tipo === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500'
                  : 'bg-red-600 text-white border-red-500'
              }`}
            >
              <span>{toast.tipo === 'success' ? '✓' : '⚠️'}</span>
              <span>{toast.mensaje}</span>
            </div>
          </div>
        )}

        {/* Header & Title */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Gestión Académica</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              👥 Estudiantes, Aspirantes y Cursos
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Administración centralizada de alumnos matriculados y aspirantes para pruebas de admisión.
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              {activeTab === 'aspirantes' ? (
                <button
                  onClick={openCreateAspiranteModal}
                  className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🎓 + Registrar Aspirante</span>
                </button>
              ) : activeTab === 'estudiantes' ? (
                <button
                  onClick={openCreateStudentModal}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>👨‍🎓 + Nuevo Estudiante</span>
                </button>
              ) : (
                <button
                  onClick={() => setIsCreatingCourse(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>🏫 + Agregar Curso</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-3 flex-wrap">
          <button
            onClick={() => { setActiveTab('estudiantes'); setSelectedCurso(''); setSearchTerm(''); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'estudiantes'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>👨‍🎓 Estudiantes Matriculados</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'estudiantes' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              {countRegulares.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => { setActiveTab('aspirantes'); setSelectedCurso(''); setSearchTerm(''); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'aspirantes'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
            }`}
          >
            <span>🎓 Aspirantes a Admisión</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
              activeTab === 'aspirantes' ? 'bg-white/20 text-white' : 'bg-purple-100 text-purple-800'
            }`}>
              {countAspirantes.toLocaleString()}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cursos')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cursos'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>🏫 Cursos ({cursos.length})</span>
          </button>
        </div>

        {/* ── TAB 1: ESTUDIANTES MATRICULADOS ── */}
        {activeTab === 'estudiantes' && (
          <>
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar estudiante matriculado por nombre o documento..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 leading-none rounded-md"
                  >
                    ✕
                  </button>
                )}
              </div>

              <select
                value={selectedCurso}
                onChange={e => setSelectedCurso(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-medium"
              >
                <option value="">Todos los Cursos</option>
                {cursos.map(c => (
                  <option key={c.nombre} value={c.nombre}>{c.nombre}</option>
                ))}
              </select>

              {searchingLive && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold px-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Buscando...</span>
                </div>
              )}
            </div>

            {/* Students Grid */}
            {estudiantes.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <div className="text-5xl mb-3">👨‍🎓</div>
                <h3 className="font-bold text-slate-700 text-lg mb-1">No se encontraron estudiantes matriculados</h3>
                <p className="text-slate-400 text-sm">
                  {searchTerm || selectedCurso ? 'Prueba cambiando los términos de búsqueda.' : 'No hay estudiantes matriculados registrados.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {estudiantes.map(est => {
                  const fotoSrc = est.foto?.data
                    ? `data:${est.foto.contentType};base64,${est.foto.data}`
                    : null;
                  const posX = est.fotoPosicionX ?? 50;
                  const posY = est.fotoPosicionY ?? 50;

                  return (
                    <div
                      key={est._id?.toString() || est.numeroDocumento}
                      className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 p-4 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="w-14 h-14 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-slate-200 flex-shrink-0">
                            {fotoSrc ? (
                              <img
                                src={fotoSrc}
                                alt={est.nombreCompleto}
                                className="w-full h-full object-cover"
                                style={{ objectPosition: `${posX}% ${posY}%` }}
                              />
                            ) : (
                              <span className="text-2xl">👤</span>
                            )}
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            est.activo !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                          }`}>
                            {est.activo !== false ? 'Matriculado' : 'Inactivo'}
                          </span>
                        </div>

                        <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                          {est.nombreCompleto}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          {est.tipoDocumento || 'TI'}: <strong>{est.numeroDocumento}</strong>
                        </p>
                        {est.curso && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Curso: <span className="font-semibold text-slate-700">{est.curso}</span>
                          </p>
                        )}
                      </div>

                      {canEdit && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() => openEditModal(est)}
                            className="px-3 py-1.5 bg-slate-50 hover:bg-blue-50 text-blue-700 font-bold text-xs rounded-lg transition border border-slate-200 flex items-center gap-1 cursor-pointer"
                          >
                            <span>✏️</span>
                            <span>Editar Datos</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── TAB 2: ASPIRANTES A ADMISIÓN ── */}
        {activeTab === 'aspirantes' && (
          <>
            {/* Banner info */}
            <div className="bg-purple-900 text-white rounded-2xl p-5 mb-6 shadow-md border border-purple-800 flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xl">🎓</span>
                  <h3 className="font-bold text-base">Banco de Aspirantes para Pruebas de Admisión</h3>
                </div>
                <p className="text-purple-200 text-xs max-w-2xl leading-relaxed">
                  Los aspirantes registrados aquí se mantienen exclusivamente en la base de datos de este aplicativo y tienen acceso únicamente a las pruebas diagnósticas de admisión de las 5 áreas.
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={openCreateAspiranteModal}
                  className="px-4 py-2 bg-white text-purple-950 hover:bg-purple-50 font-extrabold text-xs rounded-xl transition shadow-xs cursor-pointer"
                >
                  + Registrar Aspirante
                </button>
              )}
            </div>

            {/* Filter Bar for Aspirantes */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar aspirante por nombre o documento..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-purple-500 outline-none bg-slate-50 focus:bg-white transition"
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 leading-none rounded-md"
                  >
                    ✕
                  </button>
                )}
              </div>

              {searchingLive && (
                <div className="flex items-center gap-1.5 text-xs text-purple-700 font-semibold px-2">
                  <div className="w-3.5 h-3.5 border-2 border-purple-700 border-t-transparent rounded-full animate-spin" />
                  <span>Buscando...</span>
                </div>
              )}
            </div>

            {/* Aspirantes Grid */}
            {estudiantes.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <div className="text-5xl mb-3">🎓</div>
                <h3 className="font-bold text-slate-700 text-lg mb-1">No hay aspirantes registrados</h3>
                <p className="text-slate-400 text-sm mb-4">
                  {searchTerm ? 'No hay aspirantes que coincidan con la búsqueda.' : 'Registra aspirantes para que puedan presentar su examen diagnóstico de admisión.'}
                </p>
                {canEdit && !searchTerm && (
                  <button
                    onClick={openCreateAspiranteModal}
                    className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    + Registrar Primer Aspirante
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {estudiantes.map(est => (
                  <div
                    key={est._id?.toString() || est.numeroDocumento}
                    className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-purple-200 p-4 transition flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="w-12 h-12 rounded-full bg-purple-100 border-2 border-purple-300 flex items-center justify-center text-xl flex-shrink-0">
                          🎓
                        </div>
                        <span className="bg-purple-100 text-purple-900 font-bold text-[10px] px-2.5 py-0.5 rounded-full border border-purple-200">
                          Aspirante
                        </span>
                      </div>

                      <h3 className="font-bold text-slate-900 text-sm leading-tight line-clamp-2">
                        {est.nombreCompleto}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono mt-1">
                        {est.tipoDocumento || 'TI'}: <strong>{est.numeroDocumento}</strong>
                      </p>
                      <div className="mt-2 pt-2 border-t border-purple-50">
                        <span className="text-[11px] text-purple-700 font-semibold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">
                          Grado aspirado: <strong>{est.grado || est.curso || 'General'}</strong>
                        </span>
                      </div>
                    </div>

                    {canEdit && (
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                        <button
                          onClick={() => openEditModal(est)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-800 font-bold text-xs rounded-lg transition border border-purple-200 flex items-center gap-1 cursor-pointer"
                        >
                          <span>✏️</span>
                          <span>Editar Datos</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB 3: CURSOS ── */}
        {activeTab === 'cursos' && (
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Cursos Registrados en MongoDB</h2>
                <p className="text-xs text-slate-500">Grados y grupos habilitados para asignar a exámenes y estudiantes</p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={courseSearch}
                  onChange={e => setCourseSearch(e.target.value)}
                  placeholder="Filtrar curso..."
                  className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                />
                {canEdit && (
                  <button
                    onClick={() => setIsCreatingCourse(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1 cursor-pointer"
                  >
                    <span>+ Agregar Curso</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {cursos
                .filter(c => !courseSearch.trim() || c.nombre.toLowerCase().includes(courseSearch.toLowerCase().trim()))
                .map(c => (
                  <div
                    key={c.nombre}
                    className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center hover:border-blue-300 transition"
                  >
                    <p className="text-xl font-extrabold text-slate-800">{c.nombre}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Colegio CNSLG</p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* ── MODAL: EDITAR / REGISTRAR ESTUDIANTE O ASPIRANTE ── */}
      {(editingStudent || isCreatingStudent || isCreatingAspirante) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-lg w-full border border-slate-100 animate-in fade-in zoom-in-95 my-6">
            <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xl">
                  {editingStudent
                    ? `✏️ Editar Datos de ${editingStudent.esAdmision ? 'Aspirante' : 'Estudiante'}`
                    : isCreatingAspirante
                    ? '🎓 Registrar Aspirante a Admisión'
                    : '👨‍🎓 Registrar Estudiante Matriculado'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isCreatingAspirante || editingStudent?.esAdmision
                    ? 'Se mantendrá exclusivamente en la base de datos de exámenes para pruebas de admisión.'
                    : 'Estudiante regular activo del Colegio Nuevo San Luis Gonzaga.'}
                </p>
              </div>
              <button
                onClick={() => { setEditingStudent(null); setIsCreatingStudent(false); setIsCreatingAspirante(false); }}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo Doc.</label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={e => setFormData(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="TI">TI</option>
                    <option value="CC">CC</option>
                    <option value="RC">RC</option>
                    <option value="NUIP">NUIP</option>
                    <option value="CE">CE</option>
                    <option value="PAS">PAS</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Número de Documento</label>
                  <input
                    type="text"
                    value={formData.numeroDocumento}
                    onChange={e => setFormData(f => ({ ...f, numeroDocumento: e.target.value }))}
                    placeholder="Ej: 1023456789"
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono font-bold bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={formData.nombreCompleto}
                  onChange={e => setFormData(f => ({ ...f, nombreCompleto: e.target.value.toUpperCase() }))}
                  placeholder="NOMBRES Y APELLIDOS"
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold uppercase bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {formData.esAdmision ? 'Grado Aspirado' : 'Curso / Grupo'}
                  </label>
                  <input
                    type="text"
                    value={formData.curso}
                    onChange={e => setFormData(f => ({ ...f, curso: e.target.value, grado: e.target.value }))}
                    placeholder={formData.esAdmision ? 'Ej: Transición, 1°, 6°' : 'Ej: 101, 602, 1101'}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estado</label>
                  <select
                    value={formData.activo ? '1' : '0'}
                    onChange={e => setFormData(f => ({ ...f, activo: e.target.value === '1' }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  >
                    <option value="1">✓ Habilitado / Activo</option>
                    <option value="0">✗ Inactivo</option>
                  </select>
                </div>
              </div>

              {formData.esAdmision ? (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-medium flex items-center gap-2">
                  <span>🎓</span>
                  <span>Este alumno está categorizado como <strong>Aspirante</strong> y únicamente podrá presentar pruebas diagnósticas de admisión.</span>
                </div>
              ) : (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 font-medium flex items-center gap-2">
                  <span>👨‍🎓</span>
                  <span>Este alumno está categorizado como <strong>Estudiante Matriculado</strong> y presentará exámenes regulares correspondientes a su curso.</span>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setEditingStudent(null); setIsCreatingStudent(false); setIsCreatingAspirante(false); }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={`flex-1 py-2.5 text-white rounded-xl text-sm font-bold transition shadow-xs disabled:opacity-50 cursor-pointer ${
                    formData.esAdmision ? 'bg-purple-700 hover:bg-purple-800' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {loading ? 'Guardando en MongoDB...' : 'Guardar Datos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: AGREGAR CURSO ── */}
      {isCreatingCourse && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-sm w-full border border-slate-100">
            <h3 className="font-bold text-slate-800 text-lg mb-3">➕ Nuevo Curso</h3>
            <form onSubmit={handleCreateCourse} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Nombre del Curso</label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={e => setNewCourseName(e.target.value)}
                  placeholder="Ej: 201, Transición B, etc."
                  className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCourse(false)}
                  className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {loading ? 'Creando...' : 'Crear Curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
