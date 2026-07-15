import { supabase } from './supabase';

// Port de TestimonioComponent + FormtestimoniosComponent (Angular, panel admin "Testimonios") --
// gestion de los testimonios que se muestran en /testimonio (ya migrada en Fase 2).
//
// BUGS REALES encontrados y corregidos (no replicados):
// 1) `delete(obj, idx)` en el original arma `datos = {id, pro_activo:1}` pero JAMAS lo usa --
//    llama a `update(obj)` con el objeto ORIGINAL sin tocar, asi que "Eliminar" en produccion HOY
//    no borra ni desactiva nada de verdad: la fila solo desaparece de la tabla en pantalla hasta
//    el proximo refresco, cuando vuelve a aparecer. Se corrige usando el delete() real del
//    servicio (coherente con que el boton dice "Eliminar", no "Ocultar").
// 2) `row['usuario']?.usu_nombre` -- `usuario` es un UUID plano (`profile_id`), no un objeto -- la
//    columna de usuario siempre esta vacia. Se resuelve con un join real a `profiles`.
// 3) La busqueda del formulario ("buscar usuario por email" para crear un testimonio a nombre de
//    otro usuario, funcion solo admin) tiene el mismo problema que FormpuntosComponent: el correo
//    no vive en `profiles`, `UsuariosService.get()` nunca soporto ese filtro. Se cambia a buscar
//    por telefono o nombre de tienda, igual que ya se hizo en FormPuntosModal.
// 4) Busqueda y paginacion de la lista tampoco estaban implementadas en el backend (unicamente
//    `estado`/`usuario` funcionaban) -- se construyen de verdad aca.

const ESTADO_LABEL: Record<number, string> = { 0: 'Activo', 1: 'Eliminado', 2: 'Pendiente de aprobación' };

export interface TestimonioAdminRow {
  id: number;
  usuarioNombre: string | null;
  descripcion: string;
  estado: number;
  estadoLabel: string;
  fecha: string;
}

export async function fetchTestimoniosAdmin(opts: { search?: string; page: number; limit: number }): Promise<{ data: TestimonioAdminRow[]; count: number }> {
  let q = supabase.from('testimonials').select('id, description, status, created_at, profiles(full_name)', { count: 'exact' }).order('created_at', { ascending: false });
  if (opts.search && opts.search.trim()) {
    q = q.ilike('description', `%${opts.search.trim()}%`);
  }
  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return {
    data: data.map((t: any) => ({
      id: t.id,
      usuarioNombre: t.profiles ? t.profiles.full_name : null,
      descripcion: t.description,
      estado: t.status,
      estadoLabel: ESTADO_LABEL[t.status] || 'Activo',
      fecha: t.created_at,
    })),
    count: count ?? data.length,
  };
}

export async function eliminarTestimonio(id: number): Promise<boolean> {
  const { error } = await supabase.from('testimonials').delete().eq('id', id);
  return !error;
}

export interface TestimonioDetalle {
  id: number | null;
  usuarioId: string;
  usuarioNombre: string | null;
  descripcion: string;
  estado: number;
}

export async function fetchTestimonioDetalle(id: number): Promise<TestimonioDetalle | null> {
  const { data, error } = await supabase.from('testimonials').select('id, profile_id, description, status, profiles(full_name)').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    usuarioId: data.profile_id,
    usuarioNombre: (data.profiles as any)?.full_name ?? null,
    descripcion: data.description,
    estado: data.status,
  };
}

export async function crearTestimonio(usuarioId: string, descripcion: string): Promise<boolean> {
  const { error } = await supabase.from('testimonials').insert({ profile_id: usuarioId, description: descripcion, status: 0 });
  return !error;
}

export async function actualizarTestimonio(id: number, descripcion: string, estado: number): Promise<boolean> {
  const { error } = await supabase.from('testimonials').update({ description: descripcion, status: estado }).eq('id', id);
  return !error;
}
