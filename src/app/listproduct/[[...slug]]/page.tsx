'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchProductos, agregarTodosLosProductosDeBodega, type ProductoLegacy } from '@/lib/productos';
import { fetchCategoriasConSub, type CategoriaConSub } from '@/lib/categorias';
import { fetchDataUserCompleto, fetchPerfilPorReferralCode, type DataUserCompleto, type PerfilTienda } from '@/lib/usuarios';
import { formatCOP } from '@/lib/cartStore';
import { ViewProductosModal } from '@/components/ViewProductosModal';

// Port 1:1 desde src/app/extra/list-article-store (Angular, ListArticleStoreComponent -- el
// componente REAL detras de ListArticleComponent, que solo delega con <app-list-article-store>).
// Cubre las 3 variantes de ruta con un catch-all [[...slug]]:
//   /listproduct                      -> catalogo completo (sin filtro)
//   /listproduct/:idStore             -> "vitrina" de un proveedor especifico (por referral_code)
//   /listproduct/categoria/:idCategoria -> filtrado por categoria
// Fase 3: fidelidad visual identica al original (Bootstrap + iphone-menu de categorias en pildoras).
//
// Reusa integramente ViewProductosModal/DropshippingCheckoutModal ya migrados (mismo dialogo real
// de "agregar a mi tienda"/dropshipping que /articulo) -- confirmado leyendo el .ts: `handleArticle`
// tambien fuerza `item.view = 'store'` siempre (this.views nunca cambia de 'none').
//
// Consolidacion menor (no es un recorte de funcionalidad real): el original tiene DOS controles de
// paginacion redundantes para la misma accion ("VER MÁS PRODUCTOS" + un mat-paginator con selector
// de tamaño de pagina) -- se deja solo el link "Ver más productos", que logra lo mismo.

interface Categoria extends CategoriaConSub {
  check?: boolean;
}

