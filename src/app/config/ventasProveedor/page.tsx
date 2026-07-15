'use client';

import { useEffect, useState } from 'react';
import { MessageCircle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchVentasProveedor, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port de VentasProveedorComponent (Angular). Casi todo el componente original esta comentado en
// el codigo fuente (busqueda, filtro por estado/fecha, "crear", "dar puntos", "eliminar") -- es
// codigo muerto que nunca corre. El unico metodo real que se ejecuta (ngOnInit) llama a
// `VentasService.getVentasProveedores`, que a su vez ignora el filtro que aparenta aplicar y
// siempre devuelve los ultimos 200 pedidos no eliminados de toda la plataforma (ver
// src/lib/ventas.ts, fetchVentasProveedor). Se replica ese mismo comportamiento real, sin
// reconstruir la UI de busqueda/filtros que nunca funciono. "Ver" reusa FormVentaDetalleModal
// (mismo dialogo de detalle+guia ya construido para /config/ventas) en vez del formulario viejo de
// Coordinadora.

export default function VentasProveedorPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  async function cargar() {
    setVentas(await fetchVentasProveedor());
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      await cargar();
      setEstado('listo');
    });
  }, []);

  function enviarGuiaWhatsapp(row: VentaRow) {
    const numero = (row.telefonoCliente || '').replace(/\D/g, '');
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia} <-- `)}`;
    window.open(url);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Ventas Proveedor</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Nombre Cliente</th>
                <th className="py-2 pr-3">Teléfono Cliente</th>
                <th className="py-2 pr-3">Fecha Venta</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Vendedor</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="space-y-1 py-2 pr-3">
                    <button onClick={() => setVentaAbierta(row.id)} className="flex items-center gap-1 rounded bg-[#0d6efd] px-2 py-1 text-xs font-medium text-white">
                      <Eye className="h-3 w-3" /> Ver
                    </button>
                    {row.numeroGuia && (
                      <button onClick={() => enviarGuiaWhatsapp(row)} className="flex items-center gap-1 rounded bg-[#ffc107] px-2 py-1 text-xs font-medium text-gray-900">
                        <MessageCircle className="h-3 w-3" /> Enviar Guía
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-3">{row.nombreCliente}</td>
                  <td className="py-2 pr-3">{row.telefonoCliente}</td>
                  <td className="py-2 pr-3 text-xs">{new Date(row.fecha).toLocaleString('es-CO')}</td>
                  <td className="py-2 pr-3 text-xs font-medium">{VENTA_ESTADO_LABEL[row.estado]}</td>
                  <td className="py-2 pr-3 text-xs text-gray-600">{row.vendedorNombre || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {ventas.length === 0 && <p className="py-10 text-center text-gray-500">No hay ventas para mostrar.</p>}
        </div>
      </div>

      {ventaAbierta != null && (
        <FormVentaDetalleModal
          orderId={ventaAbierta}
          esAdmin
          onClose={() => setVentaAbierta(null)}
          onCambio={cargar}
        />
      )}
    </div>
  );
}
