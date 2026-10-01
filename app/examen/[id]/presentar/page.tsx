'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: { letra: string; texto: string }[];
  peso: number;
}

interface ExamenData {
  _id: string;
  titulo: string;
  materia?: string;
  preguntas: Pregunta[];
  duracionMinutos?: number;
}

type Respuestas = Record<number, string>; // orden -> letra

export default function PresentarExamenPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [examen, setExamen] = useState<ExamenData | null>(null);
  const [intentoId, setIntentoId] = useState<string | null>(null);
  const [current, setCurrent] = useState(0);
  const [respuestas, setRespuestas] = useState<Respuestas>({});
  const [loading, setLoading] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [confirmEnvio, setConfirmEnvio] = useState(false);
  const [error, setError] = useState('');
  const [tiempoRestante, setTiempoRestante] = useState<number | null>(null);

  // Load exam and create attempt
  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`/api/estudiante/examen/${id}/iniciar`, { method: 'POST' });
        if (!res.ok) {
          const d = await res.json();
          setError(d.error || 'No se pudo iniciar el examen');
          setLoading(false);
          return;
        }
        const data = await res.json();
        setExamen(data.examen);
        setIntentoId(data.intentoId);
        if (data.examen.duracionMinutos) {
          setTiempoRestante(data.examen.duracionMinutos * 60);
        }
        setLoading(false);
      } catch {
        setError('Error de conexión');
        setLoading(false);
      }
    }
    init();
  }, [id]);

  // Timer countdown
  useEffect(() => {
    if (tiempoRestante === null || tiempoRestante <= 0) return;
    const timer = setInterval(() => {
      setTiempoRestante(t => {
        if (t === null || t <= 1) {
          clearInterval(timer);
          // Auto-submit when time runs out
          handleEnviar(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [tiempoRestante]);

  const handleEnviar = useCallback(async (autoEnvio = false) => {
    if (!examen || !intentoId) return;
    setEnviando(true);
    try {
      await fetch(`/api/estudiante/examen/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intentoId, respuestas }),
      });
      router.push('/examen/enviado');
    } catch {
      setError('Error al enviar. Verifique su conexión.');
      setEnviando(false);
    }
  }, [examen, intentoId, respuestas, id, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow p-8 max-w-md text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <a href="/examen/login" className="text-blue-600 underline">Volver al login</a>
        </div>
      </div>
    );
  }

  if (!examen) return null;

  const preguntas = examen.preguntas;
  const total = preguntas.length;
  const pregunta = preguntas[current];
  const respondidas = Object.keys(respuestas).length;
  const progreso = Math.round((respondidas / total) * 100);

  const formatTiempo = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="bg-white border-b shadow-sm px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-slate-800 text-base">{examen.titulo}</h1>
          {examen.materia && <p className="text-xs text-slate-500">{examen.materia}</p>}
        </div>
        <div className="flex items-center gap-4">
          {tiempoRestante !== null && (
            <div className={`font-mono font-bold text-lg ${tiempoRestante < 300 ? 'text-red-600 animate-pulse' : 'text-slate-700'}`}>
              ⏱ {formatTiempo(tiempoRestante)}
            </div>
          )}
          <div className="text-xs text-slate-500 text-right">
            <div>{respondidas}/{total} respondidas</div>
            <div>Pregunta {current + 1} de {total}</div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-200">
        <div
          className="h-full bg-blue-600 transition-all duration-500"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Question */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl bg-white rounded-2xl shadow-lg p-8">
          {/* Question number */}
          <div className="flex items-center justify-between mb-6">
            <span className="bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded-full">
              Pregunta {current + 1}
            </span>
            <span className="text-xs text-slate-400">Peso: {pregunta.peso}%</span>
          </div>

          {/* Enunciado */}
          <p className="text-slate-800 text-lg leading-relaxed mb-8 whitespace-pre-wrap">
            {pregunta.enunciado}
          </p>

          {/* Options */}
          <div className="space-y-3">
            {pregunta.opciones.map(opcion => {
              const selected = respuestas[pregunta.orden] === opcion.letra;
              return (
                <button
                  key={opcion.letra}
                  onClick={() => setRespuestas(r => ({ ...r, [pregunta.orden]: opcion.letra }))}
                  className={`w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl border-2 transition-all
                    ${selected
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50/40'
                    }`}
                >
                  <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm
                    ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                    {opcion.letra}
                  </span>
                  <span className="leading-relaxed pt-0.5">{opcion.texto}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="w-full max-w-2xl mt-6 flex items-center justify-between">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            ← Anterior
          </button>

          {/* Question dots */}
          <div className="flex gap-1.5 flex-wrap justify-center max-w-sm">
            {preguntas.map((p, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`w-7 h-7 rounded-full text-xs font-medium transition
                  ${i === current ? 'bg-blue-600 text-white ring-2 ring-blue-300' :
                    respuestas[p.orden] ? 'bg-green-500 text-white' :
                    'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {current < total - 1 ? (
            <button
              onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={() => setConfirmEnvio(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition font-semibold"
            >
              Enviar ✓
            </button>
          )}
        </div>
      </main>

      {/* Confirm send modal */}
      {confirmEnvio && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
            <div className="text-5xl mb-4">📤</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">¿Enviar respuestas?</h3>
            <p className="text-gray-500 text-sm mb-2">
              Has respondido <strong>{respondidas}</strong> de <strong>{total}</strong> preguntas.
            </p>
            <p className="text-red-600 text-sm font-medium mb-6">
              Una vez enviadas, no podrás modificarlas ni volver a intentarlo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmEnvio(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                disabled={enviando}
              >
                Seguir revisando
              </button>
              <button
                onClick={() => handleEnviar()}
                className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition font-semibold"
                disabled={enviando}
              >
                {enviando ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
