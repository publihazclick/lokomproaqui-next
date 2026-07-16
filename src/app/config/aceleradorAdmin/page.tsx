'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto } from '@/lib/usuarios';
import { AceleradorAdmin } from '@/components/AceleradorAdmin';

// Port de AceleradorAdminComponent (Angular, "/config/aceleradorAdmin") -- es el MISMO componente
// que `mentor-panel.component.html` ya embebe (`<app-acelerador-admin>`), ya portado en Fase 2 como
// `AceleradorAdmin.tsx` para `/mvid8x2qz1/panel`. Esta ruta solo lo reusa tal cual, sin duplicar
// el CRUD de modulos/lecciones.
//
// Bug real de seguridad encontrado y corregido: sin chequeo de rol (cualquier usuario logueado
// podia subir/editar contenido del curso). Mismo rol que exige /mvid8x2qz1/panel ('mentor').

export default function AceleradorAdminPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-autorizado'>('revisando');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      if (usuario.rolname !== 'mentor') {
        setEstado('no-autorizado');
        return;
      }
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando') return null;

  if (estado === 'no-autorizado') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Esta sección es solo para mentores.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-6">
      <AceleradorAdmin />
    </div>
  );
}
