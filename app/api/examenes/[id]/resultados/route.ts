import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { ObjectId } from 'mongodb';

// GET /api/examenes/[id]/resultados
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'docente')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const db = await getDb();
  const intentos = await db.collection('ex_intentos')
    .find({ examenId: id })
    .sort({ enviadoEn: -1 })
    .toArray();

  return NextResponse.json({ intentos });
}
