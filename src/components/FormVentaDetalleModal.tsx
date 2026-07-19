'use client';

import { useEffect, useRef, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
import {
  fetchVentaDetalle,
  cambiarEstadoVenta,
  cotizarFlete,
  generarGuiaEnvio,
  actualizarFleteYTransportadora,
  actualizarCondicionesEntrega,
  marcarPedidoEnPreparacion,
  cobrarWalletPedidoSiNoCobrado,
  buscarCiudadesMipaquete,
  refreshTracking,
  VENTA_ESTADO_LABEL,
  type VentaDetalle,
  type CiudadMipaquete,
  type CotizacionFlete,
} from '@/lib/ventas';
import { getBalanceDropshipper, SALDO_MINIMO_DROPSHIPPING } from '@/lib/wallet';
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
// 1) Cambiar el estado de la venta (dropdown real para admin, dispara approve_order/reject_order).
// 2) Si falta guia: cotizar y generarla con el flujo REAL de Mipaquete (mismo que ya se uso en
//    DropshippingCheckoutModal), no la cotizacion vieja rota.
// 3) Si ya hay guia: boton "Actualizar estado" (tracking real), igual que en /config/ventas.
//
// REDISEÑO 2026-07-19 (pedido explicito del usuario): antes el vendedor cambiaba el estado desde
// un dropdown arriba, sin relacion con la guia. Ahora, para un pedido pendiente sin guia, el
// vendedor tiene que: confirmar/editar la ciudad de destino (autocompletada con la ciudad real del
// pedido), definir las condiciones de entrega (mismo toggle "cliente ya pago"/"envio incluido" que
// ya existia en DropshippingCheckoutModal, ahora disponible para CUALQUIER tipo de venta, no solo
// dropshipping), elegir transportadora, y recien ahi aparece el boton "Autorizar y enviar a
// despacho" al final del formulario -- ese click genera la guia real Y mueve el pedido a
// "Preparacion" en un solo paso. El vendedor ya no puede saltar directo a "Despachado"/"Venta
// exitosa" (eso lo decide el proveedor generando la guia -- que con este cambio ya lo hace el
// vendedor aca mismo -- y el tracking real via approve_order/reject_order automatico).
//
// Campos del original que NUNCA se guardaban de verdad (UsuariosService.update()/VentasService.update()
// solo mapean status/tracking_number/withdrawn/freight_value/carrier) se omiten en vez de mostrar
// inputs editables que no sirven para nada: numero de cedula del cliente, barrio/direccion editables,
// info de "cubre envio", "pago anticipado" (columnas viejas, distintas de customer_prepaid_product).

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
  const [fleteSeleccionado, setFleteSeleccionado] = useState<CotizacionFlete | null>(null);
  const [autorizando, setAutorizando] = useState(false);
  const [error, setError] = useState('');

  const [clientePago, setClientePago] = useState(false);
  const [envioIncluido, setEnvioIncluido] = useState(true);
  // Seguro antidevoluciones (pedido explicito del usuario 2026-07-19): MISMA logica que
  // Hacer Dropshipping/Pedir muestra -- activado por defecto para que "la gran mayoria" lo elija
  // (mismo principio ya aplicado ahi: el default es la palanca de adopcion mas fuerte). Solo tiene
  // consecuencia real (cobra de la wallet) en pedidos 'contraentrega' -- dropshipping/muestra ya
  // definieron esto en su propio checkout, este modal no los vuelve a cobrar.
  const [seguroActivo, setSeguroActivo] = useState(true);
  const [saldo, setSaldo] = useState(0);

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetchVentaDetalle(orderId).then((res) => {
      setVenta(res);
      setCargando(false);
      if (!res) return;
      setClientePago(res.clientePago);
      setEnvioIncluido(res.envioIncluido);
      if (res.sellerId) getBalanceDropshipper(res.sellerId).then(setSaldo);
      // Autobusqueda: la ciudad ya viene del pedido (buyer_city, texto libre del cliente) -- se
      // busca de una vez contra Mipaquete para que el vendedor solo tenga que hacer click en la
      // sugerencia correcta, en vez de tener que escribir todo de nuevo. Sigue pudiendo buscar
      // otra ciudad si la sugerencia no coincide.
      if (res.ciudad && !res.numeroGuia) {
        setCiudadQuery(res.ciudad);
        buscarCiudadesMipaquete(res.ciudad).then(setSugerencias);
      } else {
        setCiudadQuery(res.ciudad || '');
      }
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
    setFleteSeleccionado(null);
    setCotizaciones([]);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setSugerencias(v.trim().length >= 2 ? await buscarCiudadesMipaquete(v) : []);
    }, 250);
  }

  async function seleccionarCiudad(c: CiudadMipaquete) {
    setCiudadSeleccionada(c);
    setCiudadQuery(c.name);
    setSugerencias([]);
    setFleteSeleccionado(null);
    setCotizando(true);
    setCotizaciones(await cotizarFlete(orderId, c.code));
    setCotizando(false);
  }

  // Pedido explicito del usuario 2026-07-19: ya no existe "pedido sin prepago" -- TODO pedido que
  // se autoriza desde ESTA pantalla, sin importar el tipo (contraentrega/dropshipping/muestra),
  // exige saldo suficiente en la wallet para el flete antes de poder generar la guia. Antes solo
  // 'contraentrega' cobraba aca -- un pedido de dropshipping/muestra atascado sin guia, abierto
  // desde /config/ventas, se autorizaba SIN cobrar nada (bug real encontrado y cerrado el mismo
  // dia). El seguro agrega los +5.000 y la proteccion ante una devolucion (ver reject_order).
  // BUG REAL CORREGIDO 2026-07-19: si "cliente ya pago" esta activo, el mensajero deja de recaudar
  // el producto (ver mipaquete-create-shipment) pero antes esta wallet NUNCA cobraba ese valor --
  // el producto no lo pagaba nadie. Mismo patron que ya existia en DropshippingCheckoutModal
  // (totalAPagar suma el producto cuando clientePago esta activo), replicado aca.
  const totalAPagarWallet = fleteSeleccionado
    ? fleteSeleccionado.fleteTotal + (seguroActivo ? 5000 : 0) + (clientePago ? (venta?.precioTotal || 0) : 0)
    : 0;
  const saldoInsuficiente = saldo < SALDO_MINIMO_DROPSHIPPING || saldo < totalAPagarWallet;

  // Un solo click al final del formulario: cobra el flete (+seguro si aplica) de la wallet, guarda
  // condiciones de entrega + transportadora elegida, genera la guia real, y (si funciona) mueve el
  // pedido a "Preparacion" -- pedido explicito del usuario: "el vendedor genera la guia cuando da
  // click a autorizar despacho". Se cobra SIEMPRE, sin importar el tipo de pedido -- ver nota arriba.
  async function autorizarDespacho() {
    if (!fleteSeleccionado || autorizando) return;
    if (saldoInsuficiente) {
      setError(`Saldo insuficiente: necesitas mínimo ${SALDO_MINIMO_DROPSHIPPING.toLocaleString('es-CO')} de saldo y ${totalAPagarWallet.toLocaleString('es-CO')} para cubrir el flete${seguroActivo ? ' + seguro' : ''}. Recarga en "Recargar Saldo" e intenta de nuevo.`);
      return;
    }
    setAutorizando(true);
    setError('');
    const kind = seguroActivo ? 'flete_seguro_pedido' : 'flete_pedido';
    // Flete SIEMPRE pagado desde la wallet en este formulario (a diferencia de
    // DropshippingCheckoutModal, aca no existe la excepcion "envio aparte"). cobrarWalletPedidoSiNoCobrado
    // cobra una sola vez por pedido -- si ya se habia cobrado (reintento tras fallo de guia), no
    // vuelve a debitar.
    const deb = await cobrarWalletPedidoSiNoCobrado(orderId, venta!.sellerId!, totalAPagarWallet, kind, true);
    if (!deb.success) {
      setAutorizando(false);
      setError(deb.message || 'No pudimos cobrar el flete de la billetera');
      return;
    }
    if (!deb.alreadyCharged) setSaldo((s) => s - totalAPagarWallet);
    await actualizarCondicionesEntrega(orderId, clientePago, envioIncluido, seguroActivo);
    await actualizarFleteYTransportadora(orderId, fleteSeleccionado.fleteTotal, fleteSeleccionado.slug);
    const res = await generarGuiaEnvio(orderId, fleteSeleccionado.slug);
    if (!res.ok) {
      setAutorizando(false);
      setError(res.message || 'No se pudo generar la guía, intenta de nuevo');
      return;
    }
    await marcarPedidoEnPreparacion(orderId);
    setAutorizando(false);
    setVenta((v) => (v ? { ...v, numeroGuia: res.guia || '', transportadora: fleteSeleccionado.slug, estado: 6 } : v));
    mostrar('Guía generada, pedido autorizado y enviado a despacho');
    onCambio();
  }

  async function rechazarPedido() {
    if (!confirm('¿Rechazar este pedido? El vendedor va a ver que la venta no se autorizó.')) return;
    await cambiarEstado(2);
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

  // Solo tiene efecto real cuando clientePago esta activo (cualquier tipo de pedido) o en
  // dropshipping sin prepago (comportamiento historico) -- ver mipaquete-create-shipment. En el
  // resto de casos (contraentrega normal, muestra) no cambia nada, se oculta para no confundir.
  const mostrarToggleEnvio = clientePago || venta?.tipoPedido === 'dropshipping';

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
            {esAdmin && (
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-700">Estado de la Venta</label>
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
              </div>
            )}

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
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700">
                      Ciudad destino <span className="text-red-500">*</span> (confirma la ciudad del pedido o busca otra)
                    </label>
                    <div className="relative">
                      <input
                        value={ciudadQuery}
                        onChange={(e) => onCiudadInput(e.target.value)}
                        placeholder="Buscar ciudad destino…"
                        className={`w-full rounded border px-3 py-2 text-sm ${ciudadSeleccionada ? 'border-green-400 bg-green-50' : 'border-gray-300'}`}
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
                    {ciudadSeleccionada && <p className="mt-1 text-xs text-green-600">✓ Ciudad confirmada: {ciudadSeleccionada.name}</p>}
                  </div>

                  <label className="flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3" style={{ borderColor: clientePago ? '#02a0e3' : '#e5e7eb', background: clientePago ? 'rgba(2,160,227,0.06)' : '#fff' }}>
                    <input type="checkbox" checked={clientePago} onChange={() => setClientePago((v) => !v)} className="mt-0.5" />
                    <div>
                      <p className="m-0 text-[13px] font-bold text-gray-800">💰 Mi cliente ya me pagó el producto</p>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500">
                        {clientePago
                          ? 'El mensajero NO cobrará el producto -- ya se lo pagaron por fuera de la plataforma.'
                          : 'Actívalo si el cliente ya te pagó/transfirió el producto antes del envío.'}
                      </p>
                    </div>
                  </label>

                  {mostrarToggleEnvio && (
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setEnvioIncluido(true)}
                          className="rounded-[10px] border px-1.5 py-2.5 text-[13px] font-bold"
                          style={envioIncluido ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)', color: '#0288c2' } : { borderColor: '#e5e7eb', color: '#1f2937' }}
                        >
                          {clientePago ? 'También pagó el envío' : 'Envío incluido'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setEnvioIncluido(false)}
                          className="rounded-[10px] border px-1.5 py-2.5 text-[13px] font-bold"
                          style={!envioIncluido ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)', color: '#0288c2' } : { borderColor: '#e5e7eb', color: '#1f2937' }}
                        >
                          {clientePago ? 'Envío lo paga aparte' : 'Envío aparte'}
                        </button>
                      </div>
                      <p className="mx-0.5 mt-1.5 text-[11.5px] text-gray-500">
                        {clientePago
                          ? envioIncluido
                            ? 'El cliente ya pagó todo: no se cobra nada contra entrega.'
                            : 'El cliente ya pagó el producto, pero el envío lo paga aparte al mensajero.'
                          : envioIncluido
                            ? 'El mensajero solo cobra el producto, el flete va incluido.'
                            : 'El mensajero cobrará el producto MÁS el flete, por separado.'}
                      </p>
                    </div>
                  )}

                  {(
                    // Seguro antidevoluciones (pedido explicito del usuario 2026-07-19, MISMA
                    // logica que Hacer Dropshipping/Pedir muestra): activado por defecto, visible
                    // antes de elegir transportadora -- mismo principio de diseño ya aplicado ahi
                    // para que "la gran mayoria" lo elija. Visible para CUALQUIER tipo de pedido que
                    // llegue a esta pantalla, ya que el flete+seguro ahora siempre se cobra aca.
                    <label
                      className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3"
                      style={{ background: seguroActivo ? '#fffbeb' : '#fef2f2', borderColor: seguroActivo ? '#fde68a' : '#fecaca' }}
                    >
                      <input type="checkbox" checked={seguroActivo} onChange={() => setSeguroActivo((v) => !v)} className="mt-0.5" />
                      <div>
                        <p className="m-0 text-[13px] font-bold text-gray-800">
                          🛡️ Protección de flete (recomendado) <span className="text-amber-800">+ $5.000</span>
                        </p>
                        {seguroActivo ? (
                          <p className="mt-1 text-xs leading-relaxed text-gray-500">
                            Activada: si el pedido se devuelve, igual recuperas el flete completo en tu billetera.
                          </p>
                        ) : (
                          <p className="mt-1 text-xs font-semibold leading-relaxed text-red-600">
                            ⚠️ Sin protección: si el pedido se devuelve, no recuperas nada del flete.
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-gray-400">Saldo en tu billetera: $ {saldo.toLocaleString('es-CO')}</p>
                      </div>
                    </label>
                  )}

                  {cotizando && <p className="text-xs text-gray-500">Cotizando…</p>}
                  {cotizaciones.length > 0 && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">Elige transportadora</label>
                      <div className="space-y-1.5">
                        {cotizaciones.map((c, i) => {
                          const activa = fleteSeleccionado === c;
                          return (
                            <div
                              key={`${c.slug}-${i}`}
                              onClick={() => setFleteSeleccionado(c)}
                              className="flex cursor-pointer items-center justify-between rounded border px-3 py-2 text-sm"
                              style={activa ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.06)' } : { borderColor: '#e5e7eb' }}
                            >
                              <span>{c.nombre}</span>
                              <span className="font-medium">$ {c.fleteTotal.toLocaleString('es-CO')}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {ciudadSeleccionada && !cotizando && cotizaciones.length === 0 && <p className="text-xs text-gray-500">No hay transportadoras disponibles para esa ciudad.</p>}
                  {fleteSeleccionado && (
                    // Pedido explicito del usuario 2026-07-19: el flete siempre se descuenta de la
                    // wallet ahora (con o sin seguro), sin importar el tipo de pedido -- se muestra
                    // el total exacto y el saldo disponible antes de autorizar, mismo nivel de
                    // transparencia que DropshippingCheckoutModal.
                    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs">
                      <span className="text-gray-600">
                        Se descontará de tu billetera (flete{seguroActivo ? ' + seguro' : ''}{clientePago ? ' + producto' : ''})
                      </span>
                      <span className={`font-bold ${saldoInsuficiente ? 'text-red-600' : 'text-gray-800'}`}>$ {totalAPagarWallet.toLocaleString('es-CO')}</span>
                    </div>
                  )}
                  {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
                </div>
              )}
            </div>

            {!esAdmin && (
              <div className="border-t border-gray-100 pt-4">
                {venta.estado === 0 ? (
                  // Pedido explicito del usuario 2026-07-19: el vendedor NO decide "Despachado" ni
                  // "Venta exitosa" a mano -- eso lo confirma el tracking real de Mipaquete
                  // (approve_order/reject_order automatico, ver mipaquete-sync-tracking). Aca solo
                  // autoriza (genera la guia real + pasa a "Preparacion" en un solo click) o
                  // rechaza. Autorizar exige haber elegido transportadora primero.
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={autorizarDespacho}
                      disabled={!fleteSeleccionado || autorizando || saldoInsuficiente}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {autorizando ? 'Generando guía…' : '✅ Autorizar y enviar a despacho'}
                    </button>
                    <button
                      type="button"
                      onClick={rechazarPedido}
                      disabled={cambiandoEstado || autorizando}
                      className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 disabled:opacity-60"
                    >
                      ❌ Rechazar pedido
                    </button>
                    {!fleteSeleccionado && <p className="w-full text-xs text-gray-400">Confirma la ciudad y elige una transportadora para poder autorizar.</p>}
                    {fleteSeleccionado && saldoInsuficiente && (
                      <p className="w-full text-xs font-semibold text-red-600">
                        Saldo insuficiente para el flete -- recarga en &quot;Recargar Saldo&quot; para continuar.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-semibold text-gray-700">Estado: {VENTA_ESTADO_LABEL[venta.estado]}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <Toast mensaje={mensaje} />
    </div>
  );
}
