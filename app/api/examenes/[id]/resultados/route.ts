import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';

// GET /api/examenes/[id]/resultados
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  
  // Get all attempts for this exam, preserving history and sorting by student name and attempt number
  const intentos = await db.collection('ex_intentos')
    .find({ examenId: id })
    .sort({ estudianteNombre: 1, intentoNumero: 1, enviadoEn: -1 })
    .toArray();

  // Get all authorizations for this exam
  const habilitaciones = await db.collection('ex_habilitaciones')
    .find({ examenId: id })
    .toArray();

  return NextResponse.json({
    intentos,
    habilitaciones,
    esDirectivo: hasRole(session.rol, 'directivo'),
    esAdmin: session.rol === 'admin',
  });
}
