'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import {
  fetchReacaudoPendiente,
  fetchGuiasDespachadas,
  fetchGuiasPorImprimir,
  fetchGuiasPagadas,
  fetchGuiasEnDevolucion,
  fetchGuiasEnPreparacion,
} from '@/lib/misDespacho';
import { TableDespachoPanel } from '@/components/TableDespachoPanel';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port de MisDespachoComponent (Angular, panel de proveedor "Mis Despacho"). Ver
// src/lib/misDespacho.ts para el detalle: los 6 metodos que respaldan esto ya estaban bien
// conectados en el backend, se portan 1:1. "Crear/Imprimir Guía" (sistema viejo de Coordinadora,
// ya confirmado roto al portar /config/ventas) se reemplaza por el mismo dialogo real de detalle
// que ya abre /config/ventas (genera guía real via Mipaquete).

const TABS = [
  { key: 'porImprimir', label: 'GUÍAS POR IMPRIMIR' },
  { key: 'preparacion', label: 'GUÍAS EN PREPARACIÓN' },
  { key: 'despachadas', label: 'GUÍAS DESPACHADAS' },
  { key: 'pagadas', label: 'GUÍAS PAGADAS AL PROVEEDOR' },
  { key: 'devolucion', label: 'GUÍAS EN DEVOLUCIÓN' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function MisDespachoPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [reacaudo, setReacaudo] = useState(0);
  const [tab, setTab] = useState<TabKey>('porImprimir');
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setEstado('listo');
      setReacaudo(await fetchReacaudoPendiente(usuario.id));
    });
  }, []);

  if (estado === 'revisando' || !dataUser) return null;

  function cargarTab() {
    if (!dataUser) return Promise.resolve({ data: [], total: 0 });
    if (tab === 'porImprimir') return fetchGuiasPorImprimir(dataUser.id);
    if (tab === 'preparacion') return fetchGuiasEnPreparacion(dataUser.id);
    if (tab === 'despachadas') return fetchGuiasDespachadas(dataUser.id);
    if (tab === 'pagadas') return fetchGuiasPagadas(dataUser.id);
    return fetchGuiasEnDevolucion(dataUser.id);
  }

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Estado de la venta</h4>
        <p className="mt-1 text-sm opacity-90">Reacaudo pendiente para pagar: $ {reacaudo.toLocaleString('es-CO')} COP</p>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={`px-3 py-2 text-xs font-semibold ${tab === t.key ? 'border-b-2 border-[#0d6efd] text-[#0d6efd]' : 'text-gray-500'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <TableDespachoPanel key={tab} cargar={cargarTab} onVerVenta={(id) => setVentaAbierta(id)} />
      </div>

      {ventaAbierta != null && (
        <FormVentaDetalleModal
          orderId={ventaAbierta}
          esAdmin={dataUser.rolname === 'administrador'}
          esProveedor={dataUser.rolname === 'proveedor'}
          onClose={() => setVentaAbierta(null)}
          onCambio={() => {}}
        />
      )}
    </div>
  );
}
