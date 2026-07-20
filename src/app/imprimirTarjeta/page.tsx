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
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col items-center justify-center gap-6 bg-gray-50 px-4 py-10 print:bg-white print:py-0">
      {/* Fuerza a que el navegador imprima los fondos de color (gradiente/insignia), que por
          defecto se omiten al imprimir -- solo aplica dentro de la tarjeta, via scope de #tarjeta. */}
      <style>{`@media print { #tarjeta, #tarjeta * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div
        id="tarjeta"
        className="w-full overflow-hidden rounded-3xl bg-[#eaf6fc] shadow-2xl ring-1 ring-black/5 print:shadow-none print:ring-0"
      >
        {/* Banda superior de marca -- mismo degradado azul de header/CTA en todo el sitio
            (#0177a8 -> #02a0e3, ver RealHeader.tsx), nunca morado/fucsia. */}
        <div className="relative bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-6 pb-14 pt-6 text-white">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '14px 14px' }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/80">LokomproAqui</p>
              <h4 className="mt-1 text-lg font-black leading-tight">
                ASO VIRTUAL
                <br />
                CONNECTED
              </h4>
            </div>
            <span className="rounded-full bg-amber-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#0177a8] shadow">
              VIP
            </span>
          </div>
        </div>

        {/* Avatar solapado sobre la banda, estilo credencial/badge de evento */}
        <div className="relative -mt-12 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
          <img
            src={datos.foto || '/assets/noimagen.jpg'}
            alt=""
            className="h-24 w-24 rounded-full border-4 border-white object-cover shadow-lg"
          />
        </div>

        <div className="px-6 pb-6 pt-3 text-center">
          <p className="text-base font-bold text-gray-900">{datos.nombre}</p>

          <div className="my-4 border-t border-dashed border-gray-200" />

          <div className="grid grid-cols-2 gap-3 text-left">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Ciudad</p>
              <p className="text-xs font-semibold text-gray-800">{datos.ciudad || 'Colombia'}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">Miembro desde</p>
              <p className="text-xs font-semibold text-gray-800">{datos.creada}</p>
            </div>
          </div>

          <div className="mt-3 text-left">
            <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400">ID de socio</p>
            <p className="break-all font-mono text-[10px] font-semibold tracking-tight text-gray-800">{datos.id}</p>
          </div>

          <p className="mt-4 text-[10px] leading-snug text-gray-500">
            Este documento acredita membresía VIP en LokomproAqui y da acceso a eventos exclusivos de la comunidad.
          </p>
        </div>

        <div className="h-1.5 bg-gradient-to-r from-[#0177a8] to-[#02a0e3]" />
      </div>

      <button
        onClick={() => window.print()}
        className="rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] px-6 py-2.5 text-sm font-bold text-white shadow-md transition hover:scale-105 print:hidden"
      >
        Imprimir tarjeta
      </button>
    </div>
  );
}
