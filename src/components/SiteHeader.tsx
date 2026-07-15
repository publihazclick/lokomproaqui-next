'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type SessionState = 'loading' | 'logged-out' | { email: string };

// Header COMPARTIDO simplificado (ver memoria lokomproaqui-nextjs-migration, Fase 2): el
// header real de Angular (extra/header) tiene 1000+ lineas -- menu con ~20 opciones segun
// rol, carrito con checkout por WhatsApp, notificaciones que se refrescan cada 50s, 5
// contadores de pendientes distintos. Portarlo entero ahora no se justifica para paginas
// PUBLICAS sin sesion (el alcance real de esta fase). Este header cubre solo lo esencial
// (logo, nav publica, login/registro o cuenta/salir) y se reemplaza por el header completo
// en la Fase 3, cuando migremos paginas donde el carrito/menu por rol sean imprescindibles.
//
// Los links a rutas que TODAVIA no existen en este proyecto Next.js (login, singUp,
// config/perfil, acelerador, testimonio) usan <a> plano a proposito, no next/link: un
// next/link intentaria una transicion client-side DENTRO de esta app Next.js y mostraria un
// 404 (el router de Next no sabe que esas rutas viven del lado Angular) -- un <a> fuerza una
// navegacion real de navegador, que vuelve a pasar por el rewrite de Vercel y llega bien.
export function SiteHeader() {
  const [session, setSession] = useState<SessionState>('loading');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ? { email: data.session.user.email ?? '' } : 'logged-out');
      })
      .catch(() => {
        if (active) setSession('logged-out');
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ? { email: newSession.user.email ?? '' } : 'logged-out');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const salir = async () => {
    await supabase.auth.signOut();
    window.location.href = '/info';
  };

  const logueado = typeof session === 'object';

  return (
    <header className="sticky top-0 z-50 bg-[#02a0e3] text-white shadow-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <a href="/info" className="flex shrink-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo lo sirve el proyecto Angular en el mismo dominio, no /public de este proyecto */}
          <img src="/assets/logo.svg" alt="LokomproAqui" className="h-9 w-auto" />
        </a>

        <nav className="hidden items-center gap-6 text-sm font-semibold md:flex">
          <a href="/info" className="hover:opacity-80">Inicio</a>
          <Link href="/tutoriales" className="hover:opacity-80">Tutoriales</Link>
          <a href="/acelerador" className="hover:opacity-80">Acelerador de Ventas</a>
          <a href="/testimonio" className="hover:opacity-80">Testimonios</a>
        </nav>

        <div className="flex items-center gap-2">
          {session === 'logged-out' && (
            <>
              <a href="/login" className="rounded-full bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/40">
                Iniciar Sesión
              </a>
              <a
                href="/singUp/vendedor/3213692393"
                className="hidden rounded-full bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/40 sm:inline-block"
              >
                Registrarse
              </a>
            </>
          )}
          {logueado && (
            <>
              <a
                href="/config/perfil"
                className="hidden rounded-full bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/40 sm:inline-block"
              >
                Mi cuenta
              </a>
              <button
                type="button"
                onClick={salir}
                className="rounded-full bg-black/30 px-4 py-2 text-sm font-semibold hover:bg-black/40"
              >
                Salir
              </button>
            </>
          )}

          <button
            type="button"
            className="rounded p-2 hover:bg-black/20 md:hidden"
            aria-label="Abrir menu"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="mb-1 block h-0.5 w-5 bg-white" />
            <span className="mb-1 block h-0.5 w-5 bg-white" />
            <span className="block h-0.5 w-5 bg-white" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="flex flex-col gap-1 bg-[#0177a8] px-4 pb-3 text-sm font-semibold md:hidden">
          <a href="/info" className="py-2">Inicio</a>
          <Link href="/tutoriales" className="py-2" onClick={() => setMenuOpen(false)}>Tutoriales</Link>
          <a href="/acelerador" className="py-2">Acelerador de Ventas</a>
          <a href="/testimonio" className="py-2">Testimonios</a>
          {session === 'logged-out' && (
            <a href="/singUp/vendedor/3213692393" className="py-2">Registrarse</a>
          )}
        </nav>
      )}
    </header>
  );
}
