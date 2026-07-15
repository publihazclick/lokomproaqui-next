import { supabase } from './supabase';

// Port de ProductosComponent + TableProductComponent + FormproductosComponent (Angular, panel
// admin "Productos" -- la pieza mas grande de Fase 5).
//
// A diferencia de la mayoria de Fase 5, `ProductoService.create()/update()` (Angular) YA estaban
// bien conectados desde la migracion a Supabase (incluida `syncVariants`, que resuelve colores +
// tallas + stock reales) -- se porta la logica de guardado 1:1. Los bugs reales SI encontrados:
//
// 1) La pestaña "Productos" (admin, productos de otros vendedores) arma su filtro como
//    `pro_usu_creacion: {'!=': dataUser.id}`, pero `ProductoService.get()` solo hace
//    `q.eq('owner_profile_id', where.pro_usu_creacion)` -- comparar la columna contra ese OBJETO
//    nunca matchea nada. En produccion HOY esa pestaña esta siempre vacia para cualquier admin.
//    Se corrige con un `.neq()` real.
// 2) El checkbox "Activar" de la pestaña "Por Activar de proveedor" hace
//    `(ngModelChange)="updateState(row,'pro_estado')"`, pero `updateState` lee `item[opt]` --
//    el valor VIEJO de `pro_estado`, no el nuevo valor del checkbox que se acaba de tocar. En la
//    practica el checkbox nunca cambiaba nada realmente. Se corrige leyendo el valor nuevo.
//
// Simplificacion real (documentada, no oculta): el original tiene un flujo de creacion en DOS
// pasos raro -- subir 1+ fotos primero crea N productos "borrador" con nombre/codigo aleatorios
// placeholder, despues hay que hacer click en cada uno para completar los datos reales. Se
// consolida en UN solo formulario con todos los campos reales visibles desde el principio (mismo
// resultado final, sin el paso intermedio confuso). El editor de texto enriquecido (AngularEditor)
// se simplifica a un textarea de HTML plano -- evita agregar una dependencia nueva de editor WYSIWYG,
// el campo se sigue guardando/mostrando igual (los templates del catalogo ya lo renderizan con
// dangerouslySetInnerHTML). "Precios por cantidad" (checkMayor/listPrecios) no se porta: ya estaba
// comentado/inalcanzable en el HTML original y nunca se guardo desde el backend tampoco. "URL DE
// MEDIOS DRIVE" (urlMedios) y "Posicion" (mat-slider) se omiten: confirmado que ninguno de los dos
// tiene efecto real, ProductoService.create()/update() nunca los mapea.

export interface ProductoAdminRow {
  id: number;
  foto: string;
  nombre: string;
  codigo: string;
  cantidadTallas: number;
  precio: number;
  categoriaNombre: string | null;
  estado: number; // pro_activo: 0 activo, 1 eliminado, 3 pendiente
  fecha: string;
}

const PRODUCT_SELECT_ADMIN = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';

function mapAdminRow(p: any): ProductoAdminRow {
  const cantidadTallas = (p.product_variants || []).reduce((sum: number, v: any) => sum + (Number(v.stock) || 0), 0);
  return {
    id: p.id,
    foto: p.image_url,
    nombre: p.name,
    codigo: p.code,
    cantidadTallas,
    precio: p.client_sale_price,
    categoriaNombre: p.categories ? p.categories.name : null,
    estado: p.active ? 0 : p.pending_review ? 3 : 1,
    fecha: p.created_at,
  };
}

export type ModoListaProductos = 'otros' | 'mios' | 'porActivar';

