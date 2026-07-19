'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Menu, X, ShoppingCart, User, Home, LayoutGrid, Tag, Store, ClipboardCheck, History,
  Wallet, Users, UserPlus, Package, Truck, Warehouse, Landmark, RefreshCw, Settings,
  GraduationCap, LogOut, Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCart, formatCOP, type CartItem } from '@/lib/cartStore';
import { fetchBannerActivo, type BannerRow } from '@/lib/adminConfig';

// Port FIEL del header real de Angular (src/app/extra/header) -- a diferencia del SiteHeader
// simplificado de Fase 2 (paginas publicas), Fase 3 en adelante el usuario pidio que se vea
// IDENTICO al original porque ya se grabaron tutoriales con esa interfaz (ver memoria
// lokomproaqui-nextjs-migration). Reemplaza a SiteHeader en el layout raiz -- se usa en TODO
// el sitio de aca en mas, no solo en las paginas nuevas.
//
// Alcance reducido a proposito (documentado, no silencioso): no incluye el drawer de
// notificaciones (polling cada 50s + badges de pendientes por modulo) del original -- es
// contenido secundario que no aparece en un tutorial tipico de "como vender/comprar". El
// menu, el carrito y la barra superior si son fieles.

// Mismas rutas donde Angular oculta el header (header.component.html: routName !== 'login' &&
// !== 'singUp'), mas /mvid8x2qz1, /introduccion y /imprimirTarjeta, que viven en app-routing.module.ts
// a nivel raiz (nunca bajo TiendaComponent, por lo tanto sin el header compartido).
const RUTAS_SIN_HEADER = ['/login', '/singUp', '/mvid8x2qz1', '/introduccion', '/imprimirTarjeta', '/front', '/publico'];

// Pedido explicito del usuario 2026-07-19: el anuncio (antes solo en /info) ahora se ve tambien
// logueado. Se oculta ademas en las pantallas de tarea critica (hacer una venta, ver pedidos) para
// no competir por atencion justo cuando el usuario esta enfocado en algo puntual -- mismo criterio
// de diseño "no dañar el enfoque unicornio" que pidio el usuario.
const RUTAS_SIN_BANNER = ['/realizarventa', '/pedidos'];

type Rol = 'visitante' | 'vendedor' | 'proveedor' | 'lider' | 'subAdministrador' | 'administrador' | 'mentor';

interface MenuItem {
  Icon: typeof Home;
  nombre: string;
  href: string;
  mostrar: (rol: Rol) => boolean;
}

// OJO -- nombre confuso pero verificado en el codigo real (header.component.ts, listMenus()):
// el campo se llama "disable" pero en realidad significa "mostrar" (`_.filter(menus, row =>
// row.disable)` se queda solo con los truthy). Cada condicion de abajo es la traduccion
// EXACTA de `disable: <condicion>` del original -- primer intento de este archivo la invirtio
// por error de lectura, esta version quedo verificada linea por linea contra el original.
const MENUS: MenuItem[] = [
  { Icon: Home, nombre: 'Inicio', href: '/articulo', mostrar: (r) => r !== 'visitante' },
  { Icon: LayoutGrid, nombre: 'Productos', href: '/pedidos', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: ShoppingCart, nombre: 'Hacer Compra', href: '/pedidos', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: Tag, nombre: 'Realizar Venta', href: '/realizarventa', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: Store, nombre: 'Mis Producto En la Tienda', href: '/config/storeProductActivated/', mostrar: (r) => r === 'administrador' || r === 'proveedor' },
  { Icon: ClipboardCheck, nombre: 'Autorizar Despacho', href: '/config/ventasPosibles', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: History, nombre: 'Historial de Ventas', href: '/config/ventas', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: Wallet, nombre: 'Mis Cobros', href: '/config/cobros', mostrar: (r) => r !== 'visitante' && r !== 'proveedor' },
  { Icon: Store, nombre: 'Ventas Proveedor', href: '/config/ventasProveedor', mostrar: (r) => r === 'administrador' },
  { Icon: UserPlus, nombre: 'Mis Referidos', href: '/config/referidos', mostrar: (r) => ['administrador', 'subAdministrador', 'lider', 'vendedor'].includes(r) },
  { Icon: Package, nombre: 'Control Inventario', href: '/config/controlInventario', mostrar: (r) => r === 'administrador' || r === 'proveedor' },
  { Icon: Warehouse, nombre: 'Explorar Bodegas', href: '/config/controlInventario', mostrar: (r) => r === 'administrador' || r === 'vendedor' },
  { Icon: Landmark, nombre: 'Módulo Contable', href: '/config/bank/index', mostrar: (r) => r === 'administrador' || r === 'proveedor' },
  { Icon: RefreshCw, nombre: 'Integración Shopify', href: '/config/shopify', mostrar: (r) => r === 'vendedor' },
  { Icon: RefreshCw, nombre: 'Integración WooCommerce', href: '/config/woocommerce', mostrar: (r) => r === 'vendedor' },
  { Icon: Store, nombre: 'Mis Órdenes', href: '/config/misDespacho', mostrar: (r) => r === 'proveedor' },
  { Icon: Settings, nombre: 'Edición Productos', href: '/config/productos', mostrar: (r) => r === 'proveedor' },
  { Icon: User, nombre: 'Mi Cuenta', href: '/config/perfil', mostrar: (r) => r !== 'visitante' },
  { Icon: Settings, nombre: 'Configuración', href: '/config/configuracion', mostrar: (r) => r === 'administrador' },
  { Icon: GraduationCap, nombre: 'Cursos / Ayuda', href: '/acelerador', mostrar: (r) => r !== 'visitante' },
];

