'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Pagina de prueba de la Fase 0 del plan de migracion (ver memoria
// lokomproaqui-nextjs-migration): no es una ruta real del sitio, sirve solo para
// verificar en vivo, con cero riesgo, que el mecanismo de rewrite (Angular -> este
// proyecto Next.js) funciona y que la sesion de Supabase se comparte entre ambos
// frontends via localStorage en el mismo dominio.
export default function MfePingPage() {
  const [sessionState, setSessionState] = useState<'checking' | 'con-sesion' | 'sin-sesion' | 'error'>('checking');
  const [email, setEmail] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [localStorageKeys, setLocalStorageKeys] = useState<string[]>([]);

  useEffect(() => {
    // Lectura directa de localStorage primero: es sincrona, sin red, y es la prueba mas
    // directa de si Angular y Next.js comparten el mismo storage -- si aparece una key
    // "sb-...-auth-token" aca, el JWT esta ahi sin importar lo que tarde/falle la llamada
    // de red de getSession() de abajo.
    const keys = Object.keys(window.localStorage).filter((k) => k.startsWith('sb-'));
    setLocalStorageKeys(keys);

    const timeout = setTimeout(() => {
      setSessionState((s) => (s === 'checking' ? 'error' : s));
      setErrorMsg((m) => m ?? 'getSession() no respondio en 8 segundos (timeout)');
    }, 8000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        clearTimeout(timeout);
        if (error) {
          setSessionState('error');
          setErrorMsg(error.message);
          return;
        }
        if (data.session) {
          setSessionState('con-sesion');
          setEmail(data.session.user.email ?? null);
        } else {
          setSessionState('sin-sesion');
        }
      })
      .catch((err) => {
        clearTimeout(timeout);
        setSessionState('error');
        setErrorMsg(err instanceof Error ? err.message : String(err));
      });

    return () => clearTimeout(timeout);
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24, maxWidth: 640 }}>
      <h1>mfe-ping: OK, esto lo sirve lokomproaqui-next (Next.js)</h1>
      <p>Si ves este texto en lokomproaqui.com/mfe-ping, el rewrite Angular → Next.js funciona.</p>

      <p>
        <strong>Keys sb-* en localStorage:</strong>{' '}
        {localStorageKeys.length > 0 ? localStorageKeys.join(', ') : '(ninguna encontrada)'}
      </p>

      <p>
        <strong>Estado de getSession():</strong>{' '}
        {sessionState === 'checking' && 'revisando...'}
        {sessionState === 'sin-sesion' && 'sin sesion detectada'}
        {sessionState === 'con-sesion' && `sesion compartida detectada (${email})`}
        {sessionState === 'error' && `ERROR: ${errorMsg}`}
      </p>
    </main>
  );
}
