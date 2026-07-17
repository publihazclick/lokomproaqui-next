'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, Eye, Trash2, MessageCircle, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, fetchVendedores, type DataUserCompleto, type VendedorBasico } from '@/lib/usuarios';
import { fetchVentas, refreshTracking, eliminarVenta, VENTA_ESTADOS, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port de "Autorizar Despacho" (menu) / VentasClienteComponent (Angular, "Ventas Posibles").
// Pedido explicito del usuario 2026-07-17 (segunda vuelta, con capturas reales de referencia): la
// quiere con la MISMA riqueza visual que "Historial de Ventas" (filtros de Vendedor/Estado/Fechas,
// boton "borrar Filtros", y las mismas 9 columnas: Acciones/Numero Guia/Re: Producto/Nombre de la
// tienda/Fecha Venta/Estado/Estado Envío/Pagado/Ganancia) -- se replica esa misma estructura aca,
// con el filtro por defecto en "Pendiente" (el proposito real de esta pantalla: autorizar
// despachos pendientes) y el badge de accion "Debes generar la guia" tal como la referencia.
const LIMIT = 15;

function haceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function VentasPosiblesPage() {
  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [vendedores, setVendedores] = useState<VendedorBasico[]>([]);
  const [vendedorFiltro, setVendedorFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('0');
  const [fechaInicio, setFechaInicio] = useState(haceDias(30));
  const [fechaFinal, setFechaFinal] = useState(haceDias(0));
  const [busqueda, setBusqueda] = useState('');

  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [actualizandoTracking, setActualizandoTracking] = useState<Record<number, boolean>>({});
  const [checks, setChecks] = useState<Set<number>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  const dataUserRef = useRef<DataUserCompleto | null>(null);

  const cargar = useCallback(async (paginaActual: number, termino: string) => {
    if (!dataUserRef.current) return;
    setCargando(true);
    const esAdmin = dataUserRef.current.rolname === 'administrador';
    const res = await fetchVentas({
      sellerId: esAdmin ? vendedorFiltro || undefined : dataUserRef.current.id,
      estadoFiltro: termino.trim() ? 'todos' : estadoFiltro || 'todos',
      fechaInicio: fechaInicio || undefined,
      fechaFinal: fechaFinal || undefined,
      search: termino.trim() || undefined,
      page: paginaActual,
      limit: LIMIT,
    });
    setVentas(res.data);
    setCount(res.count);
    setChecks(new Set());
    setCargando(false);
    setPage(paginaActual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendedorFiltro, estadoFiltro, fechaInicio, fechaFinal]);

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
      cargar(0, '');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, []);

  function buscar() {
    cargar(0, busqueda);
  }

  function borrarFiltros() {
    setVendedorFiltro('');
    setEstadoFiltro('0');
    setFechaInicio(haceDias(30));
    setFechaFinal(haceDias(0));
    setBusqueda('');
    cargar(0, '');
  }

  async function actualizarTracking(row: VentaRow) {
    if (actualizandoTracking[row.id]) return;
    setActualizandoTracking((prev) => ({ ...prev, [row.id]: true }));
    const res = await refreshTracking(row.id);
    setActualizandoTracking((prev) => ({ ...prev, [row.id]: false }));
    if (!res.success) {
      alert(res.message || 'No pudimos actualizar el estado');
      return;
    }
    setVentas((prev) => prev.map((v) => (v.id === row.id ? { ...v, trackingStatus: res.estado ?? v.trackingStatus, trackingSyncedAt: new Date().toISOString() } : v)));
  }

  function enviarGuiaWhatsapp(row: VentaRow) {
    const numero = (row.telefonoCliente || '').replace(/\D/g, '');
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia || ''} <-- `)}`;
    window.open(url);
  }

  function cambiarPagina(nueva: number) {
    cargar(nueva, busqueda);
  }

  function toggleCheck(id: number) {
    setChecks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminarSeleccionadas() {
    if (checks.size === 0) return;
    if (!confirm('¿Desea Eliminar Dato?')) return;
    setEliminando(true);
    for (const id of checks) {
      const res = await eliminarVenta(id);
      if (!res.success) alert(res.message || 'Error de servidor');
    }
    setEliminando(false);
    cargar(page, busqueda);
  }

  if (estado === 'revisando') return null;

  const totalPaginas = Math.max(1, Math.ceil(count / LIMIT));
  const desde = count === 0 ? 0 : page * LIMIT + 1;
  const hasta = Math.min(count, page * LIMIT + LIMIT);

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="border-b border-gray-200 pb-3">
        <h4 className="text-lg font-bold text-gray-900">Ventas Posibles</h4>
      </div>

      <div className="mt-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && buscar()}
          placeholder="Buscar Ventas"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-2">
        <button type="button" onClick={buscar} disabled={cargando} className="rounded bg-[#0d6efd] p-2.5 text-white disabled:opacity-60">
          <Search className="h-4 w-4" />
        </button>
      </div>

      {esAdmin && (
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-gray-700">Vendedor</label>
          <select value={vendedorFiltro} onChange={(e) => setVendedorFiltro(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value="">Vendedor</option>
            {vendedores.map((v) => (
              <option key={v.id} value={v.id}>
                {v.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Estado de la venta</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            {VENTA_ESTADOS.filter((op) => op.value !== 'todos').map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Inicial</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Fecha Final</label>
          <input type="date" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="mt-3">
        <button type="button" onClick={borrarFiltros} className="rounded bg-[#dc3545] px-4 py-2 text-sm font-medium text-white">
          borrar Filtros
        </button>
      </div>

      <div className="mt-3 flex items-start gap-2">
        <button type="button" onClick={buscar} disabled={cargando} title="Refresh" className="rounded bg-[#0d6efd] p-2.5 text-white disabled:opacity-60">
          <Eye className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={eliminarSeleccionadas}
          disabled={eliminando || checks.size === 0}
          title="Erase"
          className="rounded bg-[#dc3545] p-2.5 text-white disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {cargando ? (
          <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
        ) : (
          <table className="w-full min-w-[1100px] text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm font-bold text-gray-900">
                <th className="py-2 pr-2"></th>
                <th className="py-2 pr-3">Acciones</th>
                <th className="py-2 pr-3">Numero Guia</th>
                <th className="py-2 pr-3">Re: Producto</th>
                <th className="py-2 pr-3">Nombre de la tienda</th>
                <th className="py-2 pr-3">Fecha Venta</th>
                <th className="py-2 pr-3">Estado</th>
                <th className="py-2 pr-3">Estado Envío</th>
                <th className="py-2 pr-3">Pagado</th>
                <th className="py-2 pr-3">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {ventas.map((row) => (
                <tr key={row.id} className="border-b border-gray-100">
                  <td className="py-3 pr-2 align-top">
                    <input type="checkbox" checked={checks.has(row.id)} onChange={() => toggleCheck(row.id)} />
                  </td>
                  <td className="space-y-1 py-3 pr-3 align-top">
                    {row.estado !== 5 && (
                      <>
                        {!row.numeroGuia && (
                          <div className="mb-1 inline-block rounded bg-[#dfdfdf] px-2 py-1 text-xs font-medium text-[#ffc107]">Debes generar la guia</div>
                        )}
                        <div>
                          <button type="button" onClick={() => setVentaAbierta(row.id)} className="rounded bg-[#0d6efd] p-2 text-white">
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                        {row.numeroGuia && (
                          <button
                            type="button"
                            onClick={() => actualizarTracking(row)}
                            disabled={actualizandoTracking[row.id]}
                            className="flex items-center gap-1 rounded bg-[#0dcaf0] px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                          >
                            <RefreshCw className="h-3 w-3" /> {actualizandoTracking[row.id] ? 'Actualizando…' : 'Actualizar estado'}
                          </button>
                        )}
                        {row.numeroGuia && (
                          <button type="button" onClick={() => enviarGuiaWhatsapp(row)} className="mt-1 flex items-center gap-1 rounded bg-[#ffc107] px-2 py-1 text-xs font-medium text-gray-900">
                            <MessageCircle className="h-3 w-3" /> Enviar Guia ( cliente )
                          </button>
                        )}
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-3 align-top">{row.numeroGuia}</td>
                  <td className="py-3 pr-3 align-top text-xs text-gray-600">
                    <p>{row.vendedorNombre}</p>
                    <p>+{row.vendedorTelefono}</p>
                    <p>{row.vendedorCiudad}</p>
                  </td>
                  <td className="py-3 pr-3 align-top">{row.nombreCliente}</td>
                  <td className="py-3 pr-3 align-top">{new Date(row.fecha).toLocaleString('es-CO')}</td>
                  <td className="py-3 pr-3 align-top">{VENTA_ESTADO_LABEL[row.estado]}</td>
                  <td className="py-3 pr-3 align-top">
                    {!row.numeroGuia && <span>Sin guía aún</span>}
                    {row.numeroGuia && !row.trackingStatus && <span>Sin datos aún</span>}
                    {row.trackingStatus && (
                      <>
                        {row.trackingStatus}
                        <br />
                        <span className="text-xs text-gray-500">{row.trackingSyncedAt ? new Date(row.trackingSyncedAt).toLocaleString('es-CO') : ''}</span>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-3 align-top">{row.retirado ? 'Pagado' : ''}</td>
                  <td className="py-3 pr-3 align-top">{row.motivoRechazo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!cargando && ventas.length === 0 && <p className="py-10 text-center text-gray-500">No hay ventas para mostrar.</p>}
      </div>

      {!cargando && count > 0 && (
        <div className="mt-4 flex flex-row-reverse items-center gap-3 text-sm text-gray-600">
          <button type="button" onClick={() => cambiarPagina(page + 1)} disabled={page + 1 >= totalPaginas} className="rounded p-1 disabled:opacity-30">
            ›
          </button>
          <span>
            {desde}–{hasta} de {count}
          </span>
          <button type="button" onClick={() => cambiarPagina(page - 1)} disabled={page === 0} className="rounded p-1 disabled:opacity-30">
            ‹
          </button>
        </div>
      )}

      {ventaAbierta != null && (
        <FormVentaDetalleModal
          orderId={ventaAbierta}
          esAdmin={dataUser?.rolname === 'administrador'}
          onClose={() => setVentaAbierta(null)}
          onCambio={() => cargar(page, busqueda)}
        />
      )}
    </div>
  );
}
