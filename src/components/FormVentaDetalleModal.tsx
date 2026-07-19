'use client';

import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import {
  fetchVentaDetalle,
  cambiarEstadoVenta,
  cotizarFlete,
  generarGuiaEnvio,
  actualizarFleteYTransportadora,
  buscarCiudadesMipaquete,
  refreshTracking,
  VENTA_ESTADO_LABEL,
  type VentaDetalle,
  type CiudadMipaquete,
  type CotizacionFlete,
} from '@/lib/ventas';
import { useToast, Toast } from '@/components/Toast';

// Port SIMPLIFICADO de FormventasComponent (Angular, 812 lineas) -- decision explicita del usuario
// 2026-07-15 tras encontrar que la funcion central del original (cotizar/generar guia) esta
// COMPLETAMENTE ROTA en produccion hoy: llama a VentasService.getFleteValor() con la forma de
// datos vieja de Coordinadora (idCiudadDestino, drpCiudadOrigen, txtIdentificacionDe...), pero el
// backend real (ya migrado a Mipaquete) espera `{ id, codeCiudad }` -- SIEMPRE devuelve vacio, sin
// importar los datos. Con eso el formulario original no puede generar una guia nueva en la
// practica (el boton de guardar depende de elegir transportadora, que depende de esa cotizacion
// rota).
//
// Esta version muestra el detalle real (vendedor, cliente, items) y permite:
// 1) Cambiar el estado de la venta (dropdown real, dispara approve_order/reject_order via RPC).
// 2) Si falta guia: cotizar y generarla con el flujo REAL de Mipaquete (mismo que ya se uso en
//    DropshippingCheckoutModal), no la cotizacion vieja rota.
// 3) Si ya hay guia: boton "Actualizar estado" (tracking real), igual que en /config/ventas.
//
// Campos del original que NUNCA se guardaban de verdad (UsuariosService.update()/VentasService.update()
// solo mapean status/tracking_number/withdrawn/freight_value/carrier) se omiten en vez de mostrar
// inputs editables que no sirven para nada: numero de cedula del cliente, barrio/direccion editables,
// info de "cubre envio", "pago anticipado", etc.

const ESTADOS_DISPONIBLES = (esAdmin: boolean) => [
  { value: 0, label: 'Pendiente' },
  { value: 6, label: 'Preparación' },
  { value: 3, label: 'Despachado' },
  ...(esAdmin ? [{ value: 1, label: 'Venta exitosa' }, { value: 2, label: 'Devolución' }] : []),
];

interface FormVentaDetalleModalProps {
  orderId: number;
  esAdmin: boolean;
  onClose: () => void;
  onCambio: () => void;
}

