'use client';

import { use, useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { fetchVentaDetalle, type VentaDetalle } from '@/lib/ventas';
import { formatCOP } from '@/lib/cartStore';

// Comprobante de envío propio de LokomproAqui (pedido explicito del usuario 2026-07-29): la API de
// Mipaquete NO expone ningun endpoint para descargar la etiqueta oficial con codigo de barras
// (probado contra un pedido real con guia ya generada: 20 nombres de endpoint candidatos, todos
// 404 "Service Not Found") -- confirma lo que ya se habia investigado antes en este proyecto (ver
// [[lokomproaqui_nextjs_migration]], seccion "formato de impresion"). Esto NO reemplaza esa
// etiqueta oficial (el mensajero la sigue necesitando para escanear) -- es un comprobante interno
// para que el proveedor sepa que pedido va en cada paquete al empacar, con el numero de guia bien
// visible para escribirlo/pegarlo a mano si hace falta.
//
// incluirVendedor=false en cada fetchVentaDetalle: mismo criterio de aislamiento proveedor<->
// vendedor de siempre -- el proveedor imprime esto desde SU panel, nunca debe ver quien revendio.

export default function ImprimirGuiasPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = use(searchParams);
  const [ventas, setVentas] = useState<VentaDetalle[]>([]);
  const [estado, setEstado] = useState<'cargando' | 'listo'>('cargando');

  useEffect(() => {
    const orderIds = (ids || '')
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n));
    if (!orderIds.length) {
      setEstado('listo');
      return;
    }
    Promise.all(orderIds.map((id) => fetchVentaDetalle(id, false))).then((res) => {
      setVentas(res.filter((v): v is VentaDetalle => !!v));
      setEstado('listo');
    });
  }, [ids]);

  if (estado === 'cargando') return <p className="py-16 text-center text-sm text-gray-500">Cargando…</p>;
  if (!ventas.length) return <p className="py-16 text-center text-sm text-gray-500">No hay pedidos para imprimir.</p>;

  return (
    <div className="mx-auto w-full max-w-[800px] px-4 py-6">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="text-lg font-bold text-gray-800">Comprobantes de envío ({ventas.length})</h1>
        <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-lg bg-[#0d6efd] px-4 py-2 text-sm font-bold text-white">
          <Printer className="h-4 w-4" /> Imprimir
        </button>
      </div>

      {ventas.map((v, i) => (
        <div key={v.id} className={`rounded-xl border border-gray-200 p-5 print:rounded-none print:border-0 print:p-0 ${i > 0 ? 'mt-6 print:mt-0' : ''}`} style={i < ventas.length - 1 ? { breakAfter: 'page' } : undefined}>
          <div className="flex items-center justify-between border-b border-dashed border-gray-300 pb-3">
            <div>
              <p className="text-lg font-extrabold text-gray-900">LokomproAqui</p>
              <p className="text-xs text-gray-500">Comprobante de envío · Pedido #{v.id}</p>
            </div>
            {v.transportadoraLogo && (
              // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
              <img src={v.transportadoraLogo} alt="" className="h-10 w-10 rounded bg-white object-contain" />
            )}
          </div>

          <div className="mt-3 rounded-lg bg-gray-50 p-3 text-center print:border print:border-gray-300">
            <p className="text-xs font-semibold text-gray-500">Número de guía</p>
            <p className="text-2xl font-extrabold tracking-wide text-gray-900">{v.numeroGuia || '—'}</p>
            <p className="text-xs text-gray-500">{v.transportadora || 'Transportadora sin confirmar'}</p>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Destinatario</h3>
            <p className="mt-1 text-sm font-semibold text-gray-800">{v.nombreCliente || '—'}</p>
            <p className="text-sm text-gray-600">{v.telefonoCliente || '—'}</p>
            <p className="text-sm text-gray-600">
              {v.direccionCliente || '—'}
              {v.barrio ? `, ${v.barrio}` : ''}
              {v.ciudad ? `, ${v.ciudad}` : ''}
            </p>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">Productos</h3>
            <table className="mt-1 w-full text-sm">
              <tbody>
                {v.items.map((it) => (
                  <tr key={it.id} className="border-t border-gray-100">
                    <td className="py-1.5">{it.titulo}</td>
                    <td className="py-1.5 text-gray-500">
                      {it.talla || ''} {it.color ? `/ ${it.color}` : ''}
                    </td>
                    <td className="py-1.5 text-right">x{it.cantidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 border-t border-dashed border-gray-300 pt-2 text-right text-sm font-bold text-gray-800">
            Total: $ {formatCOP(v.precioTotal)}
          </p>
        </div>
      ))}
    </div>
  );
}
