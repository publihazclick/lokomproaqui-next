'use client';

import { use, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail, User, Users, Phone, Store, Truck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Indicativo } from '@/lib/indicativo';
import { departamento } from '@/lib/departamentos';
import { notificarRegistroWhatsapp } from '@/lib/adminConfig';

// Port desde src/app/layout/sign-up (Angular), ruta [[...slug]] para cubrir tanto /singUp como
// /singUp/:type/:cel (mismo componente en Angular). Es el registro que de verdad usa casi todo
// el sitio (CTAs de /info, /login, y el link de referido que cada vendedor comparte con
// /config/perfil -> urlRegistro), asi que el selector de rol y el cel de referido de la URL se
// preservan tal cual estaban.
//
// Pedido explicito del usuario 2026-07-24: el selector Vendedor/Proveedor debe ir AL INICIO del
// formulario (no como checkbox al final, como estaba) y el formulario debe cambiar de verdad segun
// cual se elija -- antes ambos roles veian exactamente los mismos campos, sin ninguna de las
// preguntas de proveedor (tipo, experiencia, plataformas, direccion de recogida) que si existen en
// /registro. Esos campos y sus mismas claves de metadata (supplier_type, supplier_experience,
// supplier_linked_platform, supplier_platforms, department, city, address) se replican aca para
// que el proveedor registrado por esta puerta quede identico al registrado por /registro.
//
// BUG REAL encontrado y corregido de paso: el campo "nombre de tienda" (usuUsuario) se validaba en
// vivo (chequeo de disponibilidad) pero el submit() original NUNCA lo mandaba en el payload de
// signUp -- se perdia siempre. Se agrega `desired_referral_code` (misma clave que usa /registro)
// para que si quede guardado.
export default function SignUpPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const typeRol = slug?.[0]; // 'vendedor' | 'proveedor' | undefined
  const cel = slug?.[1];

  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [dataCabeza, setDataCabeza] = useState<{ referral_code: string | null } | null>(null);

  // Pedido explicito del usuario 2026-07-24: ninguna opcion viene seleccionada por defecto (salvo
  // que la URL ya traiga el tipo, ej. link de referido /singUp/vendedor/:cel) -- el usuario debe
  // elegir a proposito antes de poder escribir en el formulario.
  const [rol, setRol] = useState<'vendedor' | 'proveedor' | null>(
    typeRol === 'proveedor' ? 'proveedor' : typeRol === 'vendedor' ? 'vendedor' : null
  );

  // Campos comunes
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [usuUsuario, setUsuUsuario] = useState('');
  const [usuarioTomado, setUsuarioTomado] = useState(false);
  const [indicativo, setIndicativo] = useState('57');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [clave, setClave] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Campos solo-proveedor (mismas opciones y claves que /registro)
  const [tipoProveedor, setTipoProveedor] = useState('fabricante');
  const [tiempoExperiencia, setTiempoExperiencia] = useState('0_6_meses');
  const [vinculado, setVinculado] = useState<'si' | 'no'>('no');
  const [plataformas, setPlataformas] = useState('');
  const [departamentoSel, setDepartamentoSel] = useState(departamento[0]?.departamento ?? '');
  const [ciudad, setCiudad] = useState('');
  const [direccion, setDireccion] = useState('');

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

  useEffect(() => {
    if (!cel) return;
    supabase
      .from('profiles')
      .select('referral_code')
      .eq('phone', cel)
      .maybeSingle()
      .then(({ data }) => setDataCabeza(data));
  }, [cel]);

  // Mismo chequeo que antes: busca si el nombre de tienda/bodega ya esta tomado (referral_code) --
  // no bloquea nada mas del formulario, solo muestra el aviso.
  async function validarUsuario(valor: string) {
    const limpio = valor.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s/g, '');
    setUsuUsuario(limpio);
    if (!limpio) {
      setUsuarioTomado(false);
      return;
    }
    const { data } = await supabase.from('profiles').select('id').eq('referral_code', limpio).maybeSingle();
    setUsuarioTomado(!!data);
  }

  function emailValido(valor: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor);
  }

  // Antes esta funcion escondia CUALQUIER error no reconocido detras de un mensaje generico
  // ("No pudimos crear tu cuenta, intenta de nuevo") -- eso hacia imposible saber la causa real
  // (ej. contraseña muy corta, formulario incompleto, o cualquier otro error de Supabase). Ahora
  // se traducen los casos conocidos y, si no es ninguno, se muestra el mensaje real de Supabase en
  // vez de ocultarlo -- pedido explicito del usuario 2026-07-24: "necesito que el registro
  // funcione perfectamente", y para eso hay que poder ver por que falla si vuelve a pasar.
  function mensajeErrorRegistro(mensajeOriginal: string): string {
    if (mensajeOriginal.includes('already registered')) return 'Ya existe una cuenta con ese correo';
    if (mensajeOriginal.includes('profiles_phone_key') || mensajeOriginal.includes('phone')) return 'Ya existe una cuenta con ese número de teléfono';
    if (mensajeOriginal.toLowerCase().includes('password')) return 'La contraseña debe tener mínimo 6 caracteres';
    if (mensajeOriginal.includes('profiles_referral_code_key') || mensajeOriginal.includes('referral_code')) return 'Ese nombre de tienda/bodega ya está en uso, elige otro';
    return `No pudimos crear tu cuenta: ${mensajeOriginal}`;
  }

  const MENSAJE_FALTA_ROL = 'Debes seleccionar si la cuenta que quieres crear es de vendedor o proveedor antes de diligenciar este formulario';

  // Pedido explicito del usuario 2026-07-24: si intenta escribir en cualquier campo del formulario
  // sin haber elegido rol todavia, se le avisa y se le quita el foco (no se le deja escribir).
  function bloquearSiFaltaRol(e: React.FocusEvent<HTMLElement>) {
    if (!rol) {
      (e.target as HTMLElement).blur();
      alert(MENSAJE_FALTA_ROL);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

    if (!rol) {
      alert(MENSAJE_FALTA_ROL);
      return;
    }
    if (!nombre || !apellido || !telefono || !email || !clave || !confirmar) {
      setEmailError(null);
      alert('Completa todos los campos obligatorios');
      return;
    }
    if (!emailValido(email)) {
      setEmailError('Correo invalido');
      return;
    }
    if (clave !== confirmar) {
      alert('Las claves no coinciden');
      return;
    }
    if (clave.length < 6) {
      alert('La contraseña debe tener mínimo 6 caracteres');
      return;
    }
    if (rol === 'proveedor' && (!ciudad || !direccion)) {
      alert('Completa la ciudad y la dirección de recogida');
      return;
    }

    setEnviando(true);
    const referrerId = dataCabeza && cel ? await resolverReferrerId(cel) : null;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: clave,
      options: {
        data: {
          full_name: nombre,
          last_name: apellido,
          phone: telefono,
          phone_country_code: indicativo,
          referrer_id: referrerId,
          role_name: rol,
          desired_referral_code: usuUsuario || undefined,
          ...(rol === 'proveedor'
            ? {
                supplier_type: tipoProveedor,
                supplier_experience: tiempoExperiencia,
                supplier_linked_platform: vinculado === 'si',
                supplier_platforms: vinculado === 'si' ? plataformas : null,
                department: departamentoSel,
                city: ciudad,
                address: direccion,
              }
            : {}),
        },
      },
    });

    if (error) {
      setEnviando(false);
      alert(mensajeErrorRegistro(error.message));
      return;
    }

    if (!data.session) {
      await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    }

    const { data: profile } = await supabase.from('profiles').select('roles(name)').eq('id', data.user!.id).single();
    const rolReal = (profile?.roles as unknown as { name: string } | null)?.name;

    // Pedido explicito del usuario 2026-07-19: abre WhatsApp (pestaña nueva) con un aviso
    // pre-armado hacia el numero configurado en /config/configuracion -- no interrumpe el redirect
    // normal de abajo, las dos cosas pasan juntas.
    notificarRegistroWhatsapp({ nombre: `${nombre} ${apellido}`.trim(), telefono, rol: rolReal || rol });

    // Pedido explicito del usuario 2026-07-20: un proveedor recien registrado debe ver de inmediato
    // el mensaje de "sube minimo 3 productos y envialos a revision" -- ese banner vive en
    // /config/productos (ver ProductosPage), asi que se manda ahi directo en vez de a /infoSupplier
    // (galeria publica de OTROS proveedores, no tenia sentido para alguien que recien se registro).
    window.location.href = rolReal === 'proveedor' ? '/config/productos' : rolReal === 'vendedor' ? '/articulo' : '/pedidos';
  }

  async function resolverReferrerId(phone: string): Promise<string | null> {
    const { data } = await supabase.from('profiles').select('id').eq('phone', phone).maybeSingle();
    return data?.id ?? null;
  }

  if (revisandoSesion) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-4 py-12">
      <div className="w-full max-w-md">
        <Link href="/info" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/logo.svg" alt="LokomproAqui" className="h-14 w-auto drop-shadow-md" />
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <h1 className="text-center text-2xl font-extrabold text-gray-900">
            {rol === 'proveedor' ? 'Registrarme como Proveedor' : rol === 'vendedor' ? 'Registrarme como Vendedor' : 'Registrarme'}
          </h1>
          {dataCabeza && <p className="mt-1 text-center text-sm font-semibold text-[#02a0e3]">Te invitó {dataCabeza.referral_code}</p>}
          <p className="mt-1 text-center text-sm text-gray-500">
            {rol === 'proveedor'
              ? 'Tengo productos que otros pueden vender y yo despachar en menos de 48 Horas'
              : rol === 'vendedor'
                ? 'Quiero promocionar los productos de lokomproaqui.com para que cada proveedor despache mis pedidos directo a mi cliente y yo recibir mis comisiones'
                : 'Elige qué tipo de cuenta quieres crear'}
          </p>

          {/* Selector de rol -- lo primero del formulario, cambia los campos que siguen. */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setRol('vendedor')}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-colors ${
                rol === 'vendedor' ? 'border-[#02a0e3] bg-[#02a0e3]/10 text-[#02a0e3]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Store className="h-6 w-6" />
              Vendedor
            </button>
            <button
              type="button"
              onClick={() => setRol('proveedor')}
              className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 text-sm font-bold transition-colors ${
                rol === 'proveedor' ? 'border-[#02a0e3] bg-[#02a0e3]/10 text-[#02a0e3]' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <Truck className="h-6 w-6" />
              Proveedor
            </button>
          </div>

          <form onSubmit={submit} onFocusCapture={bloquearSiFaltaRol} className="mt-5 flex flex-col gap-3.5">
            <Campo
              icon={<User className="h-4.5 w-4.5" />}
              placeholder={rol === 'proveedor' ? 'Nombre del titular de la bodega' : 'Nombre'}
              value={nombre}
              onChange={setNombre}
            />
            <Campo
              icon={<Users className="h-4.5 w-4.5" />}
              placeholder={rol === 'proveedor' ? 'Apellido del titular de la bodega' : 'Apellido'}
              value={apellido}
              onChange={setApellido}
            />

            <div>
              <Campo
                icon={<User className="h-4.5 w-4.5" />}
                placeholder={rol === 'proveedor' ? 'Cómo se llama tu bodega' : 'Cómo quieres llamar a tu tienda (Dayana Store)'}
                value={usuUsuario}
                onChange={validarUsuario}
              />
              {usuarioTomado && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  {rol === 'proveedor' ? 'Ese nombre de bodega ya está registrado, usa otro.' : 'El nombre de tu tienda ya se encuentra registrado, por favor utiliza otro.'}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <select
                value={indicativo}
                onChange={(e) => setIndicativo(e.target.value)}
                className="w-24 shrink-0 rounded-xl border border-gray-200 px-2 text-sm outline-none focus:border-[#02a0e3]"
              >
                {Indicativo.map((item: { nombre: string; phone_code: string }) => (
                  <option key={item.nombre} value={item.phone_code}>
                    {item.nombre} +{item.phone_code}
                  </option>
                ))}
              </select>
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
                <Phone className="h-4.5 w-4.5 shrink-0 text-gray-400" />
                <input
                  type="tel"
                  placeholder={rol === 'proveedor' ? 'Celular para el soporte' : 'Escribe número del cel'}
                  className="w-full text-sm outline-none"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            </div>

            {rol === 'proveedor' && (
              <>
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

                <Campo icon={<Truck className="h-4.5 w-4.5" />} placeholder="Dirección de recogida para el paquete" value={direccion} onChange={setDireccion} />
              </>
            )}

            <div>
              <Campo
                icon={<Mail className="h-4.5 w-4.5" />}
                placeholder="Correo"
                type="email"
                value={email}
                onChange={setEmail}
                onBlur={() => setEmailError(email && !emailValido(email) ? 'Correo invalido' : null)}
              />
              {emailError && <p className="mt-1 text-xs font-semibold text-red-600">{emailError}</p>}
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
              <Lock className="h-4.5 w-4.5 shrink-0 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Contraseña"
                className="w-full text-sm outline-none"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
              />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
              <Lock className="h-4.5 w-4.5 shrink-0 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirmar contraseña"
                className="w-full text-sm outline-none"
                value={confirmar}
                onChange={(e) => setConfirmar(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={enviando}
              className="mt-1 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {enviando ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>

            <p className="text-center text-sm text-gray-500">
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" className="font-semibold text-[#02a0e3] hover:underline">
                Iniciar Sesión
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

function Campo({
  icon,
  placeholder,
  value,
  onChange,
  onBlur,
  type = 'text',
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
      <span className="shrink-0 text-gray-400">{icon}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full text-sm outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    </div>
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
