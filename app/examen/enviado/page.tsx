'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

function ExamenEnviadoContent() {
  const searchParams = useSearchParams();
  const isAuto = searchParams.get('auto') === '1';
  const [countdown, setCountdown] = useState(5);
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    // Check if running inside Electron desktop app
    const inElectron = typeof window !== 'undefined' && (
      !!(window as unknown as { electronAPI?: { isElectron?: boolean; closeApp?: () => Promise<unknown> } }).electronAPI?.isElectron ||
      navigator.userAgent.includes('Electron') ||
      navigator.userAgent.includes('CNSLG-Desktop-App')
    );
    setIsElectron(inElectron);

    // Countdown to close the app
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleCerrar();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  function handleCerrar() {
    if (typeof window !== 'undefined') {
      const api = (window as unknown as { electronAPI?: { closeApp?: () => Promise<unknown> } }).electronAPI;
      if (api?.closeApp) {
        api.closeApp();
        return;
      }
      try {
        window.close();
      } catch (_) {}
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-10 max-w-md w-full text-center border border-emerald-100">
        <div className="text-6xl mb-4 animate-bounce">
          {isAuto ? '⏰' : '✅'}
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-2">
          {isAuto ? '¡Tiempo Terminado y Examen Enviado!' : '¡Examen Enviado Exitosamente!'}
        </h1>

        <p className="text-slate-600 text-sm mb-4 leading-relaxed">
          {isAuto
            ? 'El tiempo del examen se agotó. Todas tus respuestas contestadas han sido registradas de forma segura.'
            : 'Tus respuestas han sido registradas exitosamente en la plataforma de calificaciones.'}
        </p>

        {/* Auto-close notification box */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-emerald-900 mb-6 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-1">
            Cierre del Aplicativo
          </p>
          <p className="text-sm font-medium">
            El aplicativo se cerrará automáticamente en:
          </p>
          <div className="text-3xl font-mono font-black text-emerald-700 my-1">
            {countdown}s
          </div>
          <p className="text-[11px] text-emerald-600">
            {isElectron
              ? 'La aplicación de escritorio se cerrará por completo.'
              : 'Puedes cerrar esta pestaña o apagar el computador.'}
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCerrar}
          className="w-full bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white font-bold py-3.5 px-6 rounded-2xl shadow-lg shadow-emerald-700/20 transition text-sm flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          <span>Cerrar Aplicativo Ahora</span>
        </button>

        <p className="text-[11px] text-slate-400 mt-6">
          Colegio Nuevo San Luis Gonzaga — Plataforma de Evaluaciones
        </p>
      </div>
    </div>
  );
}

export default function ExamenEnviadoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
          <p>Cargando confirmación...</p>
        </div>
      }
    >
      <ExamenEnviadoContent />
    </Suspense>
  );
}
