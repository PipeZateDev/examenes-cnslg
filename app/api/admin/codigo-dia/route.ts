import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getSessionFromRequest, hasRole } from '@/lib/auth';
import { generateCloseCode, hoy } from '@/lib/utils';

// GET /api/admin/codigo-dia
export async function GET(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session || !hasRole(session.rol, 'admin')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const codigoCierre = generateCloseCode(new Date());
  const today = hoy();

  const db = await getDb();
  const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: today });

  return NextResponse.json({
    fecha: today,
    codigoCierre,
    examenesClaves: claveDoc?.examenesClaves || [],
  });
}

// POST /api/admin/verificar-codigo - Electron uses this to verify close code
export async function POST(req: NextRequest) {
  const { codigo } = await req.json();
  const expected = generateCloseCode(new Date());
  const valid = codigo === expected;
  return NextResponse.json({ valid });
}
