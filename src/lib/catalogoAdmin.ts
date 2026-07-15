import { supabase } from './supabase';

// Port de CatalogoService (Angular) + CatalogoComponent/FormcatalogoComponent -- "Catálogos"
// publicos armados a mano por el admin (una coleccion de productos con su propio link
// compartible). CatalogoService ya estaba bien implementado en Supabase (sin bugs, CRUD directo
// sobre `catalogs`/`catalog_items`), se porta 1:1.
//
// Alcance recortado y documentado: el link "Copiar" apunta a `/publico/:id`, una pagina PUBLICA
// de cara al cliente (modulo Angular `publico`, lazy) que todavia no se porto a Next.js -- es su
// propia pieza grande, separada de este panel admin (mismo criterio que Categorias: la gestion
// admin no depende de que la vista publica ya exista). El link se sigue mostrando/copiando tal
// cual para no bloquear la gestion de catalogos mientras esa pieza se construye.

export interface CatalogoRow {
  id: number;
  titulo: string | null;
  estado: number;
  precio: number | null;
  precioMayor: number | null;
}

function mapCatalogo(c: any): CatalogoRow {
  return { id: c.id, titulo: c.title, estado: c.status, precio: c.price, precioMayor: c.wholesale_price };
}

export async function fetchCatalogos(search?: string): Promise<CatalogoRow[]> {
  let q = supabase.from('catalogs').select('*').order('id', { ascending: false });
  if (search && search.trim()) q = q.or(`title.ilike.%${search.trim()}%`);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapCatalogo);
}

export async function crearCatalogo(data: { titulo: string; estado: number; precio: number | null; precioMayor: number | null }): Promise<number | null> {
  const { data: inserted, error } = await supabase
    .from('catalogs')
    .insert({ title: data.titulo, status: data.estado, price: data.precio, wholesale_price: data.precioMayor })
    .select('id')
    .single();
  if (error || !inserted) return null;
  return inserted.id;
}

export async function actualizarCatalogo(id: number, data: { titulo: string; estado: number; precio: number | null; precioMayor: number | null }): Promise<boolean> {
  const { error } = await supabase.from('catalogs').update({ title: data.titulo, status: data.estado, price: data.precio, wholesale_price: data.precioMayor }).eq('id', id);
  return !error;
}

export async function eliminarCatalogo(id: number): Promise<boolean> {
  const { error } = await supabase.from('catalogs').delete().eq('id', id);
  return !error;
}

export interface CatalogoItem {
  id: number;
  productoId: number | null;
  nombre: string | null;
  foto: string | null;
}

export async function fetchCatalogoItems(catalogoId: number): Promise<CatalogoItem[]> {
  const { data, error } = await supabase.from('catalog_items').select('*, products(id, name, image_url)').eq('catalog_id', catalogoId);
  if (error || !data) return [];
  return data.map((i: any) => ({ id: i.id, productoId: i.product_id, nombre: i.products ? i.products.name : null, foto: i.products ? i.products.image_url : i.image_url }));
}

export async function agregarProductoACatalogo(catalogoId: number, productId: number): Promise<number | null> {
  const { data, error } = await supabase.from('catalog_items').insert({ catalog_id: catalogoId, product_id: productId }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function agregarFotoACatalogo(catalogoId: number, imageUrl: string): Promise<number | null> {
  const { data, error } = await supabase.from('catalog_items').insert({ catalog_id: catalogoId, image_url: imageUrl }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function eliminarCatalogoItem(id: number): Promise<boolean> {
  const { error } = await supabase.from('catalog_items').delete().eq('id', id);
  return !error;
}
