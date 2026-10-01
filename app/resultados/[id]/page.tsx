'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatHoraBogota, formatFechaHoraBogota } from '@/lib/utils';

interface CalificacionArea {
  area: string;
  puntaje: number;
  correctas: number;
  totalPreguntas: number;
}

interface Intento {
  _id: string;
  estudianteNombre: string;
  estudianteId: string;
  estado: string;
  iniciadoEn?: string;
  enviadoEn?: string;
  calificacionFinal?: number;
  calificacionesPorArea?: CalificacionArea[];
  intentoNumero: number;
  autorizadoPor?: string;
  autorizadoEn?: string;
  respuestas: Array<{
    preguntaOrden: number;
    opcionSeleccionada: string;
    esCorrecta: boolean;
    puntajeObtenido?: number;
    area?: string;
  }>;
}

interface Habilitacion {
  _id: string;
  examenId: string;
  estudianteId: string;
  intentosPermitidos: number;
  autorizadoPor?: string;
  autorizadoEn?: string;
}

interface ExamenInfo {
  _id: string;
  titulo: string;
  materia?: string;
  esAdmision?: boolean;
  intentosPermitidos?: number;
  preguntas: Array<{ orden: number; enunciado: string; area?: string }>;
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>();
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [habilitaciones, setHabilitaciones] = useState<Habilitacion[]>([]);
  const [examen, setExamen] = useState<ExamenInfo | null>(null);
  const [esDirectivo, setEsDirectivo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Intento | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  const showToast = (tipo: 'success' | 'error', mensaje: string) => {
    setToast({ tipo, mensaje });
    setTimeout(() => setToast(null), 5000);
  };

  const loadData = useCallback(async () => {
    try {
      const [exRes, resRes] = await Promise.all([
        fetch(`/api/examenes/${id}`),
        fetch(`/api/examenes/${id}/resultados`),
      ]);
      if (exRes.ok) {
        const d = await exRes.json();
        setExamen(d.examen);
      }
      if (resRes.ok) {
        const d = await resRes.json();
        setIntentos(d.intentos || []);
        setHabilitaciones(d.habilitaciones || []);
        setEsDirectivo(!!(d.esDirectivo || d.esAdmin));
      }
    } catch (_) {
      showToast('error', 'Error al cargar los resultados.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 20 seconds
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Handle authorizing a second attempt
  const handleHabilitarSegundoIntento = async (estudianteId: string, estudianteNombre: string) => {
    if (!confirm(`¿Deseas habilitar un 2° INTENTO para el estudiante ${estudianteNombre} (${estudianteId})?\n\nEl 1er intento y sus respuestas se mantendrán intactos para comparar ambos resultados.`)) {
      return;
    }

    setActionLoading(estudianteId);
    try {
      const res = await fetch(`/api/examenes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'habilitar_intento',
          estudianteId,
          intentosPermitidos: 2,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast('error', data.error || 'No se pudo habilitar el segundo intento.');
        return;
      }
      showToast('success', `✓ 2° intento habilitado con éxito para ${estudianteNombre}.`);
      await loadData();
    } catch (_) {
      showToast('error', 'Error de conexión al habilitar intento.');
    } finally {
      setActionLoading(null);
    }
  };

  // Group attempts by student
  const intentosPorEstudiante = useMemo(() => {
    const map = new Map<string, {
      estudianteId: string;
      estudianteNombre: string;
      intentos: Intento[];
      habilitacion?: Habilitacion;
    }>();

    for (const intento of intentos) {
      if (!map.has(intento.estudianteId)) {
        map.set(intento.estudianteId, {
          estudianteId: intento.estudianteId,
          estudianteNombre: intento.estudianteNombre,
          intentos: [],
          habilitacion: habilitaciones.find(h => h.estudianteId === intento.estudianteId),
        });
      }
      map.get(intento.estudianteId)!.intentos.push(intento);
    }

    // Sort attempts within each student by intentoNumero
    for (const group of map.values()) {
      group.intentos.sort((a, b) => (a.intentoNumero || 1) - (b.intentoNumero || 1));
    }

    // Filter by text search
    let list = Array.from(map.values());
    if (filtroTexto.trim()) {
      const q = filtroTexto.toLowerCase();
      list = list.filter(g =>
        g.estudianteNombre.toLowerCase().includes(q) ||
        g.estudianteId.toLowerCase().includes(q)
      );
    }

    return list;
  }, [intentos, habilitaciones, filtroTexto]);

  const totalPresentados = intentos.filter(i => i.estado === 'enviado').length;
  const totalEnProgreso = intentos.filter(i => i.estado === 'en_progreso').length;
  const promedioGeneral = intentos.filter(i => i.calificacionFinal != null).length > 0
    ? (intentos.filter(i => i.calificacionFinal != null).reduce((sum, i) => sum + (i.calificacionFinal || 0), 0) / intentos.filter(i => i.calificacionFinal != null).length)
    : 0;
  const totalAprobados = intentos.filter(i => (i.calificacionFinal || 0) >= 60).length;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Toast Notification */}
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
              <Link href="/resultados" className="text-blue-600 hover:underline">Resultados</Link>
              <span className="text-slate-400">/</span>
              <Link href={`/examenes/${id}`} className="text-blue-600 hover:underline">
                {examen ? examen.titulo : 'Examen'}
              </Link>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-slate-800">
                📊 Resultados{examen ? `: ${examen.titulo}` : ''}
              </h1>
              {examen?.esAdmision && (
                <span className="bg-purple-100 text-purple-800 font-semibold text-xs px-3 py-1 rounded-full border border-purple-200">
                  🎓 Prueba de Admisión (5 Áreas)
                </span>
              )}
            </div>
            {examen?.materia && <p className="text-slate-500 text-sm mt-0.5">{examen.materia}</p>}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/examenes/${id}`}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition shadow-xs"
            >
              ⚙️ Gestionar Examen
            </Link>
            <button
              onClick={loadData}
              className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-1.5 shadow-sm transition"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Intentos Enviados</p>
            <p className="text-3xl font-extrabold text-blue-700">{totalPresentados}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">En Presentación</p>
            <p className="text-3xl font-extrabold text-amber-600">{totalEnProgreso}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Promedio General</p>
            <p className="text-3xl font-extrabold text-emerald-600">{promedioGeneral.toFixed(1)}%</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 text-center">
            <p className="text-slate-400 text-xs font-semibold uppercase mb-1">Aprobados (≥60)</p>
            <p className="text-3xl font-extrabold text-green-700">{totalAprobados}</p>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={filtroTexto}
              onChange={e => setFiltroTexto(e.target.value)}
              placeholder="Filtrar por nombre o documento del estudiante..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
            />
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Mostrando <strong>{intentosPorEstudiante.length}</strong> estudiante(s) con intentos registrados
          </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left px-5 py-3.5 font-bold">Estudiante</th>
                <th className="text-center px-4 py-3.5 font-bold">Intento</th>
                <th className="text-center px-4 py-3.5 font-bold">Estado</th>
                {examen?.esAdmision && (
                  <th className="text-left px-4 py-3.5 font-bold">Áreas Evaluadas</th>
                )}
                <th className="text-center px-4 py-3.5 font-bold">
                  {examen?.esAdmision ? 'Promedio Final' : 'Calificación'}
                </th>
                <th className="text-center px-4 py-3.5 font-bold">Hora Envío</th>
                <th className="text-center px-4 py-3.5 font-bold">Acciones / 2° Intento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={examen?.esAdmision ? 7 : 6} className="text-center py-12 text-slate-400">
                    <div className="animate-spin w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full mx-auto mb-2" />
                    Cargando intentos y calificaciones...
                  </td>
                </tr>
              ) : intentosPorEstudiante.length === 0 ? (
                <tr>
                  <td colSpan={examen?.esAdmision ? 7 : 6} className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-2">📭</div>
                    No hay intentos registrados que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                intentosPorEstudiante.map(grupo => {
                  const tieneSegundoIntentoHabilitado = (grupo.habilitacion?.intentosPermitidos || 1) >= 2;
                  const totalIntentosRealizados = grupo.intentos.length;

                  return grupo.intentos.map((intento, idx) => {
                    const isFirstRowOfStudent = idx === 0;
                    const numIntento = intento.intentoNumero || (idx + 1);

                    return (
                      <tr
                        key={intento._id}
                        className={`hover:bg-slate-50/80 transition ${
                          numIntento > 1 ? 'bg-purple-50/20' : ''
                        }`}
                      >
                        {/* Student Name & Document */}
                        <td className="px-5 py-3.5 font-medium text-slate-800">
                          <div className="font-semibold text-slate-900">{intento.estudianteNombre}</div>
                          <div className="text-slate-400 font-mono text-xs mt-0.5">Doc: {intento.estudianteId}</div>
                        </td>

                        {/* Attempt Number Badge */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                            numIntento === 1
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : numIntento === 2
                              ? 'bg-purple-100 text-purple-800 border-purple-300 ring-2 ring-purple-100'
                              : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                          }`}>
                            <span>{numIntento === 1 ? '🥇' : '🥈'}</span>
                            <span>{numIntento}° Intento</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            intento.estado === 'enviado'
                              ? 'bg-emerald-100 text-emerald-800'
                              : intento.estado === 'en_progreso'
                              ? 'bg-amber-100 text-amber-800 animate-pulse'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {intento.estado === 'enviado' ? '✓ Enviado' : intento.estado === 'en_progreso' ? '⏱ En Progreso' : 'Bloqueado'}
                          </span>
                        </td>

                        {/* Admissions area breakdown */}
                        {examen?.esAdmision && (
                          <td className="px-4 py-3.5">
                            {intento.calificacionesPorArea && intento.calificacionesPorArea.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 max-w-sm">
                                {intento.calificacionesPorArea.map(ca => (
                                  <span
                                    key={ca.area}
                                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                      ca.puntaje >= 60
                                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                        : ca.puntaje >= 40
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-red-50 text-red-800 border-red-200'
                                    }`}
                                    title={`${ca.area}: ${ca.correctas}/${ca.totalPreguntas} correctas`}
                                  >
                                    {ca.area.slice(0, 4)}: {ca.puntaje}%
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>
                        )}

                        {/* Final Score */}
                        <td className="px-4 py-3.5 text-center">
                          {intento.calificacionFinal != null ? (
                            <div className="flex flex-col items-center">
                              <span className={`font-black text-lg ${
                                intento.calificacionFinal >= 60 ? 'text-emerald-600' : 'text-red-500'
                              }`}>
                                {intento.calificacionFinal}%
                              </span>
                              <span className="text-[10px] text-slate-400 uppercase font-semibold">
                                {intento.calificacionFinal >= 60 ? 'Aprobado' : 'Reprobado'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 font-semibold">—</span>
                          )}
                        </td>

                        {/* Time submitted */}
                        <td className="px-4 py-3.5 text-center text-xs text-slate-500 font-mono">
                          {intento.enviadoEn ? formatHoraBogota(intento.enviadoEn) : 'En curso'}
                        </td>

                        {/* Actions / 2nd Attempt */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2 flex-wrap">
                            <button
                              onClick={() => setSelected(intento)}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition border border-blue-200"
                            >
                              🔍 Ver Respuestas
                            </button>

                            {/* Enable 2nd attempt button (shown once per student on their latest row) */}
                            {isFirstRowOfStudent && esDirectivo && (
                              <>
                                {!tieneSegundoIntentoHabilitado && totalIntentosRealizados === 1 ? (
                                  <button
                                    onClick={() => handleHabilitarSegundoIntento(intento.estudianteId, intento.estudianteNombre)}
                                    disabled={actionLoading === intento.estudianteId}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition shadow-xs flex items-center gap-1 disabled:opacity-50"
                                    title="Habilitar un segundo intento para este estudiante"
                                  >
                                    {actionLoading === intento.estudianteId ? (
                                      'Habilitando...'
                                    ) : (
                                      <>
                                        <span>➕</span>
                                        <span>Dar 2° Intento</span>
                                      </>
                                    )}
                                  </button>
                                ) : tieneSegundoIntentoHabilitado && totalIntentosRealizados === 1 ? (
                                  <span
                                    className="px-2 py-0.5 bg-purple-100 text-purple-800 border border-purple-300 rounded-lg text-[11px] font-bold"
                                    title={`Autorizado por ${grupo.habilitacion?.autorizadoPor || 'Directivo'}`}
                                  >
                                    ✓ 2° Intento Habilitado
                                  </span>
                                ) : null}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl p-6 md:p-8 max-w-3xl w-full my-8 border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex justify-between items-start mb-4 pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-800 text-xl md:text-2xl">{selected.estudianteNombre}</h3>
                  <span className="bg-blue-100 text-blue-800 font-bold text-xs px-2.5 py-0.5 rounded-full border border-blue-200">
                    {selected.intentoNumero || 1}° Intento
                  </span>
                </div>
                <p className="text-slate-500 text-xs mt-1">
                  Documento: <strong className="font-mono">{selected.estudianteId}</strong> • Enviado:{' '}
                  {selected.enviadoEn ? formatFechaHoraBogota(selected.enviadoEn) : 'En curso'}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-slate-700 text-2xl font-bold p-1 leading-none rounded-lg hover:bg-slate-100 transition"
              >
                ✕
              </button>
            </div>

            {/* Score Summary Card */}
            <div className="text-center mb-6 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/80 shadow-xs">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-500 block mb-1">
                {examen?.esAdmision ? 'Promedio General de Admisión' : 'Calificación Final Obtenida'}
              </span>
              <div className="text-4xl font-black">
                {selected.calificacionFinal != null ? (
                  <span className={selected.calificacionFinal >= 60 ? 'text-emerald-600' : 'text-red-500'}>
                    {selected.calificacionFinal}%{' '}
                    <span className="text-lg font-bold">
                      ({selected.calificacionFinal >= 60 ? '✓ Aprobado' : '✗ Reprobado'})
                    </span>
                  </span>
                ) : (
                  'Sin calificar'
                )}
              </div>
            </div>

            {/* Admission Areas Breakdown */}
            {selected.calificacionesPorArea && selected.calificacionesPorArea.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Desglose por Áreas de Admisión (100% por área)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {selected.calificacionesPorArea.map(ca => (
                    <div key={ca.area} className="bg-white border border-slate-200 rounded-xl p-3 text-center shadow-2xs">
                      <p className="text-xs font-bold text-slate-700 truncate" title={ca.area}>
                        {ca.area}
                      </p>
                      <p className={`text-xl font-extrabold mt-1 ${ca.puntaje >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {ca.puntaje}%
                      </p>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-200">
                        <div
                          className={`h-full ${ca.puntaje >= 60 ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, ca.puntaje)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 font-medium">
                        {ca.correctas} de {ca.totalPreguntas} correctas
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions Breakdown */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Detalle de Respuestas Marcadas por el Estudiante ({selected.respuestas.length} preguntas)
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {selected.respuestas.map(r => (
                <div
                  key={r.preguntaOrden}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm border transition ${
                    r.esCorrecta
                      ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                      : 'bg-red-50/70 border-red-200 text-red-950'
                  }`}
                >
                  <span className="font-bold w-10 text-xs uppercase px-1.5 py-0.5 rounded bg-white/80 border border-slate-200 text-center">
                    P{r.preguntaOrden}
                  </span>
                  {r.area && (
                    <span className="text-xs bg-white px-2 py-0.5 rounded-md text-slate-600 font-semibold border border-slate-200">
                      {r.area}
                    </span>
                  )}
                  <span className="text-sm">
                    Opción seleccionada: <strong>{r.opcionSeleccionada || 'Sin respuesta'}</strong>
                  </span>
                  <span className="ml-auto font-bold text-xs uppercase px-2 py-0.5 rounded">
                    {r.esCorrecta ? '✓ Correcta' : '✗ Incorrecta'}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-right">
              <button
                onClick={() => setSelected(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-sm rounded-xl transition shadow-xs"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
