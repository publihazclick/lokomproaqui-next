import { supabase } from './supabase';

// Port de PerfilComponent (Angular, src/app/dashboard-config/components/perfil) -- "Mi Cuenta".
// A diferencia del resto de Fase 3/campos ya usados en otras paginas, ESTA pantalla necesita
// escribir varios campos que UsuariosService.update() (Angular) JAMAS mapeo desde la migracion a
// Supabase -- se perdian en silencio al guardar. Se agregaron las columnas que faltaban en
// `profiles` (migracion 032_perfil_extra_fields.sql) y aca se conecta el guardado real por
// primera vez (decision del usuario 2026-07-15: arreglarlo de una vez en vez de portar el bug).

const legacyRoleName = (name: string) => (name === 'admin' ? 'administrador' : name);

export interface PerfilCompleto {
  id: string;
  nombre: string | null;
  apellido: string | null;
  nombreTienda: string | null; // referral_code / usu_usuario
  telefono: string | null;
  indicativo: string;
  ciudad: string | null;
  direccion: string | null;
  avatarUrl: string | null;
  rolname: string;
  contactEmail: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  fechaNacimiento: string | null; // yyyy-mm-dd
  genero: string | null;
  colorTienda: string | null;
  supplierType: string | null;
  supplierExperience: string | null;
  supplierRunsAds: boolean | null;
  pdfRutUrl: string | null;
  pdfCedulaUrl: string | null;
  pdfCamaraComercioUrl: string | null;
}

const SELECT = `
  id, full_name, last_name, referral_code, phone, phone_country_code, city, address, avatar_url,
  roles(name), contact_email, facebook_url, instagram_url, youtube_url, birth_date, gender,
  store_color, supplier_type, supplier_experience, supplier_runs_ads,
  supplier_doc_rut_url, supplier_doc_cc_url, supplier_doc_comercio_url
`;

export async function fetchPerfilCompleto(userId: string): Promise<PerfilCompleto | null> {
  const { data, error } = await supabase.from('profiles').select(SELECT).eq('id', userId).single();
  if (error || !data) return null;
  const rolRow = data.roles as unknown as { name: string } | null;
  return {
    id: data.id,
    nombre: data.full_name,
    apellido: data.last_name,
    nombreTienda: data.referral_code,
    telefono: data.phone,
    indicativo: data.phone_country_code || '57',
    ciudad: data.city,
    direccion: data.address,
    avatarUrl: data.avatar_url,
    rolname: rolRow ? legacyRoleName(rolRow.name) : 'vendedor',
    contactEmail: data.contact_email,
    facebookUrl: data.facebook_url,
    instagramUrl: data.instagram_url,
    youtubeUrl: data.youtube_url,
    fechaNacimiento: data.birth_date,
    genero: data.gender,
    colorTienda: data.store_color,
    supplierType: data.supplier_type,
    supplierExperience: data.supplier_experience,
    supplierRunsAds: data.supplier_runs_ads,
    pdfRutUrl: data.supplier_doc_rut_url,
    pdfCedulaUrl: data.supplier_doc_cc_url,
    pdfCamaraComercioUrl: data.supplier_doc_comercio_url,
  };
}

// Equivalente a UsuariosService.get({ where: { usu_usuario, 'id != this.id' } }): true si YA
// existe otro perfil (distinto del propio) con ese nombre de tienda.
export async function nombreTiendaTomado(nombreTienda: string, propioId: string): Promise<boolean> {
  const { data } = await supabase.from('profiles').select('id').eq('referral_code', nombreTienda).neq('id', propioId).maybeSingle();
  return !!data;
}

export interface PerfilPatch {
  nombre?: string;
  apellido?: string;
  nombreTienda?: string;
  telefono?: string;
  indicativo?: string;
  ciudad?: string;
  direccion?: string;
  avatarUrl?: string;
  contactEmail?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  youtubeUrl?: string;
  fechaNacimiento?: string;
  genero?: string;
  colorTienda?: string;
  supplierType?: string;
  supplierExperience?: string;
  supplierRunsAds?: boolean;
  pdfRutUrl?: string;
  pdfCedulaUrl?: string;
  pdfCamaraComercioUrl?: string;
}

