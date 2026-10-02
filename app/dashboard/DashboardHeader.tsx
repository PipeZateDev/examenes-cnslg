'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Rol } from '@/lib/types';

interface DashboardHeaderProps {
  user: {
    nombre: string;
    rol: Rol;
  };
  rolLabels: Record<Rol, string>;
  onOpenLivePreview?: () => void;
}

export default function DashboardHeader({ user, rolLabels, onOpenLivePreview }: DashboardHeaderProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleExitApp = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.closeApp) {
      (window as any).electronAPI.closeApp();
    } else {
      // If running in browser or electronAPI not injected, close or go to login
      if (window.confirm('¿Deseas cerrar la aplicación / salir?')) {
        window.close();
        router.push('/login');
      }
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    window.location.href = '/login';
  };

  return (
    <header className="bg-blue-900 text-white px-6 py-4 flex items-center justify-between shadow-lg flex-wrap gap-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center p-1 shadow-md">
          <img
            src="/logo-cnslg.png"
            alt="CNSLG"
            className="w-8 h-8 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </div>
        <div>
          <h1 className="font-bold text-lg leading-tight">exámenes CNSLG</h1>
          <p className="text-blue-300 text-xs">Colegio Nuevo San Luis Gonzaga</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        {/* User Info Badge */}
        <div className="text-right bg-blue-950/60 border border-blue-800/80 px-3.5 py-1.5 rounded-xl">
          <p className="text-xs font-bold text-white">{user.nombre}</p>
          <p className="text-blue-300 text-[11px] capitalize">{rolLabels[user.rol] || user.rol}</p>
        </div>

        {/* Live student preview button for all staff */}
        {onOpenLivePreview ? (
          <button
            onClick={onOpenLivePreview}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            title="Abrir selector de exámenes para verlos en vivo como el alumno"
          >
            <span>👁️</span>
            <span>Vista en Vivo</span>
          </button>
        ) : (
          <Link
            href="/examen/staff"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs"
            title="Ver cómo los estudiantes ven y presentan los exámenes"
          >
            <span>👁️</span>
            <span>Vista en Vivo</span>
          </Link>
        )}

        {/* Salir de la App (Electron Close) */}
        <button
          onClick={handleExitApp}
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-3.5 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          title="Salir y cerrar inmediatamente la aplicación de escritorio"
        >
          <span>🚪</span>
          <span>Salir de la App</span>
        </button>

        {/* Cerrar Sesión (Volver al Login) */}
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="bg-blue-800 hover:bg-blue-700 text-blue-100 font-medium px-3 py-1.5 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Cerrar sesión institucional y volver al login"
        >
          <span>🔒</span>
          <span>{loggingOut ? 'Cerrando...' : 'Cerrar Sesión'}</span>
        </button>
      </div>
    </header>
  );
}
