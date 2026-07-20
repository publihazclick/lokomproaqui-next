'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Script from 'next/script';
import { ChevronLeft, X, Check, Truck, PackageCheck, Wallet as WalletIcon } from 'lucide-react';
import { type DataUserCompleto } from '@/lib/usuarios';
import { getBalanceDropshipper, createTopup, getTopupStatus, SALDO_MINIMO_DROPSHIPPING } from '@/lib/wallet';
import { fetchSeguroObligatorio } from '@/lib/ventas';
import {
  fetchPickupAddress,
  guardarPickupAddress,
  crearGuiaBorrador,
  cotizarGuia,
  actualizarTransportadoraGuia,
  actualizarSeguroGuia,
  generarGuia,
  buscarCiudadesMipaquete,
  TAMANOS_PAQUETE,
  COSTO_SEGURO_GUIA,
  type CiudadMipaquete,
  type CotizacionGuia,
  type PickupAddress,
} from '@/lib/guias';

// Wizard del modulo "Generacion de Guias" (pedido explicito del usuario 2026-07-20): version
// "para cualquiera" de DropshippingCheckoutModal.tsx -- mismo estilo visual (tarjetas redondeadas,
// celeste de marca #02a0e3/#0177a8, checkbox de seguro con 3 mensajes, resumen con saldo
// insuficiente + recarga inline via ePayco), pero para un paquete SUELTO sin producto de la tienda
// detras: destinatario libre, tamaño de paquete por botones grandes, contra_entrega/pago_anticipado
// en vez de dropshipping/muestra.
const ESTADO_PRUEBA_PAGOS = false;
const KEY_EPAYCO = '62977a30b1a19dcd0728f6b639b33fb0';

declare global {
  interface Window {
    ePayco?: { checkout: { configure: (opts: { key: string; test: boolean }) => { open: (obj: Record<string, unknown>) => void } } };
  }
}

type Paso = 'remitente' | 'destinatario' | 'paquete' | 'pago' | 'transportadora' | 'seguro' | 'resumen' | 'exito';

const MONTOS_SUGERIDOS = [30000, 50000, 100000, 200000, 500000];

function formatCOPMoneda(n: number): string {
  return `$ ${Math.round(n || 0).toLocaleString('es-CO')}`;
}

