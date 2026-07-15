'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { Wallet, X, Plus, Minus, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchDataUserCompleto, type DataUserCompleto } from '@/lib/usuarios';
import {
  getBalanceDropshipper,
  createTopup,
  getTopupStatus,
  fetchPaquetesRecarga,
  fetchLedgerDropshipper,
  SALDO_MINIMO_DROPSHIPPING,
  type PaqueteRecarga,
  type MovimientoLedger,
} from '@/lib/wallet';
import { useToast, Toast } from '@/components/Toast';

// Port 1:1 de RechargeComponent (Angular, "Recargar Saldo") -- recarga la billetera 'dropshipper'
// via wallet_topups, mismo mecanismo ya construido en DropshippingCheckoutModal.
//
// IMPORTANTE: ePayco queda en modo PRUEBA (ESTADO_PRUEBA_PAGOS = true) a proposito, mismo criterio
// que DropshippingCheckoutModal -- cambiar a false solo cuando se confirme que esta listo para
// produccion real.

const ESTADO_PRUEBA_PAGOS = true;
const KEY_EPAYCO = '62977a30b1a19dcd0728f6b639b33fb0';

const ETIQUETAS_MOVIMIENTO: Record<string, string> = {
  recarga: 'Recarga',
  flete_pedido: 'Flete de pedido',
  flete_seguro_pedido: 'Flete + seguro de pedido',
  flete_devuelto: 'Flete devuelto (entrega exitosa)',
  flete_devuelto_seguro: 'Flete devuelto (seguro antidevoluciones)',
  flete_cancelado: 'Flete devuelto (pedido cancelado)',
};

declare global {
  interface Window {
    ePayco?: { checkout: { configure: (opts: { key: string; test: boolean }) => { open: (obj: Record<string, unknown>) => void } } };
  }
}

function formatCOPMoneda(n: number): string {
  return `$ ${Math.round(n || 0).toLocaleString('es-CO')}`;
}

