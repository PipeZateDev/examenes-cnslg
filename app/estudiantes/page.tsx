import { redirect } from 'next/navigation';
import { getSession, hasRole } from '@/lib/auth';
import { getDbReportes } from '@/lib/mongodb';
import Link from 'next/link';

export default async function EstudiantesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!hasRole(session.rol, 'supervisor')) redirect('/dashboard');

  const params = await searchParams;
  const q = params.q || '';
  const page = Number(params.page || 1);
  const limit = 50;
  const skip = (page - 1) * limit;

  const db = await getDbReportes();
  const filter = q
    ? { $or: [
        { nombreCompleto: { $regex: q, $options: 'i' } },
        { numeroDocumento: { $regex: q, $options: 'i' } },
      ]}
    : {};

  const [estudiantes, total] = await Promise.all([
    db.collection('students')
      .find(filter)
      .sort({ nombreNormalizado: 1 })
      .skip(skip)
      .limit(limit)
      .project({ nombreCompleto: 1, numeroDocumento: 1, tipoDocumento: 1, foto: 1, fotoPosicionX: 1, fotoPosicionY: 1 })
      .toArray(),
    db.collection('students').countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">← Dashboard</Link>
            <h1 className="text-2xl font-bold text-slate-800">🎓 Estudiantes</h1>
          </div>
          <span className="text-slate-500 text-sm">{total.toLocaleString()} estudiantes</span>
        </div>

        {/* Search */}
        <form className="bg-white rounded-xl shadow p-4 mb-4 flex gap-3">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nombre o documento..."
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition">
            Buscar
          </button>
        </form>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {estudiantes.map(est => {
            const fotoSrc = est.foto?.data
              ? `data:${est.foto.contentType};base64,${est.foto.data}`
              : null;
            const posX = est.fotoPosicionX ?? 50;
            const posY = est.fotoPosicionY ?? 50;

            return (
              <div key={est._id.toString()} className="bg-white rounded-xl shadow hover:shadow-md p-3 text-center transition">
                <div className="w-16 h-16 rounded-full mx-auto mb-2 overflow-hidden bg-gray-200 flex items-center justify-center">
                  {fotoSrc ? (
                    <img
                      src={fotoSrc}
                      alt={est.nombreCompleto}
                      className="w-full h-full object-cover"
                      style={{ objectPosition: `${posX}% ${posY}%` }}
                    />
                  ) : (
                    <span className="text-gray-400 text-2xl">👤</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-slate-800 leading-tight">{est.nombreCompleto}</p>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{est.numeroDocumento}</p>
                <p className="text-xs text-slate-300">{est.tipoDocumento}</p>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {page > 1 && (
              <Link href={`/estudiantes?q=${q}&page=${page - 1}`}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-lg shadow text-sm hover:bg-blue-50">
                ← Anterior
              </Link>
            )}
            <span className="text-slate-500 text-sm">Página {page} de {totalPages}</span>
            {page < totalPages && (
              <Link href={`/estudiantes?q=${q}&page=${page + 1}`}
                className="px-3 py-1.5 bg-white text-blue-600 rounded-lg shadow text-sm hover:bg-blue-50">
                Siguiente →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
