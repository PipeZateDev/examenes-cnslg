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

    // 1. Verify student exists in examenes or reportes DB
    const db = await getDb();
    let student = await db.collection('students').findOne({
      numeroDocumento: docStr,
    });

    if (!student) {
      try {
        const dbReportes = await getDbReportes();
        student = await dbReportes.collection('students').findOne({
          numeroDocumento: docStr,
        });
      } catch (_) {}
    }

    if (!student) {
      return NextResponse.json({
        error: 'Número de documento no encontrado en el sistema. Verifica que esté bien escrito o consulta con tu docente o admisiones.',
      }, { status: 401 });
    }

    if (student.activo === false) {
      return NextResponse.json({
        error: 'El estudiante o aspirante se encuentra inactivo en el sistema. Consulta con la coordinación.',
      }, { status: 403 });
    }

    // Auto-resolve course from graderecords if not present directly on student doc
    if (!student.curso && !student.esAdmision) {
      try {
        const dbReportes = await getDbReportes();
        const latestGrade = await dbReportes.collection('graderecords').findOne(
          { numeroDocumento: docStr },
          { sort: { anioLectivo: -1, periodo: -1, updatedAt: -1 } }
        );
        if (latestGrade?.curso) {
          student.curso = latestGrade.curso;
          dbReportes.collection('students').updateOne(
            { numeroDocumento: docStr },
            { $set: { curso: latestGrade.curso } }
          ).catch(() => {});
        }
      } catch (_) {}
    }

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

    // 2.5 Strict Admission vs Regular Exam Check
    const isAspirante = Boolean(student.esAdmision);
    const isExamenAdmision = Boolean(examen.esAdmision);

    if (isAspirante && !isExamenAdmision) {
      return NextResponse.json({
        error: 'Tu usuario está registrado como aspirante al proceso de admisión. Únicamente puedes presentar pruebas diagnósticas de admisión.',
      }, { status: 403 });
    }

    if (!isAspirante && isExamenAdmision) {
      return NextResponse.json({
        error: 'Este examen es exclusivo para aspirantes al proceso de admisión. Los estudiantes matriculados regulares no pueden presentar pruebas de admisión.',
      }, { status: 403 });
    }

    // Course verification for regular students
    if (!isAspirante && Array.isArray(examen.cursos) && examen.cursos.length > 0) {
      const studentCurso = String(student.curso || student.grado || '').trim().toLowerCase();
      const allowedCursos = examen.cursos.map((c: string) => String(c).trim().toLowerCase());

      const isCourseAllowed = allowedCursos.some((c: string) => 
        c === studentCurso ||
        (studentCurso && c.includes(studentCurso)) ||
        (studentCurso && studentCurso.includes(c))
      );

      if (!isCourseAllowed && studentCurso) {
        return NextResponse.json({
          error: `Este examen está asignado a los cursos (${examen.cursos.join(', ')}). Tu curso registrado es ${student.curso || student.grado}, por lo que no estás habilitado para esta prueba.`,
        }, { status: 403 });
      }
    }

    const finalExamenId = examen._id.toString();

    // 3. Check if student already presented or exhausted allowed attempts
    const intentosCompletados = await db.collection('ex_intentos').countDocuments({
      examenId: finalExamenId,
      estudianteId: docStr,
      estado: { $in: ['enviado', 'bloqueado'] },
    });

    const habilitacion = await db.collection('ex_habilitaciones').findOne({
      examenId: finalExamenId,
      estudianteId: docStr,
    });

    const maxIntentos = habilitacion?.intentosPermitidos || examen.intentosPermitidos || 1;
    if (intentosCompletados >= maxIntentos) {
      return NextResponse.json({
        error: `Ya has completado tus ${maxIntentos > 1 ? maxIntentos + ' intentos' : 'intento'} para este examen. Si requieres autorización para un nuevo intento, contacta a la coordinación o administración.`,
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
