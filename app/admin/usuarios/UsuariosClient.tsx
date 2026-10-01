'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';

export interface UsuarioItem {
  _id: string;
  username: string;
  nombre: string;
  apellido?: string;
  email?: string;
  rol: string;
  activo?: boolean;
}

interface UsuariosClientProps {
  usuarios: UsuarioItem[];
}

const ROL_LABELS: Record<string, string> = {
  admin: '⚙️ Admin',
  directivo: '🏛 Directivo',
  coordinador: '📚 Coordinador',
  supervisor: '👁 Supervisor',
  docente: '👩‍🏫 Docente',
  estudiante: '🎓 Estudiante',
};

const ROL_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  directivo: 'bg-red-100 text-red-700',
  coordinador: 'bg-orange-100 text-orange-700',
  supervisor: 'bg-blue-100 text-blue-700',
  docente: 'bg-green-100 text-green-700',
  estudiante: 'bg-gray-100 text-gray-600',
};

export default function UsuariosClient({ usuarios }: UsuariosClientProps) {
  const [busqueda, setBusqueda] = useState('');
  const [rolFilter, setRolFilter] = useState('');

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();

    return usuarios.filter(u => {
      // Filter by role
      if (rolFilter && u.rol !== rolFilter) return false;

      // Real-time search query
      if (!q) return true;

      const fullName = `${u.nombre || ''} ${u.apellido || ''}`.toLowerCase();
      const matchName = fullName.includes(q);
      const matchUsername = (u.username || '').toLowerCase().includes(q);
      const matchEmail = (u.email || '').toLowerCase().includes(q);
      const matchRol = (ROL_LABELS[u.rol] || u.rol || '').toLowerCase().includes(q);

      return matchName || matchUsername || matchEmail || matchRol;
    });
  }, [usuarios, busqueda, rolFilter]);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumbs */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <Link href="/admin" className="text-blue-600 hover:underline">Administración</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Usuarios</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">👤 Gestión de Usuarios del Sistema</h1>
            <p className="text-slate-500 text-xs mt-0.5">
              Administración de cuentas docentes, coordinadores, directivos y administradores.
            </p>
          </div>

          <Link
            href="/admin/usuarios/nuevo"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            <span>+ Nuevo Usuario</span>
          </Link>
        </div>

        {/* Real-time search and role filter bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {['', 'admin', 'directivo', 'coordinador', 'docente'].map(r => (
              <button
                key={r}
                onClick={() => setRolFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border cursor-pointer ${
                  rolFilter === r
                    ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {r ? ROL_LABELS[r] || r : 'Todos los Roles'}
              </button>
            ))}
          </div>

          <div className="relative flex-1 max-w-xs">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar en tiempo real por nombre, usuario o email..."
              className="w-full pl-8 pr-8 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white transition"
              autoComplete="off"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold p-1 leading-none rounded-md"
                title="Limpiar búsqueda"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Live counter */}
        {busqueda && (
          <div className="mb-4 text-xs text-slate-500 flex items-center justify-between px-1">
            <span>
              Resultados para &quot;<strong className="text-slate-800">{busqueda}</strong>&quot;: <strong>{filtrados.length}</strong> encontrados
            </span>
            <button
              onClick={() => setBusqueda('')}
              className="text-blue-600 hover:underline font-semibold text-xs"
            >
              Limpiar filtro
            </button>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left px-5 py-3.5 font-bold">Nombre Completo</th>
                <th className="text-left px-4 py-3.5 font-bold">Nombre de Usuario</th>
                <th className="text-center px-4 py-3.5 font-bold">Rol en Sistema</th>
                <th className="text-center px-4 py-3.5 font-bold">Estado</th>
                <th className="text-center px-4 py-3.5 font-bold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-slate-400">
                    <div className="text-3xl mb-2">👤</div>
                    No se encontraron usuarios que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filtrados.map(u => (
                  <tr key={u._id} className="hover:bg-slate-50 transition">
                    <td className="px-5 py-3.5 font-medium text-slate-900">
                      <div>{u.nombre} {u.apellido || ''}</div>
                      {u.email && <p className="text-slate-400 text-xs">{u.email}</p>}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-600 text-xs font-semibold">
                      {u.username}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${ROL_COLORS[u.rol] || 'bg-gray-100 text-gray-500'}`}>
                        {ROL_LABELS[u.rol] || u.rol}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${u.activo !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {u.activo !== false ? '✓ Activo' : '✗ Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <Link
                        href={`/admin/usuarios/${u._id}`}
                        className="px-3 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold text-xs rounded-lg transition border border-slate-200"
                      >
                        ✏️ Editar
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
