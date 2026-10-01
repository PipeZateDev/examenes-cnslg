import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import UsuariosClient, { UsuarioItem } from './UsuariosClient';

export default async function AdminUsuariosPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.rol !== 'admin') redirect('/dashboard');

  const db = await getDb();
  const usuarios = await db.collection('ex_usuarios')
    .find({}, { projection: { passwordHash: 0 } })
    .sort({ rol: 1, nombre: 1 })
    .toArray();

  const lista: UsuarioItem[] = usuarios.map(u => ({
    _id: u._id.toString(),
    username: u.username as string,
    nombre: (u.nombre as string) || '',
    apellido: (u.apellido as string) || '',
    email: (u.email as string) || '',
    rol: (u.rol as string) || 'docente',
    activo: u.activo !== false,
  }));

  return <UsuariosClient usuarios={lista} />;
}
