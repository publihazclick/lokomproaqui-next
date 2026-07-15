'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Port de ImprimirTarjetaComponent (Angular, "/imprimirTarjeta") -- tarjeta VIP imprimible con los
// datos del usuario logueado. `window.print()` estaba comentado en el original (no se dispara
// solo), se deja igual: el usuario imprime con Ctrl+P / el boton del navegador.

interface DatosTarjeta {
  id: string;
  nombre: string;
  ciudad: string | null;
  foto: string | null;
  creada: string;
}

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function ImprimirTarjetaPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [datos, setDatos] = useState<DatosTarjeta | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const userId = sessionData.session.user.id;
      const { data: profile } = await supabase.from('profiles').select('full_name, last_name, city, avatar_url, created_at').eq('id', userId).maybeSingle();
      setDatos({
        id: userId,
        nombre: `${profile?.full_name || ''} ${profile?.last_name || ''}`.trim(),
        ciudad: profile?.city || null,
        foto: profile?.avatar_url || null,
        creada: formatFecha(profile?.created_at || new Date().toISOString()),
      });
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando' || !datos) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg items-center justify-center px-4 py-8">
      <div id="tarjeta" className="w-full rounded-xl border-2 border-gray-300 p-5 shadow-lg">
        <h4 className="text-center text-lg font-bold text-gray-800">ASO-VIRTUAL-CONNECTED</h4>
        <p className="text-center text-[11px] font-bold text-gray-600">Asociacion de Tiendas Virtuales conectadas</p>

        <div className="mt-4 flex gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
          <img src={datos.foto || '/assets/noimagen.jpg'} alt="" className="h-24 w-24 rounded object-cover" />
          <div className="flex-1 space-y-2 text-sm">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500">ID:</label>
              <p className="border-b border-gray-300 pb-0.5">{datos.id}</p>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-gray-500">Nombre:</label>
              <p className="border-b border-gray-300 pb-0.5">{datos.nombre}</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-gray-500">Ciudad</label>
                <p className="border-b border-gray-300 pb-0.5">{datos.ciudad}</p>
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-semibold text-gray-500">Fecha</label>
                <p className="border-b border-gray-300 pb-0.5">{datos.creada}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-gray-600">
          Este documento es para uso vip de nuestra plataforma con este documento entras a evento exclusivos
        </p>

        <div className="mt-4 text-center print:hidden">
          <button onClick={() => window.print()} className="rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white">
            Imprimir
          </button>
        </div>
      </div>
    </div>
  );
}
