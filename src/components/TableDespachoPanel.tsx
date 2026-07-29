'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, RefreshCw, MessageCircle, Printer } from 'lucide-react';
import type { ItemDespacho } from '@/lib/misDespacho';
import { VENTA_ESTADO_LABEL } from '@/lib/ventas';

const COLOR_FILA: Record<number, string> = {
  0: '#83bafa33',
  1: '#95ffac33',
  2: '#ff759833',
  3: '#f6ffa833',
  6: '#dcedc133',
};

// Color del texto de "Estado de la orden" -- mismo criterio de la captura de referencia (Pendiente
// en rojo), extendido a los demas estados con el mismo espiritu (positivo=verde, en curso=ambar).
const COLOR_ESTADO: Record<number, string> = {
  0: '#dc2626',
  1: '#16a34a',
  2: '#dc2626',
  3: '#d97706',
  6: '#0d6efd',
};

interface TableDespachoPanelProps {
  cargar: () => Promise<{ data: ItemDespacho[]; total: number }>;
  mostrarTotal?: boolean;
  onVerVenta: (ventaId: number) => void;
}

const FILTROS_VACIOS = { refProducto: '', transportadora: '', numeroGuia: '', nombreVendedor: '', fechaInicial: '', fechaFinal: '' };

export function TableDespachoPanel({ cargar, mostrarTotal, onVerVenta }: TableDespachoPanelProps) {
  const [items, setItems] = useState<ItemDespacho[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());

  function toggleSeleccion(id: number) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // El "Actualizar" (boton, evento normal) reusa esta funcion y si necesita resetear cargando a
  // true de forma sincrona; el efecto de montaje de abajo NO la reusa a proposito (llamar una
  // funcion que hace setState sincrono dentro de un efecto dispara el lint
  // react-hooks/set-state-in-effect, mismo caso ya resuelto en FormVentaDetalleModal).
  function recargar() {
    setCargando(true);
    cargar().then((res) => {
      setItems(res.data);
      setTotal(res.total);
      setCargando(false);
    });
  }

  useEffect(() => {
    cargar().then((res) => {
      setItems(res.data);
      setTotal(res.total);
      setCargando(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pedido explicito del usuario 2026-07-29 (captura del panel viejo "Mis Despachos"): filtros por
  // ref producto / transportadora / # de guia / nombre del vendedor + rango de fechas. Se filtran
  // en el cliente sobre lo ya cargado de esta pestaña (misma logica ya usada en otras pantallas
  // pequeñas del proyecto) -- no hace falta una consulta nueva a Supabase por cada tecla.
  const itemsFiltrados = useMemo(() => {
    const desde = filtros.fechaInicial ? new Date(filtros.fechaInicial) : null;
    const hasta = filtros.fechaFinal ? new Date(filtros.fechaFinal) : null;
    if (hasta) hasta.setHours(23, 59, 59, 999);
    return items.filter((it) => {
      if (filtros.refProducto && !(it.productoCodigo || '').toLowerCase().includes(filtros.refProducto.toLowerCase()) && !it.productoNombre.toLowerCase().includes(filtros.refProducto.toLowerCase())) return false;
      if (filtros.transportadora && !(it.transportadora || '').toLowerCase().includes(filtros.transportadora.toLowerCase())) return false;
      if (filtros.numeroGuia && !(it.numeroGuia || '').toLowerCase().includes(filtros.numeroGuia.toLowerCase())) return false;
      if (filtros.nombreVendedor && !(it.vendedorNombre || '').toLowerCase().includes(filtros.nombreVendedor.toLowerCase())) return false;
      const fecha = new Date(it.fecha);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    });
  }, [items, filtros]);

  // Comprobante propio de LokomproAqui, no la etiqueta oficial de la transportadora -- ver
  // comentario completo en app/config/misDespacho/imprimir/page.tsx (Mipaquete no expone ningun
  // endpoint para descargar esa etiqueta). Un solo pedido puede tener varias filas aca (una por
  // producto/order_item) -- se deduplica por ventaId para no abrir el mismo comprobante repetido.
  function imprimirGuia(ventaId: number) {
    window.open(`/config/misDespacho/imprimir?ids=${ventaId}`, '_blank');
  }

  function imprimirSeleccionados() {
    const ids = Array.from(new Set(itemsFiltrados.filter((it) => seleccionados.has(it.id)).map((it) => it.ventaId)));
    if (!ids.length) return;
    window.open(`/config/misDespacho/imprimir?ids=${ids.join(',')}`, '_blank');
  }

  if (cargando) return <p className="py-10 text-center text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="mt-3">
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Filtrar por</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Ref Producto</label>
            <input value={filtros.refProducto} onChange={(e) => setFiltros({ ...filtros, refProducto: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Transportadora</label>
            <input value={filtros.transportadora} onChange={(e) => setFiltros({ ...filtros, transportadora: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500"># de guía</label>
            <input value={filtros.numeroGuia} onChange={(e) => setFiltros({ ...filtros, numeroGuia: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Nombre del vendedor</label>
            <input value={filtros.nombreVendedor} onChange={(e) => setFiltros({ ...filtros, nombreVendedor: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Fecha Inicial</label>
            <input type="date" value={filtros.fechaInicial} onChange={(e) => setFiltros({ ...filtros, fechaInicial: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold text-gray-500">Fecha Final</label>
            <input type="date" value={filtros.fechaFinal} onChange={(e) => setFiltros({ ...filtros, fechaFinal: e.target.value })} className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={() => setFiltros(FILTROS_VACIOS)} className="rounded bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100">
              Borrar filtros
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        {mostrarTotal && (
          <p className="text-sm font-semibold text-gray-700">
            Total: <span className="text-[#0d6efd]">$ {total.toLocaleString('es-CO')} COP</span>
          </p>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={imprimirSeleccionados}
            disabled={seleccionados.size === 0}
            className="flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-40"
          >
            <Printer className="h-3.5 w-3.5" /> Imprimir guías seleccionadas
          </button>
          <button onClick={recargar} className="flex items-center gap-1.5 rounded-lg bg-[#0d6efd] px-3 py-1.5 text-xs font-bold text-white hover:opacity-90">
            <RefreshCw className="h-3.5 w-3.5" /> Actualizar
          </button>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase text-gray-500">
              <th className="py-2 pr-3">Seleccionar</th>
              <th className="py-2 pr-3">Acciones</th>
              <th className="py-2 pr-3">Transportadora</th>
              <th className="py-2 pr-3">Productos</th>
              <th className="py-2 pr-3">Fecha de orden</th>
              <th className="py-2 pr-3">Estado de la orden</th>
              <th className="py-2 pr-3">Número del vendedor</th>
            </tr>
          </thead>
          <tbody>
            {itemsFiltrados.map((it) => (
              <tr key={it.id} className="border-b border-gray-100" style={{ background: COLOR_FILA[it.ventaEstado] }}>
                <td className="py-2 pr-3">
                  <input type="checkbox" checked={seleccionados.has(it.id)} onChange={() => toggleSeleccion(it.id)} />
                </td>
                <td className="py-2 pr-3">
                  <button onClick={() => onVerVenta(it.ventaId)} className="flex items-center gap-1 rounded bg-[#0d6efd] px-2 py-1 text-xs text-white">
                    <Eye className="h-3 w-3" /> Ver
                  </button>
                </td>
                <td className="py-2 pr-3">
                  {it.transportadora ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                      {it.transportadoraLogo && (
                        // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
                        <img src={it.transportadoraLogo} alt="" className="h-5 w-5 shrink-0 rounded bg-white object-contain" />
                      )}
                      {it.transportadora}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Sin transportadora</span>
                  )}
                  {it.numeroGuia && (
                    <button onClick={() => imprimirGuia(it.ventaId)} className="mt-1.5 flex items-center gap-1 rounded bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-200">
                      <Printer className="h-3 w-3" /> Imprimir guía
                    </button>
                  )}
                </td>
                <td className="py-2 pr-3 text-xs">
                  <p className="font-semibold text-gray-800">{it.productoNombre}</p>
                  <p className="text-gray-500">
                    {it.productoCodigo ? `REF: ${it.productoCodigo} ` : ''}
                    {it.talla ? `TAM: ${it.talla} ` : ''}
                    {it.color ? `COL: ${it.color} ` : ''}
                    CAN: {it.cantidad}
                  </p>
                </td>
                <td className="py-2 pr-3 text-xs">{new Date(it.fecha).toLocaleDateString('es-CO')}</td>
                <td className="py-2 pr-3 text-xs font-bold" style={{ color: COLOR_ESTADO[it.ventaEstado] }}>
                  {VENTA_ESTADO_LABEL[it.ventaEstado]}
                </td>
                <td className="py-2 pr-3">
                  {it.vendedorTelefono ? (
                    <a href={`https://wa.me/57${it.vendedorTelefono}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#128C4A]">
                      <MessageCircle className="h-4 w-4 rounded-full bg-[#25D366] p-0.5 text-white" /> {it.vendedorTelefono}
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itemsFiltrados.length === 0 && <p className="py-10 text-center text-gray-500">No hay items en esta categoría.</p>}
      </div>
    </div>
  );
}
