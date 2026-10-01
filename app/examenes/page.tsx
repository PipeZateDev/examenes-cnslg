import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import { getDb } from '@/lib/mongodb';

export default async function ExamenesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; admision?: string }>;
}) {
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const params = await searchParams;
  const esAdmision = params.admision === '1';

  const db = await getDb();
  const filter: Record<string, unknown> = { esAdmision };
  if (params.estado) filter.estado = params.estado;

  const examenes = await db.collection('ex_examenes')
    .find(filter)
    .sort({ creadoEn: -1 })
    .project({ titulo: 1, materia: 1, estado: 1, creadoEn: 1, esAdmision: 1 })
    .toArray();

  const ESTADO_COLORS: Record<string, string> = {
    borrador: 'bg-gray-100 text-gray-600',
    pendiente_aprobacion: 'bg-amber-100 text-amber-700',
    aprobado: 'bg-blue-100 text-blue-700',
    activo: 'bg-green-100 text-green-700',
    cerrado: 'bg-red-100 text-red-600',
  };

  const ESTADO_LABELS: Record<string, string> = {
    borrador: 'Borrador',
    pendiente_aprobacion: 'Pendiente Aprobación',
    aprobado: 'Aprobado',
    activo: 'Activo ✓',
    cerrado: 'Cerrado',
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">← Dashboard</Link>
            <h1 className="font-bold text-slate-800 text-2xl">
              {esAdmision ? '📋 Exámenes de Admisión' : '📝 Exámenes'}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/examenes?admision=0" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${!esAdmision ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border border-blue-300'}`}>
              Regulares
            </Link>
            <Link href="/examenes?admision=1" className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${esAdmision ? 'bg-blue-700 text-white' : 'bg-white text-blue-700 border border-blue-300'}`}>
              Admisiones
            </Link>
            <Link href="/examenes/nuevo" className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition">
              + Nuevo Examen
            </Link>
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-xl shadow p-4 mb-4 flex gap-2 flex-wrap">
          {['', 'borrador', 'pendiente_aprobacion', 'aprobado', 'activo', 'cerrado'].map(e => (
            <Link
              key={e}
              href={`/examenes?${esAdmision ? 'admision=1&' : ''}${e ? `estado=${e}` : ''}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition border
                ${params.estado === e || (!params.estado && !e)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'}`}
            >
              {e ? ESTADO_LABELS[e] : 'Todos'}
            </Link>
          ))}
        </div>

        {/* Exams list */}
        {examenes.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-12 text-center text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p>No hay exámenes en esta categoría.</p>
            <Link href="/examenes/nuevo" className="mt-4 inline-block text-blue-600 hover:underline text-sm">
              Crear el primer examen →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {examenes.map((ex) => (
              <Link
                key={ex._id.toString()}
                href={`/examenes/${ex._id.toString()}`}
                className="bg-white rounded-xl shadow hover:shadow-md p-5 flex items-center justify-between transition group"
              >
                <div>
                  <h3 className="font-bold text-slate-800 group-hover:text-blue-700 transition">{ex.titulo}</h3>
                  {ex.materia && <p className="text-slate-500 text-sm">{ex.materia}</p>}
                  <p className="text-slate-400 text-xs mt-1">
                    {new Date(ex.creadoEn).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${ESTADO_COLORS[ex.estado] || 'bg-gray-100 text-gray-500'}`}>
                    {ESTADO_LABELS[ex.estado] || ex.estado}
                  </span>
                  <span className="text-gray-400 text-lg">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
