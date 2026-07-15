import { supabase } from './supabase';

// Subconjunto de UsuariosService.mapProfileToLegacyUser (Angular) que necesitan los dialogos de
// catalogo/checkout -- id + los campos de contacto/envio usados para prellenar formularios.

export interface DataUserCompleto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  telefono: string | null;
  direccion: string | null;
  ciudad: string | null;
  email: string | null;
}

export async function fetchDataUserCompleto(userId: string): Promise<DataUserCompleto> {
  const [{ data: profile }, { data: userAuth }] = await Promise.all([
    supabase.from('profiles').select('full_name, last_name, phone, city, address').eq('id', userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  return {
    id: userId,
    nombre: profile?.full_name ?? null,
    apellido: profile?.last_name ?? null,
    telefono: profile?.phone ?? null,
    direccion: profile?.address ?? null,
    ciudad: profile?.city ?? null,
    email: userAuth?.user?.email ?? null,
  };
}
