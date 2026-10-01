'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Intento {
  _id: string;
  estudianteNombre: string;
  estudianteId: string;
  estado: string;
  enviadoEn?: string;
  calificacionFinal?: number;
  respuestas: Array<{ preguntaOrden: number; opcionSeleccionada: string; esCorrecta: boolean }>;
}

export default function ResultadosPage() {
  const { id } = useParams<{ id: string }>();
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [examen, setExamen] = useState<{ titulo: string; materia?: string; preguntas: Array<{ orden: number; enunciado: string }> } | null>(null);
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
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <Link href={`/examenes/${id}`} className="text-blue-600 hover:underline">Examen</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-600">Resultados</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              📊 Resultados{examen ? `: ${examen.titulo}` : ''}
            </h1>
            {examen?.materia && <p className="text-slate-500 text-sm">{examen.materia}</p>}
          </div>
          <button onClick={loadData} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
            🔄 Actualizar
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {[
            { label: 'Total Presentados', value: intentos.filter(i => i.estado === 'enviado').length, color: 'blue' },
            { label: 'En Progreso', value: intentos.filter(i => i.estado === 'en_progreso').length, color: 'amber' },
            { label: 'Promedio', value: `${promedio.toFixed(1)}%`, color: 'emerald' },
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
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Calificación</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Enviado</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Cargando...</td></tr>
              ) : intentos.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">No hay intentos registrados aún.</td></tr>
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
                      className="text-blue-600 hover:text-blue-800 text-xs underline"
                    >
                      Ver
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
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">{selected.estudianteNombre}</h3>
                <p className="text-slate-500 text-sm">{selected.estudianteId}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="text-3xl font-bold text-center mb-4 p-4 rounded-xl bg-slate-50">
              {selected.calificacionFinal != null ? (
                <span className={selected.calificacionFinal >= 60 ? 'text-green-600' : 'text-red-500'}>
                  {selected.calificacionFinal}% {selected.calificacionFinal >= 60 ? '✓ Aprobado' : '✗ Reprobado'}
                </span>
              ) : 'Sin calificar'}
            </div>
            <div className="space-y-2">
              {selected.respuestas.map(r => (
                <div key={r.preguntaOrden} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                  ${r.esCorrecta ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <span className="font-bold">P{r.preguntaOrden}</span>
                  <span>Respondió: <strong>{r.opcionSeleccionada || 'Sin respuesta'}</strong></span>
                  <span className="ml-auto">{r.esCorrecta ? '✓' : '✗'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
