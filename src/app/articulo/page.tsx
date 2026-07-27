'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { fetchProductos, type ProductoLegacy } from '@/lib/productos';
import { fetchCategoriasConProductos, type CategoriaConSub } from '@/lib/categorias';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchBannersActivos, clasesPosicionBoton, type BannerImagen } from '@/lib/adminConfig';
import { formatCOP } from '@/lib/cartStore';
import { ViewProductosModal } from '@/components/ViewProductosModal';
import { ProveedorDashboard } from '@/components/ProveedorDashboard';

// Port 1:1 desde src/app/components/pedidos (Angular, mapeado a la ruta /articulo -- naming
// heredado del backend viejo, PedidosComponent es la pagina de INICIO real del catalogo). Fase 3:
// fidelidad visual identica al original.
//
// El componente `app-slider` de Angular (Swiper.js, 3 variantes por `view`) se reconstruye con
// scroll horizontal nativo en vez de instalar swiper -- visualmente equivalente (carrusel/tira
// horizontal), sin la dependencia pesada. Confirmado leyendo el HTML real: NINGUN otro metodo de
// PedidosComponent (masInfo, openShare, handleEdit, handleOpenStore, buscar/seartxt, maxCantidad,
// etc.) tiene un elemento real en la plantilla que lo dispare -- son codigo muerto en esta pagina
// especifica, no se portan. `agregar()`/`AgregarCart()` en el original literalmente solo abren el
// mismo dialogo (`ViewProductosComponent`, ya migrado a `ViewProductosModal`) con `view: 'store'`
// SIEMPRE -- no hay una variante "comprar directo" visible en esta pagina en produccion hoy.
//
// Pendiente documentado: la barra de busqueda (`seartxt`) de esta pagina en realidad vive en el
// header real de Angular (1000+ lineas, no portado aun a `RealHeader.tsx`) y llega via el store
// compartido -- sin esa barra todavia no hay nada que la dispare aca tampoco.

interface DataUserBasico {
  id: string;
  telefono?: string | null;
}