const MENUS_PIE: { Icon: typeof Home; nombre: string; accion: 'login' | 'registrar' | 'salir' | 'recargar' | 'compartir'; mostrar: (r: Rol) => boolean }[] = [
  { Icon: User, nombre: 'Iniciar Sesión', accion: 'login', mostrar: (r) => r === 'visitante' },
  { Icon: UserPlus, nombre: 'Regístrate', accion: 'registrar', mostrar: (r) => r === 'visitante' },
  { Icon: LogOut, nombre: 'Compartir mi tienda', accion: 'compartir', mostrar: (r) => r === 'administrador' || r === 'vendedor' },
  { Icon: Wallet, nombre: 'Recargar Saldo', accion: 'recargar', mostrar: (r) => r === 'administrador' || r === 'vendedor' },
  { Icon: LogOut, nombre: 'Salir', accion: 'salir', mostrar: (r) => r !== 'visitante' },
];

export function RealHeader() {
  const pathname = usePathname();
  const { cart, eliminar } = useCart();

  const [rol, setRol] = useState<Rol>('visitante');
  const [userId, setUserId] = useState<string | null>(null);
  const [telefono, setTelefono] = useState<string | null>(null);
  const [logo, setLogo] = useState('/assets/logo.svg');
  const [balance, setBalance] = useState<number | null>(null);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [banner, setBanner] = useState<BannerRow | null>(null);
  const [bannerCerrado, setBannerCerrado] = useState(true);

  useEffect(() => {
    fetchBannerActivo().then((b) => {
      if (!b) return;
      setBanner(b);
      // Cerrable: una vez el usuario lo cierra, no vuelve a molestar -- pero si el admin publica
      // un banner NUEVO (id distinto), se muestra de nuevo aunque el anterior ya se hubiera cerrado.
      const cerradoId = typeof window !== 'undefined' ? window.localStorage.getItem('bannerCerradoId') : null;
      setBannerCerrado(String(b.id) === cerradoId);
    });
  }, []);

  function cerrarBanner() {
    if (banner) window.localStorage.setItem('bannerCerradoId', String(banner.id));
    setBannerCerrado(true);
  }

  useEffect(() => {
    let activo = true;
    async function cargar() {
      const { data } = await supabase.auth.getSession();
      if (!activo) return;
      if (!data.session) {
        setRol('visitante');
        return;
      }
      const userId = data.session.user.id;
      const [{ data: profile }, { data: wallet }] = await Promise.all([
        supabase.from('profiles').select('phone, avatar_url, roles(name)').eq('id', userId).single(),
        supabase.from('wallet_balances').select('balance').eq('profile_id', userId).eq('wallet_type', 'referral').maybeSingle(),
      ]);
      if (!activo || !profile) return;
      const rolReal = ((profile.roles as unknown as { name: string } | null)?.name ?? 'vendedor') as Rol;
      setRol(rolReal);
      setUserId(userId);
      setTelefono(profile.phone);
      if (profile.avatar_url) setLogo(profile.avatar_url);
      setBalance(wallet?.balance ?? 0);
    }
    cargar();
    const { data: sub } = supabase.auth.onAuthStateChange(() => cargar());
    return () => {
      activo = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuAbierto || carritoAbierto ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuAbierto, carritoAbierto]);

  const menusVisibles = useMemo(() => MENUS.filter((m) => m.mostrar(rol)), [rol]);
  const menusPieVisibles = useMemo(() => MENUS_PIE.filter((m) => m.mostrar(rol)), [rol]);

  async function salir() {
    await supabase.auth.signOut();
    window.location.href = '/info';
  }

  function accionPie(accion: string) {
    if (accion === 'login') window.location.href = '/login';
    if (accion === 'registrar') window.location.href = '/singUp/vendedor/3213692393';
    if (accion === 'salir') salir();
    if (accion === 'recargar') window.location.href = '/config/recharge';
    if (accion === 'compartir') {
      const url = `${window.location.origin}/front/index/${telefono || ''}`;
      navigator.clipboard.writeText(url).then(() => alert(`Copiado: ${url}`));
    }
  }

  const total = cart.reduce((acc, item) => acc + (item.loVendio || 0), 0);

  if (RUTAS_SIN_HEADER.some((r) => pathname === r || pathname.startsWith(`${r}/`))) return null;

  const bannerVisible = banner && !bannerCerrado && !RUTAS_SIN_BANNER.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  return (
    <>
      {/* Anuncio editable desde /config/configuracion (tabla notifications, type=3) -- antes vivia
          hardcodeado aca y solo se veia en /info; pedido explicito del usuario 2026-07-19: que se
          vea tambien logueado. Va ANTES de la cabecera (no dentro), mismo lugar de siempre. Cerrable
          (X) para no sentirse invasivo -- recuerda el cierre por id de banner, asi un anuncio NUEVO
          se vuelve a mostrar aunque el anterior ya se hubiera cerrado. */}
      {bannerVisible && (
        <div className="banner-mirror relative overflow-hidden px-3 py-2.5 text-center shadow-[0_2px_16px_rgba(0,0,0,0.25)] sm:py-3">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-center gap-2 pr-7 sm:gap-3 sm:pr-8">
            <span className="flex min-w-0 items-center gap-1.5 truncate text-xs font-extrabold uppercase tracking-wide text-[#0177a8] drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] sm:text-base">
              <span className="animate-pulse text-base sm:text-lg">🔥</span>
              <span className="truncate">{banner!.titulo}</span>
            </span>
            {banner!.linkUrl && (
              <Link
                href={banner!.linkUrl}
                className="whitespace-nowrap rounded-full bg-[#0177a8] px-4 py-1.5 text-xs font-extrabold text-white shadow-lg transition hover:scale-110 sm:px-5 sm:py-2 sm:text-sm"
              >
                {banner!.descripcion || 'Ver ahora'} →
              </Link>
            )}
          </div>
          <button
            type="button"
            onClick={cerrarBanner}
            aria-label="Cerrar anuncio"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#0177a8] hover:bg-black/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-50 bg-[#02a0e3] shadow-md">
        <div className="mx-auto flex h-20 max-w-[1200px] items-center gap-2 px-3 sm:h-32 sm:px-4">
          <button type="button" onClick={() => setMenuAbierto(true)} className="rounded p-2 text-white hover:bg-white/10" aria-label="Abrir menú">
            <Menu className="h-6 w-6" />
          </button>

          {/* Logueado (cualquier rol): el logo va pegado al menu hamburguesa (posicion original) --
              pedido explicito del usuario. Solo para visitante (sin loguear) se mueve al otro lado,
              junto a "Iniciar Sesion" mas abajo, como se pidio en un cambio anterior. */}
          {rol !== 'visitante' && (
            <Link href="/articulo" className="min-w-0 shrink">
              {/* eslint-disable-next-line @next/next/no-img-element -- logo/avatar de usuario, servido por Angular o Supabase Storage */}
              <img src={logo} alt="LokomproAqui" className="h-[70px] w-auto max-w-full sm:h-[116px]" />
            </Link>
          )}

          <div className="ml-auto flex min-w-0 shrink items-center gap-2 sm:gap-4">
            {rol === 'visitante' ? (
              <>
                {/* Pedido explicito del usuario: el logo va al lado opuesto del menu hamburguesa
                    (no pegado a el) y sin el boton "EMPEZAR GRATIS" en la cabecera -- ese CTA sigue
                    disponible en otras partes de la pagina (hero de /info, MENUS_PIE, etc.). */}
                <Link href="/login" className="hidden whitespace-nowrap text-base font-semibold text-white hover:underline sm:inline">
                  Iniciar Sesión
                </Link>
                <Link href="/info" className="min-w-0 shrink">
                  {/* eslint-disable-next-line @next/next/no-img-element -- logo, servido por Angular */}
                  <img src={logo} alt="LokomproAqui" className="h-[70px] w-auto max-w-full sm:h-[116px]" />
                </Link>
              </>
            ) : (
              <>
                {balance !== null && (
                  <Link
                    href={rol === 'proveedor' ? '/config/bank/index' : '/config/cobros'}
                    className="hidden text-sm font-semibold text-white sm:inline"
                  >
                    ${formatCOP(balance)}
                  </Link>
                )}
                {rol !== 'proveedor' && (
                  <button type="button" onClick={() => setCarritoAbierto(true)} className="relative rounded p-2 text-white hover:bg-white/10" aria-label="Carrito">
                    <ShoppingCart className="h-5 w-5" />
                    {cart.length > 0 && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        {cart.length}
                      </span>
                    )}
                  </button>
                )}
                <Link href="/config/perfil" className="rounded p-2 text-white hover:bg-white/10" aria-label="Mi cuenta">
                  <User className="h-5 w-5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Menu lateral (hamburguesa) -- siempre montado (no `{menuAbierto && ...}`) para que el nav
          pueda animarse deslizando de izquierda a derecha al abrir (translate-x-full -> 0) en vez
          de aparecer de golpe; si se desmontara en cada cierre, no habria "estado inicial" del que
          partir para animar la siguiente apertura. Pedido explicito del usuario. */}
      <div
        className={`fixed inset-0 z-[100] flex transition-opacity duration-300 ${menuAbierto ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
      >
        <div className="absolute inset-0 bg-black/60" onClick={() => setMenuAbierto(false)} />
        {/* Antes bg-[#7386d5] (periwinkle indigo suelto del Angular original) -- desentonaba con el
            celeste de marca (#02a0e3) que domina el resto del sitio, mas notorio aun en /info
            justo debajo de la barra superior de este mismo drawer que ya usa #02a0e3. Ahora usa
            el mismo azul oscuro del degradado de marca (#0177a8), coherente con hero/banner. */}
        <nav
          className={`relative flex h-full w-[280px] flex-col bg-[#0177a8] text-white shadow-xl transition-transform duration-300 ease-out ${menuAbierto ? 'translate-x-0' : '-translate-x-full'}`}
        >
          <div className="flex items-center justify-between bg-[#02a0e3] px-4 py-3">
            <Link href={rol === 'visitante' ? '/info' : '/articulo'}>
              {/* eslint-disable-next-line @next/next/no-img-element -- logo, mismo dominio Angular */}
              <img src="/assets/logo.svg" alt="LokomproAqui" className="h-9 w-auto rounded" />
            </Link>
            <button type="button" onClick={() => setMenuAbierto(false)} className="rounded p-1 hover:bg-white/10" aria-label="Cerrar menú">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-3">
            <ul className="flex flex-col gap-0.5">
              {menusVisibles.map((item) => {
                const href = item.href === '/config/storeProductActivated/' ? `${item.href}${userId ?? ''}` : item.href;
                return (
                  <li key={item.nombre}>
                    <Link
                      href={href}
                      onClick={() => setMenuAbierto(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-white/10 ${pathname === href ? 'bg-white/15' : ''}`}
                    >
                      <item.Icon className="h-[18px] w-[18px] shrink-0" />
                      {item.nombre}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="my-3 border-t border-white/15" />

            <ul className="flex flex-col gap-0.5">
              {menusPieVisibles.map((item) => (
                <li key={item.nombre}>
                  <button
                    type="button"
                    onClick={() => accionPie(item.accion)}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-white/10"
                  >
                    <item.Icon className="h-[18px] w-[18px] shrink-0" />
                    {item.nombre}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </div>

      {/* Carrito */}
      {carritoAbierto && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCarritoAbierto(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-bold text-gray-900">Productos Seleccionados</h2>
              <button type="button" onClick={() => setCarritoAbierto(false)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100" aria-label="Cerrar carrito">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {cart.length === 0 && <p className="text-center text-sm text-gray-400">Tu carrito está vacío.</p>}
              <ul className="flex flex-col gap-3">
                {cart.map((item: CartItem, idx: number) => (
                  <li key={String(item.id)} className="flex items-center gap-3 rounded-xl border border-gray-100 p-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto, Supabase Storage */}
                    <img src={(item.foto as string) || '/assets/producto.jpg'} alt="" className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-800">{item.titulo}</p>
                      <p className="text-xs text-gray-500">Cantidad: {item.cantidad ?? 1}</p>
                      <p className="text-xs text-gray-500">Precio: ${formatCOP(item.costoTotal)} COP</p>
                    </div>
                    <button type="button" onClick={() => eliminar(item.id)} className="shrink-0 rounded-full p-1.5 text-red-500 hover:bg-red-50" aria-label="Quitar">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border-t border-gray-100 p-4">
              <p className="text-center text-sm font-semibold text-gray-700">Valor a pagar: ${formatCOP(total)}</p>
              <Link
                href="/pedidos"
                onClick={() => setCarritoAbierto(false)}
                className="mt-3 block rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-center text-sm font-bold text-white shadow-md"
              >
                Agregar más productos
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