export async function actualizarPerfil(userId: string, patch: PerfilPatch): Promise<boolean> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.nombre !== undefined) dbPatch.full_name = patch.nombre;
  if (patch.apellido !== undefined) dbPatch.last_name = patch.apellido;
  if (patch.nombreTienda !== undefined) dbPatch.referral_code = patch.nombreTienda;
  if (patch.telefono !== undefined) dbPatch.phone = patch.telefono;
  if (patch.indicativo !== undefined) dbPatch.phone_country_code = patch.indicativo;
  if (patch.ciudad !== undefined) dbPatch.city = patch.ciudad;
  if (patch.direccion !== undefined) dbPatch.address = patch.direccion;
  if (patch.avatarUrl !== undefined) dbPatch.avatar_url = patch.avatarUrl;
  if (patch.contactEmail !== undefined) dbPatch.contact_email = patch.contactEmail;
  if (patch.facebookUrl !== undefined) dbPatch.facebook_url = patch.facebookUrl;
  if (patch.instagramUrl !== undefined) dbPatch.instagram_url = patch.instagramUrl;
  if (patch.youtubeUrl !== undefined) dbPatch.youtube_url = patch.youtubeUrl;
  if (patch.fechaNacimiento !== undefined) dbPatch.birth_date = patch.fechaNacimiento || null;
  if (patch.genero !== undefined) dbPatch.gender = patch.genero;
  if (patch.colorTienda !== undefined) dbPatch.store_color = patch.colorTienda;
  if (patch.supplierType !== undefined) dbPatch.supplier_type = patch.supplierType;
  if (patch.supplierExperience !== undefined) dbPatch.supplier_experience = patch.supplierExperience;
  if (patch.supplierRunsAds !== undefined) dbPatch.supplier_runs_ads = patch.supplierRunsAds;
  if (patch.pdfRutUrl !== undefined) dbPatch.supplier_doc_rut_url = patch.pdfRutUrl;
  if (patch.pdfCedulaUrl !== undefined) dbPatch.supplier_doc_cc_url = patch.pdfCedulaUrl;
  if (patch.pdfCamaraComercioUrl !== undefined) dbPatch.supplier_doc_comercio_url = patch.pdfCamaraComercioUrl;

  const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId);
  return !error;
}

// Equivalente a UsuariosService.cambioPass: solo se puede cambiar la propia clave (ya logueado).
export async function cambiarPassword(nuevaClave: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.auth.updateUser({ password: nuevaClave });
  if (error) return { success: false, message: error.message };
  return { success: true };
}

// Equivalente a ArchivosService.create/createFile (uploadFile): sube a un archivo al bucket
// PUBLICO 'lokomproaqui-media' -- sin el bug de Storage/RLS de los buckets privados (ver
// [[lokomproaqui_nextjs_migration]]), XHR directo funciona bien aca.
export async function subirArchivoPublico(file: File): Promise<string | null> {
  const ext = (file.name || 'jpg').split('.').pop();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('lokomproaqui-media').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('lokomproaqui-media').getPublicUrl(path);
  return data.publicUrl;
}

// Categorias que el vendedor/proveedor quiere promocionar (user_categories).
//
// Bug real encontrado y corregido (no replicado): CategoriasService.createUser (Angular, ya
// migrado a Supabase) solo hace upsert de las categorias marcadas -- nunca borra las que el
// usuario desmarca, asi que en produccion HOY destildar una categoria en el formulario de perfil
// no tiene ningun efecto real. Se corrige sincronizando de verdad (borra las que ya no estan
// marcadas, agrega las nuevas).
export async function fetchCategoriasSeleccionadas(userId: string): Promise<number[]> {
  const { data } = await supabase.from('user_categories').select('category_id').eq('profile_id', userId);
  return (data || []).map((r) => r.category_id);
}

export async function guardarCategoriasSeleccionadas(userId: string, categoryIds: number[]): Promise<boolean> {
  const actuales = await fetchCategoriasSeleccionadas(userId);
  const aQuitar = actuales.filter((id) => !categoryIds.includes(id));
  const aAgregar = categoryIds.filter((id) => !actuales.includes(id));

  if (aQuitar.length) {
    const { error } = await supabase.from('user_categories').delete().eq('profile_id', userId).in('category_id', aQuitar);
    if (error) return false;
  }
  if (aAgregar.length) {
    const rows = aAgregar.map((id) => ({ profile_id: userId, category_id: id }));
    const { error } = await supabase.from('user_categories').upsert(rows, { onConflict: 'profile_id,category_id', ignoreDuplicates: true });
    if (error) return false;
  }
  return true;
}
