'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchPerfilProveedor, fetchCatalogoProveedor, type PerfilProveedor } from '@/lib/verProveedor';
import { formatCOP } from '@/lib/cartStore';
import type { ProductoLegacy } from '@/lib/productos';

// Port de VerProveedorComponent (Angular, "Ver detalles" de un proveedor especifico). Ver
// src/lib/verProveedor.ts -- el selector de categoria del original nunca funciono (bug de
// binding), se omite y se deja solo la busqueda de texto real.

const LIMIT = 18;

export default function VerProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [perfil, setPerfil] = useState<PerfilProveedor | null>(null);
  const [productos, setProductos] = useState<ProductoLegacy[]>([]);
  const [count, setCount] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);

  const cargar = useCallback(
    async (search: string, page: number, reemplazar: boolean) => {
      const res = await fetchCatalogoProveedor(id, search, page, LIMIT);
      setCount(res.count);
      setProductos((prev) => {
        const base = reemplazar ? [] : prev;
        const existentes = new Set(base.map((p) => p.id));
        return [...base, ...res.data.filter((p) => !existentes.has(p.id))];
      });
      setNotEmptyPost(res.data.length > 0);
      setPage(page);
    },
    [id],
  );

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setPerfil(await fetchPerfilProveedor(id));
      setEstado('listo');
      cargar('', 0, true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function buscar() {
    cargar(busqueda, 0, true);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1140px] px-3 py-6">
      <a href="/config/verCatalagoProveedor" className="text-sm text-[#0d6efd] hover:underline">
        ← Volver al listado
      </a>

      <div className="mt-4 flex flex-col gap-6 sm:flex-row">
        <div className="w-full text-center sm:w-56">
          {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
          <img src={perfil?.foto || '/assets/noimagen.jpg'} alt="" className="mx-auto h-40 w-40 rounded-full object-cover shadow" />
          <h5 className="mt-3 font-semibold text-gray-800">{perfil?.nombre || 'Empresa Null'}</h5>
          <p className="text-sm font-medium text-amber-600">{count} Producto(s)</p>
          <p className="mt-1 text-sm text-gray-500">Ciudad {perfil?.ciudad}</p>
        </div>

        <div className="flex-1">
          <div className="flex gap-2">
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

          {notEmptyPost && productos.length > 0 && (
            <div className="mt-4 text-center">
              <button
                onClick={async () => {
                  setCargandoMas(true);
                  await cargar(busqueda, page + 1, false);
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
    </div>
  );
}
