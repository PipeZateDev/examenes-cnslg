import { NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';

export async function GET() {
  try {
    const db = await getDb();
    const examenes = await db.collection('ex_examenes')
      .find({ estado: 'activo' })
      .project({ titulo: 1, materia: 1 })
      .toArray();
    return NextResponse.json({ examenes });
  } catch (err) {
    return NextResponse.json({ examenes: [] });
  }
}
