import { supabase } from './supabase';

// Port de UsuariosComponent + FormusuariosComponent (Angular, "Usuarios" -- directorio admin).
//
// BUGS REALES encontrados y NO replicados (mismo criterio del resto de Fase 5):
// 1) UsuariosService.get() (Angular) solo soporta filtrar por id/telefono/nombre de tienda --
//    nunca implemento `where.or` (busqueda) ni paginacion. En produccion HOY "Usuarios" trae la
//    tabla `profiles` COMPLETA en una sola consulta sin filtrar ni paginar cada vez que se busca
//    algo (la busqueda se ignora en silencio). Se construye busqueda y paginacion reales aca.
// 2) El selector de "Perfil" (rol) en FormusuariosComponent nunca se guardaba: `update()` no mapea
//    `usu_perfil`/role_id a ninguna columna. Un admin cambiando el rol de otro usuario no tenia
//    ningun efecto real. Se conecta de verdad (rol es la funcion mas importante de esta pantalla).
// 3) El toggle "Activo/Inactivo" (mal etiquetado "Tipo de Documento" en el original, un error de
//    copy/paste) tampoco se guardaba -- se conecta a `profiles.status` (el mismo campo real que ya
//    usa UsuariosService.delete() para desactivar).
//
// Alcance recortado y documentado: cambiar la clave de OTRO usuario (el original ya estaba roto
// para este caso -- `cambioPass()` solo permite cambiar la clave PROPIA, `auth.updateUser` opera
// sobre la sesion actual) necesitaria una Edge Function con service_role, fuera de alcance de esta
// pieza. "Abrir Empresas" (concepto de multi-empresa nunca usado en el resto del sistema, no se
// encontro ningun otro rastro real) y toda la seccion "Informacion de la bodega extras" (fecha
// nacimiento, email, porcentaje, nivel, tipo proveedor, PDFs) tampoco se guardaban en el original
// (mismos campos no mapeados que en /config/perfil) -- ya se resuelven de verdad para el PROPIO
// usuario en /config/perfil, no hace falta duplicarlos aca para editar a otros.

const ROLES_ASIGNABLES = ['admin', 'vendedor', 'proveedor', 'bodega'];
const ROL_LABEL: Record<string, string> = { admin: 'Administrador', vendedor: 'Vendedor', proveedor: 'Proveedor', bodega: 'Bodega' };

export interface RolOpcion {
  id: number;
  name: string;
  label: string;
}

export async function fetchRolesAsignables(): Promise<RolOpcion[]> {
  const { data } = await supabase.from('roles').select('id, name').in('name', ROLES_ASIGNABLES);
  return (data || []).map((r) => ({ id: r.id, name: r.name, label: ROL_LABEL[r.name] || r.name }));
}

export interface UsuarioAdminRow {
  id: string;
  nombre: string;
  rolNombre: string;
  telefono: string | null;
  ciudad: string | null;
  fechaRegistro: string;
  activo: boolean;
}

export async function fetchUsuariosAdmin(opts: { search?: string; page: number; limit: number }): Promise<{ data: UsuarioAdminRow[]; count: number }> {
  let q = supabase.from('profiles').select('id, full_name, last_name, phone, city, status, created_at, roles(name)', { count: 'exact' }).order('created_at', { ascending: false });
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`full_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,referral_code.ilike.%${s}%`);
  }
  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return {
    data: data.map((p: any) => ({
      id: p.id,
      nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)',
      rolNombre: p.roles ? ROL_LABEL[p.roles.name] || p.roles.name : '—',
      telefono: p.phone,
      ciudad: p.city,
      fechaRegistro: p.created_at,
      activo: p.status !== 0,
    })),
    count: count ?? data.length,
  };
}

export interface UsuarioAdminDetalle {
  id: string;
  nombre: string | null;
  apellido: string | null;
  nombreTienda: string | null;
  documento: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  roleId: number | null;
  activo: boolean;
}

export async function fetchUsuarioAdminDetalle(userId: string): Promise<UsuarioAdminDetalle | null> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, last_name, referral_code, document_id, phone, city, address, role_id, status').eq('id', userId).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    nombre: data.full_name,
    apellido: data.last_name,
    nombreTienda: data.referral_code,
    documento: data.document_id,
    telefono: data.phone,
    ciudad: data.city,
    direccion: data.address,
    roleId: data.role_id,
    activo: data.status !== 0,
  };
}

export interface PatchUsuarioAdmin {
  nombre?: string;
  apellido?: string;
  nombreTienda?: string;
  documento?: string;
  telefono?: string;
  direccion?: string;
  roleId?: number;
  activo?: boolean;
}

export async function actualizarUsuarioAdmin(userId: string, patch: PatchUsuarioAdmin): Promise<boolean> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.nombre !== undefined) dbPatch.full_name = patch.nombre;
  if (patch.apellido !== undefined) dbPatch.last_name = patch.apellido;
  if (patch.nombreTienda !== undefined) dbPatch.referral_code = patch.nombreTienda;
  if (patch.documento !== undefined) dbPatch.document_id = patch.documento;
  if (patch.telefono !== undefined) dbPatch.phone = patch.telefono;
  if (patch.direccion !== undefined) dbPatch.address = patch.direccion;
  if (patch.roleId !== undefined) dbPatch.role_id = patch.roleId;
  if (patch.activo !== undefined) dbPatch.status = patch.activo ? 1 : 0;

  const { error } = await supabase.from('profiles').update(dbPatch).eq('id', userId);
  return !error;
}