export function FormVentaDetalleModal({ orderId, esAdmin, onClose, onCambio }: FormVentaDetalleModalProps) {
  const { mensaje, mostrar } = useToast();
  const [venta, setVenta] = useState<VentaDetalle | null>(null);
  const [cargando, setCargando] = useState(true);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [actualizandoTracking, setActualizandoTracking] = useState(false);

  const [ciudadQuery, setCiudadQuery] = useState('');
  const [sugerencias, setSugerencias] = useState<CiudadMipaquete[]>([]);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<CiudadMipaquete | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<CotizacionFlete[]>([]);
  const [generando, setGenerando] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchVentaDetalle(orderId).then((res) => {
      setVenta(res);
      setCiudadQuery(res?.ciudad || '');
      setCargando(false);
    });
  }, [orderId]);

  async function cambiarEstado(nuevoEstado: number) {
    setCambiandoEstado(true);
    const ok = await cambiarEstadoVenta(orderId, nuevoEstado);
    setCambiandoEstado(false);
    if (!ok) {
      mostrar('Error de servidor');
      return;
    }
    setVenta((v) => (v ? { ...v, estado: nuevoEstado } : v));
    mostrar('Actualizado');
    onCambio();
  }

  function onCiudadInput(v: string) {
    setCiudadQuery(v);
    setCiudadSeleccionada(null);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSugerencias(v.trim().length >= 2 ? await buscarCiudadesMipaquete(v) : []);
    }, 250);
  }

  async function seleccionarCiudad(c: CiudadMipaquete) {
    setCiudadSeleccionada(c);
    setCiudadQuery(c.name);
    setSugerencias([]);
    setCotizando(true);
    setCotizaciones(await cotizarFlete(orderId, c.code));
    setCotizando(false);
  }

  async function generarGuia(c: CotizacionFlete) {
    setGenerando(true);
    await actualizarFleteYTransportadora(orderId, c.fleteTotal, c.slug);
    const res = await generarGuiaEnvio(orderId, c.slug);
    setGenerando(false);
    if (!res.ok) {
      mostrar(res.message || 'No se pudo generar la guia');
      return;
    }
    setVenta((v) => (v ? { ...v, numeroGuia: res.guia || '', transportadora: c.slug, estado: 6 } : v));
    mostrar('Guía generada');
    onCambio();
  }

  async function actualizarTracking() {
    setActualizandoTracking(true);
    const res = await refreshTracking(orderId);
    setActualizandoTracking(false);
    if (!res.success) {
      mostrar(res.message || 'No pudimos actualizar el estado');
      return;
    }
    mostrar('Estado actualizado');
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h4 className="text-base font-bold text-gray-900">Detalle Venta #{orderId}</h4>
          <button onClick={onClose} aria-label="Cerrar" className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {cargando || !venta ? (
          <p className="px-4 py-10 text-center text-sm text-gray-500">{cargando ? 'Cargando…' : 'No se encontró la venta.'}</p>
        ) : (
          <div className="space-y-4 px-4 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-700">Estado de la Venta</label>
              {esAdmin ? (
                <>
                  <select
                    value={venta.estado}
                    onChange={(e) => cambiarEstado(Number(e.target.value))}
                    disabled={cambiandoEstado}
                    className="w-full max-w-xs rounded border border-gray-300 px-2 py-2 text-sm"
                  >
                    {ESTADOS_DISPONIBLES(esAdmin).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">Actual: {VENTA_ESTADO_LABEL[venta.estado]}</p>
                </>
              ) : venta.estado === 0 ? (
                // Pedido explicito del usuario 2026-07-19: el vendedor NO decide "Despachado" ni
                // "Venta exitosa" -- eso lo sabe el proveedor (genera la guia real) y el tracking
                // real de Mipaquete (que ya dispara approve_order/reject_order solo, ver
                // mipaquete-sync-tracking). Aca solo autoriza o rechaza. Autorizar = pasa a
                // "Preparacion", que es el unico estado que /config/misDespacho ya usa para
                // mostrarle el pedido al proveedor -- en 'Pendiente' es invisible para el.
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cambiarEstado(6)}
                    disabled={cambiandoEstado}
                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                  >
                    ✅ Autorizar y enviar a despacho
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('¿Rechazar este pedido? El vendedor va a ver que la venta no se autorizo.')) cambiarEstado(2);
                    }}
                    disabled={cambiandoEstado}
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
                  >
                    ❌ Rechazar pedido
                  </button>
                </div>
              ) : (
                <p className="text-sm font-semibold text-gray-700">{VENTA_ESTADO_LABEL[venta.estado]}</p>
              )}
            </div>

            <div>
              <h5 className="mb-1 rounded bg-[#0d6efd] px-2 py-1 text-xs font-bold text-white">Información del Vendedor</h5>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
                <p>
                  <span className="text-gray-500">Nombre:</span> {venta.vendedorNombre || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Teléfono:</span> {venta.vendedorTelefono || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Ciudad:</span> {venta.vendedorCiudad || '—'}
                </p>
              </div>
            </div>

            <div>
              <h5 className="mb-1 rounded bg-[#0d6efd] px-2 py-1 text-xs font-bold text-white">Información del Cliente</h5>
              <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                <p>
                  <span className="text-gray-500">Nombre:</span> {venta.nombreCliente || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Teléfono:</span> {venta.telefonoCliente || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Ciudad:</span> {venta.ciudad || '—'}
                </p>
                <p>
                  <span className="text-gray-500">Barrio:</span> {venta.barrio || '—'}
                </p>
                <p className="sm:col-span-2">
                  <span className="text-gray-500">Dirección:</span> {venta.direccionCliente || '—'}
                </p>
              </div>
            </div>

            <div>
              <h5 className="mb-1 rounded bg-[#0d6efd] px-2 py-1 text-xs font-bold text-white">Artículos</h5>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-1">Producto</th>
                    <th className="py-1">Talla/Color</th>
                    <th className="py-1">Cant.</th>
                    <th className="py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {venta.items.map((it) => (
                    <tr key={it.id} className="border-t border-gray-100">
                      <td className="py-1">{it.titulo}</td>
                      <td className="py-1">
                        {it.talla || '—'} {it.color ? `/ ${it.color}` : ''}
                      </td>
                      <td className="py-1">{it.cantidad}</td>
                      <td className="py-1">$ {(it.costoTotal || 0).toLocaleString('es-CO')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-sm font-bold">Total: $ {(venta.precioTotal || 0).toLocaleString('es-CO')}</p>
            </div>

            <div>
              <h5 className="mb-1 rounded bg-[#0d6efd] px-2 py-1 text-xs font-bold text-white">Guía de envío</h5>
              {venta.numeroGuia ? (
                <div className="flex items-center gap-3 text-sm">
                  <p>
                    Guía: <strong>{venta.numeroGuia}</strong> ({venta.transportadora})
                  </p>
                  <button onClick={actualizarTracking} disabled={actualizandoTracking} className="flex items-center gap-1 rounded bg-[#0dcaf0] px-2 py-1 text-xs font-medium text-white disabled:opacity-60">
                    <RefreshCw className="h-3 w-3" /> {actualizandoTracking ? 'Actualizando…' : 'Actualizar estado'}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <input
                      value={ciudadQuery}
                      onChange={(e) => onCiudadInput(e.target.value)}
                      placeholder="Buscar ciudad destino…"
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
                    />
                    {sugerencias.length > 0 && (
                      <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-40 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                        {sugerencias.map((c, i) => (
                          <div key={`${c.code}-${i}`} onMouseDown={() => seleccionarCiudad(c)} className="cursor-pointer px-3 py-2 text-sm hover:bg-gray-50">
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {cotizando && <p className="text-xs text-gray-500">Cotizando…</p>}
                  {cotizaciones.map((c, i) => (
                    <div key={`${c.slug}-${i}`} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                      <span>{c.nombre}</span>
                      <span className="font-medium">$ {c.fleteTotal.toLocaleString('es-CO')}</span>
                      <button onClick={() => generarGuia(c)} disabled={generando} className="rounded bg-[#198754] px-2 py-1 text-xs font-medium text-white disabled:opacity-60">
                        {generando ? 'Generando…' : 'Generar guía'}
                      </button>
                    </div>
                  ))}
                  {ciudadSeleccionada && !cotizando && cotizaciones.length === 0 && <p className="text-xs text-gray-500">No hay transportadoras disponibles para esa ciudad.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
