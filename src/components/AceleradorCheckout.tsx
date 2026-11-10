'use client';

import { useEffect, useRef, useState } from 'react';
import { Copy, Check, Upload, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { fetchEstadoPago, PRECIO_ACELERADOR_TEXTO, PRECIO_ACELERADOR_ANTES_TEXTO, DESCUENTO_ACELERADOR_TEXTO, CUENTA_PAGO_CURSO, fotoComprobante, enviarComprobantePago } from '@/lib/acelerador';

// Port de AceleradorCheckoutComponent (Angular) -- boton "Suscribirme" + flujo de pago del curso
// Acelerador de Ventas, reusable en /info (ya portado, solo linkea aca) y /acelerador.
// 08-11-2026: aviso de acceso personal antes de pagar (curso-anticompartir.sql).
// 08-11-2026 (pedido del usuario, "para evitar costos"): ya NO se cobra por ePayco. Se paga por
// transferencia a Bancolombia, el comprador sube la foto del comprobante aqui mismo, el panel del
// gamer se la manda al dueño por WhatsApp con una referencia de 5 numeros y, cuando el dueño
// responde que el pago cayo, el acceso se activa solo (curso-transferencia.sql). Esta pantalla
// revisa cada 10 s y abre el curso apenas queda activo.

interface DataUserPago {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  documento: string;
  ciudad: string;
}

// copiar=false: solo se muestra (banco y tipo de cuenta no se copian, pedido del usuario 08-11)
function CopiarDato({ etiqueta, valor, copiar = true }: { etiqueta: string; valor: string; copiar?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  if (!copiar) {
    return (
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
        <span className="text-xs text-gray-500">{etiqueta}</span>
        <span className="text-sm font-bold text-gray-900">{valor}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5 last:border-0">
      <span className="text-xs text-gray-500">{etiqueta}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(valor).catch(() => {});
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
        className="flex items-center gap-1 text-sm font-bold text-gray-900"
      >
        {valor} {copiado ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
      </button>
    </div>
  );
}

const AVISO_PERSONAL = (
  <>
    Al pagar aceptas que tu acceso es <b>personal</b>: se ve en máximo 2 aparatos, cada aparato se confirma con un código por WhatsApp y
    sobre el video sale tu nombre y teléfono. Si compartes el acceso con otra u otras personas, se cancela sin devolución.
  </>
);

export function AceleradorCheckout({
  buttonClass = 'rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90',
  buttonLabel = 'Comprar curso',
  abrirCheckoutInicial = false,
  abrirTrigger = 0,
  onActivada,
}: {
  buttonClass?: string;
  buttonLabel?: string;
  abrirCheckoutInicial?: boolean;
  // Se incrementa desde afuera (ej. al hacer click en una tarjeta de leccion de la vitrina) para
  // abrir el mismo flujo de pago sin montar una segunda instancia. El primer valor (montaje) se
  // ignora, solo importan los cambios.
  abrirTrigger?: number;
  onActivada: () => void;
}) {
  const [dataUser, setDataUser] = useState<DataUserPago | null>(null);
  const [sesionResuelta, setSesionResuelta] = useState(false);
  // paso: boton -> (sin sesion) datos -> transferencia (cuenta + comprobante) -> esperando
  const [paso, setPaso] = useState<'boton' | 'datos' | 'transferencia' | 'esperando'>('boton');
  const [procesando, setProcesando] = useState(false);
  const [pagoFueAnonimo, setPagoFueAnonimo] = useState(false);
  const [anonData, setAnonData] = useState({ nombre: '', email: '', telefono: '', documento: '', ciudad: '', clave: '' });
  const [foto, setFoto] = useState<string | null>(null);
  const [leyendoFoto, setLeyendoFoto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [referencia, setReferencia] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abrioInicialRef = useRef(false);

  // Consulta la sesion REAL en el momento en que se llama (nunca un valor cacheado de antes).
  async function resolverDataUserEnVivo(): Promise<DataUserPago | null> {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) return null;
    const userId = sessionData.session.user.id;
    const [{ data: profile }, { data: userAuth }] = await Promise.all([
      supabase.from('profiles').select('full_name, last_name, phone, document_id, city').eq('id', userId).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    return {
      id: userId,
      nombre: profile?.full_name || '',
      apellido: profile?.last_name || '',
      email: userAuth?.user?.email || '',
      telefono: profile?.phone || '',
      documento: profile?.document_id || '',
      ciudad: profile?.city || '',
    };
  }

  // Si ya mando un comprobante que sigue sin revisar, se muestra la espera (no se le pide otro).
  async function pagoPendiente(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from('acelerador_payments')
      .select('referencia, status, created_at')
      .eq('profile_id', userId)
      .eq('metodo', 'transferencia')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data && data.status === 0 && data.referencia ? data.referencia : null;
  }

  useEffect(() => {
    resolverDataUserEnVivo().then(async (usuario) => {
      setDataUser(usuario);
      setSesionResuelta(true);
      if (usuario) {
        const ref = await pagoPendiente(usuario.id);
        if (ref) {
          setReferencia(ref);
          setPaso('esperando');
          iniciarPolling(ref);
        }
      }
    });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ?checkout=1 llega desde el boton "Suscribirme" de la vitrina principal (/info).
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
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrirTrigger]);

  // Se vuelve a consultar la sesion en vivo en el instante del click (pedido del usuario 2026-07-22:
  // nunca confundir "todavia no se sabe" con "no hay sesion").
  async function onClickPrincipal() {
    if (paso === 'esperando') return;
    const usuario = dataUser || (await resolverDataUserEnVivo());
    if (usuario) {
      if (!dataUser) setDataUser(usuario);
      setPaso('transferencia');
    } else {
      setPaso('datos');
    }
  }

  const soloLetras = (v: string) => (v || '').replace(/[^a-zA-ZÀ-ÿñÑ\s]/g, '');
  const soloNumeros = (v: string) => (v || '').replace(/[^0-9]/g, '');
  const emailValido = () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(anonData.email || '');
  const formularioValido = () =>
    !!(anonData.nombre && anonData.telefono.length >= 10 && anonData.documento && anonData.ciudad && anonData.clave.length >= 6) && emailValido();

  // Sin sesion: crea la cuenta con la contraseña que la persona elige (antes era una clave al azar
  // y no podia volver a entrar desde otro aparato).
  async function crearCuenta(): Promise<boolean> {
    if (procesando) return false;
    if (!formularioValido()) {
      setError('Completa todos los campos (la contraseña con mínimo 6 caracteres)');
      return false;
    }
    setProcesando(true);
    setError(null);
    // origen 'acelerador': la base confirma el correo al instante (curso-comprobante-sesion.sql, 09-11-2026).
    // Antes la cuenta quedaba "sin confirmar", sin sesión, y el comprobante fallaba SIEMPRE.
    const { data, error: e } = await supabase.auth.signUp({
      email: anonData.email.trim(),
      password: anonData.clave,
      options: { data: { full_name: anonData.nombre, phone: anonData.telefono, origen: 'acelerador' } },
    });
    if (e || !data.user) {
      setProcesando(false);
      setError(/registered|already/i.test(e?.message || '') ? 'Ese correo ya tiene cuenta. Entra con tu correo y contraseña y vuelve aquí.' : 'No pudimos continuar, intenta de nuevo');
      return false;
    }
    if (!data.session && !(await asegurarSesion())) {
      setProcesando(false);
      setError('Ese correo ya estaba registrado con otra contraseña. Entra con tu correo y contraseña y vuelve aquí.');
      return false;
    }
    await supabase.from('profiles').update({ document_id: anonData.documento, city: anonData.ciudad, phone: anonData.telefono }).eq('id', data.user.id);
    setDataUser({ id: data.user.id, nombre: anonData.nombre, apellido: '', email: anonData.email.trim(), telefono: anonData.telefono, documento: anonData.documento, ciudad: anonData.ciudad });
    setPagoFueAnonimo(true);
    setProcesando(false);
    return true;
  }

  // 09-11-2026: el comprobante solo se puede guardar con sesión abierta. Si no hay, vuelve a entrar con el correo y
  // la contraseña que la persona acaba de escribir (3 intentos, por si la red falla).
  async function asegurarSesion(): Promise<boolean> {
    for (let i = 0; i < 3; i++) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session) return true;
      if (!anonData.email || !anonData.clave) return false;
      const { data, error: e } = await supabase.auth.signInWithPassword({ email: anonData.email.trim(), password: anonData.clave });
      if (data.session) return true;
      if (e && /invalid login|credentials/i.test(e.message)) return false;   // contraseña distinta: no insistir
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
    return false;
  }

  async function crearCuentaYEnviar() {
    if (!foto) {
      setError('Sube la foto del comprobante de pago');
      return;
    }
    // si ya creo la cuenta en un intento anterior (fallo el envio), no se vuelve a crear
    if (!dataUser && !(await crearCuenta())) return;
    await enviar();
  }

  async function elegirFoto(archivo: File | undefined) {
    if (!archivo) return;
    setLeyendoFoto(true);
    setError(null);
    try {
      setFoto(await fotoComprobante(archivo));
    } catch {
      setError('No pudimos leer esa imagen. Toma una captura de pantalla del comprobante y súbela.');
    }
    setLeyendoFoto(false);
  }

  async function enviar() {
    if (!foto || procesando) {
      if (!foto) setError('Sube la foto del comprobante de pago');
      return;
    }
    setProcesando(true);
    setError(null);
    if (!(await asegurarSesion())) {
      setProcesando(false);
      setError('Tu sesión se cerró. Entra con tu correo y contraseña y vuelve a subir el comprobante.');
      return;
    }
    const r = await enviarComprobantePago(foto);
    setProcesando(false);
    if (!r.ok || !r.referencia) {
      setError(r.error || 'No pudimos enviar el comprobante');
      return;
    }
    setReferencia(r.referencia);
    setPaso('esperando');
    iniciarPolling(r.referencia);
  }

  // Revisa cada 10 s (hasta 3 horas con la pagina abierta) si el dueño ya confirmo el pago.
  function iniciarPolling(ref: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    let intentos = 0;
    pollingRef.current = setInterval(async () => {
      intentos++;
      const res = await fetchEstadoPago('TR-' + ref);
      if (res && res.status === 2) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        alert(
          pagoFueAnonimo
            ? `¡Pago confirmado! Tu curso quedó activo. Para entrar desde otro aparato usa tu correo ${dataUser?.email || ''} y la contraseña que creaste.`
            : '¡Pago confirmado! Tu curso quedó activo.',
        );
        onActivada();
      } else if (res && res.status === 1) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setReferencia(null);
        setFoto(null);
        setPaso('transferencia');
        setError(`No encontramos el pago con la referencia ${ref}. Revisa la transferencia y vuelve a subir el comprobante, o escríbenos.`);
      } else if (intentos > 1080) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
      }
    }, 10000);
  }

  // Formulario en el orden del pago (pedido del usuario 08-11): primero la cuenta (para poder transferir), luego los
  // datos y al final el comprobante junto al boton de enviar. Si ya tiene sesion: cuenta + comprobante.
  const bloqueCuenta = (
    <>
            <p className="text-sm font-semibold text-gray-800">1. Transfiere {PRECIO_ACELERADOR_TEXTO} a esta cuenta:</p>
            <div className="mt-2 rounded-lg bg-gray-50 px-3 py-1">
              <CopiarDato etiqueta="Banco" valor={CUENTA_PAGO_CURSO.banco} copiar={false} />
              <CopiarDato etiqueta="Tipo" valor={CUENTA_PAGO_CURSO.tipo} copiar={false} />
              <CopiarDato etiqueta="Número de cuenta" valor={CUENTA_PAGO_CURSO.numero} />
              <CopiarDato etiqueta="A nombre de" valor={CUENTA_PAGO_CURSO.titular} />
              <CopiarDato etiqueta="Cédula" valor={CUENTA_PAGO_CURSO.cedula} />
            </div>
    </>
  );

  const bloqueComprobante = (n: number) => (
    <>
            <p className="mt-4 text-sm font-semibold text-gray-800">{n}. Sube la foto o captura del comprobante de pago:</p>
            <label className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 text-center text-sm text-gray-600 hover:border-[#02a0e3]">
              {foto ? (
                // eslint-disable-next-line @next/next/no-img-element -- vista previa local (data URL), no pasa por next/image
                <img src={foto} alt="Comprobante" className="max-h-56 rounded object-contain" />
              ) : (
                <>
                  <Upload className="mb-1 h-6 w-6 text-gray-400" />
                  {leyendoFoto ? 'Leyendo la foto…' : 'Toca aquí para subir el comprobante'}
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => elegirFoto(e.target.files?.[0])} />
            </label>
            {foto && <p className="mt-1 text-center text-xs text-gray-500">¿No es esa? Toca la foto para cambiarla.</p>}
    </>
  );

  return (
    <div ref={containerRef}>
      {paso === 'boton' && (
        <button onClick={onClickPrincipal} className={buttonClass}>
          {buttonLabel}
        </button>
      )}

      {paso === 'datos' && (
        <div className="mx-auto max-w-md text-left">
          {bloqueCuenta}
          <p className="mb-2 mt-4 text-sm font-semibold text-gray-800">2. Completa tus datos:</p>
          <input value={anonData.nombre} onChange={(e) => setAnonData({ ...anonData, nombre: soloLetras(e.target.value) })} placeholder="Nombre completo *" className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input type="email" value={anonData.email} onChange={(e) => setAnonData({ ...anonData, email: e.target.value })} placeholder="Correo electronico (ej: nombre@correo.com) *" className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input type="tel" value={anonData.telefono} onChange={(e) => setAnonData({ ...anonData, telefono: soloNumeros(e.target.value).slice(0, 10) })} placeholder="Celular con WhatsApp (10 números) *" className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={anonData.documento} onChange={(e) => setAnonData({ ...anonData, documento: soloNumeros(e.target.value) })} placeholder="Numero de documento *" className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input value={anonData.ciudad} onChange={(e) => setAnonData({ ...anonData, ciudad: soloLetras(e.target.value) })} placeholder="Ciudad *" className="mb-2 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <input type="password" value={anonData.clave} onChange={(e) => setAnonData({ ...anonData, clave: e.target.value })} placeholder="Crea una contraseña (mínimo 6) *" autoComplete="new-password" className="mb-1 w-full rounded border border-gray-300 px-3 py-2 text-sm" />
          <p className="text-xs text-gray-500">Con tu correo y esta contraseña entras al curso. Al celular te llegan los códigos para confirmar cada aparato.</p>
          {bloqueComprobante(3)}
          <button onClick={crearCuentaYEnviar} disabled={procesando || leyendoFoto || !formularioValido() || !foto} className="mt-4 w-full rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
            {procesando ? 'Enviando...' : 'Enviar comprobante'}
          </button>
          {error && <p className="mt-2 rounded bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>}
          <p className="mt-3 text-xs text-gray-500">{AVISO_PERSONAL}</p>
        </div>
      )}

      {paso === 'transferencia' && (
        <div className="mx-auto max-w-md rounded-2xl border border-[#02a0e3]/20 bg-white p-5 text-left shadow-md">
          <p className="text-center font-semibold text-gray-800">
            Curso <span className="text-[#0177a8]">Acelerador de Ventas</span> — pago único de {PRECIO_ACELERADOR_TEXTO} COP
          </p>
          {/* 10-11-2026: recordar aquí también que el precio ya trae el 50 % de descuento */}
          <p className="mt-1 text-center text-sm font-semibold text-[#15803d]">
            🔥 Ya tiene el {DESCUENTO_ACELERADOR_TEXTO} de descuento (precio normal <span className="line-through decoration-[#dc2626]">{PRECIO_ACELERADOR_ANTES_TEXTO}</span>)
          </p>
          <p className="mb-4 mt-1 text-center text-sm text-gray-500">Acceso de por vida a todas las clases.</p>

          {bloqueCuenta}
          {bloqueComprobante(2)}

          <button onClick={enviar} disabled={procesando || leyendoFoto || !foto} className="mt-4 w-full rounded-full bg-green-600 px-6 py-3 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60">
            {procesando ? 'Enviando…' : 'Enviar comprobante'}
          </button>
          <button onClick={() => { setPaso('boton'); setError(null); }} className="mt-2 w-full text-sm text-gray-500">
            Cancelar
          </button>
          {error && <p className="mt-2 rounded bg-red-50 p-2 text-center text-sm text-red-700">{error}</p>}
          <p className="mt-3 text-xs text-gray-500">{AVISO_PERSONAL}</p>
        </div>
      )}

      {paso === 'esperando' && (
        <div className="mx-auto max-w-md rounded-2xl border border-green-200 bg-green-50 p-5 text-center shadow-sm">
          <Clock className="mx-auto h-8 w-8 text-green-700" />
          <p className="mt-2 font-bold text-green-800">¡Recibimos tu comprobante!</p>
          <p className="mt-1 text-sm text-green-800">
            Tu referencia es <b className="text-lg">{referencia}</b>. Estamos revisando que el pago haya llegado; apenas se confirme tu curso se activa
            solo y te avisamos por WhatsApp.
          </p>
          <p className="mt-2 text-xs text-green-700">Puedes dejar esta página abierta: el curso se abre solo cuando quede activo.</p>
        </div>
      )}
    </div>
  );
}
