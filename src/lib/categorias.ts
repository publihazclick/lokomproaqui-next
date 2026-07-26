import { supabase } from './supabase';
import { filtroNotInProveedoresNoAprobados } from './productos';

// Equivalente a CategoriasService.get() (Angular) para el arbol de categorias del catalogo:
// categorias raiz (parent_id null) + sus subcategorias, con "TODOS" agregada al frente igual que
// PedidosComponent.getCategorias().

export interface CategoriaConSub {
  id: number;
  title: string;
  image: string;
  subCategoria: { id: number; title: string }[];
}

export async function fetchCategoriasConSub(): Promise<CategoriaConSub[]> {
  const { data: top } = await supabase
    .from('categories')
    .select('id, name, image_url')
    .is('parent_id', null)
    .eq('active', true)
    .order('sort_order')
    .limit(1000);

  const result: CategoriaConSub[] = [];
  for (const row of top || []) {
    const { data: subs } = await supabase
      .from('categories')
      .select('id, name')
      .eq('parent_id', row.id)
      .eq('active', true)
      .order('sort_order')
      .limit(1000);
    result.push({
      id: row.id,
      title: row.name,
      image: row.image_url || '/assets/imagenes/todos.png',
      subCategoria: (subs || []).map((s) => ({ id: s.id, title: s.name })),
    });
  }

  result.unshift({ id: 0, title: 'TODOS', image: '/assets/imagenes/todos.png', subCategoria: [] });
  return result;
}

// Pedido explicito del usuario 2026-07-25 ("cuando el usuario se loguea no muestres ese monton de
// categorias debajo del banner sino unicamente las que ya tengan productos"): para la franja de
// categorias del Inicio (/articulo) -- a diferencia de fetchCategoriasConSub() de arriba (que se
// sigue usando tal cual en los filtros de /pedidos y /listproduct, donde SI tiene sentido ofrecer
// todas las categorias para navegar), aca se descartan las que no tengan ningun producto visible
// de verdad ahora mismo (activo + del proveedor con cuenta aprobada, mismo criterio que el
// catalogo real -- ver filtroNotInProveedoresNoAprobados en productos.ts). "TODOS" se conserva
// siempre.
export async function fetchCategoriasConProductos(): Promise<CategoriaConSub[]> {
  const todas = await fetchCategoriasConSub();

  let q = supabase.from('products').select('category_id').eq('active', true);
  const excluidos = await filtroNotInProveedoresNoAprobados();
  if (excluidos) q = q.not('owner_profile_id', 'in', excluidos);
  const { data } = await q;

  const idsConProductos = new Set((data || []).map((p) => p.category_id).filter((id): id is number => id != null));
  return todas.filter((c) => c.id === 0 || idsConProductos.has(c.id));
}
