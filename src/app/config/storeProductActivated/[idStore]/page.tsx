'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchPerfilProveedorPorReferralCode, agregarTodosLosProductos, type PerfilProveedor } from '@/lib/verProveedor';
import { fetchProductos, type ProductoLegacy } from '@/lib/productos';
import { fetchCategoriasPrincipales, type OpcionSimple } from '@/lib/productosAdmin';
import { formatCOP } from '@/lib/cartStore';
import { useToast, Toast } from '@/components/Toast';

// Port de ListArticleStoreComponent (Angular, "/config/storeProductActivated/:idStore") -- vitrina
// de una tienda especifica (identificada por referral_code, no id) con filtro real de categoria y
// el boton "Agregar Todos los Productos de Esta Bodega" (createPriceArticleFull -> price_overrides,
// ya bien implementado en el backend). Ver src/lib/verProveedor.ts.

const LIMIT = 18;

export default function StoreProductActivatedPage({ params }: { params: Promise<{ idStore: string }> }) {
  const { idStore } = use(params);
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-encontrada'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [perfil, setPerfil] = useState<PerfilProveedor | null>(null);
  const [categorias, setCategorias] = useState<OpcionSimple[]>([]);
  const [categoriaId, setCategoriaId] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [productos, setProductos] = useState<ProductoLegacy[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [agregandoTodos, setAgregandoTodos] = useState(false);

  const cargar = useCallback(
    async (storeOwnerId: string, page: number, reemplazar: boolean) => {
      const res = await fetchProductos({ ownerProfileId: storeOwnerId, categoriaId: categoriaId || undefined, search: busqueda, page, limit: LIMIT });
      setCount(res.count);
      setProductos((prev) => {
        const base = reemplazar ? [] : prev;
        const existentes = new Set(base.map((p) => p.id));
        return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
      });
      setNotEmptyPost(res.data.length > 0);
      setPage(page);
    },
    [categoriaId, busqueda],
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const [usuario, tienda, cats] = await Promise.all([
        fetchDataUserCompleto(sessionData.session.user.id),
        fetchPerfilProveedorPorReferralCode(idStore),
        fetchCategoriasPrincipales(),
      ]);
      setDataUser(usuario);
      setCategorias(cats);
      if (!tienda) {
        setEstado('no-encontrada');
        return;
      }
      setPerfil(tienda);
      setEstado('listo');
      cargar(tienda.id, 0, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idStore]);

  useEffect(() => {
    if (estado === 'listo' && perfil) cargar(perfil.id, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  function buscar() {
    if (perfil) cargar(perfil.id, 0, true);
  }

  async function agregarTodos() {
    if (!perfil || !dataUser) return;
    if (!window.confirm('¿Deseas agregar todos los productos de esta bodega a tu tienda?')) return;
    setAgregandoTodos(true);
    const res = await agregarTodosLosProductos(dataUser.id, perfil.id);
    setAgregandoTodos(false);
    mostrar(res.message);
  }

  if (estado === 'revisando') return null;
  if (estado === 'no-encontrada') {
    return <p className="py-16 text-center text-gray-500">Esta tienda ya no está disponible.</p>;
  }

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="w-full text-center sm:w-56">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
          <img src={perfil?.foto || '/assets/noimagen.jpg'} alt="" className="mx-auto h-40 w-40 rounded-full object-cover shadow" />
          <h5 className="mt-3 font-semibold text-gray-800">{perfil?.nombre}</h5>
          <p className="text-sm font-medium text-amber-600">{count} Producto(s)</p>
          <p className="mt-1 text-sm text-gray-500">Ciudad {perfil?.ciudad}</p>
          <button
            onClick={agregarTodos}
            disabled={agregandoTodos}
            className="mt-3 w-full rounded-full bg-green-600 px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {agregandoTodos ? 'Agregando…' : 'Agregar Todos los Productos de Esta Bodega'}
          </button>
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap gap-2">
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className="rounded border border-gray-300 px-2 py-2 text-sm">
              <option value="">Todas las categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && buscar()}
              placeholder="Filtrar por código o nombre"
              className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
            />
            <button onClick={buscar} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white">
              Buscar
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {productos.map((p) => (
              <a key={p.id} href={`/config/verProductoProveedor/${p.id}`} className="rounded-xl border border-gray-100 p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
                <img src={p.foto} alt={p.pro_nombre} className="h-28 w-full rounded object-cover" />
                <p className="mt-1 truncate text-xs font-medium text-gray-800">{p.pro_nombre.slice(0, 20)}</p>
                <p className="text-xs text-gray-500">$ {formatCOP(p.pro_vendedor || p.pro_uni_venta || 0)}</p>
              </a>
            ))}
          </div>
          {productos.length === 0 && <p className="py-10 text-center text-gray-500">No hay productos para mostrar.</p>}

          {notEmptyPost && productos.length > 0 && perfil && (
            <div className="mt-4 text-center">
              <button
                onClick={async () => {
                  setCargandoMas(true);
                  await cargar(perfil.id, page + 1, false);
                  setCargandoMas(false);
                }}
                disabled={cargandoMas}
                className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60"
              >
                {cargandoMas ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
