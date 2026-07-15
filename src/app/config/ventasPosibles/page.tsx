'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, fetchVendedores, type DataUserCompleto, type VendedorBasico } from '@/lib/usuarios';
import { fetchVentas, fetchMontosVenta, VENTA_ESTADOS, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port de VentasClienteComponent (Angular, "Posibles Ventas"). Historicamente una vista separada
// de VentasComponent (/config/ventas) pero sobre la misma fuente de datos (getPossibleSales era
// un alias directo de VentasService.get()) -- se reusa fetchVentas para el listado (mismos bugs ya
// corregidos ahi) con alcance de esta pantalla: por defecto solo "Pendiente" y una caja de "Total
// Utilidad de venta" real (fetchMontosVenta), que /config/ventas no tiene.
//
// Alcance recortado: multi-eliminar por checkbox y "Dar puntos" ya viven en /config/ventas -- no
// se duplican aca. Las acciones de guia "CORDINADORA" (imprimirFlete/imprimirEvidencia) son del
// sistema viejo confirmado muerto (ver lib/ventas.ts) -- solo se deja el envio de guia por
// WhatsApp, que si es real hoy con Mipaquete.

const COLOR_FILA: Record<number, string> = {
  0: '#83bafa',
  1: '#95ffac',
  2: '#ff7598',
  3: '#f6ffa8',
  5: '#fb1951',
};

const LIMIT = 15;

export default function VentasPosiblesPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [vendedores, setVendedores] = useState<VendedorBasico[]>([]);
  const [vendedorFiltro, setVendedorFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('0');

  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [totalUtilidad, setTotalUtilidad] = useState<number | null>(null);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  const dataUserRef = useRef<DataUserCompleto | null>(null);

  const cargar = useCallback(async (page: number, reemplazar: boolean) => {
    if (!dataUserRef.current) return;
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const sellerId = esAdmin ? vendedorFiltro || undefined : dataUserRef.current.id;
    const res = await fetchVentas({ sellerId, estadoFiltro, page, limit: LIMIT });
    setLoader(false);
    setVentas((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((v) => v.id));
      return [...base, ...res.data.filter((v) => !existentes.has(v.id))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
    if (sellerId) setTotalUtilidad(await fetchMontosVenta(sellerId, estadoFiltro));
    else setTotalUtilidad(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, vendedorFiltro, estadoFiltro]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      dataUserRef.current = usuario;
      setDataUser(usuario);
      if (usuario.rolname === 'administrador') setVendedores(await fetchVendedores());
      setEstado('listo');
    });
  }, []);

  useEffect(() => {
    if (estado === 'listo') cargar(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, vendedorFiltro, estadoFiltro]);

  function enviarGuiaWhatsapp(row: VentaRow) {
    const numero = (row.telefonoCliente || '').replace(/\D/g, '');
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia} <-- `)}`;
    window.open(url);
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Posibles Ventas</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {esAdmin && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Vendedor</label>
              <select value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
                <option value="">Todos</option>
                {vendedores.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Estado de la venta</label>
            <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm">
              {VENTA_ESTADOS.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>
          {totalUtilidad != null && (
            <div className="flex flex-col justify-center rounded-lg bg-green-50 px-3 py-2">
              <span className="text-xs text-gray-600">Total Utilidad de venta</span>
              <p className="text-lg font-bold text-green-700">$ {totalUtilidad.toLocaleString('es-CO')} COP</p>
            </div>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Nombre Cliente</th>
                  <th className="py-2 pr-3">Teléfono Cliente</th>
                  <th className="py-2 pr-3">Fecha Venta</th>
                  <th className="py-2 pr-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100" style={{ background: COLOR_FILA[row.estado] ? `${COLOR_FILA[row.estado]}33` : undefined }}>
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
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!cargando && ventas.length === 0 && <p className="py-10 text-center text-gray-500">No hay ventas para mostrar.</p>}
        </div>

        {!cargando && notEmptyPost && ventas.length > 0 && (
          <div className="mt-4 text-center">
            <button onClick={() => cargar(page + 1, false)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
              {cargandoMas ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </div>

      {ventaAbierta != null && (
        <FormVentaDetalleModal
          orderId={ventaAbierta}
          esAdmin={esAdmin}
          onClose={() => setVentaAbierta(null)}
          onCambio={() => cargar(0, true)}
        />
      )}
    </div>
  );
}
