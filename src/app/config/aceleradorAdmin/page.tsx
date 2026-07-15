'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AceleradorAdmin } from '@/components/AceleradorAdmin';

// Port de AceleradorAdminComponent (Angular, "/config/aceleradorAdmin") -- es el MISMO componente
// que `mentor-panel.component.html` ya embebe (`<app-acelerador-admin>`), ya portado en Fase 2 como
// `AceleradorAdmin.tsx` para `/mvid8x2qz1/panel`. Esta ruta solo lo reusa tal cual, sin duplicar
// el CRUD de modulos/lecciones.

export default function AceleradorAdminPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('listo');
    });
  }, []);

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-6">
      <AceleradorAdmin />
    </div>
  );
}
