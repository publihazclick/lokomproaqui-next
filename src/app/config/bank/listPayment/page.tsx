'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import { fetchPagosProveedor, fetchItemsPago, type PagoProveedor, type ItemPago } from '@/lib/bank';
import { formatCOP } from '@/lib/cartStore';

// Port de ListPaymentComponent (Angular, "/config/bank/listPayment") -- historial de pagos ya
// realizados/pendientes al proveedor. "Ver detalle" reusa fetchItemsPago (order_items.supplier_payout_id),
// que solo tiene datos reales para pagos aprobados con el nuevo RPC process_supplier_payout (ver
// lib/bank.ts) -- para pagos viejos anteriores a ese arreglo, la lista queda vacia (no hay forma de
// reconstruir ese vinculo retroactivamente).

export default function ListPaymentPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [pagos, setPagos] = useState<PagoProveedor[]>([]);
  const [detalle, setDetalle] = useState<{ pago: PagoProveedor; items: ItemPago[] } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario: DataUserCompleto = await fetchDataUserCompleto(sessionData.session.user.id);
      setPagos(await fetchPagosProveedor(usuario.id));
      setEstado('listo');
    });
  }, []);

  async function verDetalle(pago: PagoProveedor) {
    setDetalle({ pago, items: await fetchItemsPago(pago.id) });
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[900px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Historial de Pagos</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Monto retirado</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Fecha pago</th>
                <th className="py-2 pr-3">Comprobante</th>
              </tr>
            </thead>
            <tbody>
              {pagos.map((p) => (
                <tr key={p.id} className="cursor-pointer border-b border-gray-100 hover:bg-gray-50" onClick={() => verDetalle(p)}>
                  <td className="py-2 pr-3">$ {formatCOP(p.monto)}</td>
                  <td className="py-2 pr-3">{p.estado === 1 ? <span className="text-green-700">Pagado</span> : <span className="text-amber-600">Pendiente</span>}</td>
                  <td className="py-2 pr-3">{p.fechaPago ? new Date(p.fechaPago).toLocaleString('es-CO') : '—'}</td>
                  <td className="py-2 pr-3">
                    {p.foto ? (
                      <a href={p.foto} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[#0d6efd] hover:underline">
                        Ver
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pagos.length === 0 && <p className="py-10 text-center text-gray-500">No hay pagos para mostrar.</p>}
        </div>
      </div>

      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">Detalle del pago — $ {formatCOP(detalle.pago.monto)}</h3>
              <button onClick={() => setDetalle(null)}>
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            {detalle.items.length === 0 ? (
              <p className="text-sm text-gray-400">No hay ventas vinculadas a este pago.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                    <th className="py-2 pr-3">Producto</th>
                    <th className="py-2 pr-3">Talla</th>
                    <th className="py-2 pr-3">Color</th>
                    <th className="py-2 pr-3">Cantidad</th>
                    <th className="py-2 pr-3">Ganancia</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((i) => (
                    <tr key={i.id} className="border-b border-gray-100">
                      <td className="py-2 pr-3">{i.nombreProducto}</td>
                      <td className="py-2 pr-3">{i.talla || '—'}</td>
                      <td className="py-2 pr-3">{i.color || '—'}</td>
                      <td className="py-2 pr-3">{i.cantidad}</td>
                      <td className="py-2 pr-3">$ {formatCOP(i.gananciaVendedor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
