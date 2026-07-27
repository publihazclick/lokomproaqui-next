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

// CORREGIDO 2026-07-27: esto hacia 1 consulta por CADA categoria raiz para traer sus
// subcategorias (17 categorias reales en produccion = 17 consultas secuenciales, ~300ms cada
// una = 5+ segundos solo en esto) -- medido en vivo con Playwright, era el grueso de la demora
// real reportada por el usuario en /pedidos y /listproduct. Ahora es una sola consulta con
// `.in('parent_id', topIds)`, agrupada en memoria -- mismo resultado, sin el N+1.
export async function fetchCategoriasConSub(): Promise<CategoriaConSub[]> {
  const { data: top } = await supabase
    .from('categories')
    .select('id, name, image_url')
    .is('parent_id', null)
    .eq('active', true)
    .order('sort_order')
    .limit(1000);

  const topIds = (top || []).map((row) => row.id);
  const { data: subs } = topIds.length
    ? await supabase.from('categories').select('id, name, parent_id').in('parent_id', topIds).eq('active', true).order('sort_order').limit(2000)
    : { data: [] as { id: number; name: string; parent_id: number }[] };

  const subsPorPadre = new Map<number, { id: number; title: string }[]>();
  for (const s of subs || []) {
    const lista = subsPorPadre.get(s.parent_id) || [];
    lista.push({ id: s.id, title: s.name });
    subsPorPadre.set(s.parent_id, lista);
  }

  const result: CategoriaConSub[] = (top || []).map((row) => ({
    id: row.id,
    title: row.name,
    image: row.image_url || '/assets/imagenes/todos.png',
    subCategoria: subsPorPadre.get(row.id) || [],
  }));

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
  // El arbol de categorias y el filtro de proveedores no aprobados son independientes -- corren
  // en paralelo (antes era otro paso secuencial mas encima del N+1 ya corregido arriba).
  const [todas, excluidos] = await Promise.all([fetchCategoriasConSub(), filtroNotInProveedoresNoAprobados()]);

  let q = supabase.from('products').select('category_id').eq('active', true);
  if (excluidos) q = q.not('owner_profile_id', 'in', excluidos);
  const { data } = await q;

  const idsConProductos = new Set((data || []).map((p) => p.category_id).filter((id): id is number => id != null));
  return todas.filter((c) => c.id === 0 || idsConProductos.has(c.id));
}
