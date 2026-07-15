'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchMisProductosTienda, eliminarProductoDeTienda, type MiProductoTienda } from '@/lib/bodega';
import { formatCOP } from '@/lib/cartStore';
import { ViewProductosModal } from '@/components/ViewProductosModal';
import { useToast, Toast } from '@/components/Toast';

// Port de MyProductsComponent (Angular, "/config/store/myproducts") -- productos que el usuario ya
// agrego a su tienda (revender con su propio precio, price_overrides). ProductoService.getPriceArticle
// / updatePriceArticle ya estaban bien implementados, sin bugs. "Ver/editar" reusa ViewProductosModal
// (ya resuelve el price_override existente por su cuenta via idMyProduct).

const LIMIT = 24;

export default function MyProductsPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [productos, setProductos] = useState<MiProductoTienda[]>([]);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [productoAbierto, setProductoAbierto] = useState<MiProductoTienda | null>(null);

  async function cargar(userId: string, page: number, reemplazar: boolean) {
    const res = await fetchMisProductosTienda(userId, page, LIMIT);
    setProductos((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((p) => p.priceOverrideId));
      return [...base, ...res.data.filter((p) => !existentes.has(p.priceOverrideId))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      await cargar(usuario.id, 0, true);
      setEstado('listo');
    });
  }, []);

  async function eliminar(item: MiProductoTienda) {
    if (!window.confirm('Deseas Eliminar Dato')) return;
    const ok = await eliminarProductoDeTienda(item.priceOverrideId);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setProductos((prev) => prev.filter((p) => p.priceOverrideId !== item.priceOverrideId));
    mostrar('Este Producto Esta Eliminado de tu Tienda!!!');
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Mis Productos en mi Tienda</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {productos.map((item) => (
            <div key={item.priceOverrideId} className="rounded-xl border border-gray-100 p-2 shadow-sm">
              <button onClick={() => setProductoAbierto(item)} className="block w-full text-left">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto de producto (Supabase Storage) */}
                <img src={item.producto.foto} alt={item.producto.pro_nombre} className="h-28 w-full rounded object-cover" />
                <p className="mt-1 truncate text-xs font-medium text-gray-800">{item.producto.pro_nombre.slice(0, 20)}</p>
                <p className="text-xs text-gray-500">$ {formatCOP(item.precio)}</p>
              </button>
              <button
                onClick={() => eliminar(item)}
                className="mt-1 flex w-full items-center justify-center gap-1 rounded bg-[#dc3545] px-2 py-1 text-xs font-medium text-white"
              >
                <Trash2 className="h-3 w-3" /> Eliminar
              </button>
            </div>
          ))}
        </div>
        {productos.length === 0 && <p className="py-10 text-center text-gray-500">Todavía no has agregado productos a tu tienda.</p>}

        {notEmptyPost && productos.length > 0 && (
          <div className="mt-4 text-center">
            <button
              onClick={async () => {
                setCargandoMas(true);
                await cargar(dataUser.id, page + 1, false);
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

      <Toast mensaje={mensaje} />

      {productoAbierto && (
        <ViewProductosModal
          producto={productoAbierto.producto}
          dataUser={dataUser}
          initialView="store"
          onClose={() => {
            setProductoAbierto(null);
            cargar(dataUser.id, 0, true);
          }}
        />
      )}
    </div>
  );
}
