import { NextResponse } from 'next/server';
import { getDb, getDbReportes } from '@/lib/mongodb';
import { createSession, COOKIE_NAME } from '@/lib/auth';
import { hoy } from '@/lib/utils';
import { ObjectId } from 'mongodb';

/**
 * Student login:
 *   - numeroDocumento: Student's ID / TI / CC / NUIP
 *   - claveAcceso: 6-char access key provided by the docente
 *
 * Automatically locates the unique active exam associated with that access key
 * and redirects the student directly to presentation.
 */
export async function POST(req: Request) {
  try {
    const { numeroDocumento, claveAcceso, examenId: inputExamenId } = await req.json();

    if (!numeroDocumento || !claveAcceso) {
      return NextResponse.json({
        error: 'Por favor ingresa tu número de documento y el código del examen proporcionado por tu docente.',
      }, { status: 400 });
    }

    const docStr = String(numeroDocumento).trim();
    const claveStr = String(claveAcceso).trim().toUpperCase();

    // Verify request comes from desktop app (Electron)
    const userAgent = req.headers.get('user-agent') || '';
    const isDesktop = userAgent.includes('Electron') || userAgent.includes('CNSLG-Desktop-App');
    const allowWeb = process.env.ALLOW_WEB_STUDENT === '1' || process.env.NODE_ENV !== 'production';

    if (!isDesktop && !allowWeb) {
      return NextResponse.json({
        error: 'Esta prueba solo puede ser presentada desde la aplicación de escritorio oficial instalada en los computadores del colegio.',
      }, { status: 403 });
    }

    // 1. Verify student exists in reportes (or fallback to examenes db)
    let student = null;
    try {
      const dbReportes = await getDbReportes();
      student = await dbReportes.collection('students').findOne({
        numeroDocumento: docStr,
      });
    } catch (_) {}

    if (!student) {
      const db = await getDb();
      student = await db.collection('students').findOne({
        numeroDocumento: docStr,
      });
    }

    if (!student) {
      return NextResponse.json({
        error: 'Número de documento no encontrado en el sistema de estudiantes. Verifica que esté bien escrito.',
      }, { status: 401 });
    }

    const db = await getDb();
    const today = hoy();

    // 2. Identify the active exam corresponding to the unique access code
    let matchedExamenId: string | null = null;

    // A. Check today's active keys in ex_clave_dia
    const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: today });
    if (claveDoc?.examenesClaves && Array.isArray(claveDoc.examenesClaves)) {
      const found = claveDoc.examenesClaves.find(
        (e: { examenId: string; clave: string }) => e.clave && e.clave.toUpperCase() === claveStr
      );
      if (found) {
        matchedExamenId = found.examenId;
      }
    }

    // B. Find exam by matched ID or by claveAcceso field in ex_examenes
    let examen = null;
    if (matchedExamenId) {
      try {
        examen = await db.collection('ex_examenes').findOne({
          _id: new ObjectId(matchedExamenId),
          estado: 'activo',
        });
      } catch (_) {}
    }

    if (!examen) {
      examen = await db.collection('ex_examenes').findOne({
        estado: 'activo',
        claveAcceso: claveStr,
      });
    }

    // C. Legacy fallback if explicit examenId was supplied
    if (!examen && inputExamenId) {
      try {
        const candidate = await db.collection('ex_examenes').findOne({
          _id: new ObjectId(inputExamenId),
          estado: 'activo',
        });
        if (candidate && candidate.claveAcceso?.toUpperCase() === claveStr) {
          examen = candidate;
        }
      } catch (_) {}
    }

    if (!examen) {
      return NextResponse.json({
        error: 'Código de examen incorrecto o no se encuentra activo ningún examen con este código hoy. Por favor verifica con tu docente.',
      }, { status: 404 });
    }

    const finalExamenId = examen._id.toString();

    // 3. Check if student already presented or exhausted allowed attempts
    const intentos = await db.collection('ex_intentos').countDocuments({
      examenId: finalExamenId,
      estudianteId: docStr,
      estado: { $in: ['enviado', 'bloqueado'] },
    });

    const maxIntentos = examen.intentosPermitidos || 1;
    if (intentos >= maxIntentos) {
      return NextResponse.json({
        error: 'Ya has presentado y enviado este examen. Si requieres presentar un nuevo intento, solicita autorización a tu docente o administrador.',
      }, { status: 403 });
    }

    // 4. Create session (student role)
    const token = await createSession({
      userId: student._id.toString(),
      username: docStr,
      rol: 'estudiante',
      nombre: student.nombreCompleto,
    });

    const res = NextResponse.json({
      ok: true,
      examenId: finalExamenId,
      titulo: examen.titulo,
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
