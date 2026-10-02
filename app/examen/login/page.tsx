'use client';

import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ExamenLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'estudiante' | 'staff'>('estudiante');

  // Student form state
  const [studentForm, setStudentForm] = useState({ numeroDocumento: '', claveAcceso: '' });

  // Staff form state
  const [staffForm, setStaffForm] = useState({ username: '', password: '' });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDesktop, setIsDesktop] = useState<boolean | null>(null);
  const [bypassDesktop, setBypassDesktop] = useState(false);

  useEffect(() => {
    // Detect if running inside Electron desktop app
    const inElectron = typeof window !== 'undefined' && (
      Boolean((window as any).electronAPI?.closeApp) ||
      Boolean((window as any).electronAPI?.isElectron) ||
      navigator.userAgent.includes('Electron') ||
      navigator.userAgent.includes('CNSLG-Desktop-App')
    );
    setIsDesktop(inElectron);
  }, []);

  // Handle Electron exit
  const handleExitApp = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.closeApp) {
      (window as any).electronAPI.closeApp();
    }
  };

  // Student Login Submit
  async function handleStudentSubmit(e: FormEvent) {
    e.preventDefault();
    if (!studentForm.numeroDocumento.trim()) {
      setError('Por favor ingresa tu número de documento.');
      return;
    }
    if (!studentForm.claveAcceso.trim()) {
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
          numeroDocumento: studentForm.numeroDocumento.trim(),
          claveAcceso: studentForm.claveAcceso.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al ingresar a la prueba');
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

  // Staff Login Submit (for live preview and catalog)
  async function handleStaffSubmit(e: FormEvent) {
    e.preventDefault();
    if (!staffForm.username.trim() || !staffForm.password) {
      setError('Por favor ingresa tu usuario y contraseña institucional.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: staffForm.username.trim(),
          password: staffForm.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Credenciales inválidas');
        return;
      }
      // Redirect to staff live exam catalog
      router.push('/examen/staff');
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
            <p>👩‍🏫 <strong>Para Docentes y Directivos:</strong> Toda la gestión remota, creación de pruebas y revisión de resultados se realiza desde el portal web.</p>
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
    <div
      className={`min-h-screen flex flex-col items-center justify-center p-4 relative transition-colors duration-500 ${
        tab === 'estudiante'
          ? 'bg-gradient-to-br from-green-950 via-emerald-900 to-teal-950'
          : 'bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950'
      }`}
    >
      {/* Top right quick exit for desktop app */}
      {isDesktop && (
        <button
          onClick={handleExitApp}
          className="absolute top-4 right-4 bg-red-600/80 hover:bg-red-600 text-white font-bold px-3.5 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow-lg border border-red-500/50 backdrop-blur-xs"
          title="Cerrar la aplicación de escritorio"
        >
          <span>🚪</span>
          <span>Cerrar Aplicativo</span>
        </button>
      )}

      {/* School header */}
      <div className="text-center mb-6">
        <div className="w-24 h-24 mx-auto mb-3 rounded-full bg-white shadow-xl flex items-center justify-center p-2 border-2 border-emerald-400/80">
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
          Colegio Nuevo San Luis Gonzaga
        </p>
      </div>

      {/* Login card */}
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 border border-white/20 backdrop-blur-xs">
        {/* Role Selector Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-2xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => { setTab('estudiante'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tab === 'estudiante'
                ? 'bg-white text-emerald-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>🎓</span>
            <span>Estudiante</span>
          </button>
          <button
            type="button"
            onClick={() => { setTab('staff'); setError(''); }}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tab === 'staff'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>👩‍🏫</span>
            <span>Staff / Vista en Vivo</span>
          </button>
        </div>

        {/* ─── TAB 1: STUDENT LOGIN ────────────────────────────────────────── */}
        {tab === 'estudiante' && (
          <>
            <h2 className="text-slate-800 text-xl font-bold mb-1 text-center">
              Ingreso a la Prueba
            </h2>
            <p className="text-slate-500 text-xs text-center mb-6 leading-relaxed">
              Digita tu número de identidad y el código de 6 caracteres suministrado por tu docente.
            </p>

            <form onSubmit={handleStudentSubmit} className="space-y-5">
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
                    value={studentForm.numeroDocumento}
                    onChange={e => setStudentForm(f => ({ ...f, numeroDocumento: e.target.value }))}
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
                    value={studentForm.claveAcceso}
                    onChange={e => setStudentForm(f => ({ ...f, claveAcceso: e.target.value.toUpperCase() }))}
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
                disabled={loading || !studentForm.numeroDocumento || !studentForm.claveAcceso}
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
          </>
        )}

        {/* ─── TAB 2: STAFF LOGIN (LIVE PREVIEW) ───────────────────────────── */}
        {tab === 'staff' && (
          <>
            <h2 className="text-slate-800 text-xl font-bold mb-1 text-center">
              Acceso Personal / Staff
            </h2>
            <p className="text-slate-500 text-xs text-center mb-6 leading-relaxed">
              Ingresa con tu cuenta institucional para explorar y probar las evaluaciones en vivo como alumno.
            </p>

            <form onSubmit={handleStaffSubmit} className="space-y-5">
              {/* Username */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Usuario Institucional
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-lg pointer-events-none">
                    👤
                  </span>
                  <input
                    type="text"
                    value={staffForm.username}
                    onChange={e => setStaffForm(f => ({ ...f, username: e.target.value }))}
                    placeholder="usuario@cnslg o nombre.apellido"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 font-semibold text-sm transition placeholder:font-normal placeholder:text-slate-400"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  Contraseña
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 text-lg pointer-events-none">
                    🔒
                  </span>
                  <input
                    type="password"
                    value={staffForm.password}
                    onChange={e => setStaffForm(f => ({ ...f, password: e.target.value }))}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white text-slate-800 font-semibold text-sm transition placeholder:font-normal placeholder:text-slate-400"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-4 py-3 rounded-xl flex items-start gap-2 leading-relaxed">
                  <span className="text-base flex-shrink-0">⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !staffForm.username || !staffForm.password}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-base shadow-lg shadow-blue-700/25 flex items-center justify-center gap-2 active:scale-[0.99]"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verificando credenciales...</span>
                  </>
                ) : (
                  <span>Ingresar al Catálogo de Pruebas →</span>
                )}
              </button>
            </form>

            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 leading-relaxed">
              💡 <strong>Acceso sin código de examen:</strong> Directivos, Administradores, Coordinadores y Docentes acceden directamente sin requerir clave diaria.
            </div>
          </>
        )}

        {/* Exit App Button for Electron Desktop */}
        {isDesktop && (
          <div className="pt-4 mt-5 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-400 font-medium">Aplicación Oficial CNSLG</span>
            <button
              type="button"
              onClick={handleExitApp}
              className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-800 border border-red-200 font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition"
              title="Cerrar la aplicación de escritorio"
            >
              <span>🚪</span>
              <span>Cerrar Aplicación</span>
            </button>
          </div>
        )}
      </div>

      <p className="text-slate-300/80 text-xs mt-6 text-center max-w-sm leading-relaxed">
        🔒 Plataforma de Evaluaciones — Colegio Nuevo San Luis Gonzaga
      </p>
    </div>
  );
}
