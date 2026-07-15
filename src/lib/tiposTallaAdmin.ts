import { supabase } from './supabase';

// Port de ListSizeComponent + FormListSizeComponent (Angular, panel admin "Tipo de Tallas") --
// alimenta el selector "Tipo de medida" que ya usa /config/productos.
//
// BUGS REALES encontrados y corregidos (no replicados):
// 1) "Eliminar" en la lista hace `obj.cat_activo = 2` (un campo de CATEGORIAS, copiado/pegado por
//    error) y llama a `update(obj)` -- `TipoTallasService.update()` nunca lee `cat_activo`, asi
//    que en produccion HOY "Eliminar" no desactiva nada de verdad (la fila solo desaparece de la
//    tabla en pantalla hasta el proximo refresco). Mismo error en el selector "Estado del tipo
//    Talla" del formulario. Se corrige usando el campo real (`active`, via `tit_sw_activo`).
// 2) Busqueda y paginacion de la lista no estaban implementadas en el backend.
//
// "listaPlatform" (ListPlatformComponent, config de sucursal por transportador) NO se porta: el
// servicio Angular que la respalda (PlatformService) es un no-op documentado a proposito desde la
// migracion a Mipaquete ("la tabla vieja Platform se elimino... se deja como no-op para no romper
// componentes que todavia la llamen") -- esa pantalla siempre muestra una lista vacia y
// crear/editar/eliminar no hacen nada, en el original tambien. Nada real que migrar ahi.

export interface TipoTallaRow {
  id: number;
  nombre: string;
  activo: boolean;
  ordenar: number;
}

export async function fetchTiposTallaAdmin(search: string): Promise<TipoTallaRow[]> {
  let q = supabase.from('size_types').select('id, name, active, sort_order').order('sort_order');
  if (search.trim()) q = q.ilike('name', `%${search.trim()}%`);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((t) => ({ id: t.id, nombre: t.name, activo: t.active, ordenar: t.sort_order }));
}

export async function desactivarTipoTalla(id: number): Promise<boolean> {
  const { error } = await supabase.from('size_types').update({ active: false }).eq('id', id);
  return !error;
}

export interface TallaHija {
  id: number | null;
  nombre: string;
  ordenar: number;
}

export interface TipoTallaDetalle {
  id: number | null;
  nombre: string;
  activo: boolean;
  ordenar: number;
  tallas: TallaHija[];
}

export async function fetchTipoTallaDetalle(id: number): Promise<TipoTallaDetalle | null> {
  const { data, error } = await supabase.from('size_types').select('id, name, active, sort_order').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const { data: tallas } = await supabase.from('sizes').select('id, name, sort_order').eq('size_type_id', id).eq('active', true).order('sort_order');
  return {
    id: data.id,
    nombre: data.name,
    activo: data.active,
    ordenar: data.sort_order,
    tallas: (tallas || []).map((t) => ({ id: t.id, nombre: t.name, ordenar: t.sort_order })),
  };
}

export async function guardarTipoTalla(input: { id: number | null; nombre: string; activo: boolean; ordenar: number }): Promise<number | null> {
  if (input.id) {
    const { error } = await supabase.from('size_types').update({ name: input.nombre, active: input.activo, sort_order: input.ordenar }).eq('id', input.id);
    return error ? null : input.id;
  }
  const { data, error } = await supabase.from('size_types').insert({ name: input.nombre, active: input.activo, sort_order: input.ordenar }).select('id').single();
  return error || !data ? null : data.id;
}

export async function agregarTallaHija(tipoTallaId: number, nombre: string): Promise<boolean> {
  const { error } = await supabase.from('sizes').insert({ name: nombre, size_type_id: tipoTallaId, active: true, sort_order: 0 });
  return !error;
}

export async function actualizarOrdenTalla(id: number, ordenar: number): Promise<boolean> {
  const { error } = await supabase.from('sizes').update({ sort_order: ordenar }).eq('id', id);
  return !error;
}

export async function eliminarTallaHija(id: number): Promise<boolean> {
  const { error } = await supabase.from('sizes').update({ active: false }).eq('id', id);
  return !error;
}
