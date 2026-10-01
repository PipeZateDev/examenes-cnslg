'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import FormattedText from '@/components/FormattedText';

interface Pregunta {
  orden: number;
  enunciado: string;
  opciones: { letra: string; texto: string; imagen?: string | null }[];
  peso: number;
  area?: string;
  imagen?: string | null;
}

interface ExamenData {
  _id: string;
  titulo: string;
  materia?: string;
  esAdmision?: boolean;
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
  const [tiempoAgotado, setTiempoAgotado] = useState(false);

  // Store latest state in refs to safely access in async timers without stale closure
  const respuestasRef = useRef(respuestas);
  respuestasRef.current = respuestas;

  const intentoIdRef = useRef(intentoId);
  intentoIdRef.current = intentoId;

  const examenRef = useRef(examen);
  examenRef.current = examen;

  const enviandoRef = useRef(enviando);
  enviandoRef.current = enviando;

  // Handler for submitting responses
  const handleEnviar = useCallback(async (autoEnvio = false) => {
    if (!examenRef.current || !intentoIdRef.current || enviandoRef.current) return;
    setEnviando(true);
    enviandoRef.current = true;
    if (autoEnvio) {
      setTiempoAgotado(true);
    }

    try {
      await fetch(`/api/estudiante/examen/${id}/enviar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentoId: intentoIdRef.current,
          respuestas: respuestasRef.current,
        }),
      });

      // Notify Electron kiosk mode that the exam has finished
      if (typeof window !== 'undefined' && (window as any).electronAPI?.examFinished) {
        try {
          await (window as any).electronAPI.examFinished();
        } catch (_) {}
      }

      router.push(`/examen/enviado?auto=${autoEnvio ? '1' : '0'}`);
    } catch {
      setError('Error al enviar respuestas. Notifica inmediatamente al docente.');
      setEnviando(false);
      enviandoRef.current = false;
    }
  }, [id, router]);

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

        if (data.tiempoRestanteSegundos !== undefined && data.tiempoRestanteSegundos !== null) {
          setTiempoRestante(data.tiempoRestanteSegundos);
        } else if (data.examen.duracionMinutos) {
          setTiempoRestante(data.examen.duracionMinutos * 60);
        }

        setLoading(false);
      } catch {
        setError('Error de conexión con el servidor.');
        setLoading(false);
      }
    }
    init();
  }, [id]);

  // Timer countdown
  useEffect(() => {
    if (tiempoRestante === null) return;
    if (tiempoRestante <= 0) {
      if (!enviandoRef.current) {
        handleEnviar(true);
      }
      return;
    }

    const timer = setInterval(() => {
      setTiempoRestante(t => {
        if (t === null) return null;
        if (t <= 1) {
          clearInterval(timer);
          if (!enviandoRef.current) {
            handleEnviar(true);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [tiempoRestante, handleEnviar]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-slate-700 font-semibold">Cargando examen...</p>
          <p className="text-slate-400 text-xs mt-1">Configurando entorno seguro</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md text-center border border-slate-200">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-red-700 mb-2">Atención</h2>
          <p className="text-slate-600 mb-6 text-sm leading-relaxed">{error}</p>
          <a
            href="/examen/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition"
          >
            Volver al inicio
          </a>
        </div>
      </div>
    );
  }

  if (!examen) return null;

  const preguntas = examen.preguntas;
  const total = preguntas.length;
  const pregunta = preguntas[current];
  const respondidas = Object.keys(respuestas).length;

  const formatTiempo = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Top Header Bar */}
      <header className="bg-white border-b border-slate-200 shadow-sm px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
        <div className="flex-1 mr-4">
          <h1 className="font-bold text-slate-800 text-base md:text-lg truncate">{examen.titulo}</h1>
          {examen.materia && <p className="text-xs text-slate-500">{examen.materia}</p>}
        </div>

        {/* Live Countdown Timer */}
        <div className="flex items-center gap-4 flex-shrink-0">
          {tiempoRestante !== null && (
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono font-bold text-base transition-all shadow-xs ${
                tiempoRestante <= 60
                  ? 'bg-red-600 text-white animate-pulse ring-4 ring-red-200'
                  : tiempoRestante <= 300
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              <span>{tiempoRestante <= 60 ? '🚨' : tiempoRestante <= 300 ? '⚠️' : '⏱️'}</span>
              <div className="flex flex-col text-left">
                <span className="text-[10px] uppercase font-sans font-semibold leading-none opacity-80">
                  {tiempoRestante <= 60 ? '¡Último minuto!' : 'Tiempo restante'}
                </span>
                <span className="text-lg leading-tight">{formatTiempo(tiempoRestante)}</span>
              </div>
            </div>
          )}

          <div className="hidden sm:block text-xs text-slate-500 text-right">
            <div className="font-semibold text-slate-700">{respondidas} de {total} respondidas</div>
            <div className="text-slate-400">Pregunta {current + 1} de {total}</div>
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="h-2 bg-slate-200 w-full overflow-hidden">
        <div
          className="h-full bg-blue-600 transition-all duration-300 ease-out"
          style={{ width: `${((current + 1) / total) * 100}%` }}
        />
      </div>

      {/* Warning banner under 5 minutes */}
      {tiempoRestante !== null && tiempoRestante <= 300 && tiempoRestante > 0 && (
        <div className="bg-amber-500 text-white text-xs font-bold py-1.5 px-4 text-center shadow-xs flex items-center justify-center gap-2 animate-pulse">
          <span>⚠️</span>
          <span>
            {tiempoRestante <= 60
              ? '¡ATENCIÓN! Queda menos de 1 minuto. Al finalizar el tiempo, las respuestas se enviarán solas.'
              : 'Quedan menos de 5 minutos para terminar. Asegúrate de responder todas las preguntas.'}
          </span>
        </div>
      )}

      {/* Main Question View */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-6">
        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-xl p-6 md:p-8 border border-slate-100">
          {/* Question badge and area */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Pregunta {current + 1} de {total}
              </span>
              {pregunta.area && (
                <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2.5 py-1 rounded-full border border-purple-200">
                  {pregunta.area}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-slate-400">
              Valor: {pregunta.peso}%
            </span>
          </div>

          {/* Enunciado con soporte de formatos (negrita, subrayado, tamaños y saltos de línea) */}
          <div className="text-slate-800 text-lg md:text-xl leading-relaxed mb-6 font-medium">
            <FormattedText text={pregunta.enunciado} />
          </div>

          {/* Question Image / Diagram if present */}
          {pregunta.imagen && (
            <div className="mb-6 flex justify-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <img
                src={pregunta.imagen}
                alt={`Diagrama de la pregunta ${pregunta.orden}`}
                className="max-h-80 max-w-full rounded-xl object-contain shadow-sm bg-white p-2"
              />
            </div>
          )}

          {/* Options List */}
          <div className="space-y-3">
            {pregunta.opciones.map(opcion => {
              const selected = respuestas[pregunta.orden] === opcion.letra;
              return (
                <button
                  key={opcion.letra}
                  onClick={() => setRespuestas(r => ({ ...r, [pregunta.orden]: opcion.letra }))}
                  className={`w-full text-left flex items-start gap-4 px-5 py-4 rounded-2xl border-2 transition-all ${
                    selected
                      ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition ${
                      selected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {opcion.letra}
                  </span>
                  <div className="flex-1">
                    {opcion.texto && (
                      <div className="leading-relaxed pt-0.5 font-medium text-sm md:text-base">
                        <FormattedText text={opcion.texto} />
                      </div>
                    )}
                    {opcion.imagen && (
                      <div className="mt-2 bg-white p-1.5 rounded-lg border border-slate-200 inline-block shadow-xs">
                        <img
                          src={opcion.imagen}
                          alt={`Opción ${opcion.letra}`}
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

        {/* Navigation & Controls */}
        <div className="w-full max-w-3xl mt-6 flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={() => setCurrent(c => Math.max(0, c - 1))}
            disabled={current === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium text-sm transition shadow-xs"
          >
            ← Anterior
          </button>

          {/* Quick jump question numbers */}
          <div className="flex gap-1.5 flex-wrap justify-center max-w-md">
            {preguntas.map((p, i) => (
              <button
                key={p.orden}
                onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-xl text-xs font-bold transition shadow-2xs ${
                  i === current
                    ? 'bg-blue-600 text-white ring-2 ring-blue-300'
                    : respuestas[p.orden]
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {current < total - 1 ? (
            <button
              onClick={() => setCurrent(c => Math.min(total - 1, c + 1))}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-semibold text-sm transition shadow-sm"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={() => setConfirmEnvio(true)}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-sm transition shadow-md shadow-emerald-600/20"
            >
              Finalizar y Enviar ✓
            </button>
          )}
        </div>
      </main>

      {/* Manual Submit Confirmation Modal */}
      {confirmEnvio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-100">
            <div className="text-5xl mb-4">📤</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">¿Enviar respuestas?</h3>
            <p className="text-slate-600 text-sm mb-2">
              Has respondido <strong>{respondidas}</strong> de <strong>{total}</strong> preguntas.
            </p>
            {respondidas < total && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-xl mb-3">
                ⚠️ Aún te faltan <strong>{total - respondidas}</strong> preguntas por responder.
              </div>
            )}
            <p className="text-slate-500 text-xs mb-6">
              Al enviar, se registrará tu intento y se procederá al cierre de la aplicación.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmEnvio(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
                disabled={enviando}
              >
                Seguir revisando
              </button>
              <button
                onClick={() => handleEnviar(false)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-bold transition shadow-sm"
                disabled={enviando}
              >
                {enviando ? 'Enviando...' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit Time's Up Screen */}
      {tiempoAgotado && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 p-4 text-white">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <div className="text-6xl mb-4 animate-bounce">⏰</div>
            <h2 className="text-2xl font-bold text-white mb-2">¡Tiempo Finalizado!</h2>
            <p className="text-slate-300 text-sm mb-6 leading-relaxed">
              El tiempo programado para este examen ha terminado. Tus respuestas se están guardando y enviando automáticamente al servidor...
            </p>
            <div className="flex items-center justify-center gap-3">
              <div className="animate-spin w-6 h-6 border-3 border-emerald-400 border-t-transparent rounded-full" />
              <span className="text-sm font-medium text-emerald-400">Enviando examen y cerrando aplicativo...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
