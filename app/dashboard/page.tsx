import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import type { Rol } from '@/lib/types';
import DashboardHeader from './DashboardHeader';

const MENU_ITEMS: { href: string; label: string; icon: string; desc: string; minRol: Rol }[] = [
  { href: '/examen/staff', label: 'Vista en Vivo Alumno', icon: '👁️', desc: 'Ver y probar exámenes exactamente como los ve el alumno', minRol: 'docente' },
  { href: '/examenes', label: 'Exámenes', icon: '📝', desc: 'Gestionar y crear exámenes', minRol: 'docente' },
  { href: '/examenes/nuevo', label: 'Nuevo Examen', icon: '➕', desc: 'Crear examen desde PDF/WORD', minRol: 'docente' },
  { href: '/resultados', label: 'Resultados', icon: '📊', desc: 'Ver resultados en tiempo real', minRol: 'docente' },
  { href: '/estudiantes', label: 'Estudiantes', icon: '🎓', desc: 'Gestión de alumnos', minRol: 'supervisor' },
  { href: '/docentes', label: 'Docentes/Staff', icon: '👩‍🏫', desc: 'Gestión de usuarios staff', minRol: 'coordinador' },
  { href: '/admisiones', label: 'Admisiones', icon: '📋', desc: 'Exámenes de admisión', minRol: 'docente' },
  { href: '/admin', label: 'Administración', icon: '⚙️', desc: 'Panel de administración total', minRol: 'admin' },
];

const ROL_LEVEL: Record<Rol, number> = {
  estudiante: 0, docente: 1, supervisor: 2, coordinador: 3, directivo: 4, admin: 5,
};

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol === 'estudiante') redirect('/examen/login');

  const visibleItems = MENU_ITEMS.filter(
    item => ROL_LEVEL[session.rol] >= ROL_LEVEL[item.minRol]
  );

  const rolLabels: Record<Rol, string> = {
    estudiante: 'Estudiante', docente: 'Docente', supervisor: 'Supervisor',
    coordinador: 'Coordinador', directivo: 'Directivo', admin: 'Administrador',
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Top navbar */}
      <DashboardHeader
        user={{ nombre: session.nombre, rol: session.rol }}
        rolLabels={rolLabels}
      />


      {/* Main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">Bienvenido, {session.nombre.split(' ')[0]}</h2>
          <p className="text-slate-500">¿Qué deseas hacer hoy?</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-white rounded-xl shadow hover:shadow-md border border-transparent hover:border-blue-200 p-6 flex items-start gap-4 transition-all group"
            >
              <span className="text-4xl group-hover:scale-110 transition-transform">{item.icon}</span>
              <div>
                <h3 className="font-bold text-slate-800 text-base group-hover:text-blue-700 transition-colors">
                  {item.label}
                </h3>
                <p className="text-slate-500 text-sm mt-1">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Quick stats */}
        <div className="mt-8 bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold text-slate-700 mb-4">Vista Rápida</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <QuickStat label="Exámenes Activos" href="/examenes?estado=activo" color="blue" />
            <QuickStat label="Pendientes Aprobación" href="/examenes?estado=pendiente" color="amber" />
            <QuickStat label="Resultados Hoy" href="/resultados" color="emerald" />
            <QuickStat label="Código de Cierre" href="/admin/codigo-dia" color="purple" />
          </div>
        </div>
      </main>
    </div>
  );
}

function QuickStat({ label, href, color }: { label: string; href: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100',
    amber: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
    purple: 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100',
  };
  return (
    <Link href={href} className={`border rounded-lg px-4 py-3 text-sm font-medium transition ${colors[color]}`}>
      {label} →
    </Link>
  );
}
