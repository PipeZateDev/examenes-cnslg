import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import Link from 'next/link';
import type { Rol } from '@/lib/types';
import DashboardClient from './DashboardClient';

const MENU_ITEMS = [
  { href: '/examen/staff', label: 'Vista en Vivo Alumno', icon: '👁️', desc: 'Ver y probar exámenes exactamente como los ve el alumno', minRol: 'docente' as Rol, isLivePreview: true },
  { href: '/examenes', label: 'Exámenes', icon: '📝', desc: 'Gestionar y crear exámenes', minRol: 'docente' as Rol },
  { href: '/examenes/nuevo', label: 'Nuevo Examen', icon: '➕', desc: 'Crear examen desde PDF/WORD', minRol: 'docente' as Rol },
  { href: '/resultados', label: 'Resultados', icon: '📊', desc: 'Ver resultados en tiempo real', minRol: 'docente' as Rol },
  { href: '/estudiantes', label: 'Estudiantes', icon: '🎓', desc: 'Gestión de alumnos', minRol: 'supervisor' as Rol },
  { href: '/docentes', label: 'Docentes/Staff', icon: '👩‍🏫', desc: 'Gestión de usuarios staff', minRol: 'coordinador' as Rol },
  { href: '/admisiones', label: 'Admisiones', icon: '📋', desc: 'Exámenes de admisión', minRol: 'docente' as Rol },
  { href: '/admin', label: 'Administración', icon: '⚙️', desc: 'Panel de administración total', minRol: 'admin' as Rol },
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
    <DashboardClient
      user={{ nombre: session.nombre, rol: session.rol }}
      rolLabels={rolLabels}
      visibleItems={visibleItems}
    />
  );
}

