'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Search, RefreshCw, MessageCircle, Trash2, Gift, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, fetchVendedores, type DataUserCompleto, type VendedorBasico } from '@/lib/usuarios';
import { fetchVentas, refreshTracking, eliminarVenta, VENTA_ESTADOS, VENTA_ESTADO_LABEL, type VentaRow } from '@/lib/ventas';
import { useToast, Toast } from '@/components/Toast';
import { FormPuntosModal } from '@/components/FormPuntosModal';
import { FormVentaDetalleModal } from '@/components/FormVentaDetalleModal';

// Port 1:1 (diseno) de VentasComponent (Angular, "Ventas" -- "Historial de Ventas" en el menu).
// Verificado contra una captura real del sitio Angular en vivo (lokomproaqui.vercel.app/config/ventas)
// el 2026-07-17, a pedido explicito del usuario (cero margen de error, los tutoriales del equipo
// se grabaron con esta interfaz).
//
// Hallazgo real MAS IMPORTANTE (confirmado leyendo el .html original linea por linea Y verificado
// contra la captura): 3 de los 9 encabezados de la tabla real de Angular NO corresponden a la
// columna que realmente muestran, porque el HTML tiene varias <td> comentadas que dejaron el
// array de headers desalineado de las celdas que en verdad se renderizan:
//   - Header "Re: Producto"        -> en realidad muestra los datos del VENDEDOR (fecha creacion,
//                                      nombre, telefono, ciudad) -- nunca datos de producto.
//   - Header "Nombre de la tienda" -> en realidad muestra el NOMBRE DEL CLIENTE (ven_nombre_cliente).
//   - Header "Ganancia"            -> en realidad muestra el MOTIVO DE RECHAZO (ven_motivo_rechazo).
// Se replica exactamente ese desalineamiento real, no la version "logica" que el nombre del
// encabezado sugeriria -- confirmado con una captura real donde una fila con datos de vendedor
// vacios se ve literalmente como un "+" suelto bajo "Re: Producto" (coincide exacto con el
// template real: "+{{indicativo}} {{telefono}}" con ambos vacios).
//
// Otros hallazgos reales de la captura:
// - Sin filtros por dropdown separados por "esAdmin": el vendedor (mal llamado "Re: Producto" en
//   el header) se muestra siempre, para cualquier rol -- no hay ningun *ngIf en esa celda real.
// - Boton "Dar puntos" es SOLO icono (regalo), sin texto, igual que buscar/refrescar/eliminar.
// - Boton "borrar Filtros" SI tiene texto visible (no es icono-only como los demas).
// - Fecha Inicial/Fecha Final: por defecto Fecha Inicial = hace 30 dias, Fecha Final = hoy (el
//   codigo real tiene los bindings cruzados con nombres de variable al reves, pero el resultado
//   visible neto es ese -- se replica el resultado visible, no la confusion interna de nombres).
// - Sin colores de fondo por estado en las filas -- no se ven aplicados en la captura real.
const LIMIT = 15;

function haceDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
}

export default function VentasPage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const esAdmin = dataUser?.rolname === 'administrador';

  const [vendedores, setVendedores] = useState<VendedorBasico[]>([]);
  const [vendedorFiltro, setVendedorFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [fechaInicio, setFechaInicio] = useState(haceDias(30));
  const [fechaFinal, setFechaFinal] = useState(haceDias(0));
  const [busqueda, setBusqueda] = useState('');

  const [ventas, setVentas] = useState<VentaRow[]>([]);
  const [page, setPage] = useState(0);
  const [notEmptyPost, setNotEmptyPost] = useState(true);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [actualizandoTracking, setActualizandoTracking] = useState<Record<number, boolean>>({});
  const [seleccionadas, setSeleccionadas] = useState<Set<number>>(new Set());
  const [eliminando, setEliminando] = useState(false);
  const [mostrarPuntos, setMostrarPuntos] = useState(false);
  const [ventaAbierta, setVentaAbierta] = useState<number | null>(null);

  const dataUserRef = useRef<DataUserCompleto | null>(null);

  const cargar = useCallback(async (page: number, reemplazar: boolean) => {
    if (!dataUserRef.current) return;
    const setLoader = page === 0 ? setCargando : setCargandoMas;
    setLoader(true);
    const res = await fetchVentas({
      sellerId: esAdmin ? vendedorFiltro || undefined : dataUserRef.current.id,
      estadoFiltro: estadoFiltro || 'todos',
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
      cargar(0, true);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, []);

  function buscar() {
    cargar(0, true);
  }

  function borrarFiltros() {
    setVendedorFiltro('');
    setEstadoFiltro('');
    setFechaInicio(haceDias(30));
    setFechaFinal(haceDias(0));
    setBusqueda('');
    cargar(0, true);
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
    const url = `https://wa.me/57${numero}?text=${encodeURIComponent(`Hola Cliente ${row.nombreCliente || ''} Este esta es tu guia --> ${row.numeroGuia || ''} <-- `)}`;
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
    if (!window.confirm('¿Deseas Eliminar Dato?')) return;
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
      <div className="border-b border-gray-200 pb-3">
        <h4 className="text-lg font-bold text-gray-900">Ventas</h4>
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

      <div className="mt-2 flex flex-wrap items-start gap-2">
        <button type="button" onClick={buscar} disabled={cargando} className="rounded bg-[#0d6efd] p-2.5 text-white disabled:opacity-60">
          <Search className="h-4 w-4" />
        </button>
        {esAdmin && (
          <button type="button" onClick={() => setMostrarPuntos(true)} title="Dar puntos" className="rounded bg-[#0d6efd] p-2.5 text-white">
            <Gift className="h-4 w-4" />
          </button>
        )}
      </div>

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

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Estado de la venta</label>
          <select value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} className="w-full rounded border border-gray-300 px-3 py-2 text-sm">
            <option value=""></option>
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
          disabled={eliminando || seleccionadas.size === 0}
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
                    <input type="checkbox" checked={seleccionadas.has(row.id)} onChange={() => toggleSeleccion(row.id)} />
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
                            className="block rounded bg-[#0dcaf0] px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                          >
                            {actualizandoTracking[row.id] ? 'Actualizando…' : 'Actualizar estado'}
                          </button>
                        )}
                        {row.numeroGuia && (
                          <button type="button" onClick={() => enviarGuiaWhatsapp(row)} className="mt-1 block rounded bg-[#ffc107] px-2 py-1 text-xs font-medium text-gray-900">
                            Enviar Guia ( cliente )
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

      {!cargando && notEmptyPost && ventas.length > 0 && (
        <div className="mt-4 text-center">
          <button onClick={() => cargar(page + 1, false)} disabled={cargandoMas} className="text-sm font-medium text-[#0d6efd] hover:underline disabled:opacity-60">
            {cargandoMas ? 'Cargando…' : 'Ver más'}
          </button>
        </div>
      )}

      <Toast mensaje={mensaje} />

      {mostrarPuntos && <FormPuntosModal onClose={() => setMostrarPuntos(false)} />}

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