export default function ListProductPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const router = useRouter();

  const categoriaId = slug?.[0] === 'categoria' ? slug[1] : undefined;
  const idStore = slug?.[0] && slug[0] !== 'categoria' ? slug[0] : undefined;

  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [dataStore, setDataStore] = useState<PerfilTienda | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [listArticle, setListArticle] = useState<ProductoLegacy[]>([]);
  const [counts, setCounts] = useState(0);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [filtroTxt, setFiltroTxt] = useState('');
  const [productoAbierto, setProductoAbierto] = useState<ProductoLegacy | null>(null);
  const [agregandoTodos, setAgregandoTodos] = useState(false);

  const limit = 50;
  const busquedaActualRef = useRef('');

  const cargarArticulos = useCallback(
    async (opts: { userId?: string; ownerProfileId?: string; categoriaId?: string; search?: string; page: number; reemplazar?: boolean }) => {
      const res = await fetchProductos({
        categoriaId: opts.categoriaId,
        ownerProfileId: opts.ownerProfileId,
        userId: opts.userId,
        search: opts.search,
        page: opts.page,
        limit,
      });
      setCounts(res.count);
      setListArticle((prev) => {
        const base = opts.reemplazar ? [] : prev;
        const existentes = new Set(base.map((p) => p.id));
        return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
      });
      setNotEmptyPost(res.data.length > 0);
    },
    [],
  );

  useEffect(() => {
    let activo = true;
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const uid = sessionData.session.user.id;
      const usuario = await fetchDataUserCompleto(uid);
      if (!activo) return;
      setDataUser(usuario);
      setEstado('cargando');

      let tienda: PerfilTienda | null = null;
      if (idStore) tienda = await fetchPerfilPorReferralCode(idStore);
      if (!activo) return;
      setDataStore(tienda);

      const cats = await fetchCategoriasConSub();
      if (!activo) return;
      setCategorias(cats.map((c) => ({ ...c, check: categoriaId != null && String(c.id) === String(categoriaId) })));

      setPage(0);
      await cargarArticulos({ userId: uid, ownerProfileId: tienda?.id, categoriaId, page: 0, reemplazar: true });
      if (!activo) return;
      setEstado('listo');
    });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStore, categoriaId]);

  function handleCategorySearch(item: Categoria) {
    router.push(`/listproduct/categoria/${item.id}`);
  }

  function onFiltroChange(v: string) {
    setFiltroTxt(v);
  }

  async function handleSearch() {
    if (!dataUser) return;
    busquedaActualRef.current = filtroTxt;
    setPage(0);
    setListArticle([]);
    setNotEmptyPost(true);
    await cargarArticulos({ userId: dataUser.id, ownerProfileId: dataStore?.id, categoriaId, search: filtroTxt, page: 0, reemplazar: true });
  }

  async function handlePageNext() {
    if (!dataUser || cargandoMas) return;
    setCargandoMas(true);
    const next = page + 1;
    setPage(next);
    await cargarArticulos({ userId: dataUser.id, ownerProfileId: dataStore?.id, categoriaId, search: busquedaActualRef.current, page: next });
    setCargandoMas(false);
  }

  async function handleProductTs() {
    if (!dataStore || !dataUser) return;
    if (!window.confirm('¿Deseas agregar TODOS los productos de esta bodega a tu tienda?')) return;
    setAgregandoTodos(true);
    const ok = await agregarTodosLosProductosDeBodega(dataStore.id, dataUser.id);
    setAgregandoTodos(false);
    if (ok) window.alert('Se agregaron todos los productos de esta bodega!!!');
  }

  if (estado === 'revisando' || estado === 'cargando') return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-4">
      {dataStore && (
        <div className="mb-4 flex flex-col items-center gap-3 rounded-xl border border-gray-100 p-4 text-center shadow-sm sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
          <img src={dataStore.usu_imagen || '/assets/avatar.png'} alt="" className="h-24 w-24 shrink-0 rounded-full object-cover" />
          <div className="flex-1">
            <h4 className="font-bold text-gray-900">{dataStore.usu_usuario}</h4>
            {dataStore.usu_telefono && <p className="text-sm text-gray-600">Celular: {dataStore.usu_telefono}</p>}
            {dataStore.usu_ciudad && <p className="text-sm text-gray-600">Ciudad: {dataStore.usu_ciudad}</p>}
          </div>
          <button
            onClick={handleProductTs}
            disabled={agregandoTodos}
            className="rounded bg-[#ffc107] px-3 py-2 text-sm font-medium text-gray-900 hover:opacity-90 disabled:opacity-60"
          >
            {agregandoTodos ? 'Agregando…' : 'Agregar Todos Los Productos'}
          </button>
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
        <span className="text-sm font-semibold text-gray-700">Artículo de Bodega {dataStore?.usu_usuario}</span>
        <div className="ml-auto flex gap-2">
          <input
            type="search"
            value={filtroTxt}
            onChange={(e) => onFiltroChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar"
            className="rounded border border-gray-300 px-2 py-1 text-sm"
          />
          <button onClick={handleSearch} className="flex items-center gap-1 rounded border border-green-600 px-2 py-1 text-sm text-green-700 hover:bg-green-50">
            <Search className="h-3.5 w-3.5" /> Buscar
          </button>
        </div>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        {categorias.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySearch(cat)}
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
              cat.check ? 'border-[#02a0e3] bg-[#02a0e3] text-white' : 'border-gray-200 bg-white text-gray-700'
            }`}
          >
            {cat.title}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {listArticle.map((item) => (
          <div key={item.id} onClick={() => setProductoAbierto(item)} className="cursor-pointer overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
            <img src={item.foto} alt={item.pro_nombre} className="h-40 w-full object-cover" />
            <div className="p-2 text-center">
              <p className="truncate text-sm font-semibold text-gray-800">{item.pro_nombre.slice(0, 10)}</p>
              <p className="text-xs font-medium text-gray-600">$ {formatCOP(item.pro_uni_venta || 0)}</p>
            </div>
          </div>
        ))}
      </div>

      {listArticle.length === 0 && <p className="py-10 text-center text-gray-500">No hay productos para mostrar aquí.</p>}

      {notEmptyPost && listArticle.length > 0 && (
        <div className="mt-5 text-center">
          <button onClick={handlePageNext} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'VER MÁS PRODUCTOS'}
          </button>
        </div>
      )}

      {productoAbierto && (
        <ViewProductosModal producto={productoAbierto} dataUser={dataUser} initialView="store" onClose={() => setProductoAbierto(null)} />
      )}
    </div>
  );
}
