import { supabase } from './supabase';

// Port de CategoriasComponent + FormcategoriasComponent (Angular, panel admin "Categorias").
// A diferencia del resto de Fase 5, `CategoriasService.get()/create()/update()` (Angular) YA
// estaban correctamente conectados desde la migracion a Supabase (busqueda, filtros y mapeo de
// campos reales) -- no hubo bugs de perdida/exposicion de datos que corregir aca, se porta 1:1.

export interface CategoriaAdminRow {
  id: number;
  nombre: string;
  descripcion: string | null;
  imagen: string | null;
  activo: boolean;
}

export async function fetchCategoriasAdmin(search: string): Promise<{ data: CategoriaAdminRow[]; count: number }> {
  let q = supabase.from('categories').select('id, name, description, image_url, active', { count: 'exact' }).is('parent_id', null).order('sort_order');
  if (search.trim()) {
    const s = search.trim();
    q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`);
  }
  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return {
    data: data.map((c) => ({ id: c.id, nombre: c.name, descripcion: c.description, imagen: c.image_url, activo: c.active })),
    count: count ?? data.length,
  };
}

export async function eliminarCategoria(id: number): Promise<boolean> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  return !error;
}

export interface SubcategoriaAdmin {
  id: number | null;
  nombre: string;
}

export interface CategoriaAdminDetalle {
  id: number | null;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  ordenador: string;
  activo: boolean;
  subcategorias: SubcategoriaAdmin[];
}

export async function fetchCategoriaAdminDetalle(id: number): Promise<CategoriaAdminDetalle | null> {
  const { data, error } = await supabase.from('categories').select('id, name, description, image_url, sort_order, active').eq('id', id).maybeSingle();
  if (error || !data) return null;
  const { data: hijas } = await supabase.from('categories').select('id, name').eq('parent_id', id).eq('active', true).order('sort_order');
  return {
    id: data.id,
    nombre: data.name,
    descripcion: data.description || '',
    imagen: data.image_url,
    ordenador: String(data.sort_order ?? ''),
    activo: data.active,
    subcategorias: (hijas || []).map((h) => ({ id: h.id, nombre: h.name })),
  };
}

function slugify(text: string): string {
  return (
    (text || 'categoria')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString(36)
  );
}

export interface GuardarCategoriaInput {
  id: number | null;
  nombre: string;
  descripcion: string;
  imagen: string | null;
  ordenador: string;
  activo: boolean;
}

export async function guardarCategoria(input: GuardarCategoriaInput): Promise<number | null> {
  if (input.id) {
    const { error } = await supabase
      .from('categories')
      .update({ name: input.nombre, description: input.descripcion, image_url: input.imagen, sort_order: Number(input.ordenador) || 0, active: input.activo })
      .eq('id', input.id);
    return error ? null : input.id;
  }
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: input.nombre, slug: slugify(input.nombre), description: input.descripcion, image_url: input.imagen, sort_order: Number(input.ordenador) || 0, active: input.activo })
    .select('id')
    .single();
  return error || !data ? null : data.id;
}

export async function guardarSubcategoria(padreId: number, sub: SubcategoriaAdmin): Promise<boolean> {
  if (sub.id) {
    const { error } = await supabase.from('categories').update({ name: sub.nombre, description: sub.nombre }).eq('id', sub.id);
    return !error;
  }
  const { error } = await supabase.from('categories').insert({ name: sub.nombre, slug: slugify(sub.nombre), description: sub.nombre, parent_id: padreId, active: true, sort_order: 30 });
  return !error;
}

export async function eliminarSubcategoria(id: number): Promise<boolean> {
  const { error } = await supabase.from('categories').delete().eq('id', id);
  return !error;
}
