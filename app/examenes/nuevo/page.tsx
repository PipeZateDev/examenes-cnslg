'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface Opcion {
  letra: string;
  texto: string;
}

interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: Opcion[];
  respuestaCorrecta: string | null;
  peso: number;
  notas?: string;
}

export default function NuevoExamenPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'review' | 'saving'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState('');

  const [titulo, setTitulo] = useState('');
  const [materia, setMateria] = useState('');
  const [duracion, setDuracion] = useState('');
  const [esAdmision, setEsAdmision] = useState(false);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);

  // ─── Step 1: Upload and process PDF / DOCX ──────────────────────────────────
  async function handleProcesar() {
    if (!file) return;
    setProcesando(true);
    setError('');
    try {
      let res: Response;

      // For Word (.docx): extract text directly in browser so we send ~8KB instead of 4.7MB (avoids Vercel 413 Payload limit)
      if (file.name.toLowerCase().endsWith('.docx')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          // @ts-expect-error mammoth browser bundle
          const mammothModule = await import('mammoth/mammoth.browser.js');
          const mammothBrowser = mammothModule.default || mammothModule;
          const { value: extractedText } = await mammothBrowser.extractRawText({ arrayBuffer });

          if (!extractedText || !extractedText.trim()) {
            setError('No se pudo extraer texto del documento Word. Verifica que tenga contenido legible.');
            setProcesando(false);
            return;
          }

          res = await fetch('/api/examenes/procesar-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              texto: extractedText,
              nombreArchivo: file.name,
            }),
          });
        } catch (docxErr) {
          console.warn('Fallback a subida normal de archivo:', docxErr);
          const fd = new FormData();
          fd.append('file', file);
          res = await fetch('/api/examenes/procesar-pdf', { method: 'POST', body: fd });
        }
      } else {
        // PDF or other formats
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch('/api/examenes/procesar-pdf', { method: 'POST', body: fd });
      }

      let data: any = null;
      try {
        data = await res.json();
      } catch (_) {
        setError(`Error del servidor (${res.status} ${res.statusText || 'Respuesta no válida'}).`);
        return;
      }

      if (!res.ok) { setError(data?.error || `Error ${res.status}: no se pudo procesar`); return; }

      if (data.titulo) setTitulo(data.titulo);
      if (data.materia) setMateria(data.materia);
      setPreguntas(data.preguntas);
      setStep('review');
    } catch (err: any) {
      setError(`Error de procesamiento: ${err?.message || 'Verifica tu red o variables en Vercel'}`);
    } finally {
      setProcesando(false);
    }
  }

  function updatePregunta(idx: number, field: keyof Pregunta, value: unknown) {
    setPreguntas(ps => ps.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  function updatePeso(idx: number, valor: number) {
    setPreguntas(ps => ps.map((p, i) => i === idx ? { ...p, peso: valor } : p));
  }

  const pesoTotal = preguntas.reduce((s, p) => s + (p.peso || 0), 0);

  // ─── Step 2: Save exam ───────────────────────────────────────────────────────
  async function handleGuardar() {
    if (pesoTotal !== 100) {
      setError(`Los pesos suman ${pesoTotal}%. Deben sumar exactamente 100%.`);
      return;
    }
    const sinRespuesta = preguntas.filter(p => !p.respuestaCorrecta);
    if (sinRespuesta.length > 0) {
      setError(`${sinRespuesta.length} pregunta(s) sin respuesta correcta asignada.`);
      return;
    }
    setStep('saving');
    setError('');
    try {
      const res = await fetch('/api/examenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo, materia, duracionMinutos: duracion ? Number(duracion) : null, esAdmision, preguntas }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al guardar'); setStep('review'); return; }
      router.push(`/examenes/${data.id}`);
    } catch {
      setError('Error al guardar el examen');
      setStep('review');
    }
  }

  // ─── Step 1 UI ───────────────────────────────────────────────────────────────
  if (step === 'upload') {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <a href="/examenes" className="text-blue-600 hover:underline text-sm">← Exámenes</a>
            <span className="text-slate-400">/</span>
            <h1 className="font-bold text-slate-800 text-xl">Nuevo Examen</h1>
          </div>

          <div className="bg-white rounded-2xl shadow p-8">
            <h2 className="text-lg font-semibold text-slate-700 mb-2">1. Sube el archivo del examen</h2>
            <p className="text-slate-500 text-sm mb-6">
              La IA de Gemini extraerá automáticamente las preguntas de selección múltiple.
              Formatos soportados: <strong>PDF, DOCX</strong>
            </p>

            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-blue-300 rounded-xl p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition"
            >
              <div className="text-5xl mb-3">{file ? '📄' : '📁'}</div>
              {file ? (
                <div>
                  <p className="font-semibold text-blue-700">{file.name}</p>
                  <p className="text-slate-500 text-sm mt-1">{(file.size / 1024).toFixed(0)} KB</p>
                </div>
              ) : (
                <div>
                  <p className="text-slate-600 font-medium">Haz clic para seleccionar archivo</p>
                  <p className="text-slate-400 text-sm mt-1">PDF o DOCX — máx. 10MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={e => { setFile(e.target.files?.[0] || null); setError(''); }}
              />
            </div>

            {error && (
              <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleProcesar}
                disabled={!file || procesando}
                className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
              >
                {procesando ? '🤖 Procesando con IA...' : '🤖 Extraer Preguntas con IA'}
              </button>
            </div>

            {procesando && (
              <p className="text-center text-slate-500 text-sm mt-3 animate-pulse">
                Analizando el examen con Gemini... esto puede tomar unos segundos.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Step 2 UI: Review questions ─────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setStep('upload')} className="text-blue-600 hover:underline text-sm">
              ← Volver
            </button>
            <h1 className="font-bold text-slate-800 text-xl">Revisar Preguntas</h1>
          </div>
          <span className={`text-sm font-semibold px-3 py-1 rounded-full ${pesoTotal === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            Peso total: {pesoTotal}%
          </span>
        </div>

        {/* Exam metadata */}
        <div className="bg-white rounded-xl shadow p-6 mb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Título del Examen *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Materia</label>
            <input value={materia} onChange={e => setMateria(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Duración (minutos)</label>
            <input type="number" value={duracion} onChange={e => setDuracion(e.target.value)} placeholder="Sin límite"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
          <div className="flex items-center gap-2 md:col-span-3">
            <input type="checkbox" id="admision" checked={esAdmision} onChange={e => setEsAdmision(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="admision" className="text-sm text-gray-600">Este es un examen de <strong>Admisiones</strong></label>
          </div>
        </div>

        {/* Questions list */}
        <div className="space-y-4">
          {preguntas.map((p, idx) => (
            <div key={idx} className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
              <div className="flex items-start justify-between gap-4 mb-4">
                <span className="bg-blue-100 text-blue-700 font-bold text-sm px-2 py-0.5 rounded">P{idx + 1}</span>
                <div className="flex items-center gap-2 text-sm">
                  <label className="text-gray-500">Peso:</label>
                  <input
                    type="number"
                    value={p.peso}
                    onChange={e => updatePeso(idx, Number(e.target.value))}
                    min={1} max={100}
                    className="w-16 border border-gray-300 rounded px-2 py-1 text-center focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <span className="text-gray-400">%</span>
                </div>
              </div>

              <textarea
                value={p.enunciado}
                onChange={e => updatePregunta(idx, 'enunciado', e.target.value)}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:ring-2 focus:ring-blue-400 outline-none resize-none"
              />

              <div className="space-y-2 mb-4">
                {p.opciones.map(op => (
                  <div key={op.letra} className={`flex items-center gap-3 p-2 rounded-lg border ${p.respuestaCorrecta === op.letra ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                    <button
                      onClick={() => updatePregunta(idx, 'respuestaCorrecta', op.letra)}
                      className={`w-8 h-8 rounded-full font-bold text-sm flex-shrink-0 transition
                        ${p.respuestaCorrecta === op.letra ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-green-100'}`}
                    >
                      {op.letra}
                    </button>
                    <input
                      value={op.texto}
                      onChange={e => {
                        const newOpciones = p.opciones.map(o => o.letra === op.letra ? { ...o, texto: e.target.value } : o);
                        updatePregunta(idx, 'opciones', newOpciones);
                      }}
                      className="flex-1 border-0 bg-transparent text-sm focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {!p.respuestaCorrecta && (
                <p className="text-amber-600 text-xs">⚠️ Haz clic en la letra correcta para marcar la respuesta</p>
              )}
            </div>
          ))}
        </div>

        {/* Save button */}
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={handleGuardar}
            disabled={step === 'saving'}
            className="flex-1 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
          >
            {step === 'saving' ? 'Guardando...' : `✓ Guardar Examen (${preguntas.length} preguntas)`}
          </button>
        </div>
      </div>
    </div>
  );
}
