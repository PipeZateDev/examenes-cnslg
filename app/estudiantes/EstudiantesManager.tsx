'use client';

import { useState, useEffect, useMemo } from 'react';
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
  totalEstudiantes?: number;
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
  isAdmin?: boolean;
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
  isAdmin = false,
}: EstudiantesManagerProps) {
  const [estudiantes, setEstudiantes] = useState<StudentItem[]>(initialEstudiantes);
  const [cursos, setCursos] = useState<CourseItem[]>(initialCursos);
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'aspirantes' | 'cursos'>(
    initialTab === 'aspirantes' ? 'aspirantes' : initialTab === 'cursos' ? 'cursos' : 'estudiantes'
  );

  // Course Detail / Drilldown State
  const [selectedCourseView, setSelectedCourseView] = useState<string | null>(null); // course name or 'SIN_CURSO'
  const [courseStudents, setCourseStudents] = useState<StudentItem[]>([]);
  const [loadingCourseStudents, setLoadingCourseStudents] = useState(false);
  const [sinCursoCount, setSinCursoCount] = useState(0);

  // Bulk assignment state in course view
  const [unassignedPool, setUnassignedPool] = useState<StudentItem[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedToAssign, setSelectedToAssign] = useState<string[]>([]);
  const [assigningBatch, setAssigningBatch] = useState(false);

  // Course Deletion State (Admin)
  const [courseToDelete, setCourseToDelete] = useState<CourseItem | null>(null);
  const [deletingCourse, setDeletingCourse] = useState(false);

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
  const [innerCourseStudentSearch, setInnerCourseStudentSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(page || 1);
  const [currentTotal, setCurrentTotal] = useState(total || 0);
  const [currentTotalPages, setCurrentTotalPages] = useState(totalPages || 1);
  const [countRegulares, setCountRegulares] = useState(totalRegulares || 0);
  const [countAspirantes, setCountAspirantes] = useState(totalAspirantes || 0);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  };

  // Load courses with student counts
  const fetchCursosData = async () => {
    try {
      const res = await fetch('/api/cursos');
      if (res.ok) {
        const data = await res.json();
        if (data.cursos) setCursos(data.cursos);
        if (data.sinCursoCount !== undefined) setSinCursoCount(data.sinCursoCount);
      }
    } catch (err) {
      console.error('Error loading courses:', err);
    }
  };

  useEffect(() => {
    fetchCursosData();
  }, []);

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

  // Load students for a specific course or for unassigned students
  const loadCourseStudents = async (courseName: string) => {
    setSelectedCourseView(courseName);
    setLoadingCourseStudents(true);
    setInnerCourseStudentSearch('');
    try {
      const params = new URLSearchParams();
      params.set('admision', '0');
      params.set('limit', '300');

      if (courseName === 'SIN_CURSO') {
        params.set('sinCurso', '1');
      } else {
        params.set('curso', courseName);
      }

      const res = await fetch(`/api/estudiantes?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCourseStudents(data.estudiantes || []);
      }
    } catch (err) {
      console.error('Error fetching course students:', err);
      showToast('error', 'Error al cargar estudiantes del curso');
    } finally {
      setLoadingCourseStudents(false);
    }
  };

  // Open batch assign modal to assign unassigned students to current course
  const openAssignModal = async () => {
    setIsAssignModalOpen(true);
    setSelectedToAssign([]);
    try {
      const res = await fetch('/api/estudiantes?admision=0&sinCurso=1&limit=300');
      if (res.ok) {
        const data = await res.json();
        setUnassignedPool(data.estudiantes || []);
      }
    } catch (err) {
      console.error('Error loading unassigned pool:', err);
    }
  };

  // Bulk assign selected students to the currently open course
  const handleAssignSelectedToCourse = async (targetCourseName: string) => {
    if (!targetCourseName || targetCourseName === 'SIN_CURSO') return;
    if (selectedToAssign.length === 0) {
      showToast('error', 'Selecciona al menos un estudiante para asignar');
      return;
    }

    setAssigningBatch(true);
    try {
      const res = await fetch('/api/cursos/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curso: targetCourseName,
          studentDocumentos: selectedToAssign,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Error al asignar estudiantes');
        return;
      }

      showToast('success', `✓ ${data.updatedCount} estudiante(s) asignados al Curso ${targetCourseName}`);
      setIsAssignModalOpen(false);
      setSelectedToAssign([]);
      // Reload current course view and course summary
      loadCourseStudents(targetCourseName);
      fetchCursosData();
    } catch {
      showToast('error', 'Error de conexión');
    } finally {
      setAssigningBatch(false);
    }
  };

  // Move or reassign an individual student to another course
  const handleReassignIndividual = async (numeroDocumento: string, newCourse: string) => {
    try {
      const res = await fetch('/api/cursos/asignar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          curso: newCourse,
          studentDocumentos: [numeroDocumento],
        }),
      });

      if (!res.ok) {
        showToast('error', 'Error al reasignar estudiante');
        return;
      }

      showToast('success', newCourse ? `✓ Estudiante asignado al Curso ${newCourse}` : '✓ Estudiante marcado como Sin Curso');
      if (selectedCourseView) {
        loadCourseStudents(selectedCourseView);
      }
      fetchCursosData();
    } catch {
      showToast('error', 'Error al cambiar curso');
    }
  };

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
      curso: selectedCourseView && selectedCourseView !== 'SIN_CURSO' ? selectedCourseView : '',
      grado: selectedCourseView && selectedCourseView !== 'SIN_CURSO' ? selectedCourseView : '',
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
        if (selectedCourseView) {
          loadCourseStudents(selectedCourseView);
        }
        fetchCursosData();
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
        if (selectedCourseView) {
          loadCourseStudents(selectedCourseView);
        }
        fetchCursosData();
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
      setCursos(prev => [...prev, data.course]);
      setNewCourseName('');
      setIsCreatingCourse(false);
      fetchCursosData();
      showToast('success', `✓ Curso ${data.course.nombre} creado exitosamente en MongoDB`);
    } catch {
      showToast('error', 'Error al crear curso');
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteCourse = async () => {
    if (!courseToDelete) return;
    setDeletingCourse(true);
    try {
      const identifier = courseToDelete._id || courseToDelete.nombre;
      const res = await fetch(
        `/api/cursos?id=${encodeURIComponent(identifier)}&nombre=${encodeURIComponent(courseToDelete.nombre)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'Error al eliminar el curso');
        return;
      }

      showToast(
        'success',
        `✓ Curso ${courseToDelete.nombre} eliminado. ${
          data.unassignedStudentsCount
            ? `${data.unassignedStudentsCount} alumno(s) pasaron a "Estudiantes Sin Curso".`
            : ''
        }`
      );

      if (selectedCourseView && selectedCourseView.toLowerCase() === courseToDelete.nombre.toLowerCase()) {
        setSelectedCourseView(null);
      }

      setCourseToDelete(null);
      await fetchCursosData();
    } catch {
      showToast('error', 'Error al eliminar el curso');
    } finally {
      setDeletingCourse(false);
    }
  };

  // Filtered course students inside detail view
  const filteredInnerCourseStudents = useMemo(() => {
    const q = innerCourseStudentSearch.toLowerCase().trim();
    if (!q) return courseStudents;
    return courseStudents.filter(
      st =>
        st.nombreCompleto.toLowerCase().includes(q) ||
        st.numeroDocumento.toLowerCase().includes(q)
    );
  }, [courseStudents, innerCourseStudentSearch]);

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
            onClick={() => { setActiveTab('estudiantes'); setSelectedCurso(''); setSearchTerm(''); setSelectedCourseView(null); }}
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
            onClick={() => { setActiveTab('aspirantes'); setSelectedCurso(''); setSearchTerm(''); setSelectedCourseView(null); }}
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
            onClick={() => { setActiveTab('cursos'); setSelectedCourseView(null); fetchCursosData(); }}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'cursos'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            <span>🏫 Gestión de Cursos ({cursos.length})</span>
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
                        {est.curso ? (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Curso: <span className="font-semibold text-slate-700">{est.curso}</span>
                          </p>
                        ) : (
                          <p className="text-xs text-amber-600 font-semibold mt-0.5">
                            ⚠️ Sin Curso Asignado
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

        {/* ── TAB 3: GESTIÓN DE CURSOS Y ASIGNACIÓN DE ESTUDIANTES ── */}
        {activeTab === 'cursos' && (
          <div>
            {selectedCourseView === null ? (
              /* Course Grid Overview */
              <div className="space-y-6">
                {/* Course Dashboard Bar with Unassigned Students Alert */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                      <span>🏫</span>
                      <span>Organización de Estudiantes por Curso</span>
                    </h2>
                    <p className="text-slate-500 text-xs mt-1">
                      Haz clic en cualquier curso para ver sus estudiantes o asignar nuevos alumnos. Cada estudiante está asignado a un único curso en MongoDB.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Botón Destacado: Estudiantes Sin Curso */}
                    <button
                      onClick={() => loadCourseStudents('SIN_CURSO')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs border ${
                        sinCursoCount > 0
                          ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 animate-pulse'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                      }`}
                    >
                      <span>⚠️</span>
                      <span>Estudiantes Sin Curso ({sinCursoCount})</span>
                    </button>

                    {canEdit && (
                      <button
                        onClick={() => setIsCreatingCourse(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>+ Agregar Nuevo Curso</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter courses input */}
                <div className="relative max-w-sm">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={e => setCourseSearch(e.target.value)}
                    placeholder="Filtrar por nombre de curso (ej: 101, Kinder)..."
                    className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-white focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                </div>

                {/* Courses Grid with Student Count Badges */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {cursos
                    .filter(c => !courseSearch.trim() || c.nombre.toLowerCase().includes(courseSearch.toLowerCase().trim()))
                    .map(c => {
                      const studentCount = Number(c.totalEstudiantes || 0);

                      return (
                        <div
                          key={c.nombre}
                          onClick={() => loadCourseStudents(c.nombre)}
                          className="bg-white rounded-2xl shadow-sm hover:shadow-md border border-slate-200 hover:border-blue-400 p-5 transition flex flex-col justify-between cursor-pointer group"
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                                Colegio CNSLG
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                                  studentCount > 0
                                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                    : 'bg-slate-100 text-slate-400'
                                }`}>
                                  👨‍🎓 {studentCount} {studentCount === 1 ? 'estudiante' : 'estudiantes'}
                                </span>
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setCourseToDelete(c);
                                    }}
                                    title={`Eliminar curso ${c.nombre}`}
                                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  >
                                    <span className="text-sm">🗑️</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <h3 className="text-2xl font-black text-slate-800 group-hover:text-blue-700 transition">
                              {c.nombre}
                            </h3>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-blue-600 font-bold">
                            <span>Ver y gestionar alumnos</span>
                            <span className="text-base group-hover:translate-x-1 transition-transform">→</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
              /* Drilldown View into Specific Course or SIN_CURSO */
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 md:p-8 space-y-6 animate-in fade-in">
                {/* Course Header & Breadcrumb */}
                <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-5">
                  <div>
                    <button
                      onClick={() => { setSelectedCourseView(null); fetchCursosData(); }}
                      className="text-xs text-blue-600 hover:underline font-bold mb-2 flex items-center gap-1 cursor-pointer"
                    >
                      <span>← Volver a Todos los Cursos</span>
                    </button>
                    <div className="flex items-center gap-3 flex-wrap">
                      <h2 className="text-2xl font-black text-slate-800">
                        {selectedCourseView === 'SIN_CURSO'
                          ? '⚠️ Estudiantes Sin Curso Asignado'
                          : `🏫 Estudiantes del Curso ${selectedCourseView}`}
                      </h2>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        selectedCourseView === 'SIN_CURSO'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-blue-100 text-blue-900 border border-blue-300'
                      }`}>
                        👨‍🎓 {courseStudents.length} estudiantes
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedCourseView !== 'SIN_CURSO' && canEdit && (
                      <button
                        onClick={openAssignModal}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>➕ Asignar Alumnos Sin Curso</span>
                      </button>
                    )}

                    {selectedCourseView !== 'SIN_CURSO' && isAdmin && (
                      <button
                        onClick={() => {
                          const currentC = cursos.find(
                            c => c.nombre.toLowerCase() === selectedCourseView.toLowerCase()
                          );
                          setCourseToDelete({
                            nombre: selectedCourseView,
                            _id: currentC?._id,
                            totalEstudiantes: courseStudents.length,
                          });
                        }}
                        className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition border border-red-200 flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>🗑️</span>
                        <span>Eliminar Curso</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter within course students */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="relative flex-1 max-w-sm">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    <input
                      type="text"
                      value={innerCourseStudentSearch}
                      onChange={e => setInnerCourseStudentSearch(e.target.value)}
                      placeholder="Filtrar alumnos por nombre o documento..."
                      className="w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-xs text-slate-400 font-medium">
                    Mostrando <strong>{filteredInnerCourseStudents.length}</strong> de {courseStudents.length} estudiantes
                  </p>
                </div>

                {/* Students List in this Course */}
                {loadingCourseStudents ? (
                  <div className="text-center py-12 text-slate-400">
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs">Cargando alumnos del curso...</p>
                  </div>
                ) : filteredInnerCourseStudents.length === 0 ? (
                  <div className="bg-slate-50 rounded-2xl p-10 text-center text-slate-400 border border-slate-200">
                    <div className="text-4xl mb-2">👨‍🎓</div>
                    <h3 className="font-bold text-slate-700 text-base mb-1">
                      {selectedCourseView === 'SIN_CURSO'
                        ? '¡Excelente! No hay estudiantes sin curso asignado.'
                        : `No hay estudiantes asignados al Curso ${selectedCourseView}.`}
                    </h3>
                    <p className="text-xs text-slate-500 mb-4">
                      {selectedCourseView !== 'SIN_CURSO' && 'Puedes asignar estudiantes sin curso a este grado con el botón superior.'}
                    </p>
                    {selectedCourseView !== 'SIN_CURSO' && canEdit && (
                      <button
                        onClick={openAssignModal}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700"
                      >
                        Asignar Alumnos Ahora →
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {filteredInnerCourseStudents.map(st => (
                      <div
                        key={st._id?.toString() || st.numeroDocumento}
                        className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 flex flex-col justify-between hover:bg-white hover:shadow-sm transition"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="font-mono text-xs font-bold text-slate-600">
                              {st.tipoDocumento || 'TI'}: {st.numeroDocumento}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              st.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {st.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>

                          <h4 className="font-bold text-slate-900 text-sm leading-snug">
                            {st.nombreCompleto}
                          </h4>
                        </div>

                        {/* Reassign / Move Course Selector */}
                        {canEdit && (
                          <div className="mt-4 pt-3 border-t border-slate-200">
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                              Mover / Asignar Curso
                            </label>
                            <select
                              value={st.curso || ''}
                              onChange={e => handleReassignIndividual(st.numeroDocumento, e.target.value)}
                              className="w-full border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs bg-white font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Sin Curso --</option>
                              {cursos.map(c => (
                                <option key={c.nombre} value={c.nombre}>
                                  Curso {c.nombre}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: ASIGNAR ESTUDIANTES SIN CURSO AL CURSO ACTUAL ── */}
      {isAssignModalOpen && selectedCourseView && selectedCourseView !== 'SIN_CURSO' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-2xl w-full border border-slate-100 animate-in fade-in zoom-in-95 my-6">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-800 text-xl">
                  ➕ Asignar Alumnos al Curso {selectedCourseView}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Selecciona de la lista los estudiantes sin curso para vincularlos a este grado.
                </p>
              </div>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-slate-600">
                Disponibles sin curso: <strong>{unassignedPool.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedToAssign(unassignedPool.map(u => u.numeroDocumento))}
                  className="text-blue-600 hover:underline font-bold"
                >
                  Seleccionar todos
                </button>
                <span className="text-slate-300">•</span>
                <button
                  type="button"
                  onClick={() => setSelectedToAssign([])}
                  className="text-slate-500 hover:underline font-bold"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {/* List of Unassigned Students with Checkboxes */}
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50 divide-y divide-slate-200/60 shadow-inner">
              {unassignedPool.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400">
                  No hay estudiantes sin curso disponibles en este momento.
                </p>
              ) : (
                unassignedPool.map(st => {
                  const isChecked = selectedToAssign.includes(st.numeroDocumento);
                  return (
                    <label
                      key={st.numeroDocumento}
                      className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition select-none ${
                        isChecked ? 'bg-emerald-50 border border-emerald-300 font-bold text-emerald-950' : 'hover:bg-white text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedToAssign(prev => [...prev, st.numeroDocumento]);
                            } else {
                              setSelectedToAssign(prev => prev.filter(d => d !== st.numeroDocumento));
                            }
                          }}
                          className="w-4 h-4 text-emerald-600 rounded cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-bold leading-tight">{st.nombreCompleto}</p>
                          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Doc: {st.numeroDocumento}
                          </p>
                        </div>
                      </div>
                      {isChecked && (
                        <span className="text-[10px] bg-emerald-200 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                          Seleccionado
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex gap-3 pt-5 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setIsAssignModalOpen(false)}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleAssignSelectedToCourse(selectedCourseView)}
                disabled={assigningBatch || selectedToAssign.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow-xs disabled:opacity-50"
              >
                {assigningBatch
                  ? 'Asignando...'
                  : `Asignar ${selectedToAssign.length} alumno(s) a ${selectedCourseView}`}
              </button>
            </div>
          </div>
        </div>
      )}

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
                  {formData.esAdmision ? (
                    <input
                      type="text"
                      value={formData.grado}
                      onChange={e => setFormData(f => ({ ...f, curso: e.target.value, grado: e.target.value }))}
                      placeholder="Ej: Transición, 1°, 6°"
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  ) : (
                    <select
                      value={formData.curso}
                      onChange={e => setFormData(f => ({ ...f, curso: e.target.value, grado: e.target.value }))}
                      className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                    >
                      <option value="">-- Sin Curso --</option>
                      {cursos.map(c => (
                        <option key={c.nombre} value={c.nombre}>
                          Curso {c.nombre}
                        </option>
                      ))}
                    </select>
                  )}
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
                  <span>Este alumno está categorizado como <strong>Estudiante Matriculado</strong> y presentará exámenes regulares correspondientes a su curso único.</span>
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

      {/* ── MODAL: CONFIRMAR ELIMINACIÓN DE CURSO ── */}
      {courseToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-md w-full border border-red-100 animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center text-2xl mx-auto mb-4">
              🗑️
            </div>
            <h3 className="font-extrabold text-slate-800 text-xl text-center mb-2">
              ¿Eliminar Curso {courseToDelete.nombre}?
            </h3>
            <p className="text-xs text-slate-600 text-center leading-relaxed mb-4">
              Esta acción eliminará el curso <strong>{courseToDelete.nombre}</strong> de la base de datos de cursos en MongoDB.
            </p>

            {(courseToDelete.totalEstudiantes || 0) > 0 ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 mb-5 leading-relaxed">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <span>⚠️</span>
                  <span>{courseToDelete.totalEstudiantes} estudiante(s) matriculado(s)</span>
                </p>
                Los estudiantes asignados a este curso pasarán automáticamente al listado de <strong>"Estudiantes Sin Curso"</strong> para que puedas reasignarlos a otro grado cuando lo desees.
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500 mb-5 text-center">
                Este curso no tiene alumnos asignados actualmente.
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCourseToDelete(null)}
                disabled={deletingCourse}
                className="flex-1 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteCourse}
                disabled={deletingCourse}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {deletingCourse ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <span>Sí, Eliminar Curso</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
