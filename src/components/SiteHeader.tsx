'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Rutas donde Angular oculta el header real (header.component.html: routName !== 'login' &&
// routName !== 'singUp') -- se replica igual aca, son pantallas de embudo propias sin nav.
// /mvid8x2qz1 (registro/panel del mentor) tampoco vive bajo TiendaComponent en Angular --
// nunca tuvo el header ni el menu general, es una seccion aislada a proposito.
const RUTAS_SIN_HEADER = ['/login', '/singUp', '/mvid8x2qz1'];

type SessionState = 'loading' | 'logged-out' | { email: string };

const NAV_LINKS = [
  { href: '/info', label: 'Inicio', migrated: false },
  { href: '/tutoriales', label: 'Tutoriales', migrated: true },
  { href: '/acelerador', label: 'Acelerador de Ventas', migrated: false },
  { href: '/testimonio', label: 'Testimonios', migrated: false },
] as const;

// Clases reusables como constantes (no styled-jsx): esta app corre con Turbopack en Next 16
// (ver AGENTS.md del proyecto, "no asumir nada del Next.js viejo") y no hay forma de probar
// visualmente en este entorno si styled-jsx sigue andando igual -- mejor Tailwind puro, cero
// riesgo de que una feature no se aplique en silencio.
const NAV_LINK_CLASS =
  'rounded-full px-3.5 py-2 text-sm font-semibold text-white/90 transition-colors duration-200 hover:bg-white/15 hover:text-white';
const MOBILE_LINK_CLASS =
  'rounded-lg px-2 py-3 text-[0.95rem] font-semibold text-white/90 transition-colors active:bg-white/10';
const BTN_SOLID =
  'inline-flex items-center rounded-full bg-white px-4.5 py-2.5 text-[0.85rem] font-bold text-[#0177a8] shadow-[0_2px_10px_-2px_rgba(0,0,0,0.25)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_6px_16px_-4px_rgba(0,0,0,0.3)]';
const BTN_GHOST =
  'inline-flex items-center rounded-full border-[1.5px] border-white/65 px-4.5 py-2.5 text-[0.85rem] font-bold text-white transition-colors duration-150 hover:border-white hover:bg-white/15';

// Header COMPARTIDO simplificado (ver memoria lokomproaqui-nextjs-migration, Fase 2): el
// header real de Angular (extra/header) tiene 1000+ lineas -- menu con ~20 opciones segun
// rol, carrito con checkout por WhatsApp, notificaciones que se refrescan cada 50s, 5
// contadores de pendientes distintos. Portarlo entero ahora no se justifica para paginas
// PUBLICAS sin sesion (el alcance real de esta fase). Este header cubre solo lo esencial
// (logo, nav publica, login/registro o cuenta/salir) y se reemplaza por el header completo
// en la Fase 3, cuando migremos paginas donde el carrito/menu por rol sean imprescindibles.
//
// Los links a rutas que TODAVIA no existen en este proyecto Next.js usan <a> plano a
// proposito, no next/link: un next/link intentaria una transicion client-side DENTRO de esta
// app Next.js y mostraria un 404 -- un <a> fuerza una navegacion real de navegador, que vuelve
// a pasar por el rewrite de Vercel y llega bien. `NAV_LINKS[].migrated` decide cual usar.
export function SiteHeader() {
  const pathname = usePathname();
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

  // El menu mobile bloquea el scroll del fondo mientras esta abierto -- detalle chico pero
  // se siente barato si no se hace (el contenido de atras se sigue moviendo al arrastrar).
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const salir = async () => {
    await supabase.auth.signOut();
    window.location.href = '/info';
  };

  if (RUTAS_SIN_HEADER.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return null;

  const logueado = typeof session === 'object';

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-[#0177a8] to-[#02a0e3] shadow-[0_4px_20px_-6px_rgba(1,119,168,0.55)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <a href="/info" className="flex shrink-0 items-center gap-2 transition-transform duration-200 hover:scale-[1.03]">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo lo sirve el proyecto Angular en el mismo dominio, no /public de este proyecto */}
          <img src="/assets/logo.svg" alt="LokomproAqui" className="h-8 w-auto drop-shadow-sm sm:h-9" />
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((item) =>
            item.migrated ? (
              <Link key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </Link>
            ) : (
              <a key={item.href} href={item.href} className={NAV_LINK_CLASS}>
                {item.label}
              </a>
            )
          )}
        </nav>

        <div className="flex items-center gap-2.5">
          {session === 'logged-out' && (
            <>
              <a href="/login" className={`${BTN_GHOST} hidden sm:inline-flex`}>
                Iniciar Sesión
              </a>
              <a href="/singUp/vendedor/3213692393" className={BTN_SOLID}>
                Registrarse
              </a>
            </>
          )}
          {logueado && (
            <>
              <a href="/config/perfil" className={`${BTN_SOLID} hidden sm:inline-flex`}>
                Mi cuenta
              </a>
              <button type="button" onClick={salir} className={BTN_GHOST}>
                Salir
              </button>
            </>
          )}

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/15 md:hidden"
            aria-label={menuOpen ? 'Cerrar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span
              className={`absolute block h-0.5 w-5 rounded-full bg-white transition-all duration-300 ${menuOpen ? 'rotate-45' : '-translate-y-[6px]'}`}
            />
            <span
              className={`absolute block h-0.5 w-5 rounded-full bg-white transition-all duration-200 ${menuOpen ? 'opacity-0' : 'opacity-100'}`}
            />
            <span
              className={`absolute block h-0.5 w-5 rounded-full bg-white transition-all duration-300 ${menuOpen ? '-rotate-45' : 'translate-y-[6px]'}`}
            />
          </button>
        </div>
      </div>

      <nav
        className={`grid overflow-hidden bg-[#0177a8]/95 backdrop-blur-sm transition-[grid-template-rows] duration-300 ease-out md:hidden ${menuOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col gap-0.5 px-4 pb-4 pt-1">
            {NAV_LINKS.map((item) =>
              item.migrated ? (
                <Link key={item.href} href={item.href} className={MOBILE_LINK_CLASS} onClick={() => setMenuOpen(false)}>
                  {item.label}
                </Link>
              ) : (
                <a key={item.href} href={item.href} className={MOBILE_LINK_CLASS}>
                  {item.label}
                </a>
              )
            )}
            <div className="my-2 h-px bg-white/15" />
            {session === 'logged-out' && (
              <>
                <a href="/login" className={`${MOBILE_LINK_CLASS} sm:hidden`}>Iniciar Sesión</a>
                <a href="/singUp/vendedor/3213692393" className={MOBILE_LINK_CLASS}>Registrarse</a>
              </>
            )}
            {logueado && <a href="/config/perfil" className={`${MOBILE_LINK_CLASS} sm:hidden`}>Mi cuenta</a>}
          </div>
        </div>
      </nav>
    </header>
  );
}
