'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { distribuirPesos } from '@/lib/utils';

export interface Opcion {
  letra: string;
  texto: string;
  imagen?: string | null;
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
  initialTitulo?: string;
  initialMateria?: string;
  initialDescripcion?: string;
  initialDuracionMinutos?: number | null;
  initialCursos?: string[];
}

const CURSOS_COLEGIO = [
  'KINDER',
  'TRANSICION',
  '101',
  '201',
  '301',
  '401',
  '501',
  '601',
  '701',
  '801',
  '901',
  '1001',
  '1101',
  '1102',
];

const CURSOS_ADMISION = [
  'ADMISIÓN TRANSICIÓN',
  'ADMISIÓN 1°',
  'ADMISIÓN 2°',
  'ADMISIÓN 3°',
  'ADMISIÓN 4°',
  'ADMISIÓN 5°',
  'ADMISIÓN 6°',
  'ADMISIÓN 7°',
  'ADMISIÓN 8°',
  'ADMISIÓN 9°',
  'ADMISIÓN 10°',
  'ADMISIÓN 11°',
];

export default function ExamenEditorView({
  examenId,
  estado,
  esAdmision,
  initialPreguntas,
  initialTitulo = '',
  initialMateria = '',
  initialDescripcion = '',
  initialDuracionMinutos = null,
  initialCursos = [],
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  
  // General configurations state
  const [configOpen, setConfigOpen] = useState(true);
  const [titulo, setTitulo] = useState(initialTitulo);
  const [materia, setMateria] = useState(initialMateria);
  const [descripcion, setDescripcion] = useState(initialDescripcion);
  const [duracionMinutos, setDuracionMinutos] = useState<number | null>(
    initialDuracionMinutos !== undefined ? initialDuracionMinutos : null
  );
  const [cursos, setCursos] = useState<string[]>(initialCursos);
  const [nuevoCurso, setNuevoCurso] = useState('');

  // Questions and UI state
  const [preguntas, setPreguntas] = useState<PreguntaItem[]>(initialPreguntas || []);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filtroArea, setFiltroArea] = useState<string>('todas');

  // Preview state
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewRespuesta, setPreviewRespuesta] = useState<Record<number, string>>({});

  const listadoCursosPredefinidos = esAdmision ? CURSOS_ADMISION : CURSOS_COLEGIO;

  // Course toggling logic
  function toggleCurso(c: string) {
    setCursos(prev => (prev.includes(c) ? prev.filter(item => item !== c) : [...prev, c]));
  }

  function handleAddCustomCurso() {
    const trimmed = nuevoCurso.trim().toUpperCase();
    if (!trimmed) return;
    if (!cursos.includes(trimmed)) {
      setCursos(prev => [...prev, trimmed]);
    }
    setNuevoCurso('');
  }

  function selectPrimaria() {
    const primaria = ['101', '201', '301', '401', '501'];
    setCursos(prev => Array.from(new Set([...prev, ...primaria])));
  }

  function selectBachillerato() {
    const bachi = ['601', '701', '801', '901', '1001', '1101', '1102'];
    setCursos(prev => Array.from(new Set([...prev, ...bachi])));
  }

  function selectTodosCursos() {
    setCursos(listadoCursosPredefinidos);
  }

  function clearCursos() {
    setCursos([]);
  }

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
    setPreguntas(prev =>
      prev.map(p => {
        if (p.orden === orden) {
          return { ...p, respuestaCorrecta: p.respuestaCorrecta === letra ? null : letra };
        }
        return p;
      })
    );
  }

  // Update question field
  function handleUpdateField(orden: number, field: keyof PreguntaItem, value: any) {
    setPreguntas(prev => prev.map(p => (p.orden === orden ? { ...p, [field]: value } : p)));
  }

  // Auto-distribute weights
  function handleAutoDistribuirPesos() {
    if (esAdmision) {
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
      const pesos = distribuirPesos(preguntas.length);
      setPreguntas(prev => prev.map((p, idx) => ({ ...p, peso: pesos[idx] })));
      setMessage({ type: 'success', text: 'Pesos distribuidos al 100% en total.' });
    }
  }

  // Save changes (configurations + questions)
  async function handleGuardar() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/examenes/${examenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          titulo,
          materia,
          descripcion,
          duracionMinutos: duracionMinutos ? Number(duracionMinutos) : null,
          cursos,
          preguntas,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al guardar cambios' });
        return;
      }

      setMessage({
        type: 'success',
        text: '✓ Configuración (Título, Duración, Cursos) y preguntas guardadas correctamente en la base de datos.',
      });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión al guardar.' });
    } finally {
      setSaving(false);
    }
  }

  const preguntasFiltradas =
    filtroArea === 'todas'
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
            ✏️ Configuración y Editor de Examen
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
              {saving ? 'Guardando...' : '💾 Guardar Todo'}
            </button>
          </div>
        )}
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl mb-6 text-sm flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs opacity-60 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* ──────────────── TAB 1: EDITOR Y CONFIGURACIÓN ──────────────── */}
      {activeTab === 'editor' && (
        <div className="space-y-6">
          {/* ⚙️ EXAM CONFIGURATION CARD */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div
              onClick={() => setConfigOpen(!configOpen)}
              className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">⚙️</span>
                <div>
                  <h2 className="font-bold text-slate-800 text-base">Parámetros y Configuración del Examen</h2>
                  <p className="text-xs text-slate-500">Nombre, Cursos a aplicar, Duración y Asignatura</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span>{configOpen ? 'Plegar' : 'Desplegar'}</span>
                <span>{configOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {configOpen && (
              <div className="p-6 space-y-5 bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Nombre / Título */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Nombre / Título del Examen *
                    </label>
                    <input
                      type="text"
                      value={titulo}
                      onChange={e => setTitulo(e.target.value)}
                      placeholder="Ej: Examen Bimestral de Matemáticas - 2° Periodo"
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  {/* Materia / Asignatura */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Materia / Asignatura
                    </label>
                    <input
                      type="text"
                      value={materia}
                      onChange={e => setMateria(e.target.value)}
                      placeholder="Ej: Matemáticas, Ciencias Naturales, Inglés..."
                      className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Duración */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      ⏱️ Duración de la Prueba
                    </label>
                    <span className="text-xs text-slate-400">
                      {duracionMinutos ? `${duracionMinutos} minutos (${Math.floor(duracionMinutos / 60)}h ${duracionMinutos % 60}m)` : 'Sin límite de tiempo'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {[
                      { label: 'Sin Límite', val: null },
                      { label: '30 min', val: 30 },
                      { label: '45 min', val: 45 },
                      { label: '60 min', val: 60 },
                      { label: '90 min', val: 90 },
                      { label: '120 min', val: 120 },
                    ].map(preset => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setDuracionMinutos(preset.val)}
                        className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition ${
                          duracionMinutos === preset.val
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                    
                    <div className="flex items-center gap-1.5 ml-2">
                      <span className="text-xs text-slate-500">Personalizado:</span>
                      <input
                        type="number"
                        min={1}
                        max={300}
                        value={duracionMinutos || ''}
                        onChange={e => setDuracionMinutos(e.target.value ? Number(e.target.value) : null)}
                        placeholder="Minutos"
                        className="w-20 border border-slate-300 rounded-lg px-2 py-1 text-xs text-center font-bold text-slate-800"
                      />
                      <span className="text-xs text-slate-400">min</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">
                    💡 <em>Nota:</em> Durante el examen, los alumnos verán un contador regresivo. Al finalizar el tiempo, las respuestas se enviarán automáticamente y la aplicación se cerrará.
                  </p>
                </div>

                {/* Cursos a Aplicar */}
                <div>
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      👥 Cursos a los que aplica este Examen
                    </label>
                    <div className="flex items-center gap-2 text-xs">
                      {!esAdmision && (
                        <>
                          <button
                            type="button"
                            onClick={selectPrimaria}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            + Primaria (101-501)
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            type="button"
                            onClick={selectBachillerato}
                            className="text-blue-600 hover:underline font-medium"
                          >
                            + Bachillerato (601-1102)
                          </button>
                          <span className="text-slate-300">|</span>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={selectTodosCursos}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        Todos
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={clearCursos}
                        className="text-red-500 hover:underline font-medium"
                      >
                        Limpiar
                      </button>
                    </div>
                  </div>

                  {/* Chips grid */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {listadoCursosPredefinidos.map(c => {
                      const isSelected = cursos.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCurso(c)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}{c}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom courses if any were added */}
                  {cursos.some(c => !listadoCursosPredefinidos.includes(c)) && (
                    <div className="mb-3">
                      <p className="text-xs text-slate-400 font-semibold mb-1">Cursos personalizados agregados:</p>
                      <div className="flex flex-wrap gap-2">
                        {cursos
                          .filter(c => !listadoCursosPredefinidos.includes(c))
                          .map(c => (
                            <span
                              key={c}
                              className="bg-purple-100 text-purple-800 border border-purple-200 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5"
                            >
                              ✓ {c}
                              <button
                                type="button"
                                onClick={() => toggleCurso(c)}
                                className="text-purple-500 hover:text-purple-800 font-bold ml-1"
                              >
                                ✕
                              </button>
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Add custom course */}
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={nuevoCurso}
                      onChange={e => setNuevoCurso(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomCurso();
                        }
                      }}
                      placeholder="Agregar otro curso / código (ej: 802)..."
                      className="border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 flex-1 uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomCurso}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs border border-slate-300 transition"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>

                {/* Descripción / Instrucciones */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Descripción / Instrucciones para el Estudiante
                  </label>
                  <textarea
                    rows={2}
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Instrucciones generales del examen, recomendaciones pedagógicas, etc."
                    className="w-full border border-slate-300 rounded-xl p-3 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Save parameters quick button */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={handleGuardar}
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-1.5"
                  >
                    {saving ? 'Guardando...' : '💾 Guardar Parámetros y Preguntas'}
                  </button>
                </div>
              </div>
            )}
          </div>

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
                  p.respuestaCorrecta ? 'border-emerald-500' : 'border-amber-400'
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

                {/* AI / Pedagogical review notes */}
                {p.notas && (
                  <div className="mb-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 shadow-xs">
                    <span className="font-bold flex-shrink-0 text-amber-600">💡 Revisión Pedagógica:</span>
                    <span className="leading-relaxed">{p.notas}</span>
                  </div>
                )}

                {/* Diagram / Image if attached */}
                {p.imagen && (
                  <div className="mb-4 bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col items-center">
                    <p className="text-xs text-slate-400 mb-2">Diagrama / Imagen asociada:</p>
                    <img
                      src={p.imagen}
                      alt={`Diagrama pregunta ${p.orden}`}
                      className="max-h-60 object-contain rounded-lg shadow-sm bg-white p-1"
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

                        {op.imagen && (
                          <div className="flex-shrink-0 my-1 bg-white p-1 rounded-lg border border-slate-200">
                            <img
                              src={op.imagen}
                              alt={`Opción ${op.letra}`}
                              className="max-h-24 max-w-[140px] object-contain rounded"
                            />
                          </div>
                        )}

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
                          placeholder={op.imagen ? 'Descripción opcional de la figura...' : `Opción ${op.letra}...`}
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
                {preguntas.filter(p => !p.respuestaCorrecta).length === 0
                  ? '✅ Todas las preguntas tienen respuesta correcta'
                  : `${preguntas.filter(p => !!p.respuestaCorrecta).length} de ${preguntas.length} respuestas correctas asignadas`}
              </p>
              <p className="text-xs text-slate-500">
                {esAdmision ? 'Ponderación dividida en las 5 áreas básicas' : `Ponderación total: ${pesoTotalGeneral}%`}
                {duracionMinutos ? ` • Duración: ${duracionMinutos} min` : ' • Sin límite de tiempo'}
                {cursos.length > 0 ? ` • ${cursos.length} cursos seleccionados` : ''}
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
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-xs bg-emerald-500 text-slate-900 font-bold px-2.5 py-1 rounded-full uppercase">
                Simulador de Pantalla de Estudiante
              </span>
              <span className="text-sm font-semibold text-slate-300">{titulo || 'Sin título'}</span>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              {duracionMinutos && (
                <span className="text-amber-300 font-mono font-bold">
                  ⏱️ {duracionMinutos}:00
                </span>
              )}
              <span>Pregunta {previewIdx + 1} de {preguntas.length}</span>
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
                      onClick={() =>
                        setPreviewRespuesta(prev => ({
                          ...prev,
                          [preguntas[previewIdx].orden]: op.letra,
                        }))
                      }
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
                      <div className="flex-1">
                        {op.texto && <span className="text-sm font-medium block leading-relaxed">{op.texto}</span>}
                        {op.imagen && (
                          <div className="mt-2 bg-white p-1 rounded-lg border border-slate-200 inline-block shadow-xs">
                            <img
                              src={op.imagen}
                              alt={`Opción ${op.letra}`}
                              className="max-h-36 max-w-full rounded object-contain"
                            />
                          </div>
                        )}
                      </div>
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
