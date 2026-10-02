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
  respuestaCorrecta?: string | null;
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
  const [duracionTotal, setDuracionTotal] = useState<number>(3600);
  const [tiempoAgotado, setTiempoAgotado] = useState(false);
  const [maxVisited, setMaxVisited] = useState(0);

  // Staff preview state
  const [isStaffPreview, setIsStaffPreview] = useState(false);
  const [staffInfo, setStaffInfo] = useState<{ nombre: string; rol: string } | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    calificacionFinal: number;
    correctas: number;
    total: number;
    porArea?: Array<{ area: string; puntaje: number; correctas: number; total: number }>;
  } | null>(null);

  // Store latest state in refs to safely access in async timers without stale closure
  const respuestasRef = useRef(respuestas);
  respuestasRef.current = respuestas;

  const intentoIdRef = useRef(intentoId);
  intentoIdRef.current = intentoId;

  const examenRef = useRef(examen);
  examenRef.current = examen;

  const enviandoRef = useRef(enviando);
  enviandoRef.current = enviando;

  const isStaffPreviewRef = useRef(isStaffPreview);
  isStaffPreviewRef.current = isStaffPreview;

  // Handle Electron close app
  const handleExitApp = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.closeApp) {
      (window as any).electronAPI.closeApp();
    } else {
      router.push('/examen/staff');
    }
  };

  // Handle Logout & return to login screen
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    router.push('/examen/login');
  };

  // Handler for submitting responses
  const handleEnviar = useCallback(async (autoEnvio = false) => {
    if (!examenRef.current || !intentoIdRef.current || enviandoRef.current) return;
    setEnviando(true);
    enviandoRef.current = true;
    if (autoEnvio) {
      setTiempoAgotado(true);
    }

    // ─── STAFF PREVIEW: Evaluate in-memory, ZERO DB writes ─────────────────────
    if (isStaffPreviewRef.current) {
      const ex = examenRef.current;
      const resps = respuestasRef.current;
      let calificacionFinal = 0;
      let correctasCount = 0;

      const areasMap = new Map<string, { total: number; correctas: number; pesoTotal: number; pesoObtenido: number }>();

      (ex.preguntas || []).forEach(p => {
        const sel = resps[p.orden] || null;
        const isCorrect = sel !== null && sel === p.respuestaCorrecta;
        if (isCorrect) {
          calificacionFinal += (p.peso || 0);
          correctasCount += 1;
        }

        if (ex.esAdmision) {
          const a = p.area || 'General';
          if (!areasMap.has(a)) {
            areasMap.set(a, { total: 0, correctas: 0, pesoTotal: 0, pesoObtenido: 0 });
          }
          const item = areasMap.get(a)!;
          item.total += 1;
          item.pesoTotal += (p.peso || 0);
          if (isCorrect) {
            item.correctas += 1;
            item.pesoObtenido += (p.peso || 0);
          }
        }
      });

      let porArea: Array<{ area: string; puntaje: number; correctas: number; total: number }> | undefined;
      if (ex.esAdmision && areasMap.size > 0) {
        porArea = Array.from(areasMap.entries()).map(([area, data]) => ({
          area,
          puntaje: data.pesoTotal > 0 ? Math.round((data.pesoObtenido / data.pesoTotal) * 100) : 0,
          correctas: data.correctas,
          total: data.total,
        }));
        calificacionFinal = Math.round(porArea.reduce((sum, a) => sum + a.puntaje, 0) / porArea.length);
      }

      setPreviewResult({
        calificacionFinal: Math.min(100, Math.round(calificacionFinal)),
        correctas: correctasCount,
        total: ex.preguntas.length,
        porArea,
      });

      setConfirmEnvio(false);
      setEnviando(false);
      enviandoRef.current = false;
      return;
    }

    // ─── REGULAR STUDENT: Send to server ──────────────────────────────────────
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

  // Load exam and create/simulate attempt
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
        setIsStaffPreview(Boolean(data.isStaffPreview));

        if (data.isStaffPreview) {
          setStaffInfo({
            nombre: data.usuario || 'Personal Staff',
            rol: data.rol || 'Staff',
          });
        }

        const examDurSecs = data.examen.duracionMinutos ? data.examen.duracionMinutos * 60 : 3600;
        setDuracionTotal(examDurSecs);

        if (data.tiempoRestanteSegundos !== undefined && data.tiempoRestanteSegundos !== null) {
          setTiempoRestante(data.tiempoRestanteSegundos);
        } else if (data.examen.duracionMinutos) {
          setTiempoRestante(examDurSecs);
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
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push('/examen/staff')}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition"
            >
              ← Volver al Catálogo de Pruebas
            </button>
            <a
              href="/examen/login"
              className="text-xs text-slate-500 hover:text-slate-700 underline pt-1"
            >
              Ir a la pantalla de ingreso
            </a>
          </div>
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

  const rolLabels: Record<string, string> = {
    admin: 'Administrador',
    directivo: 'Directivo',
    coordinador: 'Coordinador',
    supervisor: 'Supervisor',
    docente: 'Docente',
    estudiante: 'Estudiante',
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* ─── STAFF PREVIEW TOP BANNER ────────────────────────────────────────── */}
      {isStaffPreview && (
        <div className="bg-gradient-to-r from-amber-600 via-indigo-700 to-blue-800 text-white px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-md z-40 text-xs sm:text-sm flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="bg-white/20 text-white font-extrabold px-2.5 py-0.5 rounded-md uppercase tracking-wider text-[11px] shadow-xs">
              👁️ Vista en Vivo Alumno
            </span>
            <span className="font-semibold text-white/90 truncate max-w-xs">
              {staffInfo ? `${rolLabels[staffInfo.rol] || staffInfo.rol}: ${staffInfo.nombre}` : 'Modo Personal Staff'}
            </span>
            <span className="hidden md:inline-block text-white/60">•</span>
            <span className="hidden md:inline-block text-white/80 text-xs">
              Sin registro de respuestas en BDD
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Cerrar la vista de este examen y regresar al panel principal"
            >
              <span>🏠</span>
              <span>Volver a la Pantalla Principal</span>
            </button>
            <button
              onClick={() => router.push('/examen/staff')}
              className="bg-white/15 hover:bg-white/25 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer"
              title="Cerrar la vista de este examen y regresar al catálogo de pruebas"
            >
              <span>📋</span>
              <span>Ver Otras Pruebas</span>
            </button>
            <button
              onClick={handleLogout}
              className="bg-white/10 hover:bg-white/20 text-white font-medium px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 cursor-pointer"
              title="Cerrar sesión y volver a la pantalla de login"
            >
              <span>🔒</span>
              <span>Volver al Login</span>
            </button>
            <button
              onClick={handleExitApp}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition flex items-center gap-1 shadow-xs cursor-pointer"
              title="Salir y cerrar inmediatamente el aplicativo de escritorio"
            >
              <span>🚪</span>
              <span>Salir de la App</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Top Header Bar with Burning Fuse & Bomb Timer ──────────────────────── */}
      <header className="bg-slate-900 border-b border-slate-800 text-white px-6 py-3 sticky top-0 z-30 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <h1 className="font-bold text-white text-base md:text-lg truncate">{examen.titulo}</h1>
            {examen.materia && <p className="text-xs text-blue-400 font-semibold">{examen.materia}</p>}
          </div>

          {/* Burning Fuse & Bomb Countdown Timer */}
          {tiempoRestante !== null && (
            <div className="flex items-center gap-3 flex-1 max-w-md justify-end">
              {/* Burning Fuse Track ("Mecha") */}
              <div className="flex-1 relative flex items-center min-w-[120px]">
                {/* Fuse rope */}
                <div className="w-full h-2.5 bg-amber-950/80 rounded-full border border-amber-700/50 relative overflow-hidden flex items-center">
                  {/* Burnt ash line */}
                  <div
                    className="h-full bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 transition-all duration-1000 ease-linear relative"
                    style={{
                      width: `${Math.min(100, Math.max(0, ((duracionTotal - tiempoRestante) / duracionTotal) * 100))}%`,
                    }}
                  >
                    {/* Glowing ember edge */}
                    <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-r from-orange-500 to-amber-300 animate-pulse shadow-[0_0_10px_#f97316]" />
                  </div>
                </div>

                {/* Animated flame / spark */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none transition-all duration-1000 ease-linear flex items-center justify-center z-10"
                  style={{
                    left: `${Math.min(97, Math.max(3, ((duracionTotal - tiempoRestante) / duracionTotal) * 100))}%`,
                  }}
                >
                  <span className="text-base inline-block animate-bounce drop-shadow-[0_0_6px_#f59e0b]">🔥</span>
                </div>
              </div>

              {/* Bomb Timer Box */}
              <div
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl font-mono font-bold text-sm transition-all shadow-md flex-shrink-0 ${
                  tiempoRestante <= 60
                    ? 'bg-red-600 text-white animate-bounce ring-4 ring-red-400 shadow-red-500/50'
                    : tiempoRestante <= 300
                    ? 'bg-amber-500 text-slate-950 animate-pulse ring-2 ring-amber-300'
                    : 'bg-slate-800 border border-slate-700 text-white'
                }`}
              >
                <span className={`text-xl ${tiempoRestante <= 60 ? 'animate-spin' : ''}`}>💣</span>
                <div className="flex flex-col text-left leading-none">
                  <span className="text-[9px] uppercase font-sans tracking-wider opacity-80">
                    {tiempoRestante <= 60 ? '¡Detonación!' : 'Tiempo restante'}
                  </span>
                  <span className="text-base font-black tracking-wider">{formatTiempo(tiempoRestante)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* ─── Interactive Question Progress & Skipped Warning Bar ─────────── */}
      <div className="bg-slate-900/95 border-b border-slate-800 px-6 py-2 shadow-inner">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="font-bold text-slate-200">Pregunta {current + 1} de {total}</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">{respondidas} respondidas</span>
            {preguntas.filter((p, idx) => !respuestas[p.orden] && (idx < current || maxVisited > idx)).length > 0 && (
              <span className="text-amber-300 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 flex items-center gap-1 animate-pulse">
                <span>⚠️</span>
                <span>
                  {preguntas.filter((p, idx) => !respuestas[p.orden] && (idx < current || maxVisited > idx)).length} sin responder
                </span>
              </span>
            )}
          </div>

          {/* Interactive segmented progress tracker */}
          <div className="flex-1 max-w-2xl flex items-center gap-1 relative py-1">
            {preguntas.map((p, i) => {
              const isCurrent = i === current;
              const isAnswered = Boolean(respuestas[p.orden]);
              const isSkipped = !isAnswered && (i < current || maxVisited > i);

              return (
                <div key={p.orden} className="flex-1 relative group">
                  <button
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      setMaxVisited(prev => Math.max(prev, i));
                    }}
                    className={`w-full h-3 rounded-full transition-all cursor-pointer flex items-center justify-center relative ${
                      isCurrent
                        ? 'bg-blue-500 ring-2 ring-blue-300 ring-offset-1 ring-offset-slate-900 scale-y-125 z-10'
                        : isAnswered
                        ? 'bg-emerald-500 hover:bg-emerald-400'
                        : isSkipped
                        ? 'bg-amber-500 hover:bg-amber-400 ring-1 ring-amber-300 animate-pulse'
                        : 'bg-slate-700/80 hover:bg-slate-600'
                    }`}
                  >
                    {isSkipped && !isCurrent && (
                      <span className="absolute -top-3 text-[10px] leading-none pointer-events-none">
                        ⚠️
                      </span>
                    )}
                  </button>

                  {/* Hover Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:flex flex-col items-center pointer-events-none z-50 whitespace-nowrap">
                    <div className="bg-slate-950 text-white text-[11px] font-semibold px-2.5 py-1 rounded-lg shadow-xl border border-slate-700 flex items-center gap-1.5">
                      {isCurrent && <span>📍 Pregunta {i + 1} (Actual)</span>}
                      {!isCurrent && isAnswered && (
                        <span className="text-emerald-300">✓ Pregunta {i + 1}: Respondida ({respuestas[p.orden]})</span>
                      )}
                      {!isCurrent && isSkipped && (
                        <span className="text-amber-300 font-bold">⚠️ Pregunta {i + 1}: Sin responder (Haz clic para ir)</span>
                      )}
                      {!isCurrent && !isAnswered && !isSkipped && (
                        <span className="text-slate-400">Pregunta {i + 1}: Pendiente</span>
                      )}
                    </div>
                    <div className="w-2 h-2 bg-slate-950 border-r border-b border-slate-700 rotate-45 -mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Warning banner under 5 minutes */}
      {tiempoRestante !== null && tiempoRestante <= 300 && tiempoRestante > 0 && (
        <div className="bg-amber-500 text-white text-xs font-bold py-1.5 px-4 text-center shadow-xs flex items-center justify-center gap-2 animate-pulse">
          <span>⚠️</span>
          <span>
            {tiempoRestante <= 60
              ? '¡ATENCIÓN! Queda menos de 1 minuto. Al finalizar el tiempo, las respuestas se enviarán automáticamente.'
              : 'Quedan menos de 5 minutos para terminar. Asegúrate de responder todas las preguntas.'}
          </span>
        </div>
      )}

      {/* ─── 16:9 Widescreen Main Question View (2 Columns) ────────────────── */}
      <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 w-full max-w-7xl mx-auto overflow-hidden">
        <div className="w-full bg-white rounded-3xl shadow-2xl p-4 sm:p-6 border border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-5 h-full max-h-[calc(100vh-160px)] min-h-[480px]">
          
          {/* ─── LEFT COLUMN: Question Enunciado & Diagram ─────────────────── */}
          <div className="lg:col-span-7 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-100 lg:pr-5 pb-3 lg:pb-0 h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-2">
              {/* Header tags */}
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2 pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-900 text-xs font-bold px-3 py-0.5 rounded-full uppercase tracking-wider">
                    Pregunta {current + 1} de {total}
                  </span>
                  {pregunta.area && (
                    <span className="bg-purple-100 text-purple-900 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-purple-200">
                      {pregunta.area}
                    </span>
                  )}
                </div>
                <span className="text-xs font-semibold text-slate-400">
                  Valor: {pregunta.peso}%
                </span>
              </div>

              {/* Enunciado text with dynamic adaptive sizing */}
              <div className={`text-slate-800 font-medium ${
                (pregunta.enunciado || '').length > 1500
                  ? 'text-xs md:text-[13px] leading-relaxed'
                  : (pregunta.enunciado || '').length > 750
                  ? 'text-[13px] md:text-sm leading-relaxed'
                  : (pregunta.enunciado || '').length > 300
                  ? 'text-sm md:text-base leading-relaxed'
                  : 'text-base md:text-lg leading-relaxed'
              } mb-4`}>
                <FormattedText text={pregunta.enunciado} />
              </div>

              {/* Diagram / Image if present */}
              {pregunta.imagen && (
                <div className="mb-4 flex justify-center bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner">
                  <img
                    src={pregunta.imagen}
                    alt={`Diagrama de la pregunta ${pregunta.orden}`}
                    className="max-h-52 max-w-full rounded-xl object-contain shadow-sm bg-white p-1.5"
                  />
                </div>
              )}
            </div>

            {/* Bottom status note */}
            <div className="text-xs text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between flex-shrink-0">
              <span>💡 Lee atentamente y selecciona tu respuesta a la derecha.</span>
              {respuestas[pregunta.orden] ? (
                <span className="text-emerald-600 font-bold">✓ Opción {respuestas[pregunta.orden]} seleccionada</span>
              ) : (
                <span className="text-amber-600 font-medium">⚠️ Aún no has seleccionado opción</span>
              )}
            </div>
          </div>

          {/* ─── RIGHT COLUMN: Options & Navigation ────────────────────────── */}
          <div className="lg:col-span-5 flex flex-col justify-between pl-0 lg:pl-2 h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto pr-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                Opciones de respuesta:
              </p>

              {/* Options list */}
              <div className="space-y-2">
                {pregunta.opciones.map(opcion => {
                  const selected = respuestas[pregunta.orden] === opcion.letra;
                  const isLong = (opcion.texto || '').length > 80;
                  return (
                    <button
                      key={opcion.letra}
                      type="button"
                      onClick={() => setRespuestas(r => ({ ...r, [pregunta.orden]: opcion.letra }))}
                      className={`w-full text-left flex items-start gap-3 ${
                        isLong ? 'px-3.5 py-2' : 'px-4 py-2.5'
                      } rounded-2xl border-2 transition-all cursor-pointer ${
                        selected
                          ? 'border-blue-600 bg-blue-50/80 text-blue-950 shadow-md ring-2 ring-blue-400/30 font-semibold'
                          : 'border-slate-200 bg-white text-slate-800 hover:border-blue-300 hover:bg-slate-50/80'
                      }`}
                    >
                      <span
                        className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs transition ${
                          selected ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {opcion.letra}
                      </span>
                      <div className="flex-1 pt-0.5">
                        {opcion.texto && (
                          <div className={`leading-snug font-medium ${
                            isLong ? 'text-xs md:text-sm' : 'text-sm'
                          }`}>
                            <FormattedText text={opcion.texto} />
                          </div>
                        )}
                        {opcion.imagen && (
                          <div className="mt-1 bg-white p-1 rounded-lg border border-slate-200 inline-block shadow-xs">
                            <img
                              src={opcion.imagen}
                              alt={`Opción ${opcion.letra}`}
                              className="max-h-24 max-w-full rounded object-contain"
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status summary */}
            <div className="pt-2.5 border-t border-slate-100 text-xs text-slate-500 flex items-center justify-between flex-shrink-0">
              <span>Preguntas respondidas: <strong className="text-emerald-700">{respondidas} de {total}</strong></span>
              {preguntas.filter((p, idx) => !respuestas[p.orden] && (idx < current || maxVisited > idx)).length > 0 && (
                <span className="text-red-600 font-bold flex items-center gap-1">
                  <span>⚠️</span>
                  <span>{preguntas.filter((p, idx) => !respuestas[p.orden] && (idx < current || maxVisited > idx)).length} omitidas (en rojo)</span>
                </span>
              )}
            </div>

            {/* Navigation Buttons (Anterior & Siguiente) */}
            <div className="pt-2.5 flex items-center justify-between gap-3 flex-shrink-0">
              <button
                type="button"
                onClick={() => setCurrent(c => Math.max(0, c - 1))}
                disabled={current === 0}
                className="flex items-center gap-2 px-5 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed font-semibold text-xs md:text-sm transition shadow-xs cursor-pointer"
              >
                ← Anterior
              </button>

              {current < total - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setCurrent(c => {
                      const next = Math.min(total - 1, c + 1);
                      setMaxVisited(prev => Math.max(prev, next));
                      return next;
                    });
                  }}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 font-bold text-xs md:text-sm transition shadow-md shadow-blue-600/20 cursor-pointer"
                >
                  Siguiente →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmEnvio(true)}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-xs md:text-sm transition shadow-md shadow-emerald-600/25 cursor-pointer"
                >
                  {isStaffPreview ? 'Simular Envío de Respuestas ✓' : 'Finalizar y Enviar ✓'}
                </button>
              )}
            </div>
          </div>

          {/* ─── FULL-WIDTH COMPACT QUESTION NUMBERS STRIP (30% smaller, Green/Red/Blue) ─── */}
          <div className="lg:col-span-12 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-3">
            {/* Color Legend */}
            <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500 flex-shrink-0">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" /> Contestada</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse" /> Omitida</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Actual</span>
            </div>

            {/* Compact 30% Smaller Numbers Flex Grid */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center flex-1 max-w-4xl">
              {preguntas.map((p, i) => {
                const isCurrent = i === current;
                const isAnswered = Boolean(respuestas[p.orden]);
                const isSkipped = !isAnswered && (i < current || maxVisited > i);

                return (
                  <button
                    key={p.orden}
                    type="button"
                    onClick={() => {
                      setCurrent(i);
                      setMaxVisited(prev => Math.max(prev, i));
                    }}
                    title={
                      isCurrent
                        ? `Pregunta ${i + 1} (Actual)`
                        : isAnswered
                        ? `Pregunta ${i + 1}: Contestada (${respuestas[p.orden]})`
                        : isSkipped
                        ? `Pregunta ${i + 1}: Omitida / Sin responder`
                        : `Pregunta ${i + 1}: Pendiente`
                    }
                    className={`w-6 h-6 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center ${
                      isCurrent
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400 scale-110 shadow-sm z-10'
                        : isAnswered
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-2xs'
                        : isSkipped
                        ? 'bg-red-500 text-white hover:bg-red-600 ring-1 ring-red-300 animate-pulse shadow-2xs'
                        : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200 hover:text-slate-800'
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Manual Submit Confirmation Modal */}
      {confirmEnvio && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center border border-slate-100">
            <div className="text-5xl mb-4">{isStaffPreview ? '👁️' : '📤'}</div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              {isStaffPreview ? '¿Simular Finalización?' : '¿Enviar respuestas?'}
            </h3>
            <p className="text-slate-600 text-sm mb-2">
              Has respondido <strong>{respondidas}</strong> de <strong>{total}</strong> preguntas.
            </p>
            {respondidas < total && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2.5 rounded-xl mb-3">
                ⚠️ Aún faltan <strong>{total - respondidas}</strong> preguntas sin responder.
              </div>
            )}
            <p className="text-slate-500 text-xs mb-6">
              {isStaffPreview
                ? 'Estás en modo Staff. Verás la calificación obtenida en memoria sin alterar ninguna base de datos.'
                : 'Al enviar, se registrará tu intento y se procederá al cierre de la aplicación.'}
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
                {enviando ? 'Calculando...' : isStaffPreview ? 'Ver Resultado' : 'Sí, enviar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Staff Preview Results Screen Modal */}
      {previewResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
              🎉
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Simulación de Examen Completada</h2>
            <p className="text-slate-500 text-xs mb-6">
              Resultado de la vista en vivo para el usuario staff <strong>{staffInfo?.nombre}</strong>
            </p>

            {/* Score box */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-6 mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">
                Calificación Obtenida en la Simulación
              </p>
              <p className="text-5xl font-extrabold text-blue-900 mb-2">
                {previewResult.calificacionFinal}<span className="text-2xl font-medium text-blue-600"> / 100</span>
              </p>
              <p className="text-sm font-medium text-slate-600">
                {previewResult.correctas} de {previewResult.total} preguntas correctas
              </p>

              {/* Admissions breakdown if present */}
              {previewResult.porArea && previewResult.porArea.length > 0 && (
                <div className="mt-4 pt-4 border-t border-blue-200/60 grid grid-cols-2 gap-2 text-left">
                  {previewResult.porArea.map(a => (
                    <div key={a.area} className="bg-white/80 p-2 rounded-xl text-xs border border-blue-100">
                      <p className="font-bold text-slate-700 truncate">{a.area}</p>
                      <p className="text-blue-800 font-semibold">{a.puntaje}% ({a.correctas}/{a.total})</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 mb-6 text-left flex items-start gap-2">
              <span className="text-base flex-shrink-0">🔒</span>
              <span>
                <strong>Modo Seguro Staff:</strong> Ningún intento ni respuesta fue almacenado en la base de datos de producción.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  setPreviewResult(null);
                  setRespuestas({});
                  setCurrent(0);
                }}
                className="py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
              >
                🔄 Repetir Prueba
              </button>
              <button
                onClick={() => router.push('/examen/staff')}
                className="py-2.5 px-3 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold transition shadow-sm"
              >
                📋 Catálogo de Pruebas
              </button>
              <button
                onClick={handleLogout}
                className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-900 text-slate-200 text-xs font-medium transition"
              >
                🔒 Volver al Login
              </button>
              <button
                onClick={handleExitApp}
                className="py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition shadow-xs"
                title="Cerrar la aplicación de escritorio"
              >
                🚪 Salir de la App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Submit Time's Up Screen */}
      {tiempoAgotado && !previewResult && (
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