const soloLetras = (v: string) => (v || '').replace(/[^A-Za-zÀ-ÿ\s'-]/g, '');
const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');
const letrasYNumeros = (v: string) => (v || '').replace(/[^A-Za-z0-9À-ÿ\s#.,-]/g, '');

interface GuiaWizardProps {
  dataUser: DataUserCompleto;
  onClose: () => void;
  onGenerada?: () => void;
}

export function GuiaWizard({ dataUser, onClose, onGenerada }: GuiaWizardProps) {
  const [cargandoInicial, setCargandoInicial] = useState(true);
  const [paso, setPaso] = useState<Paso>('destinatario');
  const [tieneRemitente, setTieneRemitente] = useState(true);
  const [loader, setLoader] = useState(false);
  const [error, setError] = useState('');

  // Paso 1: remitente (solo si el vendedor no tiene datos guardados aun)
  const [remitente, setRemitente] = useState({ firstName: '', lastName: '', idDocument: '', whatsapp: dataUser.telefono || '', address: dataUser.direccion || '', email: dataUser.email || '' });
  const [ciudadOrigenQuery, setCiudadOrigenQuery] = useState('');
  const [sugerenciasOrigen, setSugerenciasOrigen] = useState<CiudadMipaquete[]>([]);
  const [ciudadOrigenFocus, setCiudadOrigenFocus] = useState(false);
  const [ciudadOrigenSeleccionada, setCiudadOrigenSeleccionada] = useState<CiudadMipaquete | null>(null);
  const ciudadOrigenDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paso 2: destinatario
  const [destinatario, setDestinatario] = useState({ nombre: '', telefono: '', direccion: '', barrio: '', referencia: '' });
  const [ciudadQuery, setCiudadQuery] = useState('');
  const [sugerencias, setSugerencias] = useState<CiudadMipaquete[]>([]);
  const [ciudadFocus, setCiudadFocus] = useState(false);
  const [ciudadSeleccionada, setCiudadSeleccionada] = useState<CiudadMipaquete | null>(null);
  const ciudadDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Paso 3: paquete
  const [tamanoId, setTamanoId] = useState('chica');
  const tamano = TAMANOS_PAQUETE.find((t) => t.id === tamanoId) || TAMANOS_PAQUETE[1];
  const [pesoManual, setPesoManual] = useState(3);
  const [anchoManual, setAnchoManual] = useState(20);
  const [altoManual, setAltoManual] = useState(20);
  const [largoManual, setLargoManual] = useState(20);
  const [valorDeclarado, setValorDeclarado] = useState('');
  const [contenido, setContenido] = useState('');

  // Paso 4: pago
  const [paymentType, setPaymentType] = useState<'contra_entrega' | 'pago_anticipado'>('contra_entrega');
  const [valorCobrar, setValorCobrar] = useState('');

  // Paso 5: transportadora
  const [shipmentId, setShipmentId] = useState<number | null>(null);
  const [cotizando, setCotizando] = useState(false);
  const [cotizaciones, setCotizaciones] = useState<CotizacionGuia[]>([]);
  const [transportadora, setTransportadora] = useState<CotizacionGuia | null>(null);

  // Paso 6: seguro
  const [seguroObligatorio, setSeguroObligatorio] = useState(false);
  const [seguroActivo, setSeguroActivo] = useState(true);

  // Paso 7: resumen / wallet
  const [saldo, setSaldo] = useState(0);
  const [mostrarRecarga, setMostrarRecarga] = useState(false);
  const [procesandoRecarga, setProcesandoRecarga] = useState(false);
  const [montoRecarga, setMontoRecarga] = useState(30000);
  const pollingRecarga = useRef<ReturnType<typeof setInterval> | null>(null);

  const [guiaGenerada, setGuiaGenerada] = useState('');

  useEffect(() => {
    (async () => {
      const [pickup, seguro, bal] = await Promise.all([
        fetchPickupAddress(dataUser.id),
        fetchSeguroObligatorio(dataUser.id, []),
        getBalanceDropshipper(dataUser.id),
      ]);
      if (pickup) {
        setTieneRemitente(true);
        setPaso('destinatario');
      } else {
        setTieneRemitente(false);
        setRemitente((r) => ({ ...r, firstName: dataUser.nombre || '', lastName: dataUser.apellido || '' }));
        setPaso('remitente');
      }
      setSeguroObligatorio(seguro);
      setSeguroActivo(seguro);
      setSaldo(bal);
      setCargandoInicial(false);
    })();
    return () => {
      if (ciudadDebounce.current) clearTimeout(ciudadDebounce.current);
      if (ciudadOrigenDebounce.current) clearTimeout(ciudadOrigenDebounce.current);
      if (pollingRecarga.current) clearInterval(pollingRecarga.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const peso = tamanoId === 'personalizar' ? pesoManual : tamano.weight || 1;
  const ancho = tamanoId === 'personalizar' ? anchoManual : tamano.width || 20;
  const alto = tamanoId === 'personalizar' ? altoManual : tamano.height || 20;
  const largo = tamanoId === 'personalizar' ? largoManual : tamano.length || 20;
  const declaredValueNum = Number(valorDeclarado) || 0;
  const collectionValueNum = paymentType === 'contra_entrega' ? Number(valorCobrar) || 0 : 0;

  const flete = transportadora?.fleteTotal || 0;
  const totalAPagar = flete + (seguroActivo ? COSTO_SEGURO_GUIA : 0);
  const saldoInsuficiente = totalAPagar > saldo;

  function onCiudadInput(valor: string) {
    const sanitized = soloLetras(valor);
    setCiudadQuery(sanitized);
    setCiudadSeleccionada(null);
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
  }

  function onCiudadOrigenInput(valor: string) {
    const sanitized = soloLetras(valor);
    setCiudadOrigenQuery(sanitized);
    setCiudadOrigenSeleccionada(null);
    if (ciudadOrigenDebounce.current) clearTimeout(ciudadOrigenDebounce.current);
    ciudadOrigenDebounce.current = setTimeout(() => buscarCiudadesOrigenLocal(sanitized), 250);
  }

  async function buscarCiudadesOrigenLocal(q: string) {
    if (q.trim().length < 2) {
      setSugerenciasOrigen([]);
      return;
    }
    setSugerenciasOrigen(await buscarCiudadesMipaquete(q));
  }

  function seleccionarCiudadOrigen(c: CiudadMipaquete) {
    setCiudadOrigenSeleccionada(c);
    setCiudadOrigenQuery(c.name);
    setSugerenciasOrigen([]);
    setCiudadOrigenFocus(false);
  }

  function formValidoRemitente(): boolean {
    return !!remitente.firstName.trim() && !!remitente.lastName.trim() && !!remitente.idDocument.trim() && !!remitente.whatsapp.trim() && !!remitente.address.trim() && !!ciudadOrigenSeleccionada;
  }

  function formValidoDestinatario(): boolean {
    return !!destinatario.nombre.trim() && !!destinatario.telefono.trim() && !!destinatario.direccion.trim() && !!destinatario.barrio.trim() && !!ciudadSeleccionada;
  }

  function formValidoPaquete(): boolean {
    return peso > 0 && ancho > 0 && alto > 0 && largo > 0 && declaredValueNum > 0 && !!contenido.trim();
  }

  function formValidoPago(): boolean {
    return paymentType === 'pago_anticipado' || collectionValueNum > 0;
  }

  async function confirmarRemitente() {
    if (!formValidoRemitente()) {
      setError(!ciudadOrigenSeleccionada ? 'Elige tu ciudad de recogida para continuar' : 'Completa tus datos de remitente para continuar');
      return;
    }
    setLoader(true);
    setError('');
    const ok = await guardarPickupAddress(dataUser.id, { ...remitente, cityName: ciudadOrigenSeleccionada!.name, cityDaneCode: ciudadOrigenSeleccionada!.code });
    setLoader(false);
    if (!ok) {
      setError('No pudimos guardar tus datos, intenta de nuevo');
      return;
    }
    setPaso('destinatario');
  }

  function continuarDestinatario() {
    if (!formValidoDestinatario()) {
      setError('Completa todos los campos (incluida la ciudad) para continuar');
      return;
    }
    setError('');
    setPaso('paquete');
  }

  function continuarPaquete() {
    if (!formValidoPaquete()) {
      setError('Completa el peso/medidas, el valor declarado y qué envías');
      return;
    }
    setError('');
    setPaso('pago');
  }

  async function continuarPago() {
    if (!formValidoPago()) {
      setError('Indica cuánto debe cobrar el mensajero al entregar');
      return;
    }
    setError('');
    setLoader(true);
    const id = await crearGuiaBorrador(dataUser.id, {
      paymentType,
      collectionValue: collectionValueNum,
      declaredValue: declaredValueNum,
      contentDescription: contenido.trim(),
      weight: peso,
      width: ancho,
      height: alto,
      length: largo,
      receiverName: destinatario.nombre.trim(),
      receiverPhone: destinatario.telefono.trim(),
      receiverAddress: destinatario.direccion.trim(),
      receiverCity: ciudadSeleccionada?.name || '',
      receiverNeighborhood: destinatario.barrio.trim(),
      receiverReference: destinatario.referencia.trim(),
      destinoDaneCode: ciudadSeleccionada?.code || '',
    });
    if (!id) {
      setLoader(false);
      setError('No pudimos guardar la guía, intenta de nuevo');
      return;
    }
    setShipmentId(id);
    setPaso('transportadora');
    await cotizar(id);
    setLoader(false);
  }

  async function cotizar(id: number) {
    if (!ciudadSeleccionada) return;
    setCotizando(true);
    setError('');
    const res = await cotizarGuia(dataUser.id, ciudadSeleccionada.code, { weight: peso, width: ancho, height: alto, length: largo, declaredValue: declaredValueNum });
    setCotizando(false);
    setCotizaciones(res.cotizaciones);
    if (res.seguroObligatorio) {
      setSeguroObligatorio(true);
      setSeguroActivo(true);
    }
    if (!res.cotizaciones.length) setError('No hay transportadoras disponibles para esa ciudad');
    void id;
  }

  async function elegirTransportadora(c: CotizacionGuia) {
    setTransportadora(c);
    if (shipmentId) await actualizarTransportadoraGuia(shipmentId, c.slug, c.nombre, c.fleteTotal, c.imgTrasp);
  }

  function continuarTransportadora() {
    if (!transportadora) {
      setError('Elige una transportadora para continuar');
      return;
    }
    setError('');
    setPaso('seguro');
  }

  async function continuarSeguro() {
    if (shipmentId) await actualizarSeguroGuia(shipmentId, seguroActivo);
    setError('');
    setPaso('resumen');
  }

  async function confirmarYGenerar() {
    if (loader || !shipmentId) return;
    if (saldo < SALDO_MINIMO_DROPSHIPPING) {
      setError(`Necesitas mínimo ${formatCOPMoneda(SALDO_MINIMO_DROPSHIPPING)} en tu billetera para continuar.`);
      setMostrarRecarga(true);
      return;
    }
    if (saldoInsuficiente) {
      setError(`Necesitas recargar tu billetera: te falta ${formatCOPMoneda(totalAPagar - saldo)}.`);
      setMostrarRecarga(true);
      return;
    }
    setLoader(true);
    setError('');
    const res = await generarGuia(shipmentId);
    setLoader(false);
    if (!res.ok) {
      setError(res.message || 'No pudimos generar la guía, intenta de nuevo');
      return;
    }
    setGuiaGenerada(res.guia || '');
    setPaso('exito');
    onGenerada?.();
  }

  async function refrescarSaldo() {
    setSaldo(await getBalanceDropshipper(dataUser.id));
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
      setError('El monto mínimo de recarga es $10.000');
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

  const ORDEN_PASOS: Paso[] = useMemo(() => (tieneRemitente ? ['destinatario', 'paquete', 'pago', 'transportadora', 'seguro', 'resumen'] : ['remitente', 'destinatario', 'paquete', 'pago', 'transportadora', 'seguro', 'resumen']), [tieneRemitente]);
  const indicePaso = ORDEN_PASOS.indexOf(paso);
  const progreso = paso === 'exito' ? 100 : Math.round(((indicePaso + 1) / ORDEN_PASOS.length) * 100);

  const TITULOS: Record<Paso, string> = {
    remitente: 'Tus datos de remitente',
    destinatario: '¿A quién le envías?',
    paquete: '¿Qué envías?',
    pago: '¿Cómo se paga?',
    transportadora: 'Elige transportadora',
    seguro: 'Protección antidevoluciones',
    resumen: 'Resumen y pago',
    exito: '¡Guía generada!',
  };

  function volver() {
    setError('');
    const idx = ORDEN_PASOS.indexOf(paso);
    if (idx > 0) setPaso(ORDEN_PASOS[idx - 1]);
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <Script src="https://checkout.epayco.co/checkout.js" strategy="lazyOnload" />
      <div className="max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b px-5 py-4" style={{ borderColor: '#e5e7eb' }}>
          <div className="flex min-w-0 items-center gap-2.5">
            {paso !== 'exito' && indicePaso > 0 && (
              <button onClick={volver} aria-label="Atrás" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#f1f3f5' }}>
                <ChevronLeft className="h-4 w-4" style={{ color: '#6b7280' }} />
              </button>
            )}
            <div className="min-w-0">
              <h4 className="m-0 flex items-center gap-1.5 truncate text-lg font-bold" style={{ color: '#1f2937' }}>
                <Truck className="h-5 w-5 shrink-0" style={{ color: '#0288c2' }} />
                {TITULOS[paso]}
              </h4>
              {paso !== 'exito' && (
                <p className="m-0 mt-0.5 text-[11px] font-semibold uppercase tracking-wide" style={{ color: '#9ca3af' }}>
                  Paso {indicePaso + 1} de {ORDEN_PASOS.length}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full" style={{ background: '#f1f3f5' }}>
            <X className="h-4 w-4" style={{ color: '#6b7280' }} />
          </button>
        </div>

        {paso !== 'exito' && (
          <div className="h-1.5 w-full" style={{ background: '#f1f3f5' }}>
            <div className="h-1.5 rounded-r-full transition-all duration-300" style={{ width: `${progreso}%`, background: 'linear-gradient(90deg,#0177a8,#02a0e3)' }} />
          </div>
        )}

        <div className="px-5 py-4">
          {cargandoInicial ? (
            <p className="py-10 text-center text-sm" style={{ color: '#6b7280' }}>
              Cargando…
            </p>
          ) : paso === 'exito' ? (
            <div className="px-2 py-6 text-center">
              <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                <Check className="h-7 w-7" />
              </div>
              <h4 className="text-lg font-bold" style={{ color: '#1f2937' }}>
                ¡Listo! Se descontó {formatCOPMoneda(totalAPagar)} de tu billetera
              </h4>
              {guiaGenerada && (
                <p className="mt-2 text-sm" style={{ color: '#6b7280' }}>
                  Número de guía: <strong style={{ color: '#1f2937' }}>{guiaGenerada}</strong> · {transportadora?.nombre}
                </p>
              )}
              {paymentType === 'contra_entrega' && collectionValueNum > 0 && (
                <p className="mt-1 text-sm" style={{ color: '#6b7280' }}>
                  El mensajero cobrará <strong style={{ color: '#1f2937' }}>{formatCOPMoneda(collectionValueNum)}</strong> al entregar.
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
              {paso === 'remitente' && (
                <div className="flex flex-col gap-3">
                  <p className="-mt-1 text-xs" style={{ color: '#6b7280' }}>
                    Solo lo pedimos una vez: es quién figura como remitente en todas tus guías.
                  </p>
                  <Campo label="Nombres">
                    <input className={inputCls} value={remitente.firstName} onChange={(e) => setRemitente((r) => ({ ...r, firstName: soloLetras(e.target.value) }))} />
                  </Campo>
                  <Campo label="Apellidos">
                    <input className={inputCls} value={remitente.lastName} onChange={(e) => setRemitente((r) => ({ ...r, lastName: soloLetras(e.target.value) }))} />
                  </Campo>
                  <Campo label="Cédula">
                    <input className={inputCls} inputMode="numeric" value={remitente.idDocument} onChange={(e) => setRemitente((r) => ({ ...r, idDocument: soloNumeros(e.target.value) }))} />
                  </Campo>
                  <Campo label="WhatsApp">
                    <input className={inputCls} inputMode="numeric" value={remitente.whatsapp} onChange={(e) => setRemitente((r) => ({ ...r, whatsapp: soloNumeros(e.target.value) }))} />
                  </Campo>
                  <Campo label="Dirección de recogida">
                    <input className={inputCls} value={remitente.address} onChange={(e) => setRemitente((r) => ({ ...r, address: letrasYNumeros(e.target.value) }))} placeholder="Calle, número, detalles" />
                  </Campo>
                  <div className="relative">
                    <Campo label="Ciudad de recogida">
                      <input
                        className={inputCls}
                        autoComplete="off"
                        value={ciudadOrigenQuery}
                        onChange={(e) => onCiudadOrigenInput(e.target.value)}
                        onFocus={() => setCiudadOrigenFocus(true)}
                        onBlur={() => setTimeout(() => setCiudadOrigenFocus(false), 180)}
                        placeholder="Ej: Medellín, Bogotá, Cali..."
                      />
                    </Campo>
                    {ciudadOrigenSeleccionada && <p className="mt-1.5 text-xs" style={{ color: '#16a34a' }}>✓ {ciudadOrigenSeleccionada.name}</p>}
                    {ciudadOrigenFocus && sugerenciasOrigen.length > 0 && !ciudadOrigenSeleccionada && (
                      <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[200px] overflow-y-auto rounded-[10px] border bg-white shadow-lg" style={{ borderColor: '#e5e7eb' }}>
                        {sugerenciasOrigen.map((c, i) => (
                          <div key={`${c.code}-${i}`} className="cursor-pointer border-b px-3.5 py-2.5 text-sm last:border-b-0 hover:bg-gray-50" style={{ borderColor: '#f1f3f5' }} onMouseDown={() => seleccionarCiudadOrigen(c)}>
                            {c.name}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <Campo label="Email (opcional)">
                    <input className={inputCls} type="email" value={remitente.email} onChange={(e) => setRemitente((r) => ({ ...r, email: e.target.value }))} />
                  </Campo>
                </div>
              )}

              {paso === 'destinatario' && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Campo label="Nombre completo">
                      <input className={inputCls} value={destinatario.nombre} onChange={(e) => setDestinatario((d) => ({ ...d, nombre: soloLetras(e.target.value) }))} />
                    </Campo>
                    <Campo label="Teléfono">
                      <input className={inputCls} inputMode="numeric" value={destinatario.telefono} onChange={(e) => setDestinatario((d) => ({ ...d, telefono: soloNumeros(e.target.value) }))} />
                    </Campo>
                    <div className="sm:col-span-2">
                      <Campo label="Dirección">
                        <input className={inputCls} value={destinatario.direccion} onChange={(e) => setDestinatario((d) => ({ ...d, direccion: letrasYNumeros(e.target.value) }))} placeholder="Calle, número, detalles de entrega" />
                      </Campo>
                    </div>
                    <Campo label="Barrio">
                      <input className={inputCls} value={destinatario.barrio} onChange={(e) => setDestinatario((d) => ({ ...d, barrio: letrasYNumeros(e.target.value) }))} />
                    </Campo>
                    <Campo label="Punto de referencia (opcional)">
                      <input className={inputCls} value={destinatario.referencia} onChange={(e) => setDestinatario((d) => ({ ...d, referencia: letrasYNumeros(e.target.value) }))} placeholder="Ej: frente al parque" />
                    </Campo>
                    <div className="relative sm:col-span-2">
                      <Campo label="Ciudad destino">
                        <input
                          className={inputCls}
                          autoComplete="off"
                          value={ciudadQuery}
                          onChange={(e) => onCiudadInput(e.target.value)}
                          onFocus={() => setCiudadFocus(true)}
                          onBlur={() => setTimeout(() => setCiudadFocus(false), 180)}
                          placeholder="Ej: Medellín, Bogotá, Cali..."
                        />
                      </Campo>
                      {ciudadSeleccionada && <p className="mt-1.5 text-xs" style={{ color: '#16a34a' }}>✓ {ciudadSeleccionada.name}</p>}
                      {ciudadFocus && sugerencias.length > 0 && !ciudadSeleccionada && (
                        <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[200px] overflow-y-auto rounded-[10px] border bg-white shadow-lg" style={{ borderColor: '#e5e7eb' }}>
                          {sugerencias.map((c, i) => (
                            <div key={`${c.code}-${i}`} className="cursor-pointer border-b px-3.5 py-2.5 text-sm last:border-b-0 hover:bg-gray-50" style={{ borderColor: '#f1f3f5' }} onMouseDown={() => seleccionarCiudad(c)}>
                              {c.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {paso === 'paquete' && (
                <div className="flex flex-col gap-3">
                  <p className="-mt-1 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                    Tamaño del paquete
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {TAMANOS_PAQUETE.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTamanoId(t.id)}
                        className="rounded-[12px] border-[1.5px] p-3 text-left"
                        style={tamanoId === t.id ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)' } : { borderColor: '#e5e7eb' }}
                      >
                        <p className="m-0 text-sm font-bold" style={{ color: '#1f2937' }}>{t.label}</p>
                        <p className="m-0 mt-0.5 text-[11px]" style={{ color: '#6b7280' }}>{t.descripcion}</p>
                      </button>
                    ))}
                  </div>

                  {tamanoId === 'personalizar' && (
                    <div className="grid grid-cols-2 gap-3 rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                      <Campo label="Peso (kg)">
                        <input type="number" min={1} className={inputCls} value={pesoManual} onChange={(e) => setPesoManual(Number(e.target.value) || 1)} />
                      </Campo>
                      <Campo label="Alto (cm)">
                        <input type="number" min={1} className={inputCls} value={altoManual} onChange={(e) => setAltoManual(Number(e.target.value) || 1)} />
                      </Campo>
                      <Campo label="Ancho (cm)">
                        <input type="number" min={1} className={inputCls} value={anchoManual} onChange={(e) => setAnchoManual(Number(e.target.value) || 1)} />
                      </Campo>
                      <Campo label="Largo (cm)">
                        <input type="number" min={1} className={inputCls} value={largoManual} onChange={(e) => setLargoManual(Number(e.target.value) || 1)} />
                      </Campo>
                    </div>
                  )}

                  <Campo label="¿Qué contiene? (breve)">
                    <input className={inputCls} value={contenido} onChange={(e) => setContenido(letrasYNumeros(e.target.value))} placeholder="Ej: Ropa, celular, documentos..." />
                  </Campo>
                  <Campo label="Valor declarado del contenido (COP)">
                    <input type="text" inputMode="numeric" className={inputCls} value={valorDeclarado} onChange={(e) => setValorDeclarado(soloNumeros(e.target.value))} placeholder="Ej: 80000" />
                  </Campo>
                </div>
              )}

              {paso === 'pago' && (
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setPaymentType('contra_entrega')}
                      className="rounded-2xl border-[1.5px] p-3.5 text-left"
                      style={paymentType === 'contra_entrega' ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)' } : { borderColor: '#e5e7eb' }}
                    >
                      <p className="m-0 text-sm font-bold" style={{ color: '#1f2937' }}>📦 Contra entrega</p>
                      <p className="m-0 mt-1 text-xs" style={{ color: '#6b7280' }}>El mensajero cobra al recibir el destinatario.</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('pago_anticipado')}
                      className="rounded-2xl border-[1.5px] p-3.5 text-left"
                      style={paymentType === 'pago_anticipado' ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.08)' } : { borderColor: '#e5e7eb' }}
                    >
                      <p className="m-0 text-sm font-bold" style={{ color: '#1f2937' }}>✅ Pago anticipado</p>
                      <p className="m-0 mt-1 text-xs" style={{ color: '#6b7280' }}>Ya te pagaron, el mensajero no cobra nada.</p>
                    </button>
                  </div>

                  {paymentType === 'contra_entrega' && (
                    <Campo label="¿Cuánto debe cobrar el mensajero al entregar? (COP)">
                      <input type="text" inputMode="numeric" className={inputCls} value={valorCobrar} onChange={(e) => setValorCobrar(soloNumeros(e.target.value))} placeholder="Ej: 80000" />
                    </Campo>
                  )}
                  <p className="mx-0.5 text-[11.5px]" style={{ color: '#6b7280' }}>
                    El flete de tu guía siempre se paga desde tu billetera, sin importar el tipo de pago que elijas aquí.
                  </p>
                </div>
              )}

              {paso === 'transportadora' && (
                <div className="flex flex-col gap-2">
                  {cotizando && (
                    <div className="rounded-2xl p-5 text-center text-sm" style={{ background: '#f8fafc', color: '#6b7280' }}>
                      Cotizando según el peso y las medidas de tu paquete…
                    </div>
                  )}
                  {!cotizando &&
                    cotizaciones.map((c, i) => {
                      const activa = transportadora === c;
                      return (
                        <div
                          key={`${c.slug}-${i}`}
                          onClick={() => elegirTransportadora(c)}
                          className="flex cursor-pointer items-center gap-3 rounded-[10px] border-[1.5px] bg-white px-3.5 py-2.5"
                          style={activa ? { borderColor: '#02a0e3', background: 'rgba(2,160,227,0.06)' } : { borderColor: '#e5e7eb' }}
                        >
                          {c.imgTrasp && (
                            // eslint-disable-next-line @next/next/no-img-element -- logo de transportadora
                            <img src={c.imgTrasp} alt="" className="h-[38px] w-[38px] shrink-0 rounded-lg bg-white object-contain" />
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="m-0 text-[13px] font-bold">{c.nombre}</p>
                            <p className="m-0 mt-0.5 text-xs" style={{ color: '#6b7280' }}>{c.tiempoEstimado}</p>
                          </div>
                          <div className="shrink-0 whitespace-nowrap text-sm font-bold">{formatCOPMoneda(c.fleteTotal)}</div>
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px]" style={activa ? { borderColor: '#02a0e3', background: '#02a0e3' } : { borderColor: '#e5e7eb' }}>
                            {activa && <Check className="h-3 w-3 text-white" />}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {paso === 'seguro' && (
                <label
                  className="flex cursor-pointer items-start gap-2.5 rounded-2xl border p-3.5"
                  style={{ background: seguroActivo ? '#fffbeb' : '#fef2f2', borderColor: seguroActivo ? '#fde68a' : '#fecaca' }}
                >
                  <input type="checkbox" checked={seguroActivo} disabled={seguroObligatorio} onChange={() => setSeguroActivo((v) => !v)} className="mt-0.5" />
                  <div>
                    <p className="m-0 text-[13px] font-bold" style={{ color: '#1f2937' }}>
                      🛡️ Protección de flete (recomendado) <span style={{ color: '#92400e' }}>+ {formatCOPMoneda(COSTO_SEGURO_GUIA)}</span>
                    </p>
                    {seguroObligatorio ? (
                      <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: '#92400e' }}>
                        Obligatorio en esta guía: tu historial de devoluciones es alto.
                      </p>
                    ) : seguroActivo ? (
                      <p className="mt-1 text-xs leading-relaxed" style={{ color: '#6b7280' }}>
                        Activada: si la guía se devuelve, de todas formas te devolvemos el flete completo a tu billetera.
                      </p>
                    ) : (
                      <p className="mt-1 text-xs font-semibold leading-relaxed" style={{ color: '#dc2626' }}>
                        ⚠️ Sin protección: si el destinatario rechaza el envío, pierdes el flete que prepagaste, sin devolución.
                      </p>
                    )}
                  </div>
                </label>
              )}

              {paso === 'resumen' && (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl p-3.5" style={{ background: '#f8fafc' }}>
                    <div className="flex items-center justify-between py-1.5 text-sm">
                      <span style={{ color: '#6b7280' }}>Transportadora</span>
                      <strong>{transportadora?.nombre}</strong>
                    </div>
                    <div className="flex items-center justify-between py-1.5 text-sm">
                      <span style={{ color: '#6b7280' }}>Flete (ya con nuestro margen)</span>
                      <strong>{formatCOPMoneda(flete)}</strong>
                    </div>
                    {seguroActivo && (
                      <div className="flex items-center justify-between py-1.5 text-sm">
                        <span style={{ color: '#6b7280' }}>Seguro antidevoluciones</span>
                        <strong>+ {formatCOPMoneda(COSTO_SEGURO_GUIA)}</strong>
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-between border-t border-dashed pt-2.5 text-base font-bold" style={{ borderColor: '#e5e7eb' }}>
                      <span>Total · se descuenta de tu billetera</span>
                      <span>{formatCOPMoneda(totalAPagar)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1 text-xs" style={{ color: '#6b7280' }}>
                      <span className="flex items-center gap-1"><WalletIcon className="h-3.5 w-3.5" /> Saldo en tu billetera</span>
                      <strong style={saldoInsuficiente ? { color: '#dc2626' } : undefined}>{formatCOPMoneda(saldo)}</strong>
                    </div>
                  </div>

                  {paymentType === 'contra_entrega' && collectionValueNum > 0 && (
                    <p className="mx-0.5 text-xs" style={{ color: '#6b7280' }}>
                      Recuerda: el mensajero cobrará <strong style={{ color: '#1f2937' }}>{formatCOPMoneda(collectionValueNum)}</strong> al destinatario al entregar.
                    </p>
                  )}

                  {saldoInsuficiente && !mostrarRecarga && (
                    <div className="rounded-[10px] p-3.5 text-[13px]" style={{ background: '#fef2f2', color: '#dc2626' }}>
                      <p className="m-0 mb-2">Saldo insuficiente para generar esta guía.</p>
                      <button onClick={abrirRecarga} className="rounded-full px-3.5 py-1.5 text-xs font-bold text-white" style={{ background: '#dc2626' }}>
                        Recargar billetera
                      </button>
                    </div>
                  )}

                  {mostrarRecarga && (
                    <div className="rounded-2xl border p-3.5" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>
                        Recargar billetera
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
                        <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>Otro monto</label>
                        <input type="number" className={inputCls} value={montoRecarga} onChange={(e) => setMontoRecarga(Number(e.target.value))} />
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
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-[10px] p-3.5 text-[13px]" style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {error}
                </div>
              )}

              {!mostrarRecarga && (
                <div className="mt-4 flex justify-center">
                  {paso === 'remitente' && (
                    <BotonPrincipal onClick={confirmarRemitente} loader={loader}>Guardar y continuar</BotonPrincipal>
                  )}
                  {paso === 'destinatario' && <BotonPrincipal onClick={continuarDestinatario}>Continuar</BotonPrincipal>}
                  {paso === 'paquete' && <BotonPrincipal onClick={continuarPaquete}>Continuar</BotonPrincipal>}
                  {paso === 'pago' && <BotonPrincipal onClick={continuarPago} loader={loader}>Cotizar envío</BotonPrincipal>}
                  {paso === 'transportadora' && !cotizando && (
                    <BotonPrincipal onClick={continuarTransportadora}>Continuar</BotonPrincipal>
                  )}
                  {paso === 'seguro' && <BotonPrincipal onClick={continuarSeguro}>Continuar</BotonPrincipal>}
                  {paso === 'resumen' && (
                    <BotonPrincipal onClick={confirmarYGenerar} loader={loader} icon={<PackageCheck className="h-4 w-4" />}>
                      {loader ? 'Generando…' : 'Generar Guía 🚀'}
                    </BotonPrincipal>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const inputCls = 'w-full rounded-[10px] border border-gray-200 px-3 py-2 text-sm focus:border-[#02a0e3] focus:outline-none disabled:bg-gray-100';

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold" style={{ color: '#6b7280' }}>{label}</label>
      {children}
    </div>
  );
}

function BotonPrincipal({ onClick, loader, children, icon }: { onClick: () => void; loader?: boolean; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={loader}
      className="flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold text-white disabled:opacity-55"
      style={{ background: '#02a0e3', boxShadow: '0 4px 10px rgba(2,160,227,0.3)' }}
    >
      {icon}
      {children}
    </button>
  );
}
