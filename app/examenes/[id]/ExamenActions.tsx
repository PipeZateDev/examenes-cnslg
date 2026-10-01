'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ExamenActionsProps {
  examenId: string;
  estado: string;
  esAdmin: boolean;
  esDirectivo: boolean;
  esDocente: boolean;
}

export default function ExamenActions({ examenId, estado, esAdmin, esDirectivo, esDocente }: ExamenActionsProps) {
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
        {estado === 'aprobado' && esDirectivo && (
          <button
            onClick={() => action('activate')}
            disabled={!!loading}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading === 'activate' ? 'Activando...' : '▶ Activar Examen'}
          </button>
        )}

        {/* Close */}
        {estado === 'activo' && esDirectivo && (
          <button
            onClick={() => { if (confirm('¿Cerrar el examen? Los estudiantes ya no podrán presentarlo.')) action('close'); }}
            disabled={!!loading}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            {loading === 'close' ? 'Cerrando...' : '⏹ Cerrar Examen'}
          </button>
        )}

        {/* Results */}
        <Link
          href={`/resultados/${examenId}`}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition"
        >
          📊 Ver Resultados
        </Link>

        {/* Delete (admin only) */}
        {esAdmin && (
          <button
            onClick={() => { if (confirm('¿Eliminar este examen permanentemente?')) action('delete'); }}
            disabled={!!loading}
            className="px-4 py-2 bg-gray-200 hover:bg-red-100 text-red-600 hover:text-red-700 rounded-lg text-sm font-medium transition disabled:opacity-50"
          >
            🗑 Eliminar
          </button>
        )}
      </div>
    </div>
  );
}