// Convierte el color hex elegido en el admin a rgba con transparencia, para el anillo de brillo
// pulsante del boton "Ver ahora" (--boton-glow en globals.css, animacion .boton-pulso).
function hexToRgba(hex: string, alpha: number): string {
  const limpio = hex.replace('#', '');
  const completo = limpio.length === 3 ? limpio.split('').map((c) => c + c).join('') : limpio;
  const bigint = parseInt(completo, 16) || 0;
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Banners de imagen reales del admin (pedido explicito del usuario 2026-07-22, ver
// adminConfig.ts/site_banners) -- lo primero que ve el usuario logueado, arriba de todo en
// /articulo. Auto-rotacion + puntos si hay mas de uno, cada slide es una imagen subida por el
// admin con medidas propias (sin recorte -- object-cover solo si el admin la subio con otra
// proporcion, no se fuerza aspect ratio). Click opcional: si el banner tiene link_url, navega ahi
// (externo o interno); si no, es puramente decorativo.
//
// El carrusel viejo de miniaturas del curso Acelerador (CursosCarousel) que iba justo debajo de
// este se elimino a pedido explicito del usuario 2026-07-22 -- ya no debe volver a agregarse aca
// sin que el usuario lo pida de nuevo.
function PromoBannerCarousel({ banners }: { banners: BannerImagen[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (banners.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % banners.length), 5000);
    return () => clearInterval(t);
  }, [banners.length]);

  if (banners.length === 0) return null;
  const actual = banners[idx % banners.length];

  // width/height son solo un hint para evitar layout shift -- style height:auto hace que el
  // navegador respete la proporcion REAL de la imagen que subio el admin (sin forzar recorte),
  // mismo comportamiento visual que el <img> plano de antes pero con optimizacion real de next/image.
  const imagen = (
    <Image
      src={actual.imageUrl}
      alt=""
      width={1200}
      height={500}
      sizes="100vw"
      priority
      style={{ width: '100%', height: 'auto' }}
      className="rounded-lg object-cover"
    />
  );

  return (
    <div className="relative">
      {actual.linkUrl ? (
        <a href={actual.linkUrl} target={actual.linkUrl.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer">
          {imagen}
        </a>
      ) : (
        imagen
      )}
      {actual.linkUrl && (
        // Boton "Ver ahora" (pedido explicito del usuario 2026-07-22): color/posicion configurados
        // por el admin POR banner (ver /config/configuracion), para que quede visible sobre
        // cualquier imagen -- sin esto no era obvio que el banner completo ya era clickeable.
        <span
          className={`${clasesPosicionBoton(actual.buttonPosition)} boton-pulso pointer-events-none rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg sm:px-6 sm:py-3 sm:text-base`}
          style={{ backgroundColor: actual.buttonColor, ['--boton-glow' as string]: hexToRgba(actual.buttonColor, 0.6) }}
        >
          Ver ahora
        </span>
      )}
      {banners.length > 1 && (
        <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((b, i) => (
            <span key={b.id} className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`} />
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriaStrip({ categorias }: { categorias: CategoriaConSub[] }) {
  return (
    <div className="flex gap-4 overflow-x-auto px-1 py-2">
      {categorias.map((cat) => (
        <a
          key={cat.id}
          href={`/listproduct/categoria/${cat.id}`}
          className="flex shrink-0 flex-col items-center gap-1 text-center"
          style={{ width: 72 }}
        >
          <Image src={cat.image} alt="" width={56} height={56} className="h-14 w-14 rounded-full border border-gray-200 object-cover" />
          <span className="text-[10px] leading-tight text-gray-700">{cat.title}</span>
        </a>
      ))}
    </div>
  );
}

function ProductoCardMini({ item, onClick }: { item: ProductoLegacy; onClick: () => void }) {
  return (
    <div className="w-44 shrink-0 rounded-xl border border-gray-100 p-2 shadow-sm">
      <div className="relative h-32 w-full cursor-pointer" onClick={onClick}>
        <Image src={item.foto} alt={item.pro_nombre} fill sizes="176px" className="rounded object-cover" />
      </div>
      <p onClick={onClick} className="mt-1 cursor-pointer truncate text-xs font-medium text-gray-800">
        {item.pro_nombre}
      </p>
      <p className="text-[11px] text-gray-500">Precio a Distribuidor: $ {formatCOP(item.pro_vendedor || 0)}</p>
      <p className="text-[11px] text-gray-500">Tu lo Vendes: $ {formatCOP(item.pro_uni_venta || 0)}</p>
    </div>
  );
}

export default function ArticuloPage() {
  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [categorias, setCategorias] = useState<CategoriaConSub[]>([]);
  const [banners, setBanners] = useState<BannerImagen[]>([]);
  const [listProductos, setListProductos] = useState<ProductoLegacy[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [productoAbierto, setProductoAbierto] = useState<ProductoLegacy | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const limit = 54;

  const cargarPagina = useCallback(async (usuario: DataUserCompleto | null, pageToLoad: number) => {
    const res = await fetchProductos({ userId: usuario?.id, page: pageToLoad, limit });
    setCount(res.count);
    setListProductos((prev) => {
      const existentes = new Set(prev.map((p) => p.id));
      return [...prev, ...res.data.filter((p) => !existentes.has(p.id))];
    });
    if (res.data.length === 0) setNotEmptyPost(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const uid = sessionData.session.user.id;
      const usuario = await fetchDataUserCompleto(uid);
      setDataUser(usuario);
      setEstado('cargando');

      // Pedido explicito del usuario 2026-07-25: un proveedor no debe ver el catalogo de compra
      // (ni el suyo propio ni el de otros proveedores) -- su "Inicio" es un dashboard aparte
      // (ProveedorDashboard), asi que se salta la carga de categorias/productos. El banner de
      // imagenes del admin SI se mantiene (pedido explicito del usuario, aclarado despues).
      if (usuario.rolname === 'proveedor') {
        setBanners(await fetchBannersActivos());
        setEstado('listo');
        return;
      }

      const [cats, listaBanners] = await Promise.all([fetchCategoriasConProductos(), fetchBannersActivos(), cargarPagina(usuario, 0)]);
      setCategorias(cats);
      setBanners(listaBanners);
      setEstado('listo');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (estado !== 'listo' || !sentinelRef.current) return;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && notEmptyPost && !cargandoMas) {
        setCargandoMas(true);
        setPage((p) => {
          const next = p + 1;
          cargarPagina(dataUser, next).finally(() => setCargandoMas(false));
          return next;
        });
      }
    });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [estado, notEmptyPost, cargandoMas, dataUser, cargarPagina]);

  if (estado === 'revisando' || estado === 'cargando') return null;

  if (dataUser?.rolname === 'proveedor') {
    return (
      <div className="mx-auto w-full max-w-[1320px] px-3 py-4">
        <PromoBannerCarousel banners={banners} />
        <ProveedorDashboard userId={dataUser.id} nombre={dataUser.nombre} />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-4">
      <PromoBannerCarousel banners={banners} />

      <div className="mt-4">
        <CategoriaStrip categorias={categorias} />
      </div>

      <h5 className="ml-2 mt-5 font-semibold text-gray-800">MAS VENDIDOS</h5>
      <div className="mt-2 flex gap-3 overflow-x-auto pb-2">
        {listProductos.map((item) => (
          <ProductoCardMini key={`slider-${item.id}`} item={item} onClick={() => setProductoAbierto(item)} />
        ))}
      </div>

      <h5 className="ml-2 mt-6 font-semibold text-gray-800">NOVEDADES</h5>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {listProductos.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-100 p-2 shadow-sm">
            <div className="relative h-32 w-full cursor-pointer" onClick={() => setProductoAbierto(item)}>
              <Image
                src={item.foto}
                alt={item.pro_nombre}
                fill
                sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                className="rounded object-cover"
              />
            </div>
            <h4 className="mt-1 truncate text-sm font-semibold text-gray-800">{item.pro_nombre.slice(0, 20)}</h4>
            <p className="text-[11px] text-gray-500">
              precio a distribuidor: <span className="font-medium text-gray-700">$ {formatCOP(item.pro_vendedor || 0)}</span>
            </p>
            <p className="text-[11px] text-gray-500">
              Lo vendes a: <span className="font-medium text-gray-700">$ {formatCOP(item.pro_uni_venta || 0)}</span>
            </p>
            <button
              onClick={() => setProductoAbierto(item)}
              className="mt-2 w-full rounded bg-[#02a0e3] py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Hacer pedido
            </button>
          </div>
        ))}
      </div>

      {listProductos.length === 0 && <p className="py-10 text-center text-gray-500">Todavia no hay productos disponibles.</p>}

      <div ref={sentinelRef} className="h-4" />
      {count > 0 && <p className="pb-4 text-center text-xs text-gray-400">{listProductos.length} de {count} productos</p>}

      {productoAbierto && (
        <ViewProductosModal
          producto={productoAbierto}
          dataUser={dataUser}
          initialView="store"
          onClose={() => setProductoAbierto(null)}
        />
      )}
    </div>
  );
}
