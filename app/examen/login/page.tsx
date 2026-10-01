'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExamenLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ numeroDocumento: '', claveAcceso: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [bypassDesktop, setBypassDesktop] = useState(false);

  useEffect(() => {
    // Detect if running inside Electron desktop app
    const inElectron = typeof window !== 'undefined' && (
      !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron ||
      navigator.userAgent.includes('Electron') ||
      navigator.userAgent.includes('CNSLG-Desktop-App')
    );
    setIsDesktop(inElectron);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.numeroDocumento.trim()) {
      setError('Por favor ingresa tu número de documento.');
      return;
    }
    if (!form.claveAcceso.trim()) {
      setError('Por favor ingresa el código del examen.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/estudiante/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numeroDocumento: form.numeroDocumento.trim(),
          claveAcceso: form.claveAcceso.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al ingresar');
        return;
      }
      // Direct redirect to the active exam resolved by backend
      router.push(`/examen/${data.examenId}/presentar`);
    } catch {
      setError('Error de conexión con el servidor. Verifica tu red.');
    } finally {
      setLoading(false);
    }
  }

  // If accessed from regular web browser in production and not bypassed
  if (isDesktop === false && !bypassDesktop) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 text-center border border-slate-100">
          <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center text-4xl mx-auto mb-5 shadow-inner">
            🖥️
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Aplicación de Escritorio Requerida</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">
            Por seguridad institucional, los estudiantes <strong>únicamente pueden presentar exámenes desde la aplicación de escritorio oficial</strong> instalada en los computadores del colegio.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs text-blue-900 mb-6 text-left space-y-2">
            <p>🎓 <strong>Para Alumnos:</strong> Dirígete a la sala de sistemas y abre la aplicación <em>"Exámenes CNSLG"</em> en el computador asignado.</p>
            <p>👩‍🏫 <strong>Para Docentes y Directivos:</strong> Toda la gestión remota, creación de pruebas y revisión de resultados se realiza desde la web.</p>
          </div>

          <div className="space-y-3">
            <a
              href="/login"
              className="block w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm shadow-md shadow-blue-700/20"
            >
              Ingresar al Portal Web de Staff / Docentes →
            </a>
            <button
              onClick={() => setBypassDesktop(true)}
              className="text-xs text-slate-400 hover:text-slate-600 underline pt-2"
            >
              (Modo prueba / Desarrollo: Continuar en navegador)
            </button>
          </div>
        </div>

        <p className="text-slate-400 text-xs mt-6 text-center">
          Colegio Nuevo San Luis Gonzaga — Plataforma de Evaluaciones
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-950 flex flex-col items-center justify-center p-4">
      {/* School header */}
      <div className="text-center mb-6">
        <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-white shadow-xl flex items-center justify-center p-2 border-2 border-emerald-400">
          <img
            src="/logo-cnslg.png"
            alt="CNSLG"
            className="w-20 h-20 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }}
          />
        </div>
        <h1 className="text-white text-3xl font-extrabold tracking-tight drop-shadow-sm">
          CNSLG — Evaluaciones
        </h1>
        <p className="text-emerald-200 text-sm mt-1 font-medium">
          Acceso Seguro para Estudiantes
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white/20 backdrop-blur-xs">
        <h2 className="text-slate-800 text-xl font-bold mb-2 text-center">
          Ingreso a la Prueba
        </h2>
        <p className="text-slate-500 text-xs text-center mb-6 leading-relaxed">
          Digita tu número de identidad y el código de 6 caracteres suministrado por tu docente.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Document number */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Número de Identidad / Documento
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-lg pointer-events-none">
                🪪
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={form.numeroDocumento}
                onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))}
                placeholder="TI / Cédula / NUIP"
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white text-slate-800 font-semibold text-base transition placeholder:font-normal placeholder:text-slate-400"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Daily / Exam Key */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Código del Examen
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-lg pointer-events-none">
                🔑
              </span>
              <input
                type="text"
                value={form.claveAcceso}
                onChange={e => setForm(f => ({ ...f, claveAcceso: e.target.value.toUpperCase() }))}
                placeholder="CÓDIGO (6 LETRAS/NÚMEROS)"
                maxLength={6}
                className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:bg-white text-center text-xl font-mono font-bold tracking-[0.35em] uppercase text-emerald-950 transition placeholder:text-xs placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 text-center">
              Tu docente te indicará el código correspondiente a tu prueba.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-start gap-2 leading-relaxed">
              <span className="text-base flex-shrink-0">⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.numeroDocumento || !form.claveAcceso}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-base shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verificando examen...</span>
              </>
            ) : (
              <span>Ingresar y Presentar Examen →</span>
            )}
          </button>
        </form>

        <div className="pt-5 mt-5 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">
            ¿Eres docente o administrador?{' '}
            <a href="/login" className="text-emerald-700 font-semibold hover:underline">
              Portal Staff
            </a>
          </p>
        </div>
      </div>

      <p className="text-emerald-200/80 text-xs mt-6 text-center max-w-sm leading-relaxed">
        🔒 Ambiente seguro de evaluación. Al finalizar o expirar el tiempo, tus respuestas se enviarán automáticamente.
      </p>
    </div>
  );
}
