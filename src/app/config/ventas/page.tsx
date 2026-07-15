'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, MessageCircle, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, fetchVendedores, type DataUserCompleto, type VendedorBasico } from '@/lib/usuarios';
import { fetchVentas, refreshTracking, eliminarVenta, VENTA_ESTADOS, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { useToast, Toast } from '@/components/Toast';

// Port desde src/app/dashboard-config/components/ventas (Angular, VentasComponent) -- historial de
// pedidos/ventas. Ver src/lib/ventas.ts para el detalle completo de los bugs reales encontrados y
// corregidos (filtros de estado/fecha ignorados en silencio por el backend, columnas de vendedor
// siempre vacias, typo que dejaba "Pagado" siempre en blanco).
//
// Alcance recortado y documentado: el dialogo "Ver detalle" (FormventasComponent) y "Dar puntos"
// (FormpuntosComponent, bono manual del admin) quedan para una proxima pieza dedicada -- son sus
// propios formularios grandes. La columna "Evidencia Entrega" se omite: depende de un campo
// (`ven_imagen_tiket`) que nunca tuvo contraparte real en el esquema de Supabase.

const COLOR_FILA: Record<number, string> = {
  0: '#83bafa', // entrante/pendiente
  1: '#95ffac', // completado/exitosa
  2: '#ff7598', // devolucion/rechazada
  3: '#f6ffa8', // despachado
  5: '#fb1951', // eliminado
};

const LIMIT = 15;

export default function VentasPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [vendedores, setVendedores] = useState<VendedorBasico[]>([]);
  const [vendedorFiltro, setVendedorFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFinal, setFechaFinal] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [actualizandoTracking, setActualizandoTracking] = useState<Record<number, boolean>>({});
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [eliminando, setEliminando] = useState(false);

  const dataUserRef = useRef<DataUserCompleto | null>(null);

  const cargar = useCallback(async (page: number, reemplazar: boolean) => {
    if (!dataUserRef.current) return;
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchVentas({
      sellerId: esAdmin ? vendedorFiltro || undefined : dataUserRef.current.id,
      estadoFiltro,
      fechaInicio: fechaInicio || undefined,
      fechaFinal: fechaFinal || undefined,
      search: busqueda,
      page,
      limit: LIMIT,
    });
    setLoader(false);
    setVentas((prev) => {
      const base = reemplazar ? [] : prev;
      const existentes = new Set(base.map((v) => v.id));
      return [...base, ...res.data.filter((v) => !existentes.has(v.id))];
    });
    setNotEmptyPost(res.data.length > 0);
    setPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esAdmin, vendedorFiltro, estadoFiltro, fechaInicio, fechaFinal, busqueda]);

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
  }, [estado, vendedorFiltro, estadoFiltro, fechaInicio, fechaFinal]);

  function buscar() {
    cargar(0, true);
  }

  function borrarFiltros() {
    setVendedorFiltro('');
    setEstadoFiltro('todos');
    setFechaInicio('');
    setFechaFinal('');
    setBusqueda('');
  }

  async function actualizarTracking(row: VentaRow) {
    if (actualizandoTracking[row.id]) return;
    setActualizandoTracking((prev) => ({ ...prev, [row.id]: true }));
    const res = await refreshTracking(row.id);
    setActualizandoTracking((prev) => ({ ...prev, [row.id]: false }));
    if (!res.success) {
      mostrar(res.message || 'No pudimos actualizar el estado');
      return;
    }
    setVentas((prev) => prev.map((v) => (v.id === row.id ? { ...v, trackingStatus: res.estado ?? v.trackingStatus, trackingSyncedAt: new Date().toISOString() } : v)));
  }

  function enviarGuiaWhatsapp(row: VentaRow) {
    const numero = (row.telefonoCliente || '').replace(/\D/g, '');
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia} <-- `)}`;
    window.open(url);
  }

  function toggleSeleccion(id: number) {
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function eliminarSeleccionadas() {
    if (!seleccionadas.size) return;
    if (!window.confirm('Deseas Eliminar Dato')) return;
    setEliminando(true);
    for (const id of seleccionadas) {
      const res = await eliminarVenta(id);
      if (!res.success) {
        mostrar(res.message || 'Error de servidor');
        continue;
      }
      setVentas((prev) => prev.filter((v) => v.id !== id));
    }
    setSeleccionadas(new Set());
    setEliminando(false);
    mostrar('Eliminado');
  }

  if (estado === 'revisando') return null;

  return (
    <div className="mx-auto w-full max-w-[1320px] px-3 py-6">
      <div className="rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <h4 className="text-lg font-bold">Ventas</h4>
      </div>
      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
            placeholder="Buscar Ventas (teléfono, guía, id)"
            className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button onClick={buscar} disabled={cargando} className="rounded bg-[#0d6efd] px-3 py-2 text-sm text-white disabled:opacity-60">
            Buscar
          </button>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Fecha Inicial</label>
            <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-700">Fecha Final</label>
            <input type="date" value={fechaFinal} onChange={(e) => setFechaFinal(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-2 text-sm" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={borrarFiltros} className="rounded-full bg-[#dc3545] px-4 py-2 text-xs font-bold text-white hover:opacity-90">
            Borrar Filtros
          </button>
          {seleccionadas.size > 0 && (
            <button onClick={eliminarSeleccionadas} disabled={eliminando} className="flex items-center gap-1 rounded-full bg-[#dc3545] px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60">
              <Trash2 className="h-3.5 w-3.5" /> Eliminar ({seleccionadas.size})
            </button>
          )}
        </div>

        <div className="mt-4 overflow-x-auto">
          {cargando ? (
            <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>
          ) : (
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
                  <th className="py-2 pr-2"></th>
                  <th className="py-2 pr-3">Acciones</th>
                  <th className="py-2 pr-3">Numero Guia</th>
                  {esAdmin && <th className="py-2 pr-3">Vendedor</th>}
                  <th className="py-2 pr-3">Cliente</th>
                  <th className="py-2 pr-3">Fecha Venta</th>
                  <th className="py-2 pr-3">Estado</th>
                  <th className="py-2 pr-3">Estado Envío</th>
                  <th className="py-2 pr-3">Pagado</th>
                </tr>
              </thead>
              <tbody>
                {ventas.map((row) => (
                  <tr key={row.id} className="border-b border-gray-100" style={{ background: COLOR_FILA[row.estado] ? `${COLOR_FILA[row.estado]}33` : undefined }}>
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={seleccionadas.has(row.id)} onChange={() => toggleSeleccion(row.id)} />
                    </td>
                    <td className="space-y-1 py-2 pr-3">
                      {!row.numeroGuia && <p className="text-xs text-amber-600">Debes generar la guía</p>}
                      {row.numeroGuia && (
                        <button
                          onClick={() => actualizarTracking(row)}
                          disabled={actualizandoTracking[row.id]}
                          className="flex items-center gap-1 rounded bg-[#0dcaf0] px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          <RefreshCw className="h-3 w-3" /> {actualizandoTracking[row.id] ? 'Actualizando…' : 'Actualizar estado'}
                        </button>
                      )}
                      {row.numeroGuia && (
                        <button onClick={() => enviarGuiaWhatsapp(row)} className="flex items-center gap-1 rounded bg-[#ffc107] px-2 py-1 text-xs font-medium text-gray-900">
                          <MessageCircle className="h-3 w-3" /> Enviar Guía
                        </button>
                      )}
                    </td>
                    <td className="py-2 pr-3">{row.numeroGuia || '—'}</td>
                    {esAdmin && (
                      <td className="py-2 pr-3 text-xs text-gray-600">
                        <p className="font-medium text-gray-800">{row.vendedorNombre || '—'}</p>
                        <p>{row.vendedorTelefono}</p>
                        <p>{row.vendedorCiudad}</p>
                      </td>
                    )}
                    <td className="py-2 pr-3">{row.nombreCliente}</td>
                    <td className="py-2 pr-3 text-xs">{new Date(row.fecha).toLocaleString('es-CO')}</td>
                    <td className="py-2 pr-3 text-xs font-medium">{VENTA_ESTADO_LABEL[row.estado]}</td>
                    <td className="py-2 pr-3 text-xs">
                      {!row.numeroGuia && <span className="text-gray-400">Sin guía aún</span>}
                      {row.numeroGuia && !row.trackingStatus && <span className="text-gray-400">Sin datos aún</span>}
                      {row.trackingStatus && (
                        <>
                          {row.trackingStatus}
                          <br />
                          <span className="text-gray-400">{row.trackingSyncedAt ? new Date(row.trackingSyncedAt).toLocaleString('es-CO') : ''}</span>
                        </>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      {row.retirado ? <span className="text-xs font-medium text-green-700">Pagado</span> : <span className="text-xs text-gray-400">—</span>}
                    </td>
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

      <Toast mensaje={mensaje} />
    </div>
  );
}