export async function fetchProductosAdmin(opts: {
  modo: ModoListaProductos;
  userId: string;
  esAdmin: boolean;
  search?: string;
  page: number;
  limit: number;
}): Promise<{ data: ProductoAdminRow[]; count: number }> {
  let q = supabase.from('products').select(PRODUCT_SELECT_ADMIN, { count: 'exact' }).order('created_at', { ascending: false });

  if (opts.modo === 'porActivar') {
    q = q.eq('active', false).eq('pending_review', true);
  } else {
    q = q.eq('active', true);
  }

  if (opts.modo === 'otros') {
    q = q.neq('owner_profile_id', opts.userId);
  } else if (!opts.esAdmin) {
    q = q.eq('owner_profile_id', opts.userId);
  }

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%`);
  }

  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return { data: data.map(mapAdminRow), count: count ?? data.length };
}

export async function eliminarProducto(id: number): Promise<boolean> {
  const { error } = await supabase.from('products').update({ active: false, pending_review: false }).eq('id', id);
  return !error;
}

// Activa un producto pendiente (lo hace visible en el catalogo real).
export async function activarProducto(id: number): Promise<boolean> {
  const { error } = await supabase.from('products').update({ active: true, pending_review: false }).eq('id', id);
  return !error;
}

export async function duplicarProducto(id: number): Promise<number | null> {
  const { data: original, error } = await supabase.from('products').select(PRODUCT_SELECT_ADMIN).eq('id', id).maybeSingle();
  if (error || !original) return null;

  const { data: inserted, error: insertError } = await supabase
    .from('products')
    .insert({
      name: original.name,
      slug: slugify(original.name),
      image_url: original.image_url,
      description: original.description,
      category_id: original.category_id,
      subcategory_id: original.subcategory_id,
      active: original.active,
      code: 'copia ' + original.code,
      owner_profile_id: original.owner_profile_id,
      client_sale_price: original.client_sale_price,
      distributor_price: original.distributor_price,
      size_type_id: original.size_type_id,
      gallery: original.gallery,
      width: original.width,
      height: original.height,
      length: original.length,
      weight: original.weight,
    })
    .select('id')
    .single();
  if (insertError || !inserted) return null;

  const variantRows = (original.product_variants || []).map((v: any) => ({
    product_id: inserted.id,
    color: v.color,
    size_id: v.size_id,
    stock: v.stock,
    images: v.images,
  }));
  if (variantRows.length) await supabase.from('product_variants').insert(variantRows);

  return inserted.id;
}

function slugify(text: string): string {
  return (
    (text || 'producto')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') +
    '-' +
    Date.now().toString(36)
  );
}

// ── Datos de apoyo para el formulario (categorias/subcategorias/tipos de talla) ─────────────────

export interface OpcionSimple {
  id: number;
  nombre: string;
}

export async function fetchCategoriasPrincipales(): Promise<OpcionSimple[]> {
  const { data } = await supabase.from('categories').select('id, name').is('parent_id', null).eq('active', true).order('sort_order');
  return (data || []).map((c) => ({ id: c.id, nombre: c.name }));
}

export async function fetchSubcategorias(padreId: number): Promise<OpcionSimple[]> {
  const { data } = await supabase.from('categories').select('id, name').eq('parent_id', padreId).eq('active', true).order('sort_order');
  return (data || []).map((c) => ({ id: c.id, nombre: c.name }));
}

export async function fetchTiposTalla(): Promise<OpcionSimple[]> {
  const { data } = await supabase.from('size_types').select('id, name').eq('active', true).order('sort_order');
  return (data || []).map((t) => ({ id: t.id, nombre: t.name }));
}

export async function fetchTallasPorTipo(tipoId: number): Promise<OpcionSimple[]> {
  const { data } = await supabase.from('sizes').select('id, name').eq('size_type_id', tipoId).eq('active', true).order('sort_order');
  return (data || []).map((s) => ({ id: s.id, nombre: s.name }));
}

// ── Producto completo (para editar) ─────────────────────────────────────────────────────────────

export interface TallaColorForm {
  tallaId: number;
  nombre: string;
  check: boolean;
  cantidad: number;
}

export interface ColorForm {
  key: string; // id local, no persiste
  nombre: string;
  foto: string | null;
  tallas: TallaColorForm[];
}

export interface ProductoForm {
  id: number | null;
  nombre: string;
  codigo: string;
  foto: string | null;
  descripcion: string;
  categoriaId: number | null;
  subcategoriaId: number | null;
  precioDistribuidor: number | null;
  precioVenta: number | null;
  alto: number | null;
  ancho: number | null;
  largo: number | null;
  peso: number | null;
  tipoTallaId: number | null;
  estado: number; // pro_activo: 0 activo, 1 eliminado, 3 pendiente
  colores: ColorForm[];
}

function codigoProducto(): string {
  return (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
}

export function productoFormVacio(): ProductoForm {
  return {
    id: null,
    nombre: '',
    codigo: codigoProducto(),
    foto: null,
    descripcion: '',
    categoriaId: null,
    subcategoriaId: null,
    precioDistribuidor: null,
    precioVenta: null,
    alto: null,
    ancho: null,
    largo: null,
    peso: null,
    tipoTallaId: null,
    estado: 0,
    colores: [],
  };
}

export async function fetchProductoParaEditar(id: number): Promise<ProductoForm | null> {
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT_ADMIN).eq('id', id).maybeSingle();
  if (error || !data) return null;

  const coloresPorNombre: Record<string, ColorForm> = {};
  for (const v of data.product_variants || []) {
    const colorNombre = v.color || 'unico';
    if (!coloresPorNombre[colorNombre]) {
      coloresPorNombre[colorNombre] = { key: colorNombre, nombre: colorNombre, foto: (v.images && v.images[0]) || data.image_url, tallas: [] };
    }
    coloresPorNombre[colorNombre].tallas.push({
      tallaId: v.size_id,
      nombre: v.sizes ? v.sizes.name : '',
      check: true,
      cantidad: v.stock || 0,
    });
  }

  return {
    id: data.id,
    nombre: data.name,
    codigo: data.code,
    foto: data.image_url,
    descripcion: data.description || '',
    categoriaId: data.category_id,
    subcategoriaId: data.subcategory_id,
    precioDistribuidor: data.distributor_price,
    precioVenta: data.client_sale_price,
    alto: data.height,
    ancho: data.width,
    largo: data.length,
    peso: data.weight,
    tipoTallaId: data.size_type_id,
    estado: data.active ? 0 : data.pending_review ? 3 : 1,
    colores: Object.values(coloresPorNombre),
  };
}

// Equivalente a ProductoService.syncVariants (Angular): reemplaza TODAS las variantes del
// producto a partir de la lista de colores/tallas del formulario.
async function syncVariants(productId: number, colores: ColorForm[]) {
  await supabase.from('product_variants').delete().eq('product_id', productId);
  const rows: any[] = [];
  for (const color of colores) {
    const images = color.foto ? [color.foto] : [];
    for (const talla of color.tallas) {
      if (!talla.check) continue;
      rows.push({ product_id: productId, color: color.nombre || null, size_id: talla.tallaId || null, stock: Number(talla.cantidad) || 0, images });
    }
  }
  if (rows.length) await supabase.from('product_variants').insert(rows);
}

export async function guardarProducto(form: ProductoForm, ownerProfileId: string, esAdmin: boolean): Promise<number | null> {
  const patch = {
    name: form.nombre,
    image_url: form.foto,
    description: form.descripcion,
    category_id: form.categoriaId,
    subcategory_id: form.subcategoriaId,
    code: form.codigo,
    client_sale_price: form.precioVenta,
    distributor_price: form.precioDistribuidor,
    size_type_id: form.tipoTallaId,
    width: form.ancho,
    height: form.alto,
    length: form.largo,
    weight: form.peso,
  };

  let productId = form.id;

  if (productId) {
    const { error } = await supabase.from('products').update(patch).eq('id', productId);
    if (error) return null;
  } else {
    // Igual que FormproductosComponent.guardar(): un proveedor/vendedor creando un producto queda
    // pendiente de aprobacion del admin; el admin lo crea directo como activo.
    const { data: inserted, error } = await supabase
      .from('products')
      .insert({ ...patch, slug: slugify(form.nombre), owner_profile_id: ownerProfileId, active: esAdmin, pending_review: !esAdmin })
      .select('id')
      .single();
    if (error || !inserted) return null;
    productId = inserted.id;
  }

  await syncVariants(productId as number, form.colores);
  return productId;
}
