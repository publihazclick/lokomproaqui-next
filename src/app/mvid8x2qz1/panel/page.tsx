'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { AceleradorAdmin } from '@/components/AceleradorAdmin';

// Port desde src/app/components/mentor-panel (Angular). MentorGuard real: sin sesion -> manda
// a /mvid8x2qz1 (registro); con sesion pero rol != 'mentor' -> manda a /info. Este panel nunca
// vive bajo TiendaComponent en Angular (sin header/menu general) -- SiteHeader ya lo sabe via
// RUTAS_SIN_HEADER.
export default function MentorPanelPage() {
  const [estado, setEstado] = useState<'revisando' | 'autorizado'>('revisando');
  const [nombre, setNombre] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        window.location.href = '/mvid8x2qz1';
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, roles(name)')
        .eq('id', data.session.user.id)
        .single();
      const rol = (profile?.roles as unknown as { name: string } | null)?.name;
      if (rol !== 'mentor') {
        window.location.href = '/info';
        return;
      }
      setNombre(profile?.full_name ?? null);
      setEstado('autorizado');
    });
  }, []);

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = '/mvid8x2qz1';
  }

  if (estado !== 'autorizado') return null;

  return (
    <div className="min-h-screen bg-[#f7f9fb]">
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3 text-white">
        <div className="text-sm">
          <strong>Panel Mentor</strong>
          {nombre && <span className="text-white/70"> — {nombre}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/acelerador?preview=suscriptor"
            className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/10"
          >
            Ver como visitante
          </Link>
          <button type="button" onClick={salir} className="rounded-full border border-white/30 px-3.5 py-1.5 text-xs font-semibold hover:bg-white/10">
            Salir
          </button>
        </div>
      </div>

      <AceleradorAdmin />
    </div>
  );
}
