'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Port desde src/app/layout/login (Angular). Replica el mismo flujo real de
// UsuariosService.login(): acepta correo O celular (se resuelve el correo real via el RPC
// lookup_email_by_phone antes de intentar el login, igual que Angular), signInWithPassword
// real de Supabase (la sesion queda en localStorage, compartida con Angular -- ver Fase 0),
// y redirige segun el rol real del perfil (mentor -> panel del mentor, resto -> /articulo).
//
// El checkbox "Recordarme" del original no estaba conectado a ninguna logica real (UI muerta)
// -- se omite en vez de portar algo que no hacia nada (ver feedback_lokomproaqui_unicornio).
export default function LoginPage() {
  const [revisandoSesion, setRevisandoSesion] = useState(true);
  const [identificador, setIdentificador] = useState('');
  const [clave, setClave] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [emailRecuperar, setEmailRecuperar] = useState('');
  const [enviandoRecuperar, setEnviandoRecuperar] = useState(false);
  const [mensajeRecuperar, setMensajeRecuperar] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        setRevisandoSesion(false);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('roles(name)')
        .eq('id', data.session.user.id)
        .single();
      redirigirSegunRol((profile?.roles as unknown as { name: string } | null)?.name);
    });
  }, []);

  function redirigirSegunRol(rol: string | undefined) {
    window.location.href = rol === 'mentor' ? '/mvid8x2qz1/panel' : '/articulo';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);

    let email = identificador.trim();
    if (!email.includes('@')) {
      const { data: resolvedEmail } = await supabase.rpc('lookup_email_by_phone', { p_phone: email });
      if (!resolvedEmail) {
        setError('No encontramos una cuenta con ese celular o correo');
        setEnviando(false);
        return;
      }
      email = resolvedEmail;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password: clave });
    if (signInError || !data.session) {
      setError('Correo/celular o contraseña incorrectos');
      setEnviando(false);
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('roles(name)')
      .eq('id', data.user.id)
      .single();
    redirigirSegunRol((profile?.roles as unknown as { name: string } | null)?.name);
  }

  async function enviarRecuperacion(e: React.FormEvent) {
    e.preventDefault();
    if (enviandoRecuperar || !emailRecuperar.trim()) return;
    setEnviandoRecuperar(true);
    setMensajeRecuperar(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(emailRecuperar.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    setEnviandoRecuperar(false);
    setMensajeRecuperar(
      resetError ? 'No pudimos enviar el correo, intenta de nuevo.' : 'Listo, revisa tu correo para restablecer la contraseña.'
    );
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
          <h1 className="text-center text-2xl font-extrabold text-gray-900">Bienvenido</h1>
          <p className="mt-1 text-center text-sm text-gray-500">Ingresa tus credenciales</p>

          {!mostrarRecuperar ? (
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">Usuario</span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 transition-colors focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
                  <Mail className="h-4.5 w-4.5 shrink-0 text-gray-400" />
                  <input
                    type="text"
                    required
                    placeholder="Correo o número de celular"
                    className="w-full text-sm outline-none"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">Contraseña</span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 transition-colors focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
                  <Lock className="h-4.5 w-4.5 shrink-0 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Contraseña"
                    className="w-full text-sm outline-none"
                    value={clave}
                    onChange={(e) => setClave(e.target.value)}
                  />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="shrink-0 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </label>

              {error && <p className="text-sm font-medium text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={enviando}
                className="mt-1 rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviando ? 'Ingresando...' : 'Iniciar Sesión'}
              </button>

              <button
                type="button"
                onClick={() => setMostrarRecuperar(true)}
                className="text-center text-sm font-semibold text-[#02a0e3] hover:underline"
              >
                ¿Olvidé mi clave?
              </button>

              <p className="text-center text-sm text-gray-500">
                ¿No tienes una cuenta?{' '}
                <Link href="/singUp" className="font-semibold text-[#02a0e3] hover:underline">
                  Regístrate Gratis
                </Link>
              </p>
            </form>
          ) : (
            <form onSubmit={enviarRecuperacion} className="mt-6 flex flex-col gap-4">
              <p className="text-sm text-gray-600">Escribe tu correo electrónico y te mandamos un link para restablecer la contraseña.</p>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-gray-700">Correo electrónico</span>
                <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 transition-colors focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
                  <Mail className="h-4.5 w-4.5 shrink-0 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="w-full text-sm outline-none"
                    value={emailRecuperar}
                    onChange={(e) => setEmailRecuperar(e.target.value)}
                  />
                </div>
              </label>
              {mensajeRecuperar && <p className="text-sm font-medium text-gray-700">{mensajeRecuperar}</p>}
              <button
                type="submit"
                disabled={enviandoRecuperar}
                className="rounded-full bg-gradient-to-r from-[#0177a8] to-[#02a0e3] py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
              >
                {enviandoRecuperar ? 'Enviando...' : 'Enviar correo de recuperación'}
              </button>
              <button
                type="button"
                onClick={() => setMostrarRecuperar(false)}
                className="text-center text-sm font-semibold text-gray-500 hover:underline"
              >
                Volver a iniciar sesión
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-white/80">2026 LokomproAqui ❣️</p>
      </div>
    </div>
  );
}
