'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProductos, type ProductoLegacy } from '@/lib/productos';
import { fetchCategoriasConSub, type CategoriaConSub } from '@/lib/categorias';
import { formatCOP } from '@/lib/cartStore';
import { ViewProductosModal } from '@/components/ViewProductosModal';

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

const BANNERS = [
  '/assets/imagenes/banner2.png',
  '/assets/imagenes/banner3.png',
  '/assets/imagenes/banner4.png',
];

interface DataUserBasico {
  id: string;
  telefono?: string | null;
}

function BannerCarousel() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % BANNERS.length), 7000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative w-full overflow-hidden rounded">
      {/* eslint-disable-next-line @next/next/no-img-element -- banner estatico servido por el dominio Angular */}
      <img src={BANNERS[idx]} alt="" className="w-full object-cover" />
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
        {BANNERS.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`} />
        ))}
      </div>
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
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de categoria (Supabase/assets legacy) */}
          <img src={cat.image} alt="" className="h-14 w-14 rounded-full border border-gray-200 object-cover" />
          <span className="text-[10px] leading-tight text-gray-700">{cat.title}</span>
        </a>
      ))}
    </div>
  );
}

function ProductoCardMini({ item, onClick }: { item: ProductoLegacy; onClick: () => void }) {
  return (
    <div className="w-44 shrink-0 rounded-xl border border-gray-100 p-2 shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
      <img src={item.foto} alt={item.pro_nombre} onClick={onClick} className="h-32 w-full cursor-pointer rounded object-cover" />
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
  const [dataUser, setDataUser] = useState<DataUserBasico | null>(null);
  const [categorias, setCategorias] = useState<CategoriaConSub[]>([]);
  const [listProductos, setListProductos] = useState<ProductoLegacy[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [productoAbierto, setProductoAbierto] = useState<ProductoLegacy | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const limit = 54;

  const cargarPagina = useCallback(async (usuario: DataUserBasico | null, pageToLoad: number) => {
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
      const { data: profile } = await supabase.from('profiles').select('phone').eq('id', uid).maybeSingle();
      const usuario = { id: uid, telefono: profile?.phone ?? null };
      setDataUser(usuario);
      setEstado('cargando');

      const [cats] = await Promise.all([fetchCategoriasConSub(), cargarPagina(usuario, 0)]);
      setCategorias(cats);
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

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-4">
      <BannerCarousel />

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
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
            <img
              src={item.foto}
              alt={item.pro_nombre}
              onClick={() => setProductoAbierto(item)}
              className="h-32 w-full cursor-pointer rounded object-cover"
            />
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
