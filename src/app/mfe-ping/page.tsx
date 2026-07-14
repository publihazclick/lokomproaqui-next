'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Pagina de prueba de la Fase 0 del plan de migracion (ver memoria
// lokomproaqui-nextjs-migration): no es una ruta real del sitio, sirve solo para
// verificar en vivo, con cero riesgo, que el mecanismo de rewrite (Angular -> este
// proyecto Next.js) funciona y que la sesion de Supabase se comparte entre ambos
// frontends via localStorage en el mismo dominio.
export default function MfePingPage() {
  const [sessionState, setSessionState] = useState<'checking' | 'con-sesion' | 'sin-sesion'>('checking');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionState('con-sesion');
        setEmail(data.session.user.email ?? null);
      } else {
        setSessionState('sin-sesion');
      }
    });
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 640 }}>
      <h1>mfe-ping: OK, esto lo sirve lokomproaqui-next (Next.js)</h1>
      <p>Si ves este texto en lokomproaqui.com/mfe-ping, el rewrite Angular → Next.js funciona.</p>
      <p>
        Estado de sesion de Supabase:{' '}
        {sessionState === 'checking' && 'revisando...'}
        {sessionState === 'sin-sesion' && 'sin sesion detectada'}
        {sessionState === 'con-sesion' && `sesion compartida detectada (${email})`}
      </p>
    </main>
  );
}
