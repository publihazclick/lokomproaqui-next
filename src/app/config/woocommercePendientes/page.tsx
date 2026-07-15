'use client';

import { useEffect, useState } from 'react';
import { Store, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchWoocommercePendingOrders, buscarProductoParaWoocommerce, resolverPedidoWoocommerce, type WoocommercePendingOrder } from '@/lib/woocommerce';
import type { ProductoLegacy } from '@/lib/productos';
import { useToast, Toast } from '@/components/Toast';

// Port de WoocommercePendingComponent (Angular, "/config/woocommercePendientes") -- mismo mecanismo
// que /config/shopifyPendientes (ver ahi), sin bugs reales.

export default function WoocommercePendingPage() {
  const { mensaje, mostrar } = useToast();
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [pedidos, setPedidos] = useState<WoocommercePendingOrder[]>([]);
  const [resultados, setResultados] = useState<Record<string, ProductoLegacy[]>>({});
  const [guardandoId, setGuardandoId] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setPedidos(await fetchWoocommercePendingOrders(usuario.id));
      setEstado('listo');
    });
  }, []);

  async function buscar(term: string, pendingId: number, itemIndex: number) {
    const key = `${pendingId}_${itemIndex}`;
    if (!term || term.length < 2) {
      setResultados((prev) => ({ ...prev, [key]: [] }));
      return;
    }
    const res = await buscarProductoParaWoocommerce(term);
    setResultados((prev) => ({ ...prev, [key]: res }));
  }

  function seleccionar(pendingId: number, itemIndex: number, producto: ProductoLegacy) {
    setPedidos((prev) =>
      prev.map((p) => {
        if (p.id !== pendingId) return p;
        const items = p.items.map((it, i) =>
          i === itemIndex
            ? {
                ...it,
                product_id: producto.id,
                product_variant_id: null,
                _productoNombre: producto.pro_nombre,
                _variantes: producto.listColor.flatMap((grupo) =>
                  grupo.tallaSelect.map((v) => ({ id: v.id, label: [grupo.talla, v.tal_descripcion].filter((x) => x && x !== 'unico').join(' - ') || 'Unica' })),
                ),
              }
            : it,
        );
        return { ...p, items };
      }),
    );
    setResultados((prev) => ({ ...prev, [`${pendingId}_${itemIndex}`]: [] }));
  }

  function setVariante(pendingId: number, itemIndex: number, variantId: number) {
    setPedidos((prev) =>
      prev.map((p) => (p.id !== pendingId ? p : { ...p, items: p.items.map((it, i) => (i === itemIndex ? { ...it, product_variant_id: variantId } : it)) })),
    );
  }

  function todoListo(pending: WoocommercePendingOrder): boolean {
    return pending.items.every((it) => !!it.product_id);
  }

  async function confirmar(pending: WoocommercePendingOrder) {
    if (!dataUser) return;
    if (!todoListo(pending)) {
      mostrar('Falta relacionar algun producto antes de confirmar');
      return;
    }
    setGuardandoId(pending.id);
    const res = await resolverPedidoWoocommerce(pending, dataUser.id, pending.items);
    setGuardandoId(null);
    if (!res.success) {
      mostrar(res.message || 'No se pudo crear el pedido');
      return;
    }
    mostrar('Pedido creado y enviado a Autorizar Despacho');
    setPedidos((prev) => prev.filter((p) => p.id !== pending.id));
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-6">
      <div className="rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center gap-2 rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
          <Store className="h-5 w-5" />
          <h4 className="text-lg font-bold">Pedidos WooCommerce por Revisar</h4>
        </div>
        <div className="p-5">
          {pedidos.length === 0 && <p className="py-10 text-center text-gray-500">No hay pedidos de WooCommerce pendientes por revisar.</p>}

          <div className="space-y-4">
            {pedidos.map((pending) => (
              <div key={pending.id} className="rounded-lg border border-gray-200 p-4">
                <h5 className="font-semibold text-gray-800">Pedido WooCommerce {pending.woocommerce_order_number || pending.woocommerce_order_id}</h5>
                <p className="mt-1 text-sm text-gray-600">
                  Cliente: <b>{pending.buyer_name}</b> — Tel: {pending.buyer_phone}
                  <br />
                  Direccion: {pending.buyer_address}, {pending.buyer_city}
                </p>
                <p className="mt-2 flex items-center gap-1 text-sm text-red-600">
                  <AlertTriangle className="h-4 w-4" /> Algunos productos de este pedido no se pudieron identificar automaticamente. Relacionalos abajo (solo tienes que hacerlo una vez por
                  producto).
                </p>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[700px] text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                        <th className="py-2 pr-3">Producto (WooCommerce)</th>
                        <th className="py-2 pr-3">SKU</th>
                        <th className="py-2 pr-3">Cant.</th>
                        <th className="py-2 pr-3">Precio</th>
                        <th className="py-2 pr-3">Producto en LokomproAqui</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pending.items.map((item, i) => {
                        const key = `${pending.id}_${i}`;
                        return (
                          <tr key={i} className="border-b border-gray-100 align-top">
                            <td className="py-2 pr-3">{item.title}</td>
                            <td className="py-2 pr-3">{item.sku || '(sin SKU)'}</td>
                            <td className="py-2 pr-3">{item.quantity}</td>
                            <td className="py-2 pr-3">$ {Number(item.unit_price).toLocaleString('es-CO')}</td>
                            <td className="py-2 pr-3">
                              {item.product_id ? (
                                <div className="text-green-700">
                                  <p className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" /> {item._productoNombre || 'Ya relacionado'}
                                  </p>
                                  {item._variantes && item._variantes.length > 0 && (
                                    <select
                                      value={item.product_variant_id ?? ''}
                                      onChange={(e) => setVariante(pending.id, i, Number(e.target.value))}
                                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs"
                                    >
                                      <option value="">Elige la talla/variante</option>
                                      {item._variantes.map((v) => (
                                        <option key={v.id} value={v.id}>
                                          {v.label}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ) : (
                                <div>
                                  <input
                                    type="text"
                                    placeholder="Buscar producto por nombre o codigo..."
                                    onChange={(e) => buscar(e.target.value, pending.id, i)}
                                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-xs"
                                  />
                                  {resultados[key] && resultados[key].length > 0 && (
                                    <div className="mt-1 max-h-48 overflow-y-auto rounded border border-gray-100">
                                      {resultados[key].map((p) => (
                                        <button
                                          key={p.id}
                                          onClick={() => seleccionar(pending.id, i, p)}
                                          className="block w-full border-b border-gray-50 px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                                        >
                                          {p.pro_nombre} <span className="text-gray-400">({p.pro_codigo})</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <button
                  onClick={() => confirmar(pending)}
                  disabled={guardandoId === pending.id || !todoListo(pending)}
                  className="mt-3 rounded bg-[#0d6efd] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  Confirmar y crear pedido
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Toast mensaje={mensaje} />
    </div>
  );
}
