'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fetchProductos, guardarPriceOverride, type ProductoLegacy } from '@/lib/productos';
import { fetchCategoriasConSub, type CategoriaConSub } from '@/lib/categorias';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { formatCOP, useCart } from '@/lib/cartStore';
import { ViewProductosModal } from '@/components/ViewProductosModal';

// Port 1:1 desde src/app/components/articulo (Angular, ArticuloComponent -- mapeado a las rutas
// /pedidos y /realizarventa, mismo componente para ambas, distinguidas solo por el segmento de
// URL). A diferencia de /articulo y /listproduct (que siempre abren el dialogo de producto en modo
// 'store' = "agregar a mi tienda"), ESTA es la pagina real de "comprar/hacer un pedido": el
// dialogo se abre SIN `initialView`, mostrando el boton real "Confirmar pedido" -- confirmado
// leyendo agregar() en el .ts original, que nunca setea `obj.view`.
//
// Diferencia real entre /pedidos y /realizarventa (mismo componente, `coinShop` cambia segun URL):
// - /pedidos (coinShop=true, boton "Hacer Compra"): precio de venta normal, solo lectura.
// - /realizarventa (coinShop=false, boton "Realizar Venta"): el precio de cada tarjeta es un input
//   editable -- el vendedor fija su propio precio de reventa ahi mismo, se guarda al salir del
//   campo (handleEdit -> price_override), igual que el original.
// El carrito se "purga" al entrar a cada pagina (validarCart): los items que no coincidan con el
// modo actual (coinShop) se eliminan -- son dos carritos logicamente distintos que comparten el
// mismo storage.
//
// Alcance recortado y documentado: el dropdown de subcategorias (mat-menu) del original filtra por
// `pro_sub_categoria`, un campo que `ProductoService.get()` (ya en Supabase) JAMAS soporto -- ya
// hoy en produccion cualquier click en una subcategoria devuelve el catalogo SIN FILTRAR (bug
// preexistente, no introducido aca). Se omite ese submenu no funcional y se deja solo el filtro
// por categoria de primer nivel, que si funciona.

interface ArticuloCarritoPageProps {
  modo: 'pedidos' | 'realizarventa';
  categoriaId?: string;
}

export function ArticuloCarritoPage({ modo, categoriaId }: ArticuloCarritoPageProps) {
  const router = useRouter();
  const { cart, eliminar } = useCart();

  const coinShop = modo === 'pedidos';
  const titleButton = coinShop ? 'Hacer Compra' : 'Realizar Venta';

  const [estado, setEstado] = useState<'revisando' | 'cargando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [categorias, setCategorias] = useState<CategoriaConSub[]>([]);
  const [listProductos, setListProductos] = useState<ProductoLegacy[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [productoAbierto, setProductoAbierto] = useState<ProductoLegacy | null>(null);

  const limit = 54;

  // Purga el carrito de items del OTRO modo (coinShop no coincide) -- idempotente, seguro de
  // correr en cada cambio de `cart` (ver nota arriba).
  useEffect(() => {
    for (const row of cart) {
      const esDeEsteModo = coinShop ? row.coinShop === true : row.coinShop !== true;
      if (!esDeEsteModo) eliminar(row.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart, coinShop]);

  const cargarPagina = useCallback(async (usuario: DataUserCompleto | null, categoria: string | undefined, pageToLoad: number, reemplazar: boolean) => {
    const res = await fetchProductos({ categoriaId: categoria, userId: usuario?.id, page: pageToLoad, limit });
    setCount(res.count);
    setListProductos((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((p) => p.id));
      return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
    });
    setNotEmptyPost(res.data.length > 0);
  }, []);

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

      const cats = await fetchCategoriasConSub();
      if (!activo) return;
      setCategorias(cats);

      setPage(0);
      await cargarPagina(usuario, categoriaId, 0, true);
      if (!activo) return;
      setEstado('listo');
    });
    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  async function handlePageNext() {
    if (!dataUser || cargandoMas) return;
    setCargandoMas(true);
    const next = page + 1;
    setPage(next);
    await cargarPagina(dataUser, categoriaId, next, false);
    setCargandoMas(false);
  }

  function handleCategoriaClick(catId: number) {
    router.push(catId ? `/${modo}/${catId}` : `/${modo}`);
  }

  async function guardarPrecioEditado(item: ProductoLegacy, valor: number) {
    if (!dataUser?.id || !valor) return;
    await guardarPriceOverride(item.id, dataUser.id, valor);
  }

  function masInfo(item: ProductoLegacy) {
    const numero = '573506700802'; // numero de soporte generico (mismo fallback que dataConfig.clInformacion)
    const texto = `Hola, estoy interesad@ en mas informacion codigo: ${item.pro_nombre} foto ==> ${item.foto}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`);
  }

  if (estado === 'revisando' || estado === 'cargando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-4">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => handleCategoriaClick(0)}
          className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
            !categoriaId ? 'border-[#02a0e3] bg-[#02a0e3] text-white' : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          TODOS
        </button>
        {categorias
          .filter((c) => c.id !== 0)
          .map((cat) => (
            <button
              key={cat.id}
              onClick={() => handleCategoriaClick(cat.id)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium ${
                String(cat.id) === categoriaId ? 'border-[#02a0e3] bg-[#02a0e3] text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {cat.title}
            </button>
          ))}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {listProductos.map((item) => (
          <div key={item.id} className="overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
            <img src={item.foto} alt={item.pro_nombre} onClick={() => setProductoAbierto(item)} className="h-40 w-full cursor-pointer object-cover" />
            <div className="p-2">
              <h4 className="truncate text-center text-sm font-semibold text-gray-800">{item.pro_nombre.slice(0, 20)}</h4>

              {coinShop ? (
                <p className="flex items-center justify-center gap-1 whitespace-nowrap text-center text-[10px] text-gray-500">
                  <span>
                    Dist: <span className="font-semibold text-gray-700">$ {formatCOP(item.pro_vendedor || 0)}</span>
                  </span>
                  <span className="text-gray-300">|</span>
                  <span>
                    Vendes: <span className="font-semibold text-gray-700">$ {formatCOP(item.pro_uni_venta || 0)}</span>
                  </span>
                </p>
              ) : (
                <input
                  type="number"
                  defaultValue={item.pro_uni_venta || 0}
                  onBlur={(e) => guardarPrecioEditado(item, Number(e.target.value))}
                  className="w-full rounded border border-gray-300 px-2 py-1 text-center text-sm"
                />
              )}

              <button
                onClick={() => setProductoAbierto(item)}
                className={`mt-2 w-full rounded py-1.5 text-xs font-bold text-white hover:opacity-90 ${coinShop ? 'bg-[#02a0e3]' : 'bg-[#198754]'}`}
              >
                {titleButton}
              </button>

              {dataUser && dataUser.rolname !== 'vendedor' && (
                <button onClick={() => masInfo(item)} className="mx-auto mt-1.5 block w-8">
                  {/* eslint-disable-next-line @next/next/no-img-element -- icono estatico servido por el dominio Angular */}
                  <img src="/assets/icons/masinformacion.png" alt="Más información" className="w-full" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {listProductos.length === 0 && <p className="py-10 text-center text-gray-500">No Hay Datos</p>}

      {notEmptyPost && listProductos.length > 0 && (
        <div className="mt-5 text-center">
          <button onClick={handlePageNext} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : `Ver más (${listProductos.length} de ${count})`}
          </button>
        </div>
      )}

      {productoAbierto && <ViewProductosModal producto={productoAbierto} dataUser={dataUser} onClose={() => setProductoAbierto(null)} />}
    </div>
  );
}
