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
  rolname: string;
}

// roles.name usa nombres nuevos ('admin'); el resto de la app compara contra el nombre viejo
// ('administrador') -- mismo unico punto de traduccion que legacyRoleName en usuarios.service.ts.
function legacyRoleName(name: string): string {
  return name === 'admin' ? 'administrador' : name;
}

export async function fetchDataUserCompleto(userId: string): Promise<DataUserCompleto> {
  const [{ data: profile }, { data: userAuth }] = await Promise.all([
    supabase.from('profiles').select('full_name, last_name, phone, city, address, roles(name)').eq('id', userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const rolRow = profile?.roles as unknown as { name: string } | null;
  return {
    id: userId,
    nombre: profile?.full_name ?? null,
    apellido: profile?.last_name ?? null,
    telefono: profile?.phone ?? null,
    direccion: profile?.address ?? null,
    ciudad: profile?.city ?? null,
    email: userAuth?.user?.email ?? null,
    rolname: rolRow ? legacyRoleName(rolRow.name) : 'vendedor',
  };
}

// Equivalente a UsuariosService.get({ where: { usu_usuario } }) para la "vitrina" de otro
// vendedor/bodega (ListArticleStoreComponent): busca por referral_code. El email SIEMPRE llega
// null aca (igual que el original: mapProfileToLegacyUser(p, null) para cualquier perfil que no
// sea el de la sesion actual, ya que el correo vive en auth.users, no en profiles).
export interface PerfilTienda {
  id: string;
  usu_usuario: string | null;
  usu_email: string | null;
  usu_telefono: string | null;
  usu_ciudad: string | null;
  usu_imagen: string | null;
}

// Equivalente a UsuariosService.getOn({ where: {} }): directorio simple de usuarios, usado por el
// autocompletar "Vendedor" del filtro admin de /config/ventas.
export interface VendedorBasico {
  id: string;
  nombre: string;
  telefono: string | null;
}

export async function fetchVendedores(): Promise<VendedorBasico[]> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, last_name, phone').limit(2000);
  if (error || !data) return [];
  return data.map((p) => ({ id: p.id, nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)', telefono: p.phone }));
}

export async function fetchPerfilPorReferralCode(referralCode: string): Promise<PerfilTienda | null> {
  const { data, error } = await supabase.from('profiles').select('id, referral_code, phone, city, avatar_url').eq('referral_code', referralCode).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    usu_usuario: data.referral_code,
    usu_email: null,
    usu_telefono: data.phone,
    usu_ciudad: data.city,
    usu_imagen: data.avatar_url,
  };
}
