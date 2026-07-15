'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { FrontHeader } from '@/components/FrontHeader';
import { resolverTiendaPorTelefono, fetchCategoriasFront, fetchProductosTienda, type TiendaFront, type CategoriaFront } from '@/lib/front';
import { formatCOP } from '@/lib/cartStore';
import type { ProductoLegacy } from '@/lib/productos';

// Port de ProductosComponent (Angular, modulo `portada`, vitrina "/front[/:cell]") -- catalogo
// curado (price_overrides) de un vendedor especifico identificado por telefono. Ver
// src/lib/front.ts sobre los 3 filtros reales corregidos (categoria/busqueda/orden, todos
// ignorados en silencio por `ProductoService.getStore()` en el original).

function parseSlug(slug?: string[]): { telefono: string | null; categoriaId: number | null } {
  if (!slug || slug.length === 0) return { telefono: null, categoriaId: null };
  const filtrado = slug.filter((s) => s !== 'inicio' && s !== 'productos');
  if (filtrado[0] === 'index') return { telefono: filtrado[1] || null, categoriaId: filtrado[2] ? Number(filtrado[2]) : null };
  return { telefono: filtrado[0] || null, categoriaId: filtrado[1] ? Number(filtrado[1]) : null };
}

const LIMIT = 30;

export default function FrontProductosPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const { telefono, categoriaId: categoriaInicial } = parseSlug(slug);

  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-encontrada'>('revisando');
  const [tienda, setTienda] = useState<TiendaFront | null>(null);
  const [categorias, setCategorias] = useState<CategoriaFront[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(categoriaInicial);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<'nombre' | 'menor_a_mayor' | 'mayor_a_menor' | 'fecha'>('fecha');
  const [productos, setProductos] = useState<ProductoLegacy[]>([]);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    async (sellerId: string, page: number, reemplazar: boolean) => {
      const res = await fetchProductosTienda({ sellerId, categoriaId: categoriaId || undefined, search: busqueda, orden, page, limit: LIMIT });
      setProductos((prev) => {
        const base = reemplazar ? [] : prev;
        const existentes = new Set(base.map((p) => p.id));
        return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
      });
      setNotEmptyPost(res.data.length > 0);
      setPage(page);
    },
    [categoriaId, busqueda, orden],
  );

  useEffect(() => {
    if (!telefono) {
      setEstado('no-encontrada');
      return;
    }
    (async () => {
      const [t, cats] = await Promise.all([resolverTiendaPorTelefono(telefono), fetchCategoriasFront()]);
      if (!t) {
        setEstado('no-encontrada');
        return;
      }
      setTienda(t);
      setCategorias(cats);
      setEstado('listo');
      cargar(t.id, 0, true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [telefono]);

  useEffect(() => {
    if (estado === 'listo' && tienda) cargar(tienda.id, 0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId, orden]);

  function buscar() {
    if (tienda) cargar(tienda.id, 0, true);
  }

  if (estado === 'revisando') return null;
  if (estado === 'no-encontrada') {
    return <p className="py-16 text-center text-gray-500">Esta tienda ya no está disponible.</p>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <FrontHeader telefono={tienda!.telefono || telefono!} />

      <div className="mx-auto w-full max-w-[1200px] px-3 py-6">
        <div className="flex gap-2">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Productos"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={buscar} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white">
            Buscar
          </button>
          <select value={orden} onChange={(e) => setOrden(e.target.value as typeof orden)} className="rounded border border-gray-300 px-2 py-2 text-sm">
            <option value="fecha">Ordenar Fecha</option>
            <option value="nombre">Ordenar nombre</option>
            <option value="menor_a_mayor">Menor a Mayor</option>
            <option value="mayor_a_menor">Mayor a Menor</option>
          </select>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoriaId(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${categoriaId === null ? 'bg-[#0d6efd] text-white' : 'bg-white text-gray-700 shadow-sm'}`}
          >
            TODOS
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${categoriaId === c.id ? 'bg-[#0d6efd] text-white' : 'bg-white text-gray-700 shadow-sm'}`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {productos.map((p) => (
            <a key={p.id} href={`/front/productosView/${p.id}/${tienda!.telefono}`} className="rounded-xl border border-gray-100 bg-white p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
              <img src={p.foto} alt={p.pro_nombre} className="h-28 w-full rounded object-cover" />
              <p className="mt-1 truncate text-xs font-medium text-gray-800">{p.pro_nombre.slice(0, 20)}</p>
              <p className="text-xs text-gray-500">$ {formatCOP(p.pro_uni_venta)}</p>
            </a>
          ))}
        </div>
        {productos.length === 0 && <p className="py-10 text-center text-gray-500">No hay productos para mostrar.</p>}

        {notEmptyPost && productos.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                setCargandoMas(true);
                await cargar(tienda!.id, page + 1, false);
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
  );
}
