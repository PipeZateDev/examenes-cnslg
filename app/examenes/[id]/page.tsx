import { redirect, notFound } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getDb } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import Link from 'next/link';
import ExamenActions from './ExamenActions';

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

  // Count submitted attempts
  const totalIntentos = await db.collection('ex_intentos').countDocuments({
    examenId: id,
    estado: 'enviado',
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
          esAdmin={session.rol === 'admin'}
          esDirectivo={['admin', 'directivo'].includes(session.rol)}
          esDocente={['admin', 'directivo', 'coordinador', 'supervisor', 'docente'].includes(session.rol)}
        />

        {/* Questions list (read-only view) */}
        <div className="mt-4 space-y-3">
          <h2 className="font-semibold text-slate-700 text-lg mb-2">Preguntas ({preguntas.length})</h2>
          {preguntas.map((p) => (
            <div key={p.orden} className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-400">
              <div className="flex justify-between items-start mb-3">
                <span className="bg-blue-100 text-blue-700 font-bold text-sm px-2 py-0.5 rounded">P{p.orden}</span>
                <span className="text-slate-400 text-xs">Peso: {p.peso}%</span>
              </div>
              <p className="text-slate-800 font-medium mb-3 whitespace-pre-wrap">{p.enunciado}</p>
              <div className="space-y-1.5">
                {p.opciones.map(op => (
                  <div key={op.letra} className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm
                    ${p.respuestaCorrecta === op.letra ? 'bg-green-50 text-green-800 font-semibold' : 'text-slate-600'}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${p.respuestaCorrecta === op.letra ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {op.letra}
                    </span>
                    {op.texto}
                    {p.respuestaCorrecta === op.letra && <span className="ml-auto text-green-600 text-xs">✓ Correcta</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
