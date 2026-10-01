import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import Link from 'next/link';

export default async function AdminUsuariosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol !== 'admin') redirect('/dashboard');

  const db = await getDb();
  const usuarios = await db.collection('ex_usuarios')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ rol: 1, nombre: 1 })
    .toArray();

  const ROL_LABELS: Record<string, string> = {
    admin: '⚙️ Admin', directivo: '🏛 Directivo', coordinador: '📚 Coordinador',
    supervisor: '👁 Supervisor', docente: '👩‍🏫 Docente', estudiante: '🎓 Estudiante',
  };

  const ROL_COLORS: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    directivo: 'bg-red-100 text-red-700',
    coordinador: 'bg-orange-100 text-orange-700',
    supervisor: 'bg-blue-100 text-blue-700',
    docente: 'bg-green-100 text-green-700',
    estudiante: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumbs */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm mb-1">
              <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
              <span className="text-slate-400">/</span>
              <Link href="/admin" className="text-blue-600 hover:underline">Administración</Link>
              <span className="text-slate-400">/</span>
              <span className="text-slate-700 font-medium">Usuarios</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">👤 Gestión de Usuarios del Sistema</h1>
          </div>

          <Link
            href="/admin/usuarios/nuevo"
            className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-sm font-semibold transition shadow-xs flex items-center gap-1.5"
          >
            <span>+ Nuevo Usuario</span>
          </Link>
        </div>

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
              {usuarios.map(u => (
                <tr key={u._id.toString()} className="hover:bg-slate-50 transition">
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
                      href={`/admin/usuarios/${u._id.toString()}`}
                      className="px-3 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 hover:text-blue-800 font-semibold text-xs rounded-lg transition border border-slate-200"
                    >
                      ✏️ Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
