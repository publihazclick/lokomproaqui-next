'use client';

import { use, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchProductoById, type ProductoLegacy } from '@/lib/productos';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { ViewProductosModal } from '@/components/ViewProductosModal';

// Port de VerProductoProveedorComponent (Angular) -- vista de un producto especifico dentro del
// catalogo de un proveedor. Reusa ViewProductosModal (mismo dialogo real de "agregar a mi tienda"
// ya construido para /articulo y /listproduct) en vez de duplicar ~240 lineas de logica de
// color/talla/carrito casi identica.

export default function VerProductoProveedorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [estado, setEstado] = useState<'revisando' | 'listo' | 'no-encontrado'>('revisando');
  const [producto, setProducto] = useState<ProductoLegacy | null>(null);
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const [usuario, prod] = await Promise.all([fetchDataUserCompleto(sessionData.session.user.id), fetchProductoById(id)]);
      setDataUser(usuario);
      if (!prod) {
        setEstado('no-encontrado');
        return;
      }
      setProducto(prod);
      setEstado('listo');
    });
  }, [id]);

  if (estado === 'revisando') return null;

  if (estado === 'no-encontrado' || !producto) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-gray-500">Este producto ya no está disponible.</p>
      </div>
    );
  }

  return (
    <ViewProductosModal
      producto={producto}
      dataUser={dataUser}
      initialView="store"
      onClose={() => window.history.back()}
    />
  );
}
