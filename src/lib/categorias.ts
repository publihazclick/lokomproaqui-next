import { supabase } from './supabase';

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