export default function RechargePage() {
  const { mensaje, mostrar } = useToast();

  const [estado, setEstado] = useState<'revisando' | 'listo'>('revisando');
  const [dataUser, setDataUser] = useState<DataUserCompleto | null>(null);
  const [saldo, setSaldo] = useState(0);
  const [paquetes, setPaquetes] = useState<PaqueteRecarga[]>([]);
  const [seleccionado, setSeleccionado] = useState<PaqueteRecarga | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mostrarMovimientos, setMostrarMovimientos] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);
  const [movimientos, setMovimientos] = useState<MovimientoLedger[]>([]);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        window.location.href = '/info';
        return;
      }
      const usuario = await fetchDataUserCompleto(sessionData.session.user.id);
      setDataUser(usuario);
      setEstado('listo');
      setSaldo(await getBalanceDropshipper(usuario.id));
      setPaquetes(await fetchPaquetesRecarga());
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  async function refrescarSaldo() {
    if (!dataUser) return;
    setSaldo(await getBalanceDropshipper(dataUser.id));
  }

  async function abrirMovimientos() {
    if (!dataUser) return;
    setMostrarMovimientos(true);
    setCargandoMovimientos(true);
    setMovimientos(await fetchLedgerDropshipper(dataUser.id));
    setCargandoMovimientos(false);
  }

  function etiquetaMovimiento(m: MovimientoLedger): string {
    return (m.kind && ETIQUETAS_MOVIMIENTO[m.kind]) || (m.direction === 0 ? 'Abono a tu billetera' : 'Cargo a tu billetera');
  }

  function abrirEpayco(item: PaqueteRecarga, codigo: string) {
    if (!dataUser) return;
    const obj = {
      name: item.titulo,
      invoice: codigo,
      currency: 'cop',
      amount: item.precio,
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
      mostrar('Error en el proceso de compra');
    }
  }

  function iniciarPolling(codigo: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let intentos = 0;
    pollingRef.current = setInterval(async () => {
      intentos++;
      const res = await getTopupStatus(codigo);
      if (res && res.status === 2) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setProcesando(false);
        setSeleccionado(null);
        await refrescarSaldo();
        mostrar('Recarga confirmada');
      } else if (intentos > 60) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollingRef.current = null;
        setProcesando(false);
      }
    }, 4000);
  }

  async function recargar() {
    if (!seleccionado || !dataUser || procesando) return;
    setProcesando(true);
    const codigo = 'TOPUP-' + Date.now().toString(36).toUpperCase();
    const ok = await createTopup(dataUser.id, seleccionado.precio, codigo);
    if (!ok) {
      setProcesando(false);
      mostrar('No pudimos iniciar la recarga, intenta de nuevo');
      return;
    }
    abrirEpayco(seleccionado, codigo);
    iniciarPolling(codigo);
  }

  if (estado === 'revisando' || !dataUser) return null;

  return (
    <div className="mx-auto w-full max-w-[720px] px-3 py-6">
      <Script src="https://checkout.epayco.co/checkout.js" strategy="lazyOnload" />

      <div className="flex items-center gap-3 rounded-t-xl bg-[#0d6efd] px-4 py-3 text-white">
        <Wallet className="h-6 w-6" />
        <div>
          <h4 className="text-lg font-bold">Recargar Saldo</h4>
          <p className="text-xs opacity-90">Elige el valor que quieres agregar a tu billetera y paga de forma segura con ePayco.</p>
        </div>
      </div>

      <div className="rounded-b-xl border border-t-0 border-gray-100 p-4 shadow-sm">
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-gray-700">
          <p className="font-semibold">🔁 ¿Cómo funcionan las recargas para generar guías?</p>
          <p className="mt-1">
            Para poder crear guías de envío en <strong>Hacer Dropshipping</strong> o <strong>Pedir una muestra</strong>, primero debes recargar saldo en tu billetera (solo cubre el{' '}
            <strong>flete</strong>, nunca el valor del producto). <strong>Ese dinero no es un gasto</strong> — es un anticipo que se te devuelve apenas el cliente paga.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-green-50 p-3 text-xs text-green-800">
            <p className="font-semibold">✓ ¿Cómo se devuelve?</p>
            <p className="mt-1">Apenas el cliente paga contra entrega, te devolvemos el flete completo a tu billetera.</p>
          </div>
          <div className="rounded-lg bg-gray-100 p-3 text-xs text-gray-700">
            <p className="font-semibold">🏦 El sistema reparte así</p>
            <p className="mt-1">Producto → lo cobra el mensajero. Flete → se te devuelve al aprobar el pedido.</p>
          </div>
          <div className="rounded-lg bg-blue-100 p-3 text-xs text-blue-800">
            <p className="font-semibold">💡 En resumen</p>
            <p className="mt-1">Lo que recargas lo recuperas cuando tus pedidos se entregan bien. No lo pierdes, solo lo adelantas.</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">Saldo actual en tu billetera</span>
          <strong className="text-lg">{formatCOPMoneda(saldo)}</strong>
        </div>
        {saldo < SALDO_MINIMO_DROPSHIPPING && (
          <p className="mt-2 text-xs text-amber-700">
            Necesitas mínimo <strong>{formatCOPMoneda(SALDO_MINIMO_DROPSHIPPING)}</strong> en tu billetera para poder generar pedidos de Dropshipping o Muestra.
          </p>
        )}

        {paquetes.length === 0 ? (
          <p className="mt-6 text-center text-sm text-gray-500">Por ahora no hay valores de recarga disponibles.</p>
        ) : (
          <div className="mt-6 rounded-2xl bg-gradient-to-br from-[#0177a8] to-[#02a0e3] p-5 text-white shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide opacity-90">
              <span>LOKOMPROAQUI</span>
              <span>SALDO</span>
            </div>
            <div className="mt-6 text-2xl font-bold">{seleccionado ? formatCOPMoneda(seleccionado.precio) : 'Elige un valor'}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              {paquetes.map((p) => (
                <button
                  key={p.id}
                  disabled={procesando}
                  onClick={() => setSeleccionado(p)}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${seleccionado?.id === p.id ? 'bg-white text-[#0177a8]' : 'bg-white/20 text-white'} disabled:opacity-60`}
                >
                  {formatCOPMoneda(p.precio)}
                </button>
              ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
              <div className="text-xs">
                <p className="opacity-75">TITULAR</p>
                <p className="font-semibold">{[dataUser.nombre, dataUser.apellido].filter(Boolean).join(' ') || 'MI CUENTA'}</p>
              </div>
              <button
                onClick={recargar}
                disabled={!seleccionado || procesando}
                className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#0177a8] disabled:opacity-60"
              >
                {procesando ? 'Procesando…' : 'Recargar →'}
              </button>
            </div>

            <button onClick={abrirMovimientos} className="mt-4 flex items-center gap-1 text-xs font-medium text-white/90 underline">
              <Receipt className="h-3.5 w-3.5" /> Movimiento fletes
            </button>
          </div>
        )}
      </div>

      {mostrarMovimientos && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-2 sm:p-4" onClick={() => setMostrarMovimientos(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between border-b border-gray-100 px-4 py-3">
              <div>
                <h4 className="text-base font-bold text-gray-900">Movimiento fletes</h4>
                <p className="text-xs text-gray-500">Solo movimientos de flete — ganancias y comisiones están en otra sección.</p>
              </div>
              <button onClick={() => setMostrarMovimientos(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-4 py-3">
              {cargandoMovimientos ? (
                <p className="py-6 text-center text-sm text-gray-500">Cargando…</p>
              ) : movimientos.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-500">Todavía no tienes movimientos en tu billetera de fletes.</p>
              ) : (
                <div className="space-y-2">
                  {movimientos.map((m) => (
                    <div key={m.id} className="flex items-center gap-3 border-b border-gray-100 py-2">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${m.direction === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {m.direction === 0 ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{etiquetaMovimiento(m)}</p>
                        <p className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleString('es-CO')}</p>
                      </div>
                      <div className={`text-sm font-bold ${m.direction === 0 ? 'text-green-700' : 'text-red-700'}`}>
                        {m.direction === 0 ? '+' : '-'}
                        {formatCOPMoneda(Math.abs(m.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Toast mensaje={mensaje} />
    </div>
  );
}
