'use client';

import { useState } from 'react';
import { distribuirPesos } from '@/lib/utils';

export interface Opcion {
  letra: string;
  texto: string;
}

export interface PreguntaItem {
  orden: number;
  enunciado: string;
  area?: string;
  opciones: Opcion[];
  respuestaCorrecta: string | null;
  peso: number;
  imagen?: string | null;
  notas?: string | null;
}

interface Props {
  examenId: string;
  estado: string;
  esAdmision: boolean;
  initialPreguntas: PreguntaItem[];
}

const AREAS_ADMISION = [
  'Matemáticas',
  'Español',
  'Ciencias Naturales',
  'Ciencias Sociales',
  'Inglés'
];

export default function ExamenEditorView({
  examenId,
  estado,
  esAdmision,
  initialPreguntas,
}: Props) {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [preguntas, setPreguntas] = useState<PreguntaItem[]>(initialPreguntas || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>('todas');

  // Preview state
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewRespuesta, setPreviewRespuesta] = useState<Record<number, string>>({});

  // Calculations for admissions vs regular weights
  const areasList = esAdmision
    ? Array.from(new Set(preguntas.map(p => p.area || 'General')))
    : [];

  const areaWeights = areasList.map(area => {
    const questionsInArea = preguntas.filter(p => (p.area || 'General') === area);
    const sum = questionsInArea.reduce((acc, q) => acc + (q.peso || 0), 0);
    return { area, total: questionsInArea.length, sum };
  });

  const pesoTotalGeneral = preguntas.reduce((sum, p) => sum + (p.peso || 0), 0);

  // Set correct answer for a question
  function handleSelectCorrecta(orden: number, letra: string) {
    setPreguntas(prev => prev.map(p => {
      if (p.orden === orden) {
        return { ...p, respuestaCorrecta: p.respuestaCorrecta === letra ? null : letra };
      }
      return p;
    }));
  }

  // Update question field
  function handleUpdateField(orden: number, field: keyof PreguntaItem, value: any) {
    setPreguntas(prev => prev.map(p => p.orden === orden ? { ...p, [field]: value } : p));
  }

  // Auto-distribute weights
  function handleAutoDistribuirPesos() {
    if (esAdmision) {
      // 100% per area
      setPreguntas(prev => {
        const copy = [...prev];
        const byArea = new Map<string, PreguntaItem[]>();
        copy.forEach(p => {
          const a = p.area || 'General';
          if (!byArea.has(a)) byArea.set(a, []);
          byArea.get(a)!.push(p);
        });

        byArea.forEach(list => {
          const pesos = distribuirPesos(list.length);
          list.forEach((q, idx) => {
            q.peso = pesos[idx];
          });
        });
        return copy;
      });
      setMessage({ type: 'success', text: 'Pesos distribuidos al 100% en cada una de las áreas.' });
    } else {
      // 100% total
      const pesos = distribuirPesos(preguntas.length);
      setPreguntas(prev => prev.map((p, idx) => ({ ...p, peso: pesos[idx] })));
      setMessage({ type: 'success', text: 'Pesos distribuidos al 100% en total.' });
    }
  }

  // Save changes
  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/examenes/${examenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          preguntas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al guardar cambios' });
        return;
      }

      setMessage({ type: 'success', text: '✓ Respuestas y preguntas guardadas correctamente en la base de datos.' });
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al guardar.' });
    } finally {
      setSaving(false);
    }
  }

  const preguntasFiltradas = filtroArea === 'todas'
    ? preguntas
    : preguntas.filter(p => (p.area || 'General') === filtroArea);

  return (
    <div className="mt-6">
      {/* Tab Switcher */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-2 bg-slate-200/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'editor'
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            ✏️ Configurar Respuestas y Pesos
          </button>
          <button
            onClick={() => setActiveTab('preview')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
              activeTab === 'preview'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            👁️ Vista Previa en Vivo (Simulación)
          </button>
        </div>

        {activeTab === 'editor' && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoDistribuirPesos}
              className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium px-3 py-2 rounded-lg border border-slate-300 transition"
            >
              ⚖️ Nivelar Pesos al 100%
            </button>
            <button
              onClick={handleGuardar}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold px-5 py-2 rounded-lg shadow-sm transition flex items-center gap-2"
            >
              {saving ? 'Guardando...' : '💾 Guardar Respuestas'}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div className={`p-4 rounded-xl mb-6 text-sm flex items-center justify-between ${
          message.type === 'success'
            ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* ──────────────── TAB 1: EDITOR DE RESPUESTAS Y PESOS ──────────────── */}
      {activeTab === 'editor' && (
        <div className="space-y-6">
          {/* Instructions banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-900 flex items-start gap-3">
            <span className="text-2xl flex-shrink-0">💡</span>
            <div>
              <p className="font-semibold mb-1">
                Haz clic en una opción (A, B, C o D) para definirla como la <strong>Respuesta Correcta</strong> (se marcará en verde).
              </p>
              <p className="text-xs text-blue-800">
                {esAdmision
                  ? 'Esta prueba de admisión está dividida en las 5 áreas básicas. Cada área tiene su propio 100% de ponderación.'
                  : 'Cada pregunta tiene su peso en porcentaje. La suma de todas las preguntas debe totalizar 100%.'}
              </p>
            </div>
          </div>

          {/* Area Status Bar (For Admissions) */}
          {esAdmision && (
            <div className="bg-white rounded-2xl shadow p-5 border border-slate-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Distribución por Áreas Básicas (100% cada una)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {areaWeights.map(aw => (
                  <div
                    key={aw.area}
                    onClick={() => setFiltroArea(filtroArea === aw.area ? 'todas' : aw.area)}
                    className={`cursor-pointer rounded-xl p-3 border transition ${
                      filtroArea === aw.area
                        ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                        : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <p className="font-bold text-slate-800 text-sm truncate">{aw.area}</p>
                    <p className="text-xs text-slate-500 mt-1">{aw.total} preguntas</p>
                    <div className="mt-2 flex items-center justify-between text-xs font-semibold">
                      <span className={aw.sum === 100 ? 'text-emerald-600' : 'text-amber-600'}>
                        {aw.sum}%
                      </span>
                      {aw.sum === 100 ? (
                        <span className="text-emerald-500 text-xs">✓ Ok</span>
                      ) : (
                        <span className="text-amber-500 text-xs">Ajustar</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {filtroArea !== 'todas' && (
                <div className="mt-3 text-right">
                  <button
                    onClick={() => setFiltroArea('todas')}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Mostrar todas las áreas
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Questions list */}
          <div className="space-y-4">
            {preguntasFiltradas.map(p => (
              <div
                key={p.orden}
                className={`bg-white rounded-2xl shadow p-6 border-l-4 transition ${
                  p.respuestaCorrecta
                    ? 'border-emerald-500'
                    : 'border-amber-400'
                }`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="bg-slate-100 font-mono font-bold text-slate-800 px-3 py-1 rounded-lg text-sm">
                      Pregunta #{p.orden}
                    </span>
                    {p.area && (
                      <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {p.area}
                      </span>
                    )}
                    {p.respuestaCorrecta ? (
                      <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                        ✓ Correcta: Opción {p.respuestaCorrecta}
                      </span>
                    ) : (
                      <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        ⚠️ Sin respuesta asignada
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 font-medium">Peso:</label>
                    <input
                      type="number"
                      value={p.peso}
                      onChange={e => handleUpdateField(p.orden, 'peso', Number(e.target.value))}
                      className="w-16 border border-slate-300 rounded-lg px-2 py-1 text-center font-bold text-sm text-slate-900 bg-white"
                      min={1}
                      max={100}
                    />
                    <span className="text-xs text-slate-400">%</span>
                  </div>
                </div>

                {/* Enunciado */}
                <div className="mb-4">
                  <textarea
                    rows={2}
                    value={p.enunciado}
                    onChange={e => handleUpdateField(p.orden, 'enunciado', e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-3 text-slate-900 text-base font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    placeholder="Enunciado de la pregunta..."
                  />
                </div>

                {/* Diagram / Image if attached */}
                {p.imagen && (
                  <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                    <p className="text-xs text-slate-400 mb-2">Diagrama / Imagen asociada:</p>
                    <img
                      src={p.imagen}
                      alt={`Diagrama pregunta ${p.orden}`}
                      className="max-h-60 object-contain rounded-lg shadow-sm"
                    />
                    <button
                      onClick={() => handleUpdateField(p.orden, 'imagen', null)}
                      className="text-xs text-red-500 hover:text-red-700 underline mt-2"
                    >
                      Quitar imagen
                    </button>
                  </div>
                )}

                {/* Options (clickable to select correct answer) */}
                <div className="space-y-2">
                  <p className="text-xs text-slate-400 font-semibold mb-1">
                    Opciones de respuesta (haz clic para marcar la correcta):
                  </p>
                  {p.opciones.map(op => {
                    const isCorrect = p.respuestaCorrecta === op.letra;
                    return (
                      <div
                        key={op.letra}
                        onClick={() => handleSelectCorrecta(p.orden, op.letra)}
                        className={`cursor-pointer w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition ${
                          isCorrect
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-950 font-semibold shadow-sm'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 transition ${
                            isCorrect
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {op.letra}
                        </span>
                        <input
                          type="text"
                          value={op.texto}
                          onClick={e => e.stopPropagation()}
                          onChange={e => {
                            const newOps = p.opciones.map(o =>
                              o.letra === op.letra ? { ...o, texto: e.target.value } : o
                            );
                            handleUpdateField(p.orden, 'opciones', newOps);
                          }}
                          className={`flex-1 bg-transparent border-0 text-sm focus:outline-none ${
                            isCorrect ? 'text-emerald-950 font-medium' : 'text-slate-800'
                          }`}
                        />
                        {isCorrect && (
                          <span className="text-xs bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                            ✓ Correcta
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Sticky Bottom Save Bar */}
          <div className="sticky bottom-4 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-xl p-4 flex items-center justify-between flex-wrap gap-4 z-20">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {preguntas.filter(p => !!p.respuestaCorrecta).length} de {preguntas.length} respuestas correctas asignadas
              </p>
              <p className="text-xs text-slate-500">
                {esAdmision ? 'Ponderación dividida en las 5 áreas básicas' : `Ponderación total: ${pesoTotalGeneral}%`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setActiveTab('preview')}
                className="px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                👁️ Probar Vista Previa
              </button>
              <button
                onClick={handleGuardar}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition"
              >
                {saving ? 'Guardando...' : '💾 Guardar Todo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ──────────────── TAB 2: VISTA PREVIA EN VIVO (SIMULADOR) ──────────────── */}
      {activeTab === 'preview' && (
        <div className="bg-slate-900 rounded-3xl p-6 shadow-2xl text-white">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-xs bg-emerald-500 text-slate-900 font-bold px-2.5 py-1 rounded-full uppercase">
                Simulador de Pantalla de Estudiante
              </span>
            </div>
            <div className="text-xs text-slate-400">
              Pregunta {previewIdx + 1} de {preguntas.length}
            </div>
          </div>

          {/* Simulated Student Card */}
          {preguntas[previewIdx] && (
            <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 shadow-2xl text-slate-900 mb-6">
              {/* Card Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                  Pregunta {previewIdx + 1}
                </span>
                {preguntas[previewIdx].area && (
                  <span className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {preguntas[previewIdx].area}
                  </span>
                )}
                <span className="text-xs text-slate-400">
                  Valor: {preguntas[previewIdx].peso}%
                </span>
              </div>

              {/* Diagram / Image */}
              {preguntas[previewIdx].imagen && (
                <div className="mb-6 flex justify-center bg-slate-50 border border-slate-200 rounded-2xl p-3">
                  <img
                    src={preguntas[previewIdx].imagen!}
                    alt="Diagrama"
                    className="max-h-64 object-contain rounded-lg"
                  />
                </div>
              )}

              {/* Enunciado */}
              <p className="text-lg font-medium text-slate-800 mb-6 leading-relaxed whitespace-pre-wrap">
                {preguntas[previewIdx].enunciado}
              </p>

              {/* Options */}
              <div className="space-y-3">
                {preguntas[previewIdx].opciones.map(op => {
                  const isSelected = previewRespuesta[preguntas[previewIdx].orden] === op.letra;
                  return (
                    <button
                      key={op.letra}
                      onClick={() => setPreviewRespuesta(prev => ({
                        ...prev,
                        [preguntas[previewIdx].orden]: op.letra
                      }))}
                      className={`w-full text-left flex items-start gap-4 px-5 py-3.5 rounded-2xl border-2 transition ${
                        isSelected
                          ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5 ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {op.letra}
                      </span>
                      <span className="text-sm font-medium">{op.texto}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <button
              onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
              disabled={previewIdx === 0}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-sm font-semibold transition"
            >
              ← Anterior
            </button>

            {/* Quick jump dots */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center max-w-sm">
              {preguntas.map((p, idx) => (
                <button
                  key={p.orden}
                  onClick={() => setPreviewIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition ${
                    previewIdx === idx
                      ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                      : previewRespuesta[p.orden]
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => setPreviewIdx(i => Math.min(preguntas.length - 1, i + 1))}
              disabled={previewIdx === preguntas.length - 1}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-white text-sm font-semibold transition"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
