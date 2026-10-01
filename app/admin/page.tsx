import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { generateCloseCode, hoy } from '@/lib/utils';
import Link from 'next/link';

export default async function AdminPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol !== 'admin') redirect('/dashboard');

  const db = await getDb();

  // Stats
  const [totalExamenes, totalIntentos, totalUsuarios] = await Promise.all([
    db.collection('ex_examenes').countDocuments(),
    db.collection('ex_intentos').countDocuments({ estado: 'enviado' }),
    db.collection('ex_usuarios').countDocuments({ activo: true }),
  ]);

  const codigoCierreDia = generateCloseCode(new Date());
  const today = hoy();

  // Today's exam keys
  const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: today });

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:underline text-sm">← Dashboard</Link>
          <h1 className="text-2xl font-bold text-slate-800">⚙️ Panel de Administración</h1>
        </div>

        {/* Critical: Daily close code */}
        <div className="bg-purple-900 text-white rounded-2xl shadow-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-1">🔐 Código de Cierre del Día</h2>
          <p className="text-purple-300 text-sm mb-4">
            Comparte este código solo con el personal autorizado para cerrar la sesión de examen en los equipos. 
            Cambia automáticamente cada día a medianoche.
          </p>
          <div className="bg-purple-800 rounded-xl p-4 text-center">
            <p className="text-purple-300 text-xs mb-1">Código válido para hoy {today}</p>
            <p className="text-6xl font-mono font-bold text-yellow-300 tracking-[0.4em]">{codigoCierreDia}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-slate-400 text-sm">Exámenes totales</p>
            <p className="text-4xl font-bold text-blue-700">{totalExamenes}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-slate-400 text-sm">Intentos enviados</p>
            <p className="text-4xl font-bold text-emerald-600">{totalIntentos}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-5 text-center">
            <p className="text-slate-400 text-sm">Usuarios activos</p>
            <p className="text-4xl font-bold text-indigo-600">{totalUsuarios}</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { href: '/docentes', label: '👩‍🏫 Gestión de Docentes/Staff', desc: 'Crear y administrar usuarios' },
            { href: '/estudiantes', label: '🎓 Gestión de Estudiantes', desc: 'Ver alumnos desde reportes' },
            { href: '/examenes', label: '📝 Todos los Exámenes', desc: 'Lista completa' },
            { href: '/admisiones', label: '📋 Exámenes de Admisión', desc: 'Sección especial' },
            { href: '/resultados', label: '📊 Resultados Generales', desc: 'Ver todos los resultados' },
            { href: '/admin/usuarios', label: '👤 Usuarios del Sistema', desc: 'Administrar accesos' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className="bg-white rounded-xl shadow hover:shadow-md p-5 transition group">
              <h3 className="font-semibold text-slate-800 group-hover:text-blue-700 transition">{item.label}</h3>
              <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
