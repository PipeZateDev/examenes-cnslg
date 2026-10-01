import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import ExamenActions from './ExamenActions';
import ExamenEditorView from './ExamenEditorView';

export default async function ExamenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session || session.rol === 'estudiante') redirect('/login');

  const db = await getDb();
  let examen: Record<string, unknown> | null = null;
  try {
    examen = await db.collection('ex_examenes').findOne({ _id: new ObjectId(id) });
  } catch { notFound(); }
  if (!examen) notFound();

  // Get today's access key if exam is active
  const { hoy } = await import('@/lib/utils');
  const claveDoc = await db.collection('ex_clave_dia').findOne({ fecha: hoy() });
  const examenClave = (claveDoc?.examenesClaves as Array<{ examenId: string; clave: string }>)?.find(e => e.examenId === id);

  // Count any student attempts
  const totalIntentos = await db.collection('ex_intentos').countDocuments({
    examenId: id,
  });

  const preguntas = examen.preguntas as Array<{
    orden: number; enunciado: string; opciones: Array<{ letra: string; texto: string }>;
    respuestaCorrecta: string; peso: number;
  }>;

  const ESTADO_LABELS: Record<string, string> = {
    borrador: '📝 Borrador',
    pendiente_aprobacion: '⏳ Pendiente Aprobación',
    aprobado: '✅ Aprobado',
    activo: '🟢 Activo',
    cerrado: '🔴 Cerrado',
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link href="/dashboard" className="text-blue-600 hover:underline">Dashboard</Link>
          <span className="text-slate-400">/</span>
          <Link href="/examenes" className="text-blue-600 hover:underline">Exámenes</Link>
          <span className="text-slate-400">/</span>
          <span className="text-slate-700 font-medium">{examen.titulo as string}</span>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-2xl shadow p-6 mb-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-slate-800">{examen.titulo as string}</h1>
              {(examen.materia as string) && <p className="text-slate-500 mt-1">{examen.materia as string}</p>}
              {(examen.descripcion as string) && <p className="text-slate-600 text-sm mt-2">{examen.descripcion as string}</p>}
            </div>
            <div className="text-right">
              <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {ESTADO_LABELS[examen.estado as string] || examen.estado as string}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-xs">Preguntas</p>
              <p className="font-bold text-slate-700 text-lg">{preguntas.length}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-xs">Duración</p>
              <p className="font-bold text-slate-700">{examen.duracionMinutos ? `${examen.duracionMinutos} min` : 'Sin límite'}</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-slate-400 text-xs">Intentos presentados</p>
              <p className="font-bold text-slate-700 text-lg">{totalIntentos}</p>
            </div>
            {examenClave && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <p className="text-emerald-600 text-xs">Clave de hoy</p>
                <p className="font-bold text-emerald-700 text-xl font-mono tracking-widest">{examenClave.clave}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions (client component) */}
        <ExamenActions
          examenId={id}
          estado={examen.estado as string}
          totalIntentos={totalIntentos}
          esAdmin={session.rol === 'admin'}
          esDirectivo={['admin', 'directivo'].includes(session.rol)}
          esDocente={['admin', 'directivo', 'coordinador', 'supervisor', 'docente'].includes(session.rol)}
        />

        {/* Interactive Editor & Live Student Simulator */}
        <ExamenEditorView
          examenId={id}
          estado={examen.estado as string}
          esAdmision={!!examen.esAdmision}
          initialPreguntas={preguntas as any}
        />
      </div>
    </div>
  );
}
