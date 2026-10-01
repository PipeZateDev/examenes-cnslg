'use client';

import { useState, useEffect, useTransition } from 'react';
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
  total: number;
  page: number;
  totalPages: number;
  query: string;
  cursoFilter: string;
  admisionFilter: string;
  canEdit: boolean;
}

export default function EstudiantesManager({
  initialEstudiantes,
  initialCursos,
  total,
  page,
  totalPages,
  query,
  cursoFilter,
  admisionFilter,
  canEdit,
}: EstudiantesManagerProps) {
  const [estudiantes, setEstudiantes] = useState<StudentItem[]>(initialEstudiantes);
  const [cursos, setCursos] = useState<CourseItem[]>(initialCursos);
  const [activeTab, setActiveTab] = useState<'estudiantes' | 'cursos'>('estudiantes');

  // Modals state
  const [editingStudent, setEditingStudent] = useState<StudentItem | null>(null);
  const [isCreatingStudent, setIsCreatingStudent] = useState(false);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Real-time live search and filters state
  const [searchTerm, setSearchTerm] = useState(query || '');
  const [selectedCurso, setSelectedCurso] = useState(cursoFilter || '');
  const [selectedAdmision, setSelectedAdmision] = useState(admisionFilter || '');
  const [searchingLive, setSearchingLive] = useState(false);
  const [courseSearch, setCourseSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(page || 1);
  const [currentTotal, setCurrentTotal] = useState(total || 0);
  const [currentTotalPages, setCurrentTotalPages] = useState(totalPages || 1);

  // Debounced real-time fetch from API
  useEffect(() => {
    const handler = setTimeout(async () => {
      setSearchingLive(true);
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.set('q', searchTerm.trim());
        if (selectedCurso) params.set('curso', selectedCurso);
        if (selectedAdmision) params.set('admision', selectedAdmision);
        params.set('page', '1');

        const res = await fetch(`/api/estudiantes?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setEstudiantes(data.estudiantes || []);
          setCurrentTotal(data.total || 0);
          setCurrentPage(data.page || 1);
          setCurrentTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        console.error('Error in real-time student search:', err);
      } finally {
        setSearchingLive(false);
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [searchTerm, selectedCurso, selectedAdmision]);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 4000);
  };

  // Form for student editing/creation
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

  const openCreateModal = () => {
    setIsCreatingStudent(true);
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
        if (!res.ok) throw new Error(data.error || 'Error al guardar');

        setEstudiantes(prev =>
          prev.map(st =>
            st._id === editingStudent._id ? { ...st, ...formData } : st
          )
        );
        showToast('success', '✓ Estudiante actualizado directamente en MongoDB');
        setEditingStudent(null);
      } else {
        // Create student
        const res = await fetch('/api/estudiantes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al crear');

        setEstudiantes(prev => [data.student, ...prev]);
        showToast('success', '✓ Nuevo estudiante registrado en MongoDB');
        setIsCreatingStudent(false);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Error al procesar la solicitud');
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
      if (!res.ok) throw new Error(data.error || 'Error al crear curso');

      setCursos(prev => [...prev, data.course]);
      setNewCourseName('');
      setIsCreatingCourse(false);
      showToast('success', '✓ Curso añadido con éxito a MongoDB');
    } catch (err: any) {
      showToast('error', err.message || 'Error al crear curso');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-xl border text-sm font-semibold flex items-center gap-2 transition-all ${
            toast.tipo === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/30'
              : 'bg-red-600 text-white border-red-500 shadow-red-600/30'
          }`}>
            <span>{toast.tipo === 'success' ? '✅' : '⚠️'}</span>
            <span>{toast.mensaje}</span>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Gestión Académica</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              🎓 Estudiantes y Cursos
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Administración centralizada de alumnos y grados conectada en tiempo real a MongoDB.
            </p>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                onClick={openCreateModal}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition shadow-xs flex items-center gap-1.5"
              >
                <span>+ Nuevo Estudiante</span>
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('estudiantes')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              activeTab === 'estudiantes'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            👨‍🎓 Lista de Estudiantes ({currentTotal.toLocaleString()})
          </button>
          <button
            onClick={() => setActiveTab('cursos')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              activeTab === 'cursos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            🏫 Gestión de Cursos ({cursos.length})
          </button>
        </div>

        {activeTab === 'estudiantes' ? (
          <>
            {/* Real-Time Live Search and Filters */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6 flex gap-3 flex-wrap items-center">
              <div className="relative flex-1 min-w-[240px]">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">
                  🔍
                </span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar en tiempo real por nombre o documento..."
                  className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 focus:bg-white transition"
                  autoComplete="off"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 leading-none rounded-md"
                    title="Limpiar búsqueda"
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

              <select
                value={selectedAdmision}
                onChange={e => setSelectedAdmision(e.target.value)}
                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50 font-medium"
              >
                <option value="">Todos los Tipos</option>
                <option value="0">Regulares</option>
                <option value="1">Admisiones</option>
              </select>

              {searchingLive && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold px-2">
                  <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  <span>Buscando...</span>
                </div>
              )}
            </div>

            {/* Live Search Results Header */}
            {searchTerm && (
              <div className="mb-4 text-xs text-slate-500 flex items-center justify-between px-1">
                <span>
                  Resultados para &quot;<strong className="text-slate-800">{searchTerm}</strong>&quot;: <strong>{currentTotal}</strong> estudiante(s) encontrado(s)
                </span>
                <button
                  onClick={() => { setSearchTerm(''); setSelectedCurso(''); setSelectedAdmision(''); }}
                  className="text-blue-600 hover:underline font-semibold text-xs"
                >
                  Restablecer filtros
                </button>
              </div>
            )}

            {/* Students Grid */}
            {estudiantes.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-12 text-center text-slate-400">
                <div className="text-5xl mb-3">👨‍🎓</div>
                <h3 className="font-bold text-slate-700 text-lg mb-1">No se encontraron estudiantes</h3>
                <p className="text-slate-400 text-sm">
                  {searchTerm || selectedCurso || selectedAdmision ? 'Prueba cambiando los términos de búsqueda o filtros.' : 'No hay estudiantes registrados en la base de datos.'}
                </p>
                {(searchTerm || selectedCurso || selectedAdmision) && (
                  <button
                    onClick={() => { setSearchTerm(''); setSelectedCurso(''); setSelectedAdmision(''); }}
                    className="mt-4 px-4 py-1.5 bg-blue-50 text-blue-700 font-semibold text-xs rounded-xl hover:bg-blue-100 transition"
                  >
                    Mostrar todos los estudiantes
                  </button>
                )}
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
                          <div className="flex flex-col items-end gap-1">
                            {est.esAdmision && (
                              <span className="bg-purple-100 text-purple-800 font-bold text-[10px] px-2 py-0.5 rounded-full border border-purple-200">
                                Admisión
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              est.activo !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {est.activo !== false ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                        </div>

                        <h3 className="font-bold text-slate-800 text-sm leading-tight line-clamp-2">
                          {est.nombreCompleto}
                        </h3>
                        <p className="text-xs text-slate-500 font-mono mt-1">
                          {est.tipoDocumento || 'TI'}: <strong>{est.numeroDocumento}</strong>
                        </p>
                        {est.curso && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            Curso: <span className="font-semibold text-slate-600">{est.curso}</span>
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

            {/* Pagination */}
            {currentTotalPages > 1 && (
              <div className="mt-6 flex items-center justify-center gap-2">
                {currentPage > 1 && (
                  <button
                    onClick={async () => {
                      const nextP = currentPage - 1;
                      setSearchingLive(true);
                      const params = new URLSearchParams();
                      if (searchTerm.trim()) params.set('q', searchTerm.trim());
                      if (selectedCurso) params.set('curso', selectedCurso);
                      if (selectedAdmision) params.set('admision', selectedAdmision);
                      params.set('page', String(nextP));
                      const res = await fetch(`/api/estudiantes?${params.toString()}`);
                      if (res.ok) {
                        const data = await res.json();
                        setEstudiantes(data.estudiantes || []);
                        setCurrentPage(nextP);
                      }
                      setSearchingLive(false);
                    }}
                    className="px-4 py-2 bg-white text-blue-600 rounded-xl shadow-sm border border-slate-200 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    ← Anterior
                  </button>
                )}
                <span className="text-slate-500 text-xs px-3 font-semibold">
                  Página {currentPage} de {currentTotalPages}
                </span>
                {currentPage < currentTotalPages && (
                  <button
                    onClick={async () => {
                      const nextP = currentPage + 1;
                      setSearchingLive(true);
                      const params = new URLSearchParams();
                      if (searchTerm.trim()) params.set('q', searchTerm.trim());
                      if (selectedCurso) params.set('curso', selectedCurso);
                      if (selectedAdmision) params.set('admision', selectedAdmision);
                      params.set('page', String(nextP));
                      const res = await fetch(`/api/estudiantes?${params.toString()}`);
                      if (res.ok) {
                        const data = await res.json();
                        setEstudiantes(data.estudiantes || []);
                        setCurrentPage(nextP);
                      }
                      setSearchingLive(false);
                    }}
                    className="px-4 py-2 bg-white text-blue-600 rounded-xl shadow-sm border border-slate-200 text-sm font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    Siguiente →
                  </button>
                )}
              </div>
            )}
          </>
        ) : (
          /* Courses Tab */
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

      {/* Edit / Create Student Modal */}
      {(editingStudent || isCreatingStudent) && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-lg w-full border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start mb-5 pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-800 text-xl">
                {editingStudent ? '✏️ Editar Datos del Estudiante' : '➕ Registrar Nuevo Estudiante'}
              </h3>
              <button
                onClick={() => { setEditingStudent(null); setIsCreatingStudent(false); }}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold leading-none p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Tipo</label>
                  <select
                    value={formData.tipoDocumento}
                    onChange={e => setFormData(f => ({ ...f, tipoDocumento: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Número Documento</label>
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
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Curso / Grado</label>
                  <input
                    type="text"
                    value={formData.curso}
                    onChange={e => setFormData(f => ({ ...f, curso: e.target.value }))}
                    placeholder="Ej: 201, 3°, Admisión 2°"
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Estado</label>
                  <select
                    value={formData.activo ? '1' : '0'}
                    onChange={e => setFormData(f => ({ ...f, activo: e.target.value === '1' }))}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">✓ Activo</option>
                    <option value="0">✗ Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl flex items-center gap-2">
                <input
                  type="checkbox"
                  id="esAdmisionCheck"
                  checked={formData.esAdmision}
                  onChange={e => setFormData(f => ({ ...f, esAdmision: e.target.checked }))}
                  className="w-4 h-4 text-purple-600 rounded cursor-pointer"
                />
                <label htmlFor="esAdmisionCheck" className="text-xs font-semibold text-purple-900 cursor-pointer select-none">
                  ¿Es estudiante / aspirante para Prueba de Admisión?
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setEditingStudent(null); setIsCreatingStudent(false); }}
                  className="flex-1 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Guardando en MongoDB...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Course Modal */}
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
                  className="flex-1 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs"
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

