'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Indicativo } from '@/lib/indicativo';
import { departamento } from '@/lib/departamentos';
import { notificarRegistroWhatsapp } from '@/lib/adminConfig';
import { Turnstile } from '@/components/Turnstile';

// Port desde src/app/components/registro (Angular): registro de PROVEEDOR unicamente (ver
// memoria lokomproaqui-nextjs-migration -- la variante "vendedor" de este formulario en
// particular no tiene ningun boton real que la dispare hoy, el registro de vendedores va por
// /singUp, ya migrado). Es el flujo real detras de "Registrarme como Proveedor" en
// /infoSupplier (ya migrada, linkea aca via <a href="/registro">).
//
// TODOS los campos del formulario se guardan de verdad (pedido explicito del usuario 2026-07-21,
// migracion 072): nombre de bodega -> referral_code (si esta disponible; si no, se cae al
// generador aleatorio de siempre), indicativo -> phone_country_code, tipo/experiencia -> mismos
// valores enum que ya usa /config/perfil (fabricante/importador, 0_6_meses/6_meses_1_anio/
// mas_1_anio) para que quede consistente si el proveedor edita despues, vinculado/plataformas ->
// columnas nuevas, departamento/ciudad/direccion -> department/city/address.
//
// Bug real NO replicado (no afecta nada, el campo ni se manda): en Angular el <option> de
// ciudad usaba [value]="item.phone_code" -- una propiedad que las ciudades no tienen (copiado
// por error del dropdown de indicativos) -- el valor real guardado siempre era el string
// "undefined". Aca el <option> simplemente usa el nombre de la ciudad.
export default function RegistroPage() {
  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [paso, setPaso] = useState(1);
  const [enviando, setEnviando] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);

  // Paso 1
  const [nombreBodega, setNombreBodega] = useState('');
  const [bodegaTomada, setBodegaTomada] = useState(false);
  const [titular, setTitular] = useState('');
  const [indicativo, setIndicativo] = useState('57');
  const [telefono, setTelefono] = useState('');
  const [tipoProveedor, setTipoProveedor] = useState('fabricante');
  const [tiempoExperiencia, setTiempoExperiencia] = useState('0_6_meses');
  const [vinculado, setVinculado] = useState<'si' | 'no'>('no');
  const [plataformas, setPlataformas] = useState('');

  // Paso 2
  const [departamentoSel, setDepartamentoSel] = useState(departamento[0]?.departamento ?? '');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');
  const [email, setEmail] = useState('');
  const [emailRepetir, setEmailRepetir] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const ciudadesDelDepartamento = useMemo(
    () => departamento.find((d: any) => d.departamento === departamentoSel)?.ciudades ?? [],
    [departamentoSel]
  );

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        window.location.href = '/pedidos';
        return;
      }
      setRevisandoSesion(false);
    });
  }, []);

  async function validarBodega(valor: string) {
    const limpio = valor.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s/g, '');
    setNombreBodega(limpio);
    if (!limpio) {
      setBodegaTomada(false);
      return;
    }
    const { data } = await supabase.from('profiles').select('id').eq('referral_code', limpio).maybeSingle();
    setBodegaTomada(!!data);
  }

  function emailValido(valor: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  function validarPaso1(): boolean {
    if (!nombreBodega) return alertear('Falta el nombre de tu bodega'), false;
    if (!titular) return alertear('Falta el nombre del titular'), false;
    if (!telefono) return alertear('Falta el celular'), false;
    return true;
  }

  function validarPaso2(): boolean {
    if (!ciudad) return alertear('Falta la ciudad'), false;
    if (!email) return alertear('Falta el correo'), false;
    if (email !== emailRepetir) return alertear('Los correos no coinciden'), false;
    if (!emailValido(email)) return alertear('Correo inválido'), false;
    if (!clave) return alertear('Falta la contraseña'), false;
    if (clave !== confirmar) return alertear('Las claves no coinciden'), false;
    if (!aceptaTerminos) return alertear('Debes aceptar los términos de privacidad'), false;
    if (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !captchaToken) return alertear('Confirma que no eres un robot'), false;
    return true;
  }

  function alertear(msg: string) {
    alert(msg);
  }

  async function submit() {
    if (enviando || !validarPaso2()) return;
    setEnviando(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: clave,
      options: {
        captchaToken: captchaToken || undefined,
        data: {
          full_name: titular,
          phone: telefono,
          phone_country_code: indicativo,
          role_name: 'proveedor',
          desired_referral_code: nombreBodega || undefined,
          supplier_type: tipoProveedor,
          supplier_experience: tiempoExperiencia,
          supplier_linked_platform: vinculado === 'si',
          supplier_platforms: vinculado === 'si' ? plataformas : null,
          department: departamentoSel,
          city: ciudad,
          address: direccion,
        },
      },
    });

    if (error) {
      setEnviando(false);
      setCaptchaToken(null);
      let msg = 'No pudimos crear tu cuenta, intenta de nuevo';
      if (error.message.includes('already registered')) msg = 'Ya existe una cuenta con ese correo';
      else if (error.message.includes('profiles_phone_key') || error.message.includes('phone')) msg = 'Ya existe una cuenta con ese número de teléfono';
      alert(msg);
      return;
    }

    if (!data.session) await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });

    // Pedido explicito del usuario 2026-07-19: abre WhatsApp (pestaña nueva) con un aviso
    // pre-armado hacia el numero configurado en /config/configuracion -- no interrumpe el redirect
    // normal de abajo, las dos cosas pasan juntas.
    notificarRegistroWhatsapp({ nombre: titular, telefono, rol: 'proveedor' });

    // Mismo redirect que el RegistroComponent original (distinto del de /singUp): proveedor -> /config/perfil.
    window.location.href = '/config/perfil';
  }

  if (revisandoSesion) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/info" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/logo.svg" alt="LokomproAqui" className="h-14 w-auto drop-shadow-md" />
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <h1 className="text-center text-2xl font-extrabold text-gray-900">Registro de Proveedor</h1>
          <div className="mx-auto mt-4 flex max-w-xs items-center gap-2">
            <div className={`h-1.5 flex-1 rounded-full ${paso >= 1 ? 'bg-[#02a0e3]' : 'bg-gray-200'}`} />
            <div className={`h-1.5 flex-1 rounded-full ${paso >= 2 ? 'bg-[#02a0e3]' : 'bg-gray-200'}`} />
          </div>

          {paso === 1 && (
            <div className="mt-6 flex flex-col gap-4">
              <Campo label="¿Cómo se llama tu bodega?" placeholder="Ej: bodegaAlMayore" value={nombreBodega} onChange={validarBodega} />
              {bodegaTomada && <p className="-mt-3 text-xs font-semibold text-red-600">Ese nombre de bodega ya está registrado, usa otro.</p>}

              <Campo label="Nombre y apellidos del titular de la bodega" value={titular} onChange={setTitular} />

              <div className="grid grid-cols-[7rem_1fr] gap-2">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">Indicativo</span>
                  <select
                    value={indicativo}
                    onChange={(e) => setIndicativo(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-[#02a0e3]"
                  >
                    {Indicativo.map((item: { nombre: string; phone_code: string }) => (
                      <option key={item.nombre} value={item.phone_code}>
                        {item.nombre} +{item.phone_code}
                      </option>
                    ))}
                  </select>
                </div>
                <Campo label="Celular para el soporte" value={telefono} onChange={(v) => setTelefono(v.replace(/[^0-9]/g, ''))} />
              </div>

              <Selector
                label="Tipo de proveedor"
                value={tipoProveedor}
                onChange={setTipoProveedor}
                options={[
                  { value: 'fabricante', label: 'Fabricante' },
                  { value: 'importador', label: 'Importador' },
                ]}
              />

              <Selector
                label="Tiempo de experiencia como proveedor dropshipping"
                value={tiempoExperiencia}
                onChange={setTiempoExperiencia}
                options={[
                  { value: '0_6_meses', label: '0 a 6 meses' },
                  { value: '6_meses_1_anio', label: '6 meses a 1 año' },
                  { value: 'mas_1_anio', label: 'Más de un año' },
                ]}
              />

              <Selector
                label="¿Estás vinculado a alguna plataforma de dropshipping?"
                value={vinculado}
                onChange={(v) => setVinculado(v as 'si' | 'no')}
                options={[
                  { value: 'no', label: 'NO' },
                  { value: 'si', label: 'SI' },
                ]}
              />
              {vinculado === 'si' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">¿En cuáles plataformas has estado o estás como proveedor?</span>
                  <textarea
                    value={plataformas}
                    onChange={(e) => setPlataformas(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#02a0e3]"
                  />
                </label>
              )}

              <button
                type="button"
                onClick={() => validarPaso1() && setPaso(2)}
                className="mt-2 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
              >
                Siguiente
              </button>
            </div>
          )}

          {paso === 2 && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">Departamento</span>
                  <select
                    value={departamentoSel}
                    onChange={(e) => {
                      setDepartamentoSel(e.target.value);
                      setCiudad('');
                    }}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-[#02a0e3]"
                  >
                    {departamento.map((d: any) => (
                      <option key={d.departamento} value={d.departamento}>
                        {d.departamento}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="mb-1.5 block text-sm font-semibold text-gray-700">Ciudad</span>
                  <select
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-2 py-2.5 text-sm outline-none focus:border-[#02a0e3]"
                  >
                    <option value="">Selecciona</option>
                    {ciudadesDelDepartamento.map((c: string) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <Campo label="Dirección de recogida para el paquete" value={direccion} onChange={setDireccion} />

              <div>
                <Campo
                  label="Correo"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  onBlur={() => setEmailError(email && !emailValido(email) ? 'Correo inválido' : null)}
                />
                {emailError && <p className="mt-1 text-xs font-semibold text-red-600">{emailError}</p>}
              </div>
              <Campo label="Repetir correo" type="email" value={emailRepetir} onChange={setEmailRepetir} />
              <Campo label="Contraseña" type="password" value={clave} onChange={setClave} />
              <Campo label="Repetir contraseña" type="password" value={confirmar} onChange={setConfirmar} />

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={aceptaTerminos} onChange={(e) => setAceptaTerminos(e.target.checked)} className="h-4 w-4 accent-[#02a0e3]" />
                Estoy de acuerdo con los{' '}
                <button type="button" onClick={() => setMostrarTerminos(true)} className="font-semibold text-[#02a0e3] underline">
                  términos de privacidad
                </button>
              </label>

              <div className="flex justify-center">
                <Turnstile onToken={setCaptchaToken} />
              </div>

              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  className="rounded-full border border-gray-300 px-5 py-3 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >
                  Atrás
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={enviando}
                  className="flex-1 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {enviando ? 'Creando cuenta...' : 'Crear cuenta'}
                </button>
              </div>
            </div>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            ¿Ya tienes una cuenta?{' '}
            <Link href="/login" className="font-semibold text-[#02a0e3] hover:underline">
              Iniciar Sesión
            </Link>
          </p>
        </div>
      </div>

      {mostrarTerminos && <TerminosModal onClose={() => setMostrarTerminos(false)} />}
    </div>
  );
}

function Campo({
  label,
  value,
  onChange,
  onBlur,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#02a0e3] focus:ring-2 focus:ring-[#02a0e3]/20"
      />
    </label>
  );
}

function Selector({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm outline-none focus:border-[#02a0e3]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TerminosModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">Términos de Privacidad</h2>
          <button type="button" onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
          Mediante el registro de tus datos personales en este formulario estás autorizando a lokomproaqui.com S.A.S
          para que realice el debido uso, almacenamiento y/o tratamiento de los mismos; permitiéndole a su vez el
          envío de información acerca de sus productos y servicios, actividades de mercadeo, evaluaciones de calidad
          de los productos y servicios y el suministro de información a las entidades gubernamentales y de control.
          {'\n\n'}
          AUTORIZACIÓN TRATAMIENTO DE DATOS PERSONALES{'\n'}
          En mi calidad de titular de la información, actuando libre y voluntariamente, autorizo de manera previa y
          expresa a www.lokomproaqui.com S.A.S y a cualquier cesionario o beneficiario presente o futuro de sus
          obligaciones y derechos, para que directamente o a través de terceros realice el tratamiento a mi
          información personal (recolectar, almacenar, usar, circular, registrar, administrar, procesar, confirmar,
          suprimir y actualizar).
          {'\n\n'}
          Mis derechos como titular de los datos personales suministrados son: conocer, actualizar y rectificar mis
          datos; solicitar prueba de la autorización otorgada; ser informado del uso dado a mis datos; presentar
          quejas ante la Superintendencia de Industria y Comercio; revocar la autorización y/o solicitar la
          supresión de mis datos; acceder en forma gratuita a los mismos.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-full bg-gray-900 py-2.5 text-sm font-bold text-white hover:bg-black"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
