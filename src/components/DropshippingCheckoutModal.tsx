'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { ChevronUp, ChevronDown, X, Check } from 'lucide-react';
import { type ProductoLegacy } from '@/lib/productos';
import { type DataUserCompleto } from '@/lib/usuarios';
import {
  getBalanceDropshipper,
  debitWalletDropshipper,
  refundWalletDropshipper,
  createTopup,
  getTopupStatus,
  SALDO_MINIMO_DROPSHIPPING,
} from '@/lib/wallet';
import {
  crearPedidoDropshipping,
  actualizarFleteYTransportadora,
  marcarPedidoRechazadoSinReembolso,
  marcarPedidoEnPreparacion,
  cotizarFlete,
  generarGuiaEnvio,
  buscarCiudadesMipaquete,
  type CiudadMipaquete,
  type CotizacionFlete,
} from '@/lib/ventas';

// Port 1:1 desde src/app/components/dropshipping-checkout (Angular, 549 lineas .ts + 249 .html) --
// checkout real de "Hacer Dropshipping"/"Pedir muestra": crea un pedido real (RPC create_order),
// cotiza y genera guia real con Mipaquete (mismas Edge Functions ya desplegadas, sin cambios), y
// cobra SOLO el flete de la billetera prepago 'dropshipper' del propio usuario -- el valor del
// producto lo cobra el mensajero contra entrega. Fidelidad visual identica al original (Fase 3),
// colores/radios tomados literalmente de dropshipping-checkout.component.scss.
//
// Pagos en modo real (confirmado por el usuario 2026-07-15).
const ESTADO_PRUEBA_PAGOS = false;
const KEY_EPAYCO = '62977a30b1a19dcd0728f6b639b33fb0';

declare global {
  interface Window {
    ePayco?: { checkout: { configure: (opts: { key: string; test: boolean }) => { open: (obj: Record<string, unknown>) => void } } };
  }
}

interface Cliente {
  nombre: string;
  telefono: string;
  direccion: string;
  barrio: string;
}

interface DropshippingCheckoutModalProps {
  mode: 'dropshipping' | 'muestra';
  producto: ProductoLegacy;
  colorSeleccionado: string;
  tallaSeleccionada: string;
  cantidadAdquirir: number;
  dataUser: DataUserCompleto;
  onClose: () => void;
}

