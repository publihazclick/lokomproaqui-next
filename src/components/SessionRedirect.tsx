'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Guard reusable para paginas server component (ISR) que no pueden leer la sesion de Supabase del
// lado del servidor -- se monta como un "island" cliente que no renderiza nada, solo chequea la
// sesion al cargar y redirige si corresponde. Pedido explicito del usuario 2026-07-19:
// 1) /info NUNCA debe verse si ya hay sesion (when="logged-in", to="/articulo").
// 2) Paginas de contenido real para usuarios logueados (ej. /tutoriales) deben exigir sesion de
//    verdad, no solo mostrarse a cualquiera (when="logged-out", to="/info").
export function SessionRedirect({ when, to }: { when: 'logged-in' | 'logged-out'; to: string }) {
  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!activo) return;
      const haySesion = !!data.session;
      if ((when === 'logged-in' && haySesion) || (when === 'logged-out' && !haySesion)) {
        window.location.href = to;
      }
    });
    return () => {
      activo = false;
    };
  }, [when, to]);

  return null;
}
