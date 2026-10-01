import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import Link from 'next/link';
import { getDb } from '@/lib/mongodb';

export default async function DocentesPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasRole(session.rol, 'coordinador')) redirect('/dashboard');

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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">← Dashboard</Link>
            <h1 className="text-2xl font-bold text-slate-800">👩‍🏫 Docentes / Staff</h1>
          </div>
          {session.rol === 'admin' && (
            <Link href="/admin/usuarios/nuevo"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition">
              + Nuevo Usuario
            </Link>
          )}
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Usuario</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Rol</th>
                <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                {session.rol === 'admin' && (
                  <th className="text-center px-4 py-3 font-semibold text-slate-600">Acciones</th>
                )}
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u._id.toString()} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.nombre} {u.apellido || ''}
                    {u.email && <p className="text-slate-400 text-xs">{u.email}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-sm">{u.username}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ROL_COLORS[u.rol] || 'bg-gray-100 text-gray-500'}`}>
                      {ROL_LABELS[u.rol] || u.rol}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {u.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  {session.rol === 'admin' && (
                    <td className="px-4 py-3 text-center">
                      <Link href={`/admin/usuarios/${u._id.toString()}`}
                        className="text-blue-600 hover:underline text-xs">
                        Editar
                      </Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