function formatearMonto(n: number | null): string {
  return n != null ? n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

function formatCOPMoneda(n: number): string {
  return `$ ${Math.round(n || 0).toLocaleString('es-CO')}`;
}

const soloLetras = (v: string) => (v || '').replace(/[^A-Za-zÀ-ÿ\s'-]/g, '');
const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');
const letrasYNumeros = (v: string) => (v || '').replace(/[^A-Za-z0-9À-ÿ\s#.,-]/g, '');

const MONTOS_SUGERIDOS = [30000, 50000, 100000, 200000, 500000];

export function DropshippingCheckoutModal({
  mode,
  producto,
  colorSeleccionado,
  tallaSeleccionada,
  cantidadAdquirir,
  dataUser,
  onClose,
}: DropshippingCheckoutModalProps) {
  const precioUnitario = mode === 'muestra' ? producto.pro_vendedor || 0 : producto.pro_uni_venta || 0;

  const [paso, setPaso] = useState<'formulario' | 'exito'>('formulario');
  const [loader, setLoader] = useState(false);
  const [error, setError] = useState('');

  const [cantidad, setCantidad] = useState(cantidadAdquirir || 1);
  const [precioVentaClienteStr, setPrecioVentaClienteStr] = useState(formatearMonto(precioUnitario * (cantidadAdquirir || 1)));
  const precioVentaCliente = precioVentaClienteStr ? parseInt(precioVentaClienteStr.replace(/\./g, ''), 10) : null;
  const [envioIncluido, setEnvioIncluido] = useState(true);
  // "Mi cliente ya me pago el producto" (pedido explicito del usuario 2026-07-18) -- solo aplica a
  // 'dropshipping'. Reusa el toggle envioIncluido con un significado nuevo: ver fleteDesdeWallet.
  const [clientePago, setClientePago] = useState(false);
  // Activado por defecto (antes false): pedido explicito del usuario 2026-07-18 para que "la gran
  // mayoria" active la proteccion -- el default es la palanca mas fuerte de adopcion, la mayoria
  // de vendedores no va a tocar algo que ya viene marcado. El vendedor puede desmarcarlo.
  const [seguroActivo, setSeguroActivo] = useState(true);

  const [cliente, setCliente] = useState<Cliente>(() =>
    mode === 'muestra'
      ? {
          nombre: [dataUser.nombre, dataUser.apellido].filter(Boolean).join(' '),
          telefono: dataUser.telefono || '',
          direccion: dataUser.direccion || '',
          barrio: '',
        }
      : { nombre: '', telefono: '', direccion: '', barrio: '' },
  );
  const destinatarioBloqueado = mode === 'muestra';

  const [ciudadQuery, setCiudadQuery] = useState(mode === 'muestra' ? dataUser.ciudad || '' : '');
  const [sugerencias, setSugerencias] = useState<CiudadMipaquete[]>([]);
  const [ciudadFocus, setCiudadFocus] = useState(false);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<CiudadMipaquete | null>(null);

  const [cotizando, setCotizando] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<CotizacionFlete[]>([]);
  const [fleteSeleccionado, setFleteSeleccionado] = useState<CotizacionFlete | null>(null);

  const [orderId, setOrderId] = useState<number | null>(null);
  const [camposBloqueados, setCamposBloqueados] = useState(false);
  const [guiaGenerada, setGuiaGenerada] = useState('');

  const [saldo, setSaldo] = useState(0);
  const [mostrarRecarga, setMostrarRecarga] = useState(false);
  const [procesandoRecarga, setProcesandoRecarga] = useState(false);
  const [montoRecarga, setMontoRecarga] = useState(30000);

  const ciudadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const campoDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRecarga = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderIdRef = useRef<number | null>(null);
  const ciudadSeleccionadaRef = useRef<CiudadMipaquete | null>(null);

  useEffect(() => {
    orderIdRef.current = orderId;
  }, [orderId]);
  useEffect(() => {
    ciudadSeleccionadaRef.current = ciudadSeleccionada;
  }, [ciudadSeleccionada]);

  const refrescarSaldo = async () => {
    if (!dataUser.id) return;
    setSaldo(await getBalanceDropshipper(dataUser.id));
  };

  useEffect(() => {
    refrescarSaldo();
    return () => {
      if (ciudadDebounce.current) clearTimeout(ciudadDebounce.current);
      if (campoDebounce.current) clearTimeout(campoDebounce.current);
      if (pollingRecarga.current) clearInterval(pollingRecarga.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = mode === 'dropshipping' && precioVentaCliente != null ? precioVentaCliente : precioUnitario * (Number(cantidad) || 0);
  const flete = fleteSeleccionado?.fleteTotal || 0;
  // "Mi cliente ya me pago el producto" (pedido explicito del usuario 2026-07-18): el flete solo
  // sale de la wallet si tambien le pagaron el envio (envioIncluido se reusa con ese significado
  // cuando clientePago esta activo) -- si el envio quedo "aparte", el mensajero lo cobra al
  // entregar, no se debita de la wallet. Para 'muestra' no cambia nada (siempre sale de la wallet).
  const fleteDesdeWallet = mode === 'dropshipping' ? !clientePago || envioIncluido : true;
  const totalAPagar = (fleteDesdeWallet ? flete : 0)
    + (mode === 'dropshipping' && seguroActivo ? 5000 : 0)
    + (mode === 'dropshipping' && clientePago ? subtotal : 0);
  const totalRecaudo = mode !== 'dropshipping'
    ? subtotal
    : clientePago
      ? (fleteDesdeWallet ? 0 : flete)
      : (envioIncluido ? subtotal : subtotal + flete);
  const saldoInsuficiente = totalAPagar > saldo;

  function formValido(): boolean {
    const precioOk = mode !== 'dropshipping' || (precioVentaCliente != null && precioVentaCliente > 0);
    return !!cliente.nombre.trim() && !!cliente.telefono.trim() && !!cliente.direccion.trim() && !!cliente.barrio.trim() && !!ciudadSeleccionada && (Number(cantidad) || 0) >= 1 && precioOk;
  }

  function onCampoChange() {
    if (campoDebounce.current) clearTimeout(campoDebounce.current);
    campoDebounce.current = setTimeout(() => intentarCotizarAutomatico(), 500);
  }

  function onPrecioInput(valor: string) {
    const digits = (valor || '').replace(/[^\d]/g, '');
    setPrecioVentaClienteStr(digits ? formatearMonto(parseInt(digits, 10)) : '');
    if (campoDebounce.current) clearTimeout(campoDebounce.current);
    campoDebounce.current = setTimeout(() => intentarCotizarAutomatico(), 500);
  }

  function onCantidadChange(valor: string) {
    let n = parseInt(valor, 10);
    if (isNaN(n) || n < 1) n = 1;
    setCantidad(n);
    onCampoChange();
  }

  function incrementarCantidad() {
    if (camposBloqueados) return;
    setCantidad((c) => (Number(c) || 0) + 1);
    onCampoChange();
  }

  function decrementarCantidad() {
    if (camposBloqueados) return;
    setCantidad((c) => {
      const nueva = (Number(c) || 0) - 1;
      return nueva < 1 ? 1 : nueva;
    });
    onCampoChange();
  }

  async function intentarCotizarAutomatico() {
    if (loader || cotizando) return;
    if (!formValido()) {
      setError('Completa todos los campos (incluida la ciudad) para cotizar el envio');
      return;
    }
    setError('');
    if (!orderIdRef.current) {
      await crearPedidoYCotizar();
    } else {
      await cotizar();
    }
  }

  function onCiudadInput(valor: string) {
    const sanitized = soloLetras(valor);
    setCiudadQuery(sanitized);
    setCiudadSeleccionada(null);
    setFleteSeleccionado(null);
    setCotizaciones([]);
    if (ciudadDebounce.current) clearTimeout(ciudadDebounce.current);
    ciudadDebounce.current = setTimeout(() => buscarCiudadesLocal(sanitized), 250);
  }

  async function buscarCiudadesLocal(q: string) {
    if (q.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    setSugerencias(await buscarCiudadesMipaquete(q));
  }

  function seleccionarCiudad(c: CiudadMipaquete) {
    setCiudadSeleccionada(c);
    setCiudadQuery(c.name);
    setSugerencias([]);
    setCiudadFocus(false);
    if (campoDebounce.current) clearTimeout(campoDebounce.current);
    setTimeout(() => intentarCotizarAutomatico(), 0);
  }

  function limpiarCiudad() {
    setCiudadSeleccionada(null);
    setCiudadQuery('');
    setFleteSeleccionado(null);
    setCotizaciones([]);
  }

  async function crearPedidoYCotizar() {
    setLoader(true);
    setError('');
    const res = await crearPedidoDropshipping({
      usu_clave_int: dataUser.id,
      pro_clave_int: producto.id,
      ven_tallas: tallaSeleccionada || null,
      ven_observacion: colorSeleccionado || null,
      ven_cantidad: cantidad,
      ven_precio: precioUnitario,
      ven_total: subtotal,
      ven_totalManual: mode === 'dropshipping' ? subtotal : undefined,
      shipping_included: mode === 'dropshipping' ? envioIncluido : undefined,
      insurance_active: mode === 'dropshipping' ? seguroActivo : undefined,
      customer_prepaid_product: mode === 'dropshipping' ? clientePago : undefined,
      nombreProducto: producto.pro_nombre,
      ven_nombre_cliente: cliente.nombre.trim(),
      ven_telefono_cliente: cliente.telefono.trim(),
      ven_direccion_cliente: cliente.direccion.trim(),
      ven_ciudad: ciudadSeleccionadaRef.current?.name || '',
      ven_barrio: cliente.barrio.trim(),
      ven_tipo: mode,
    });
    setLoader(false);
    if (!res.success || !res.id) {
      setError('No pudimos crear el pedido, intenta de nuevo');
      return;
    }
    setOrderId(res.id);
    orderIdRef.current = res.id;
    setCamposBloqueados(true);
    await cotizar(res.id);
  }

  async function cotizar(idParaCotizar?: number) {
    const id = idParaCotizar ?? orderIdRef.current;
    const ciudad = ciudadSeleccionadaRef.current;
    if (!id || !ciudad) return;
    setCotizando(true);
    setError('');
    setFleteSeleccionado(null);
    const res = await cotizarFlete(id, ciudad.code);
    setCotizando(false);
    setCotizaciones(res);
    if (!res.length) setError('No hay transportadoras disponibles para esa ciudad');
  }

  async function elegirFlete(c: CotizacionFlete) {
    setFleteSeleccionado(c);
    refrescarSaldo();
    if (orderIdRef.current) await actualizarFleteYTransportadora(orderIdRef.current, c.fleteTotal, c.slug);
  }

  async function confirmarPago() {
    if (loader || !fleteSeleccionado || !orderId) return;
    if (saldo < SALDO_MINIMO_DROPSHIPPING) {
      setError(`Necesitas mínimo ${formatCOPMoneda(SALDO_MINIMO_DROPSHIPPING)} en tu billetera para continuar.`);
      setMostrarRecarga(true);
      return;
    }
    if (saldoInsuficiente) {
      setError(`Necesitas recargar tu billetera para completar este pedido: te falta ${formatCOPMoneda(totalAPagar - saldo)}.`);
      setMostrarRecarga(true);
      return;
    }

    setLoader(true);
    setError('');
    const kind = mode === 'dropshipping' && seguroActivo ? 'flete_seguro_pedido' : 'flete_pedido';
    const res = await debitWalletDropshipper(dataUser.id, totalAPagar, orderId, kind);
    if (!res.success) {
      setLoader(false);
      setError(res.message || 'No pudimos procesar el pago');
      refrescarSaldo();
      return;
    }
    await actualizarFleteYTransportadora(orderId, fleteSeleccionado.fleteTotal, fleteSeleccionado.slug);
    await generarGuia(orderId, fleteSeleccionado.slug);
  }

  async function generarGuia(id: number, transportadoraSelect: string) {
    const res = await generarGuiaEnvio(id, transportadoraSelect);
    setLoader(false);
    if (!res.ok) {
      setError('Ya cobramos tu pedido pero no pudimos generar la guia de envio');
      setGuiaGenerada('');
      return;
    }
    setGuiaGenerada(res.guia || '');
    await marcarPedidoEnPreparacion(id);
    setPaso('exito');
  }

  async function reintentarGuia() {
    if (!orderId || !fleteSeleccionado) return;
    setLoader(true);
    setError('');
    await generarGuia(orderId, fleteSeleccionado.slug);
  }

  async function cancelarYReembolsar() {
    if (!orderId) return;
    if (!window.confirm('Cancelar pedido: se te devolvera el saldo debitado a tu billetera. ¿Continuar?')) return;
    setLoader(true);
    await refundWalletDropshipper(dataUser.id, totalAPagar, orderId);
    await marcarPedidoRechazadoSinReembolso(orderId);
    setLoader(false);
    onClose();
  }

  function abrirRecarga() {
    setError('');
    setMostrarRecarga(true);
  }

  function cerrarRecarga() {
    setMostrarRecarga(false);
    if (pollingRecarga.current) {
      clearInterval(pollingRecarga.current);
      pollingRecarga.current = null;
    }
  }

  async function lanzarRecarga() {
    const monto = Number(montoRecarga) || 0;
    if (monto < 10000) {
      setError('El monto minimo de recarga es $10.000');
      return;
    }
    if (procesandoRecarga) return;
    setProcesandoRecarga(true);
    setError('');

    const codigo = 'TOPUP-' + Date.now().toString(36).toUpperCase();
    const ok = await createTopup(dataUser.id, monto, codigo);
    setProcesandoRecarga(false);
    if (!ok) {
      setError('No pudimos iniciar la recarga, intenta de nuevo');
      return;
    }
    abrirEpaycoRecarga(monto, codigo);
    iniciarPollingRecarga(codigo);
  }

  function abrirEpaycoRecarga(monto: number, codigo: string) {
    const obj = {
      name: 'Recarga billetera dropshipper',
      invoice: codigo,
      currency: 'cop',
      amount: monto,
      tax_base: '0',
      tax: '0',
      country: 'co',
      test: ESTADO_PRUEBA_PAGOS,
      lang: 'es',
      external: 'true',
      name_billing: [dataUser.nombre, dataUser.apellido].filter(Boolean).join(' '),
      email_billing: dataUser.email || '',
      mobilephone_billing: dataUser.telefono || '',
    };
    try {
      if (!window.ePayco) throw new Error('ePayco no cargo');
      const handler = window.ePayco.checkout.configure({ key: KEY_EPAYCO, test: ESTADO_PRUEBA_PAGOS });
      handler.open(obj);
    } catch {
      setError('Error abriendo el pago');
    }
  }

  function iniciarPollingRecarga(codigo: string) {
    if (pollingRecarga.current) clearInterval(pollingRecarga.current);
    let intentos = 0;
    pollingRecarga.current = setInterval(async () => {
      intentos++;
      const res = await getTopupStatus(codigo);
      if (res && res.status === 2) {
        if (pollingRecarga.current) clearInterval(pollingRecarga.current);
        pollingRecarga.current = null;
        await refrescarSaldo();
        setMostrarRecarga(false);
      } else if (intentos > 60) {
        if (pollingRecarga.current) clearInterval(pollingRecarga.current);
        pollingRecarga.current = null;
      }
    }, 4000);
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <Script src="https://checkout.epayco.co/checkout.js" strategy="lazyOnload" />
      <div
        className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl"
        style={{ fontFamily: 'inherit' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h4 className="m-0 text-lg font-bold" style={{ color: '#1f2937' }}>
              {mode === 'muestra' ? 'Pedir muestra' : 'Hacer Dropshipping'}
            </h4>
            <p className="m-0 mt-0.5 text-[13px]" style={{ color: '#6b7280' }}>
              {producto.pro_nombre}
            </p>
            <span
              className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ background: 'rgba(2, 160, 227, 0.12)', color: '#0288c2' }}
            >
              {mode === 'muestra' ? 'Envío a tu dirección' : 'Envío a tu cliente'}
            </span>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#f1f3f5' }}>
            <X className="h-4 w-4" style={{ color: '#6b7280' }} />
          </button>
        </div>

        <div className="px-5 py-4">
          {paso === 'exito' ? (
            <div className="px-2 py-6 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <Check className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-bold" style={{ color: '#1f2937' }}>
                ¡Pedido #{orderId} creado!
              </h4>
              <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
                Se descontaron <strong style={{ color: '#1f2937' }}>{formatCOPMoneda(totalAPagar)}</strong> de tu billetera (
                {[
                  fleteDesdeWallet ? 'flete' : null,
                  mode === 'dropshipping' && clientePago ? 'producto' : null,
                  mode === 'dropshipping' && seguroActivo ? 'seguro' : null,
                ]
                  .filter(Boolean)
                  .join(' + ')}
                ).
              </p>
              {totalRecaudo > 0 && (
                <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
                  Recuerda cobrar <strong style={{ color: '#1f2937' }}>{formatCOPMoneda(totalRecaudo)}</strong> contra entrega al recibir el pedido.
                </p>
              )}
              {mode === 'dropshipping' && !clientePago && (
                <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
                  Apenas el pedido se entregue con éxito, se te devuelve el flete a tu billetera — no es un gasto perdido.
                </p>
              )}
              {guiaGenerada && (
                <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
                  Guía generada: <strong style={{ color: '#1f2937' }}>{guiaGenerada}</strong>
                </p>
              )}
              <div className="mt-4 flex justify-center">
                <button onClick={onClose} className="rounded-full px-6 py-2.5 text-sm font-bold text-white" style={{ background: '#02a0e3' }}>
                  Cerrar
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Resumen del producto */}
              <div className="mb-4.5">
                <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                  {producto.foto && (
                    // eslint-disable-next-line @next/next/no-img-element -- foto de Supabase Storage
                    <img src={producto.foto} alt="" className="h-14 w-14 shrink-0 rounded-[10px] border object-cover" style={{ borderColor: '#e5e7eb', background: '#fff' }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-bold">{producto.pro_nombre}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs" style={{ color: '#6b7280' }}>
                      {colorSeleccionado && (
                        <span className="rounded-full border bg-white px-2 py-0.5" style={{ borderColor: '#e5e7eb' }}>
                          Color: {colorSeleccionado}
                        </span>
                      )}
                      {tallaSeleccionada && (
                        <span className="rounded-full border bg-white px-2 py-0.5" style={{ borderColor: '#e5e7eb' }}>
                          Talla: {tallaSeleccionada}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-[15px] font-bold" style={{ color: '#0288c2' }}>
                    {formatCOPMoneda(precioUnitario)}
                  </div>
                </div>
                {mode === 'muestra' && (
                  <p className="mx-0.5 mt-2 text-xs" style={{ color: '#6b7280' }}>
                    Esta muestra llega a tu propia dirección de registro (no a un cliente).
                  </p>
                )}
              </div>

              {/* Precio editable + envio incluido/aparte (solo dropshipping) */}
              {mode === 'dropshipping' && (
                <div className="mb-4.5">
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                    Precio y envío
                  </p>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      {clientePago ? 'Valor que ya te pagó el cliente por el producto (COP) *' : 'Precio a cobrar al cliente (COP) *'}
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm disabled:bg-gray-100"
                      style={{ borderColor: '#e5e7eb' }}
                      type="text"
                      inputMode="numeric"
                      value={precioVentaClienteStr}
                      onChange={(e) => onPrecioInput(e.target.value)}
                      disabled={camposBloqueados}
                      placeholder="Ej: 80.000"
                    />
                  </div>

                  <label
                    className="mt-2.5 flex cursor-pointer items-start gap-2.5 rounded-[10px] border p-3"
                    style={{ borderColor: clientePago ? '#02a0e3' : '#e5e7eb', background: clientePago ? 'rgba(2,160,227,0.06)' : '#fff' }}
                  >
                    <input
                      type="checkbox"
                      checked={clientePago}
                      onChange={() => setClientePago((v) => !v)}
                      disabled={camposBloqueados}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="m-0 text-[13px] font-bold" style={{ color: '#1f2937' }}>
                        💰 Mi cliente ya me pagó el producto
                      </p>
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                        {clientePago
                          ? 'El mensajero NO cobrará el producto -- ya te lo pagaron por fuera. Ese valor se descuenta de tu billetera.'
                          : 'Actívalo si tu cliente ya te transfirió/pagó el producto antes del envío (fuera de la plataforma).'}
                      </p>
                    </div>
                  </label>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={camposBloqueados}
                      onClick={() => setEnvioIncluido(true)}
                      className="rounded-[10px] border px-1.5 py-2.5 text-[13px] font-bold"
                      style={envioIncluido ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)', color: '#0288c2' } : { borderColor: '#e5e7eb', color: '#1f2937' }}
                    >
                      {clientePago ? 'También pagó el envío' : 'Envío incluido'}
                    </button>
                    <button
                      type="button"
                      disabled={camposBloqueados}
                      onClick={() => setEnvioIncluido(false)}
                      className="rounded-[10px] border px-1.5 py-2.5 text-[13px] font-bold"
                      style={!envioIncluido ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)', color: '#0288c2' } : { borderColor: '#e5e7eb', color: '#1f2937' }}
                    >
                      {clientePago ? 'Envío lo paga aparte' : 'Envío aparte'}
                    </button>
                  </div>
                  <p className="mx-0.5 mt-2 text-[11.5px]" style={{ color: '#6b7280' }}>
                    {clientePago
                      ? envioIncluido
                        ? 'Tu cliente ya pagó todo (producto + envío): no se cobra nada contra entrega, el flete también sale de tu billetera.'
                        : 'Tu cliente ya pagó el producto, pero el envío lo paga aparte al mensajero cuando reciba.'
                      : envioIncluido
                        ? 'El precio de arriba ya incluye el flete: el mensajero solo cobra ese valor.'
                        : 'El mensajero cobrará el precio de arriba MÁS el flete, por separado.'}
                  </p>
                </div>
              )}

              {/* Datos de envio */}
              <div className="mb-4.5">
                <p className="mb-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                  Datos de envío
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Nombre completo
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm disabled:bg-gray-100"
                      style={{ borderColor: '#e5e7eb' }}
                      value={cliente.nombre}
                      onChange={(e) => {
                        setCliente((c) => ({ ...c, nombre: soloLetras(e.target.value) }));
                        onCampoChange();
                      }}
                      disabled={destinatarioBloqueado || camposBloqueados}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Teléfono
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm disabled:bg-gray-100"
                      style={{ borderColor: '#e5e7eb' }}
                      inputMode="numeric"
                      value={cliente.telefono}
                      onChange={(e) => {
                        setCliente((c) => ({ ...c, telefono: soloNumeros(e.target.value) }));
                        onCampoChange();
                      }}
                      disabled={destinatarioBloqueado || camposBloqueados}
                    />
                  </div>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Dirección
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm disabled:bg-gray-100"
                      style={{ borderColor: '#e5e7eb' }}
                      value={cliente.direccion}
                      onChange={(e) => {
                        setCliente((c) => ({ ...c, direccion: letrasYNumeros(e.target.value) }));
                        onCampoChange();
                      }}
                      disabled={destinatarioBloqueado || camposBloqueados}
                      placeholder="Calle, número, detalles de entrega"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Barrio
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm disabled:bg-gray-100"
                      style={{ borderColor: '#e5e7eb' }}
                      value={cliente.barrio}
                      onChange={(e) => {
                        setCliente((c) => ({ ...c, barrio: letrasYNumeros(e.target.value) }));
                        onCampoChange();
                      }}
                      disabled={camposBloqueados}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Cantidad
                    </label>
                    <div className="relative w-[110px]">
                      <input
                        type="number"
                        min={1}
                        className="w-full rounded-[10px] border py-2 pl-3 pr-7 text-sm disabled:bg-gray-100"
                        style={{ borderColor: '#e5e7eb' }}
                        value={cantidad}
                        onChange={(e) => onCantidadChange(e.target.value)}
                        disabled={camposBloqueados}
                      />
                      {!camposBloqueados && (
                        <div className="absolute inset-y-[1px] right-[1px] flex w-[22px] flex-col overflow-hidden rounded-r-[10px] border-l" style={{ borderColor: '#e5e7eb' }}>
                          <button type="button" onClick={incrementarCantidad} className="flex flex-1 items-center justify-center border-b" style={{ background: '#f8fafc', borderColor: '#e5e7eb' }}>
                            <ChevronUp className="h-2.5 w-2.5" style={{ color: '#6b7280' }} />
                          </button>
                          <button type="button" onClick={decrementarCantidad} className="flex flex-1 items-center justify-center" style={{ background: '#f8fafc' }}>
                            <ChevronDown className="h-2.5 w-2.5" style={{ color: '#6b7280' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="relative flex flex-col gap-1 sm:col-span-2">
                    <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                      Ciudad destino
                    </label>
                    <input
                      className="w-full rounded-[10px] border px-3 py-2 text-sm"
                      style={{ borderColor: '#e5e7eb' }}
                      autoComplete="off"
                      value={ciudadQuery}
                      onChange={(e) => onCiudadInput(e.target.value)}
                      onFocus={() => setCiudadFocus(true)}
                      onBlur={() => setTimeout(() => setCiudadFocus(false), 180)}
                      placeholder="Ej: Medellín, Bogotá, Cali..."
                    />
                    {ciudadSeleccionada && (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs" style={{ color: '#16a34a' }}>
                        ✓ {ciudadSeleccionada.name}{' '}
                        <a className="cursor-pointer underline" style={{ color: '#6b7280' }} onClick={limpiarCiudad}>
                          cambiar
                        </a>
                      </p>
                    )}
                    {ciudadFocus && sugerencias.length > 0 && !ciudadSeleccionada && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[220px] overflow-y-auto rounded-[10px] border bg-white shadow-lg" style={{ borderColor: '#e5e7eb' }}>
                        {sugerencias.map((c, i) => (
                          <div
                            key={`${c.code}-${i}`}
                            className="cursor-pointer border-b px-3.5 py-2.5 text-sm last:border-b-0 hover:bg-gray-50"
                            style={{ borderColor: '#f1f3f5' }}
                            onMouseDown={() => seleccionarCiudad(c)}
                          >
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Movido aca arriba (antes vivia despues de elegir transportadora, escondido al
                    final del flujo) y activado por defecto -- pedido explicito del usuario
                    2026-07-18: quiere que "la gran mayoria" lo elija. Visible desde que abre el
                    formulario (el precio del seguro no depende de la transportadora elegida), y
                    el mensaje cambia a perdida en rojo cuando lo desmarca, en vez de solo mostrar
                    el costo de agregarlo -- la friccion queda del lado de QUITARLO. */}
                {mode === 'dropshipping' && (
                  <label
                    className="mt-3.5 flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5"
                    style={{ background: seguroActivo ? '#fffbeb' : '#fef2f2', borderColor: seguroActivo ? '#fde68a' : '#fecaca' }}
                  >
                    <input type="checkbox" checked={seguroActivo} onChange={() => setSeguroActivo((v) => !v)} className="mt-0.5" />
                    <div>
                      <p className="m-0 text-[13px] font-bold" style={{ color: '#1f2937' }}>
                        🛡️ Protección de flete (recomendado) <span style={{ color: '#92400e' }}>+ {formatCOPMoneda(5000)}</span>
                      </p>
                      {seguroActivo ? (
                        <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                          Activada: si el pedido se devuelve, de todas formas te devolvemos el flete completo a tu billetera.
                        </p>
                      ) : (
                        <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: '#dc2626' }}>
                          ⚠️ Sin protección: si el cliente rechaza el pedido, pierdes todo el flete que prepagaste, sin devolución.
                        </p>
                      )}
                    </div>
                  </label>
                )}

                {!fleteSeleccionado && (
                  <div className="mt-2.5 text-center">
                    <button
                      type="button"
                      disabled={loader || cotizando}
                      onClick={() => intentarCotizarAutomatico()}
                      className="py-1 text-[13px] font-semibold disabled:cursor-default"
                      style={{ color: loader || cotizando ? '#6b7280' : '#0288c2' }}
                    >
                      {loader || cotizando ? 'Cotizando…' : orderId ? '↻ Recotizar envío' : '↻ Cotizar envío'}
                    </button>
                  </div>
                )}
              </div>

              {/* Transportadoras */}
              {(cotizando || cotizaciones.length > 0) && (
                <div className="mb-4.5">
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                    Elige transportadora
                  </p>
                  {cotizando && (
                    <div className="rounded-2xl p-3.5 text-center text-sm" style={{ background: '#f8fafc', color: '#6b7280' }}>
                      Cotizando según el peso y las dimensiones del producto…
                    </div>
                  )}
                  {cotizaciones.map((c, i) => {
                    const activa = fleteSeleccionado === c;
                    return (
                      <div
                        key={`${c.slug}-${i}`}
                        onClick={() => elegirFlete(c)}
                        className="mb-2 flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] bg-white px-3.5 py-2.5"
                        style={activa ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.06)' } : { borderColor: '#e5e7eb' }}
                      >
                        {c.imgTrasp && (
                          // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
                          <img src={c.imgTrasp} alt="" className="h-[38px] w-[38px] shrink-0 rounded-lg bg-white object-contain" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="m-0 text-[13px] font-bold">{c.nombre}</p>
                          <p className="m-0 mt-0.5 text-xs" style={{ color: '#6b7280' }}>
                            {c.tiempoEstimado}
                          </p>
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-sm font-bold">{formatCOPMoneda(c.fleteTotal)}</div>
                        <div
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]"
                          style={activa ? { borderColor: '#02a0e3', background: '#02a0e3' } : { borderColor: '#e5e7eb' }}
                        >
                          {activa && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Resumen sin transportadora elegida */}
              {!fleteSeleccionado && (
                <div className="mb-4.5 rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span style={{ color: '#6b7280' }}>Precio unitario</span>
                    <strong>{formatCOPMoneda(precioUnitario)}</strong>
                  </div>
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span style={{ color: '#6b7280' }}>Valor producto ({cantidad} und)</span>
                    <strong>{formatCOPMoneda(subtotal)}</strong>
                  </div>
                </div>
              )}

              {/* Resumen y pago */}
              {fleteSeleccionado && (
                <div className="mb-4.5">
                  <p className="mb-2.5 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                    Resumen y pago
                  </p>
                  <div className="rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                    <div className="flex items-center justify-between py-1.5 text-sm">
                      <span style={{ color: '#6b7280' }}>Valor producto ({cantidad} und)</span>
                      <strong>{formatCOPMoneda(subtotal)}</strong>
                    </div>
                    {mode === 'dropshipping' && clientePago ? (
                      <p className="-mt-1.5 mb-2 text-xs" style={{ color: '#6b7280' }}>
                        {totalRecaudo > 0
                          ? <>El mensajero cobra <strong>{formatCOPMoneda(totalRecaudo)}</strong> de flete al entregar (el producto ya te lo pagaron).</>
                          : 'Envío 100% prepagado: el mensajero no cobra nada al entregar.'}
                      </p>
                    ) : (
                      <p className="-mt-1.5 mb-2 text-xs" style={{ color: '#6b7280' }}>
                        Cobras <strong>{formatCOPMoneda(totalRecaudo)}</strong> contra entrega al recibir el pedido
                        {mode === 'dropshipping' && !envioIncluido ? ' (producto + flete por separado)' : ''}. No se descuenta de tu billetera.
                      </p>
                    )}
                    {mode === 'dropshipping' && clientePago && (
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span style={{ color: '#6b7280' }}>Producto (ya pagado por tu cliente)</span>
                        <strong>+ {formatCOPMoneda(subtotal)}</strong>
                      </div>
                    )}
                    {mode === 'dropshipping' && seguroActivo && (
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span style={{ color: '#6b7280' }}>Seguro antidevoluciones</span>
                        <strong>+ {formatCOPMoneda(5000)}</strong>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between border-t border-dashed pt-2.5 text-base font-bold" style={{ borderColor: '#e5e7eb' }}>
                      <span>Total · se descuenta de tu billetera</span>
                      <span>{formatCOPMoneda(totalAPagar)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs" style={{ color: '#6b7280' }}>
                      <span>Saldo en tu billetera</span>
                      <strong style={saldoInsuficiente ? { color: '#dc2626' } : undefined}>{formatCOPMoneda(saldo)}</strong>
                    </div>
                  </div>

                  {saldoInsuficiente && !mostrarRecarga && (
                    <div className="mt-2.5 rounded-[10px] p-3.5 text-[13px]" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <p className="m-0 mb-2">Saldo insuficiente para confirmar el pedido.</p>
                      <button onClick={abrirRecarga} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: '#dc2626' }}>
                        Recargar Billetera de fletes
                      </button>
                    </div>
                  )}

                  {mostrarRecarga && (
                    <div className="mt-2.5 rounded-2xl border p-3.5" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                      {error && (
                        <p className="mb-2.5 text-[13px] font-semibold" style={{ color: '#dc2626' }}>
                          {error}
                        </p>
                      )}
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                        Recargar Billetera de fletes
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {MONTOS_SUGERIDOS.map((m) => (
                          <button
                            key={m}
                            onClick={() => setMontoRecarga(m)}
                            className="rounded-[10px] border-[1.5px] bg-white py-2.5 text-center text-[13px] font-bold"
                            style={montoRecarga === m ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)', color: '#0288c2' } : { borderColor: '#e5e7eb', color: '#1f2937' }}
                          >
                            {formatCOPMoneda(m)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-2.5 flex flex-col gap-1">
                        <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                          Otro monto
                        </label>
                        <input
                          type="number"
                          className="w-full rounded-[10px] border px-3 py-2 text-sm"
                          style={{ borderColor: '#e5e7eb' }}
                          value={montoRecarga}
                          onChange={(e) => setMontoRecarga(Number(e.target.value))}
                        />
                      </div>
                      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                        <button onClick={cerrarRecarga} className="rounded-full px-3.5 py-1.5 text-xs font-bold" style={{ background: '#f1f3f5', color: '#1f2937' }}>
                          Cancelar
                        </button>
                        <button onClick={lanzarRecarga} disabled={procesandoRecarga} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60" style={{ background: '#02a0e3' }}>
                          {procesandoRecarga ? 'Abriendo…' : 'Pagar recarga'}
                        </button>
                      </div>
                    </div>
                  )}

                  {!mostrarRecarga && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2.5">
                      {error && (
                        <button onClick={cancelarYReembolsar} className="rounded-full px-5.5 py-2.5 text-sm font-bold" style={{ background: '#f1f3f5', color: '#1f2937' }}>
                          Cancelar pedido
                        </button>
                      )}
                      <button
                        onClick={() => (error ? reintentarGuia() : confirmarPago())}
                        disabled={loader}
                        className="rounded-full px-5.5 py-2.5 text-sm font-bold text-white disabled:opacity-55"
                        style={{ background: '#02a0e3', boxShadow: '0 4px 10px rgba(2,160,227,0.3)' }}
                      >
                        {loader ? 'Procesando…' : error ? 'Reintentar guía' : 'Confirmar y pagar'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {error && !fleteSeleccionado && (
                <div className="mt-1 rounded-[10px] p-3.5 text-[13px]" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {error}
                </div>
              )}
              {loader && !orderId && (
                <p className="mt-2 text-center text-sm" style={{ color: '#6b7280' }}>
                  Creando pedido…
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
