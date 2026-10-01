'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExamenLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ numeroDocumento: '', claveAcceso: '', examenId: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [examenes, setExamenes] = useState<Array<{ _id: string; titulo: string; materia?: string }>>([]);
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

    // Load active exams for the selector
    fetch('/api/estudiante/examenes-activos')
      .then(r => r.json())
      .then(data => setExamenes(data.examenes || []))
      .catch(() => {});
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/estudiante/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al ingresar'); return; }
      router.push(`/examen/${form.examenId}/presentar`);
    } catch {
      setError('Sin conexión. Verifique la red.');
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
    <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-800 to-teal-900 flex flex-col items-center justify-center p-4">
      {/* School header */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white shadow-lg flex items-center justify-center">
          <img src="/logo-cnslg.png" alt="CNSLG" className="w-20 h-20 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
        </div>
        <h1 className="text-white text-3xl font-bold">CNSLG — Exámenes</h1>
        <p className="text-green-200 text-sm mt-1">Acceso para Estudiantes (App de Escritorio)</p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <h2 className="text-gray-800 text-lg font-semibold mb-6 text-center">Ingresa tus datos</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Exam selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Examen</label>
            <select
              value={form.examenId}
              onChange={e => setForm(f => ({ ...f, examenId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              required
            >
              <option value="">— Selecciona el examen —</option>
              {examenes.map(ex => (
                <option key={ex._id} value={ex._id}>
                  {ex.titulo} {ex.materia ? `(${ex.materia})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Document number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Número de Documento</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.numeroDocumento}
              onChange={e => setForm(f => ({ ...f, numeroDocumento: e.target.value }))}
              placeholder="Cédula / NUIP / TI"
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-lg"
              required
            />
          </div>

          {/* Daily key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Clave del Día</label>
            <input
              type="text"
              value={form.claveAcceso}
              onChange={e => setForm(f => ({ ...f, claveAcceso: e.target.value.toUpperCase() }))}
              placeholder="Ingresada por el docente"
              maxLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition text-center text-xl font-mono tracking-[0.3em] uppercase"
              required
            />
            <p className="text-xs text-gray-400 mt-1">Tu docente te indicará esta clave de 6 caracteres</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !form.examenId}
            className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold py-3 rounded-lg transition-colors text-lg"
          >
            {loading ? 'Verificando...' : 'Presentar Examen'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          ¿Eres docente?{' '}
          <a href="/login" className="text-emerald-600 hover:underline">Acceso Staff</a>
        </p>
      </div>

      <p className="text-green-300 text-xs mt-8 text-center">
        Importante: No cierres esta ventana durante el examen.<br/>
        Al enviar tus respuestas no podrás volver a intentarlo.
      </p>
    </div>
  );
}
