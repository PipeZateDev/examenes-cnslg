'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ExamenActionsProps {
  examenId: string;
  estado: string;
  totalIntentos?: number;
  esAdmin: boolean;
  esDirectivo: boolean;
  esDocente: boolean;
}

export default function ExamenActions({ examenId, estado, totalIntentos = 0, esAdmin, esDirectivo, esDocente }: ExamenActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [nuevaClave, setNuevaClave] = useState('');

  async function action(tipo: string, extra?: Record<string, unknown>) {
    setLoading(tipo);
    setError('');
    try {
      const res = await fetch(`/api/examenes/${examenId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: tipo, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error'); return; }
      if (tipo === 'activate' && data.clave) setNuevaClave(data.clave);
      router.refresh();
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow p-5">
      <h2 className="font-semibold text-slate-700 mb-4">Acciones del Examen</h2>

      {nuevaClave && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4 mb-4 text-center">
          <p className="text-emerald-700 font-semibold mb-1">✅ Examen activado. Clave de acceso de hoy:</p>
          <p className="text-4xl font-mono font-bold text-emerald-800 tracking-[0.3em]">{nuevaClave}</p>
          <p className="text-emerald-600 text-sm mt-1">Comparte esta clave con los docentes para que los estudiantes puedan ingresar.</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {/* Submit for approval */}
        {estado === 'borrador' && esDocente && (
          <button
            onClick={() => action('submit_approval')}
            disabled={!!loading}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading === 'submit_approval' ? 'Enviando...' : 'Enviar a Aprobación'}
          </button>
        )}

        {/* Approve */}
        {estado === 'pendiente_aprobacion' && esDirectivo && (
          <button
            onClick={() => action('approve')}
            disabled={!!loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading === 'approve' ? 'Aprobando...' : '✓ Aprobar Examen'}
          </button>
        )}

        {/* Activate */}
        {estado === 'aprobado' && (esDirectivo || esDocente) && (
          <button
            onClick={() => action('activate')}
            disabled={!!loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-xs flex items-center gap-1.5"
          >
            {loading === 'activate' ? 'Activando...' : '▶ Activar Examen'}
          </button>
        )}

        {/* Close */}
        {estado === 'activo' && (esDirectivo || esDocente) && (
          <div className="flex gap-2">
            <button
              onClick={() => action('activate')}
              disabled={!!loading}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              title="Generar un nuevo código de acceso para hoy"
            >
              {loading === 'activate' ? 'Regenerando...' : '🔄 Regenerar Código'}
            </button>
            <button
              onClick={() => { if (confirm('¿Cerrar el examen? Los estudiantes ya no podrán presentarlo.')) action('close'); }}
              disabled={!!loading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-50 shadow-xs"
            >
              {loading === 'close' ? 'Cerrando...' : '⏹ Cerrar Examen'}
            </button>
          </div>
        )}

        {/* Results */}
        <Link
          href={`/resultados/${examenId}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
        >
          📊 Ver Resultados
        </Link>

        {/* Delete exam logic */}
        {(() => {
          // If exam has student attempts: CANNOT be deleted
          if ((totalIntentos || 0) > 0) {
            return (
              <span
                className="px-3 py-2 bg-slate-100 text-slate-400 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 cursor-not-allowed select-none"
                title="Este examen tiene respuestas de estudiantes y no puede eliminarse."
              >
                🔒 Con respuestas ({totalIntentos})
              </span>
            );
          }

          // If approved/active/closed: only directivo or admin can delete
          const esAprobado = ['aprobado', 'activo', 'cerrado'].includes(estado);
          if (esAprobado && !esDirectivo) {
            return null; // Docentes and coordinadores cannot see or delete approved exams
          }

          // In borrador/pendiente: docentes and above can delete
          if (!esDocente) return null;

          return (
            <button
              onClick={async () => {
                if (confirm('¿Estás seguro de eliminar este examen permanentemente? Esta acción no se puede deshacer.')) {
                  setLoading('delete');
                  try {
                    const res = await fetch(`/api/examenes/${examenId}`, {
                      method: 'DELETE',
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      setError(data.error || 'Error al eliminar');
                      return;
                    }
                    router.push('/examenes');
                  } catch {
                    setError('Error de conexión al eliminar');
                  } finally {
                    setLoading(null);
                  }
                }
              }}
              disabled={!!loading}
              className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-lg text-sm font-semibold transition disabled:opacity-50 flex items-center gap-1"
            >
              {loading === 'delete' ? 'Eliminando...' : '🗑 Eliminar Examen'}
            </button>
          );
        })()}
      </div>
    </div>
  );
}
