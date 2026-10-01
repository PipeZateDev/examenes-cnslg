import { NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { createSession, COOKIE_NAME } from '@/lib/auth';
import { generateCloseCode, hoy } from '@/lib/utils';

/**
 * Student login — uses:
 *   - username: numeroDocumento (from reportes-cnslg Students)
 *   - password: daily key provided by docente for the exam
 */
export async function POST(req: Request) {
  try {
    const { numeroDocumento, claveAcceso, examenId } = await req.json();

    if (!numeroDocumento || !claveAcceso || !examenId) {
      return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // 1. Verify student exists in reportes
    const dbReportes = await getDbReportes();
    const student = await dbReportes.collection('students').findOne({
      numeroDocumento: String(numeroDocumento).trim(),
    });
    if (!student) {
      return NextResponse.json({ error: 'Documento no encontrado' }, { status: 401 });
    }

    // 2. Verify exam exists and is active
    const db = await getDb();
    const { ObjectId } = await import('mongodb');
    const examen = await db.collection('ex_examenes').findOne({
      _id: new ObjectId(examenId),
      estado: 'activo',
    });
    if (!examen) {
      return NextResponse.json({ error: 'Examen no disponible' }, { status: 404 });
    }

    // 3. Verify daily access key
    const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: hoy() });
    const examenClave = claveDoc?.examenesClaves?.find(
      (e: { examenId: string; clave: string }) => e.examenId === examenId
    );
    if (!examenClave || examenClave.clave.toUpperCase() !== claveAcceso.toUpperCase()) {
      return NextResponse.json({ error: 'Clave de acceso incorrecta' }, { status: 401 });
    }

    // 4. Check if student already used all attempts
    const intentos = await db.collection('ex_intentos').countDocuments({
      examenId,
      estudianteId: numeroDocumento,
      estado: { $in: ['enviado', 'bloqueado'] },
    });
    if (intentos >= examen.intentosPermitidos) {
      return NextResponse.json({
        error: 'Ya has presentado este examen. Contacta al administrador para un nuevo intento.',
      }, { status: 403 });
    }

    // 5. Create session (student role)
    const token = await createSession({
      userId: student._id.toString(),
      username: numeroDocumento,
      rol: 'estudiante',
      nombre: student.nombreCompleto,
    });

    const res = NextResponse.json({
      ok: true,
      examenId,
      nombre: student.nombreCompleto,
    });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 4, // 4 hours max for exam session
      path: '/',
    });

    return res;
  } catch (err) {
    console.error('Student login error:', err);
    return NextResponse.json({ error: 'Error del servidor' }, { status: 500 });
  }
}
