import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { generateCloseCode, hoy } from '@/lib/utils';
import Link from 'next/link';

export default async function AdminCodigoDiaPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol !== 'admin' && session.rol !== 'directivo') redirect('/dashboard');

  const today = hoy();
  const codigoCierre = generateCloseCode(new Date());

  const db = await getDb();
  const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: today });
  const activeExams = (claveDoc?.examenesClaves as Array<{ examenId: string; clave: string; titulo?: string }>) || [];

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm mb-4">
          <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link href="/admin" className="text-blue-600 hover:underline">Administración</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-700 font-medium">Códigos del Día</span>
        </div>

        {/* Master Close Code Card */}
        <div className="bg-gradient-to-br from-purple-950 via-indigo-900 to-slate-900 text-white rounded-3xl shadow-xl p-8 mb-6 border border-purple-800/40">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">🔐</span>
            <h1 className="text-2xl font-black">Código Maestro de Cierre Diario</h1>
          </div>
          <p className="text-purple-200 text-sm mb-6 max-w-xl leading-relaxed">
            Este código de 6 dígitos permite al personal administrativo o docente de soporte desbloquear y cerrar el aplicativo seguro (Modo Kiosk) en cualquier computador de la sala. Se recalcula automáticamente cada medianoche.
          </p>

          <div className="bg-white/10 border border-white/20 rounded-2xl p-6 text-center backdrop-blur-md max-w-md mx-auto">
            <p className="text-purple-300 text-xs uppercase font-bold tracking-wider mb-1">
              Código Válido para Hoy ({today})
            </p>
            <p className="text-5xl md:text-6xl font-mono font-black text-yellow-300 tracking-[0.35em] drop-shadow-sm">
              {codigoCierre}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-4 text-xs text-purple-300/80">
            <span>🛡️ Cifrado HMAC-SHA256</span>
            <span>•</span>
            <span>⚡ Válido en toda la red CNSLG</span>
          </div>
        </div>

        {/* Today's Active Exam Access Keys */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>🔑</span>
              <span>Claves de Examen Activas para Hoy</span>
            </h2>
            <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
              {activeExams.length} activas
            </span>
          </div>

          {activeExams.length === 0 ? (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center text-slate-400">
              <p className="text-sm">No hay claves de exámenes activadas para el día de hoy.</p>
              <Link href="/examenes" className="text-blue-600 hover:underline text-xs font-semibold mt-2 inline-block">
                Ir a la lista de exámenes para activar una prueba →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl overflow-hidden">
              {activeExams.map((item, idx) => (
                <div key={idx} className="p-4 flex items-center justify-between hover:bg-slate-50 transition">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      {item.titulo || `Examen ID: ${item.examenId}`}
                    </h3>
                    <p className="text-slate-400 text-xs font-mono mt-0.5">ID: {item.examenId}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xl font-bold bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-1 rounded-xl tracking-widest">
                      {item.clave}
                    </span>
                    <Link
                      href={`/examenes/${item.examenId}`}
                      className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition"
                    >
                      Ver Examen
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
