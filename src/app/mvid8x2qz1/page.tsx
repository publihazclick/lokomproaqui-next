'use client';

import { useState } from 'react';
import { User, Mail, Phone, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Port desde src/app/components/mentor-registro (Angular). Ruta secreta (no enlazada en
// ningun menu) para crear cuentas del rol "mentor". Reutiliza el mismo signUp real de
// supabase.auth.signUp y despues asigna el rol "mentor" directamente -- el trigger de signup
// (handle_new_user) siempre usa el rol por defecto (vendedor), no admite un rol distinto por
// metadata.
export default function MentorRegistroPage() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [clave, setClave] = useState('');
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (procesando) return;
    if (!nombre || !email || !telefono || !clave) {
      setError('Completa todos los campos');
      return;
    }
    if (clave.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setError(null);
    setProcesando(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password: clave,
      options: { data: { full_name: nombre, phone: telefono } },
    });

    if (signUpError || !data.user) {
      setProcesando(false);
      setError(signUpError?.message.includes('already registered') ? 'Ya existe una cuenta con ese correo' : 'No pudimos crear la cuenta, intenta de nuevo');
      return;
    }

    const { data: rol } = await supabase.from('roles').select('id').eq('name', 'mentor').single();
    if (rol) await supabase.from('profiles').update({ role_id: rol.id }).eq('id', data.user.id);

    if (!data.session) await supabase.auth.signInWithPassword({ email: email.trim(), password: clave });

    window.location.href = '/mvid8x2qz1/panel';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0177a8] to-[#02a0e3] px-4 py-12">
      <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl">
        <h1 className="text-center text-xl font-extrabold text-gray-900">Registro de Mentor</h1>
        <p className="mt-1 text-center text-sm text-gray-500">Crea la cuenta para subir y organizar el contenido del curso.</p>

        <form onSubmit={registrar} className="mt-6 flex flex-col gap-3.5">
          <Campo icon={<User className="h-4.5 w-4.5" />} placeholder="Nombre completo" value={nombre} onChange={setNombre} />
          <Campo icon={<Mail className="h-4.5 w-4.5" />} placeholder="Correo electrónico" type="email" value={email} onChange={setEmail} />
          <Campo icon={<Phone className="h-4.5 w-4.5" />} placeholder="Teléfono" value={telefono} onChange={setTelefono} />
          <Campo icon={<Lock className="h-4.5 w-4.5" />} placeholder="Contraseña (mínimo 6 caracteres)" type="password" value={clave} onChange={setClave} />

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={procesando}
            className="mt-1 rounded-full bg-gray-900 py-3 text-sm font-bold text-white shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-black hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {procesando ? 'Creando cuenta...' : 'Crear cuenta de mentor'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Campo({
  icon,
  placeholder,
  value,
  onChange,
  type = 'text',
}: {
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3.5 py-2.5 focus-within:border-[#02a0e3] focus-within:ring-2 focus-within:ring-[#02a0e3]/20">
      <span className="shrink-0 text-gray-400">{icon}</span>
      <input type={type} placeholder={placeholder} className="w-full text-sm outline-none" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
