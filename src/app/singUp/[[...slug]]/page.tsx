'use client';

import { use, useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, User, Users, Phone } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Indicativo } from '@/lib/indicativo';

// Port desde src/app/layout/sign-up (Angular), ruta [[...slug]] para cubrir tanto /singUp como
// /singUp/:type/:cel (mismo componente en Angular). Se replica el formulario COMPLETO tal cual
// pidio el usuario -- incluidos 2 campos que en la version actual de Angular no hacen nada
// (nombre de tienda con chequeo de disponibilidad, indicativo de pais separado del telefono):
// solo se saca la restriccion de que el correo tenga que ser gmail.com/gmail.es (decision
// explicita del usuario 2026-07-14, el resto del formulario no cambia de comportamiento).
export default function SignUpPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = use(params);
  const typeRol = slug?.[0]; // 'vendedor' | 'proveedor' | undefined
  const cel = slug?.[1];

  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [dataCabeza, setDataCabeza] = useState<{ referral_code: string | null } | null>(null);

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
  const [rol, setRol] = useState<'vendedor' | 'proveedor'>(typeRol === 'proveedor' ? 'proveedor' : 'vendedor');
  const [enviando, setEnviando] = useState(false);

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

  // Mismo chequeo que Angular: busca si el nombre de tienda ya esta tomado (referral_code) --
  // no bloquea nada mas del formulario, solo muestra el aviso, igual que el original.
  async function validarUsuario(valor: string) {
    const limpio = valor.replace(/[^a-zA-Z ]/g, '').replace(/\s/g, '');
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;

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
          referrer_id: referrerId,
          role_name: rol,
        },
      },
    });

    if (error) {
      setEnviando(false);
      let msg = 'No pudimos crear tu cuenta, intenta de nuevo';
      if (error.message.includes('already registered')) msg = 'Ya existe una cuenta con ese correo';
      else if (error.message.includes('profiles_phone_key') || error.message.includes('phone')) msg = 'Ya existe una cuenta con ese numero de telefono';
      alert(msg);
      return;
    }

    if (!data.session) {
      await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });
    }

    const { data: profile } = await supabase.from('profiles').select('roles(name)').eq('id', data.user!.id).single();
    const rolReal = (profile?.roles as unknown as { name: string } | null)?.name;
    window.location.href = rolReal === 'proveedor' ? '/infoSupplier' : rolReal === 'vendedor' ? '/articulo' : '/pedidos';
  }

  async function resolverReferrerId(phone: string): Promise<string | null> {
    const { data } = await supabase.from('profiles').select('id').eq('phone', phone).maybeSingle();
    return data?.id ?? null;
  }

  if (revisandoSesion) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-4 py-12">
      <div className="w-full max-w-md">
        <a href="/info" className="mb-8 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/logo.svg" alt="LokomproAqui" className="h-14 w-auto drop-shadow-md" />
        </a>

        <div className="rounded-3xl bg-white p-8 shadow-2xl sm:p-10">
          <h1 className="text-center text-2xl font-extrabold text-gray-900">Registrarme</h1>
          {dataCabeza && <p className="mt-1 text-center text-sm font-semibold text-[#02a0e3]">Te invitó {dataCabeza.referral_code}</p>}
          <p className="mt-1 text-center text-sm text-gray-500">Rellena el siguiente formulario para crear una cuenta</p>

          <form onSubmit={submit} className="mt-6 flex flex-col gap-3.5">
            <Campo icon={<User className="h-4.5 w-4.5" />} placeholder="Nombre" value={nombre} onChange={setNombre} />
            <Campo icon={<Users className="h-4.5 w-4.5" />} placeholder="Apellido" value={apellido} onChange={setApellido} />

            <div>
              <Campo
                icon={<User className="h-4.5 w-4.5" />}
                placeholder="Cómo quieres llamar a tu tienda (Dayana Store)"
                value={usuUsuario}
                onChange={validarUsuario}
              />
              {usuarioTomado && (
                <p className="mt-1 text-xs font-semibold text-red-600">
                  El nombre de tu tienda ya se encuentra registrado, por favor utiliza otro.
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
                  placeholder="Escribe número del cel"
                  className="w-full text-sm outline-none"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/[^0-9]/g, ''))}
                />
              </div>
            </div>

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

            <div className="flex gap-6 py-1">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={rol === 'vendedor'} onChange={() => setRol('vendedor')} className="h-4 w-4 accent-[#02a0e3]" />
                Vendedor
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <input type="checkbox" checked={rol === 'proveedor'} onChange={() => setRol('proveedor')} className="h-4 w-4 accent-[#02a0e3]" />
                Proveedor
              </label>
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
              <a href="/login" className="font-semibold text-[#02a0e3] hover:underline">
                Iniciar Sesión
              </a>
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
