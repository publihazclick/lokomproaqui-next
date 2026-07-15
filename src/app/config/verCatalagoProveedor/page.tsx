'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchTendencia, fetchRecomendados, fetchRentables, fetchProveedoresDestacados, type ProveedorDestacado } from '@/lib/verCatalagoProveedor';
import { formatCOP } from '@/lib/cartStore';
import type { ProductoLegacy } from '@/lib/productos';

// Port de VerCatalagoProveedorComponent (Angular, "Explorar Bodegas"). Ver
// src/lib/verCatalagoProveedor.ts para los 2 bugs reales corregidos (filtro con un ID numerico
// viejo que dejaba 3 de 4 secciones siempre vacias, y el filtro de rol de "Destacados" que nunca
// funciono).

function SeccionProductos({ titulo, productos }: { titulo: string; productos: ProductoLegacy[] }) {
  return (
    <div className="mb-8">
      <h3 className="mb-3 text-xl font-semibold text-gray-800">{titulo}</h3>
      {productos.length === 0 ? (
        <p className="text-sm text-gray-400">No hay productos para mostrar.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {productos.map((p) => (
            <a key={p.id} href={`/config/verProductoProveedor/${p.id}`} className="rounded-xl border border-gray-100 p-2 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
              <img src={p.foto} alt={p.pro_nombre} className="h-28 w-full rounded object-cover" />
              <p className="mt-1 truncate text-xs font-medium text-gray-800">{p.pro_nombre.slice(0, 20)}</p>
              <p className="text-xs text-gray-500">$ {formatCOP(p.pro_vendedor || p.pro_uni_venta || 0)}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function VerCatalagoProveedorPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [tendencia, setTendencia] = useState<ProductoLegacy[]>([]);
  const [destacados, setDestacados] = useState<ProveedorDestacado[]>([]);
  const [recomendados, setRecomendados] = useState<ProductoLegacy[]>([]);
  const [rentables, setRentables] = useState<ProductoLegacy[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      setEstado('listo');
      const [t, d, r, re] = await Promise.all([fetchTendencia(), fetchProveedoresDestacados(), fetchRecomendados(), fetchRentables()]);
      setTendencia(t);
      setDestacados(d);
      setRecomendados(r);
      setRentables(re);
    });
  }, []);

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <SeccionProductos titulo="Productos en Tendencia" productos={tendencia} />

      <div className="mb-8">
        <h3 className="mb-3 text-xl font-semibold text-gray-800">Proveedores Destacados</h3>
        {destacados.length === 0 ? (
          <p className="text-sm text-gray-400">No hay proveedores para mostrar.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {destacados.map((p) => (
              <a key={p.id} href={`/config/verProveedor/${p.id}`} className="rounded-xl border border-gray-100 p-2 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto de perfil (Supabase Storage) */}
                <img src={p.foto || '/assets/noimagen.jpg'} alt="" className="h-28 w-full rounded object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>

      <SeccionProductos titulo="Nuestros recomendados" productos={recomendados} />
      <SeccionProductos titulo="Productos más rentables" productos={rentables} />
    </div>
  );
}
