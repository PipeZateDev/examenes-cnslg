'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NuevoUsuarioPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: '',
    password: '',
    nombre: '',
    apellido: '',
    email: '',
    rol: 'docente',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al crear usuario');
        return;
      }
      router.push('/admin/usuarios');
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 p-8 max-w-lg w-full">
        <div className="flex items-center gap-2 text-xs mb-3 text-slate-500">
          <Link href="/admin/usuarios" className="text-blue-600 hover:underline">← Volver a Usuarios</Link>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 mb-1">➕ Registrar Nuevo Usuario Staff</h1>
        <p className="text-slate-500 text-xs mb-6">Crea una cuenta para docentes, directivos o administradores.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre</label>
              <input
                type="text"
                value={form.nombre}
                onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej: Laura"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Apellido</label>
              <input
                type="text"
                value={form.apellido}
                onChange={e => setForm(f => ({ ...f, apellido: e.target.value }))}
                placeholder="Ej: Gómez"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nombre de Usuario</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                placeholder="Ej: lgomez"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Contraseña</label>
              <input
                type="password"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                required
                minLength={6}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Correo Electrónico (Opcional)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="correo@colegiocnslg.edu.co"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Rol / Nivel de Acceso</label>
            <select
              value={form.rol}
              onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
            >
              <option value="docente">👩‍🏫 Docente (Crear y presentar exámenes)</option>
              <option value="supervisor">👁 Supervisor (Ver alumnos y resultados)</option>
              <option value="coordinador">📚 Coordinador (Gestionar alumnos y exámenes)</option>
              <option value="directivo">🏛 Directivo (Aprobar, activar y dar 2do intento)</option>
              <option value="admin">⚙️ Administrador (Acceso total al sistema)</option>
            </select>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <Link
              href="/admin/usuarios"
              className="flex-1 py-2.5 text-center border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50"
            >
              {loading ? 'Creando...' : 'Crear Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
