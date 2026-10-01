'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

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
  enviadoEn?: string;
  calificacionFinal?: number;
  calificacionesPorArea?: CalificacionArea[];
  respuestas: Array<{
    preguntaOrden: number;
    opcionSeleccionada: string;
    esCorrecta: boolean;
    puntajeObtenido?: number;
    area?: string;
  }>;
}

interface ExamenInfo {
  titulo: string;
  materia?: string;
  esAdmision?: boolean;
  preguntas: Array<{ orden: number; enunciado: string; area?: string }>;
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>();
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [examen, setExamen] = useState<ExamenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Intento | null>(null);

  const loadData = useCallback(async () => {
    const [exRes, resRes] = await Promise.all([
      fetch(`/api/examenes/${id}`),
      fetch(`/api/examenes/${id}/resultados`),
    ]);
    if (exRes.ok) { const d = await exRes.json(); setExamen(d.examen); }
    if (resRes.ok) { const d = await resRes.json(); setIntentos(d.intentos); }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 15 seconds for real-time view
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  const promedio = intentos.filter(i => i.calificacionFinal != null)
    .reduce((sum, i, _, arr) => sum + (i.calificacionFinal || 0) / arr.length, 0);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <Link href={`/examenes/${id}`} className="text-blue-600 hover:underline">Examen</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">Resultados</span>
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
          <button onClick={loadData} className="text-sm bg-white border border-slate-300 hover:bg-slate-50 px-3 py-2 rounded-lg text-blue-600 font-medium flex items-center gap-1 shadow-sm transition">
            🔄 Actualizar
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Presentados', value: intentos.filter(i => i.estado === 'enviado').length, color: 'blue' },
            { label: 'En Progreso', value: intentos.filter(i => i.estado === 'en_progreso').length, color: 'amber' },
            { label: 'Promedio General', value: `${promedio.toFixed(1)}%`, color: 'emerald' },
            { label: 'Aprobados (≥60)', value: intentos.filter(i => (i.calificacionFinal || 0) >= 60).length, color: 'green' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl shadow p-4 text-center">
              <p className="text-slate-400 text-xs mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Estudiante</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Documento</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                {examen?.esAdmision && (
                  <th className="text-left px-4 py-3 font-semibold text-slate-600">Áreas Básicas Evaluadas</th>
                )}
                <th className="text-center px-4 py-3 font-semibold text-slate-600">
                  {examen?.esAdmision ? 'Promedio Final' : 'Calificación'}
                </th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Enviado</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={examen?.esAdmision ? 7 : 6} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              ) : intentos.length === 0 ? (
                <tr><td colSpan={examen?.esAdmision ? 7 : 6} className="text-center py-8 text-slate-400">No hay intentos registrados aún.</td></tr>
              ) : intentos.map(intento => (
                <tr key={intento._id} className="border-b hover:bg-slate-50 transition">
                  <td className="px-4 py-3 font-medium text-slate-800">{intento.estudianteNombre}</td>
                  <td className="px-4 py-3 text-slate-500 font-mono text-xs">{intento.estudianteId}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${intento.estado === 'enviado' ? 'bg-green-100 text-green-700' :
                        intento.estado === 'en_progreso' ? 'bg-amber-100 text-amber-700' :
                        'bg-gray-100 text-gray-600'}`}>
                      {intento.estado === 'enviado' ? 'Enviado' : intento.estado === 'en_progreso' ? 'En Progreso' : 'Bloqueado'}
                    </span>
                  </td>

                  {/* Admissions area breakdown badges */}
                  {examen?.esAdmision && (
                    <td className="px-4 py-3">
                      {intento.calificacionesPorArea && intento.calificacionesPorArea.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-md">
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

                  <td className="px-4 py-3 text-center">
                    {intento.calificacionFinal != null ? (
                      <span className={`font-bold text-lg ${intento.calificacionFinal >= 60 ? 'text-green-600' : 'text-red-500'}`}>
                        {intento.calificacionFinal}%
                      </span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-slate-400">
                    {intento.enviadoEn ? new Date(intento.enviadoEn).toLocaleTimeString('es-CO') : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setSelected(intento)}
                      className="text-blue-600 hover:text-blue-800 text-xs font-semibold underline"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-10 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-3xl w-full my-8">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-xl">{selected.estudianteNombre}</h3>
                <p className="text-slate-500 text-sm">Documento: {selected.estudianteId}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>

            {/* Score summary */}
            <div className="text-center mb-6 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs uppercase font-bold tracking-wider text-slate-400 block mb-1">
                {examen?.esAdmision ? 'Promedio General de Admisión' : 'Calificación Final'}
              </span>
              <div className="text-3xl font-extrabold">
                {selected.calificacionFinal != null ? (
                  <span className={selected.calificacionFinal >= 60 ? 'text-green-600' : 'text-red-500'}>
                    {selected.calificacionFinal}% {selected.calificacionFinal >= 60 ? '✓ Aprobado' : '✗ Reprobado'}
                  </span>
                ) : 'Sin calificar'}
              </div>
            </div>

            {/* Admission areas breakdown */}
            {selected.calificacionesPorArea && selected.calificacionesPorArea.length > 0 && (
              <div className="mb-6">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
                  Desglose por Áreas Básicas (100% por área)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {selected.calificacionesPorArea.map(ca => (
                    <div key={ca.area} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
                      <p className="text-xs font-semibold text-slate-700 truncate" title={ca.area}>{ca.area}</p>
                      <p className={`text-xl font-bold mt-1 ${ca.puntaje >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {ca.puntaje}%
                      </p>
                      <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div
                          className={`h-full ${ca.puntaje >= 60 ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${Math.min(100, ca.puntaje)}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{ca.correctas} de {ca.totalPreguntas} correctas</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Questions breakdown */}
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Detalle de Respuestas por Pregunta
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {selected.respuestas.map(r => (
                <div
                  key={r.preguntaOrden}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm border ${
                    r.esCorrecta
                      ? 'bg-green-50 border-green-200 text-green-900'
                      : 'bg-red-50 border-red-200 text-red-900'
                  }`}
                >
                  <span className="font-bold w-8">P{r.preguntaOrden}</span>
                  {r.area && (
                    <span className="text-xs bg-white/70 px-2 py-0.5 rounded text-slate-600 font-medium">
                      {r.area}
                    </span>
                  )}
                  <span>
                    Respondió: <strong>{r.opcionSeleccionada || 'Sin respuesta'}</strong>
                  </span>
                  <span className="ml-auto font-bold">
                    {r.esCorrecta ? '✓ Correcta' : '✗ Incorrecta'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
