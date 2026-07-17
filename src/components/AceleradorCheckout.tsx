'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import { supabase } from '@/lib/supabase';
import { crearIntentoPago, fetchEstadoPago } from '@/lib/acelerador';

// Port de AceleradorCheckoutComponent (Angular) -- boton "Suscribirme" + flujo de pago del curso
// Acelerador de Ventas, reusable en /info (ya portado, solo linkea aca) y /acelerador. Mismo
// mecanismo ya usado en DropshippingCheckoutModal: widget de ePayco via next/script + polling de
// confirmacion. Pagos en modo real (confirmado por el usuario 2026-07-15).

const ESTADO_PRUEBA_PAGOS = false;
const KEY_EPAYCO = '62977a30b1a19dcd0728f6b639b33fb0';
const PRECIO_USD = 35;

declare global {
  interface Window {
    ePayco?: { checkout: { configure: (opts: { key: string; test: boolean }) => { open: (obj: Record<string, unknown>) => void } } };
  }
}

function codigoPago(): string {
  return 'SUB-' + (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
}

interface DataUserPago {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documento: string;
  ciudad: string;
}

export function AceleradorCheckout({
  buttonClass = 'rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90',
  buttonLabel = 'Suscribirme',
  abrirCheckoutInicial = false,
  abrirTrigger = 0,
  onActivada,
}: {
  buttonClass?: string;
  buttonLabel?: string;
  abrirCheckoutInicial?: boolean;
  // Se incrementa desde afuera (ej. al hacer click en una tarjeta de leccion de la vitrina) para
  // abrir el mismo flujo de pago sin montar una segunda instancia (evita duplicar el script de
  // ePayco y el polling). El primer valor (montaje) se ignora, solo importan los cambios.
  abrirTrigger?: number;
  onActivada: () => void;
}) {
  const [dataUser, setDataUser] = useState<DataUserPago | null>(null);
  const [sesionResuelta, setSesionResuelta] = useState(false);
  const [mostrarFormAnon, setMostrarFormAnon] = useState(false);
  const [procesandoCuenta, setProcesandoCuenta] = useState(false);
  const [procesandoPago, setProcesandoPago] = useState(false);
  const [pagoFueAnonimo, setPagoFueAnonimo] = useState(false);
  const [anonData, setAnonData] = useState({ nombre: '', email: '', telefono: '', documento: '', ciudad: '' });
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abrioInicialRef = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: sessionData }) => {
      if (!sessionData.session) {
        setSesionResuelta(true);
        return;
      }
      const userId = sessionData.session.user.id;
      const [{ data: profile }, { data: userAuth }] = await Promise.all([
        supabase.from('profiles').select('full_name, last_name, phone, document_id, city').eq('id', userId).maybeSingle(),
        supabase.auth.getUser(),
      ]);
      setDataUser({
        id: userId,
        nombre: profile?.full_name || '',
        apellido: profile?.last_name || '',
        email: userAuth?.user?.email || '',
        telefono: profile?.phone || '',
        documento: profile?.document_id || '',
        ciudad: profile?.city || '',
      });
      setSesionResuelta(true);
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  // ?checkout=1 llega desde el boton "Suscribirme" de la vitrina principal (/info): abre el pago
  // (o el formulario anonimo) de una vez en vez de solo mostrar la vitrina.
  useEffect(() => {
    if (abrirCheckoutInicial && sesionResuelta && !abrioInicialRef.current) {
      abrioInicialRef.current = true;
      onClickPrincipal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionResuelta]);

  const containerRef = useRef<HTMLDivElement>(null);
  const primerTriggerRef = useRef(true);
  useEffect(() => {
    if (primerTriggerRef.current) {
      primerTriggerRef.current = false;
      return;
    }
    if (sesionResuelta) {
      onClickPrincipal();
      // El boton que disparo esto pudo estar mas abajo en la pagina (tarjeta de leccion en la
      // vitrina) -- sin esto el formulario/boton de pago cambia de estado fuera de la vista.
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirTrigger]);

  function onClickPrincipal() {
    if (dataUser) suscribirme(dataUser);
    else setMostrarFormAnon(true);
  }

  function soloLetras(valor: string): string {
    return (valor || '').replace(/[^a-zA-ZÀ-ÿñÑ\s]/g, '');
  }

  function soloNumeros(valor: string): string {
    return (valor || '').replace(/[^0-9]/g, '');
  }

  function emailValido(): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(anonData.email || '');
  }

  function formularioValido(): boolean {
    return !!(anonData.nombre && anonData.telefono && anonData.documento && anonData.ciudad) && emailValido();
  }

  async function pagarAnonimo() {
    if (procesandoCuenta || procesandoPago) return;
    if (!formularioValido()) {
      alert('Completa todos los campos correctamente para continuar');
      return;
    }
    setProcesandoCuenta(true);
    const claveTemp = codigoPago() + codigoPago().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: anonData.email.trim(),
      password: claveTemp,
      options: { data: { full_name: anonData.nombre, phone: anonData.telefono } },
    });
    if (error || !data.user) {
      setProcesandoCuenta(false);
      alert('No pudimos continuar, intenta de nuevo');
      return;
    }
    if (!data.session) await supabase.auth.signInWithPassword({ email: anonData.email.trim(), password: claveTemp });
    await supabase.from('profiles').update({ document_id: anonData.documento, city: anonData.ciudad }).eq('id', data.user.id);

    const nuevoDataUser: DataUserPago = {
      id: data.user.id,
      nombre: anonData.nombre,
      apellido: '',
      email: anonData.email.trim(),
      telefono: anonData.telefono,
      documento: anonData.documento,
      ciudad: anonData.ciudad,
    };
    setDataUser(nuevoDataUser);
    setPagoFueAnonimo(true);
    setProcesandoCuenta(false);
    setMostrarFormAnon(false);
    suscribirme(nuevoDataUser);
  }

  async function suscribirme(usuario: DataUserPago) {
    if (procesandoPago) return;
    setProcesandoPago(true);
    const codigo = codigoPago();
    const ok = await crearIntentoPago(usuario.id, PRECIO_USD, codigo);
    if (!ok) {
      setProcesandoPago(false);
      alert('No pudimos iniciar el pago, intenta de nuevo');
      return;
    }
    abrirEpayco(usuario, codigo);
    iniciarPolling(codigo);
  }

  // Reintenta hasta ~3s (afterInteractive deberia dejar window.ePayco listo mucho antes, pero en
  // una conexion muy lenta el script puede seguir en camino justo cuando el usuario hace click) en
  // vez de fallar de una con el primer click de la sesion.
  async function esperarEpayco(intentos = 15): Promise<boolean> {
    for (let i = 0; i < intentos; i++) {
      if (window.ePayco) return true;
      await new Promise((r) => setTimeout(r, 200));
    }
    return !!window.ePayco;
  }

  async function abrirEpayco(usuario: DataUserPago, codigo: string) {
    if (!(await esperarEpayco()) || !window.ePayco) {
      setProcesandoPago(false);
      alert('Error en el proceso de pago');
      return;
    }
    try {
      const handler = window.ePayco.checkout.configure({ key: KEY_EPAYCO, test: ESTADO_PRUEBA_PAGOS });
      handler.open({
        name: 'Suscripcion Acelerador de Ventas',
        invoice: codigo,
        currency: 'usd',
        amount: PRECIO_USD,
        tax_base: '0',
        tax: '0',
        country: 'co',
        lang: 'esp',
        external: 'true',
        name_billing: `${usuario.nombre} ${usuario.apellido}`.trim(),
        email_billing: usuario.email,
        address_billing: usuario.ciudad || 'cucuta',
        mobilephone_billing: usuario.telefono,
        number_doc_billing: usuario.documento,
      });
    } catch {
      setProcesandoPago(false);
      alert('Error en el proceso de pago');
    }
  }

  function iniciarPolling(codigo: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let intentos = 0;
    pollingRef.current = setInterval(async () => {
      intentos++;
      const res = await fetchEstadoPago(codigo);
      if (res && res.status === 2) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setProcesandoPago(false);
        if (pagoFueAnonimo) {
          alert(`Suscripcion activada. Guardamos tu acceso con el correo ${dataUser?.email}. Para volver a entrar mas adelante desde otro dispositivo, usa "Olvide mi contrasena" en el login con ese mismo correo.`);
        } else {
          alert('Suscripcion activada');
        }
        onActivada();
      } else if (intentos > 60) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setProcesandoPago(false);
      }
    }, 4000);
  }

  return (
    <div ref={containerRef}>
      {/* afterInteractive (no lazyOnload): este widget se puede disparar apenas el usuario llega a
          la pagina (boton principal o cualquier tarjeta de leccion) -- lazyOnload lo pospone hasta
          que el navegador queda inactivo despues de cargar TODA la pagina, lo que hacia que el
          primer click, en cualquiera de esos puntos, se sintiera lento/colgado esperando a que
          window.ePayco existiera. */}
      <Script src="https://checkout.epayco.co/checkout.js" strategy="afterInteractive" />
      {!mostrarFormAnon ? (
        <button onClick={onClickPrincipal} disabled={procesandoPago} className={`${buttonClass} disabled:opacity-60`}>
          {procesandoPago ? 'Procesando...' : buttonLabel}
        </button>
      ) : (
        <div className="mx-auto max-w-md text-left">
          <h5 className="mb-3 text-center font-semibold text-gray-800">Completa tus datos para continuar</h5>
          <input
            value={anonData.nombre}
            onChange={(e) => setAnonData({ ...anonData, nombre: soloLetras(e.target.value) })}
            placeholder="Nombre completo *"
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            value={anonData.email}
            onChange={(e) => setAnonData({ ...anonData, email: e.target.value })}
            placeholder="Correo electronico (ej: nombre@correo.com) *"
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="tel"
            value={anonData.telefono}
            onChange={(e) => setAnonData({ ...anonData, telefono: soloNumeros(e.target.value) })}
            placeholder="Telefono / WhatsApp *"
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={anonData.documento}
            onChange={(e) => setAnonData({ ...anonData, documento: soloNumeros(e.target.value) })}
            placeholder="Numero de documento *"
            className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            value={anonData.ciudad}
            onChange={(e) => setAnonData({ ...anonData, ciudad: soloLetras(e.target.value) })}
            placeholder="Ciudad *"
            className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            onClick={pagarAnonimo}
            disabled={procesandoCuenta || procesandoPago || !formularioValido()}
            className="w-full rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {procesandoCuenta || procesandoPago ? 'Procesando...' : 'Continuar al pago'}
          </button>
        </div>
      )}
    </div>
  );
}
