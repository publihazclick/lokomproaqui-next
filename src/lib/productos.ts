import { supabase } from './supabase';

// Mismo mapeo que ProductoService.mapProductToLegacy (Angular, src/app/servicesComponents/producto.service.ts):
// reconstruye el JSON `listColor` que las paginas de catalogo/producto todavia esperan, a partir de
// `products` + `product_variants`. Se centraliza aca porque el resto de Fase 3 (`/pedidos`, `/articulo`,
// `/listproduct`) va a necesitar el mismo shape.

const PRODUCT_SELECT = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';

// Pedido explicito del usuario 2026-07-25 ("solo los productos de proveedor aprobado se van a
// mostrar en productos a la vista de los vendedores"): antes, `products.active=true` (que un
// proveedor pone el mismo con "Activar Producto") era la UNICA condicion para aparecer en el
// catalogo -- la cuenta del proveedor podia seguir sin aprobar (supplier_status 'incompleto'/
// 'en_revision'/'rechazado') y sus productos ya se veian igual. Ahora se excluyen los productos
// de cualquier profile con rol proveedor cuya cuenta no este 'aprobado' (NULL incluido, un
// proveedor recien registrado). Cache corto (30s) porque son pocas filas (rol proveedor) y esta
// consulta corre en cada busqueda/pagina del catalogo -- no vale la pena pedirla de nuevo en cada
// tecla, pero tampoco se quiere un cache largo que tarde en reflejar una aprobacion reciente.
let cacheProveedoresNoAprobados: { ids: string[]; ts: number } | null = null;

async function idsProveedoresNoAprobados(): Promise<string[]> {
  const ahora = Date.now();
  if (cacheProveedoresNoAprobados && ahora - cacheProveedoresNoAprobados.ts < 30_000) {
    return cacheProveedoresNoAprobados.ids;
  }
  const { data } = await supabase
    .from('profiles')
    .select('id, roles!inner(name)')
    .eq('roles.name', 'proveedor')
    .or('supplier_status.is.null,supplier_status.neq.aprobado');
  const ids = (data || []).map((p: any) => p.id as string);
  cacheProveedoresNoAprobados = { ids, ts: ahora };
  return ids;
}

// `.not(col, 'in', '(a,b,c)')` es la sintaxis real de PostgREST/supabase-js para NOT IN -- devuelve
// el texto listo para pasarle a `.not('owner_profile_id', 'in', ...)`, o null si no hay nada que
// excluir (para no aplicar un `.not` innecesario). Exportada para que otras pantallas (ej. el
// listado de categorias del Inicio) apliquen el mismo criterio de "solo lo que un vendedor puede
// ver de verdad", sin duplicar la consulta de proveedores no aprobados.
export async function filtroNotInProveedoresNoAprobados(): Promise<string | null> {
  const excluidos = await idsProveedoresNoAprobados();
  return excluidos.length ? `(${excluidos.join(',')})` : null;
}

// Sentinela interno para agrupar la unica variante de un producto sin primer eje (ver
// esVariante en ProductoColor) -- exportado para que las pantallas que arman un label combinado
// de "talla - color" (ej woocommercePendientes/shopifyPendientes) lo filtren igual que el viejo
// 'unico', y no le muestren este texto interno al admin.
export const SIN_VARIANTE = '__sin_variante__';

export interface ProductoTallaSelect {
  id: number;
  tal_descripcion: string;
  cantidad: number;
  check: boolean;
}

export interface ProductoColor {
  talla: string; // OJO: es el nombre del COLOR, no de la talla -- mismo nombre confuso que el original
  foto: string;
  tallaSelect: ProductoTallaSelect[];
  galeriaList: { id: string; foto: string }[];
  // Generalizacion 2026-07-25: un producto "sin variantes" (nunca existio antes de la migracion
  // 079) tiene igual UN bucket en listColor (para poder resolver stock/fotos), pero con
  // esVariante=false -- el selector de "Color" en pantalla debe ocultarse en ese caso, no mostrar
  // un boton huerfano con el nombre interno "unico".
  esVariante: boolean;
}

export interface ProductoComentario {
  nombre: string | null;
  fecha: string;
  descripcion: string;
  foto: string;
}

export interface ProductoLegacy {
  id: number;
  pro_nombre: string;
  pro_palabra: string;
  foto: string;
  pro_descripcion: string | null;
  pro_descripcionbreve: string | null;
  pro_marca: string | null;
  pro_categoria: { id: number; cat_nombre: string } | null;
  pro_codigo: string;
  pro_uni_venta: number;
  pro_vendedor: number | null; // precio a distribuidor (distributor_price)
  listColor: ProductoColor[];
  listComment: ProductoComentario[];
  checkMayor: boolean;
  // Generalizacion 2026-07-25 (migracion 079): nombre visible de cada eje de variante, definido
  // por el proveedor al montar el producto (default 'Color'/null -- ver FormProductoModal). El
  // storefront ya no puede asumir "Color"/"Talla" fijos, cualquier producto puede llamarlos distinto.
  variante1Label: string;
  variante2Label: string | null;
}

export function mapProductToLegacy(product: any, computedPrice?: number): ProductoLegacy {
  const variantsByColor: Record<string, ProductoColor> = {};
  for (const v of product.product_variants || []) {
    const esVariante = v.color != null && v.color !== '';
    const color = v.color || SIN_VARIANTE;
    if (!variantsByColor[color]) {
      const colorImages: string[] = v.images && v.images.length ? v.images : [product.image_url];
      variantsByColor[color] = {
        talla: color,
        foto: colorImages[0],
        tallaSelect: [],
        galeriaList: colorImages.map((url: string, idx: number) => ({ id: `${v.id}-${idx}`, foto: url })),
        esVariante,
      };
    }
    variantsByColor[color].tallaSelect.push({
      id: v.id,
      // Generalizacion 2026-07-25: si no viene del catalogo real de tallas (sizes), cae al valor
      // libre escrito por el proveedor (size_label) -- antes quedaba en blanco siempre que no
      // hubiera size_id, escondiendo por completo cualquier segundo eje que no fuera ropa/calzado.
      tal_descripcion: v.sizes ? v.sizes.name : v.size_label || '',
      cantidad: v.stock,
      check: v.stock > 0,
    });
  }

  return {
    id: product.id,
    pro_nombre: product.name,
    pro_palabra: product.slug,
    foto: product.image_url,
    pro_descripcion: product.description,
    pro_descripcionbreve: product.short_description,
    pro_marca: product.brand,
    pro_categoria: product.categories ? { id: product.categories.id, cat_nombre: product.categories.name } : null,
    pro_codigo: product.code,
    pro_uni_venta: computedPrice != null ? computedPrice : product.client_sale_price,
    pro_vendedor: product.distributor_price,
    listColor: Object.values(variantsByColor),
    listComment: [],
    checkMayor: !!product.wholesale_enabled,
    variante1Label: product.variant1_label || 'Color',
    variante2Label: product.variant2_label || null,
  };
}

function formatFechaDDMMYYYY(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

// Equivalente a ProductoService.get({ where: { id } }) para la pagina de detalle: un producto activo
// + sus comentarios publicos aprobados (status 0), mismo orden mas reciente primero.
export async function fetchProductoById(id: string | number): Promise<ProductoLegacy | null> {
  let q = supabase.from('products').select(PRODUCT_SELECT).eq('id', id).eq('active', true);
  const excluidos = await filtroNotInProveedoresNoAprobados();
  if (excluidos) q = q.not('owner_profile_id', 'in', excluidos);
  const { data, error } = await q.maybeSingle();
  if (error || !data) return null;

  const mapped = mapProductToLegacy(data);

  const { data: comments } = await supabase
    .from('product_comments')
    .select('*')
    .eq('product_id', id)
    .eq('status', 0)
    .order('created_at', { ascending: false });

  mapped.listComment = (comments || []).map((c: any) => ({
    nombre: c.name,
    fecha: formatFechaDDMMYYYY(c.created_at),
    descripcion: c.description,
    foto: '/assets/noimagen.jpg',
  }));

  return mapped;
}

// Equivalente a ProductoService.get({ where: { pro_categoria, user, idPrice }, page, limit }) para
// listados/catalogo (PedidosComponent, ListArticleStoreComponent): productos activos paginados,
// con precio propio (price_overrides) del usuario logueado si ya reselleo alguno.
export async function fetchProductos(opts: {
  categoriaId?: number | string;
  ownerProfileId?: string;
  userId?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{ data: ProductoLegacy[]; count: number }> {
  const page = opts.page ?? 0;
  const limit = opts.limit ?? 54;

  let q = supabase.from('products').select(PRODUCT_SELECT, { count: 'exact' }).eq('active', true).order('position', { ascending: true });
  if (opts.categoriaId) q = q.eq('category_id', opts.categoriaId);
  if (opts.ownerProfileId) q = q.eq('owner_profile_id', opts.ownerProfileId);
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    const idNumerico = /^\d+$/.test(s) ? Number(s) : null;
    q = q.or(`name.ilike.%${s}%,code.ilike.%${s}%${idNumerico !== null ? `,id.eq.${idNumerico}` : ''}`);
  }
  const excluidos = await filtroNotInProveedoresNoAprobados();
  if (excluidos) q = q.not('owner_profile_id', 'in', excluidos);
  q = q.range(page * limit, page * limit + limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };

  let overrides: any[] = [];
  if (opts.userId) {
    const { data: po } = await supabase.from('price_overrides').select('product_id, price').eq('profile_id', opts.userId).eq('active', true);
    overrides = po || [];
  }

  const mapped = data.map((p: any) => {
    const override = overrides.find((o: any) => o.product_id === p.id);
    return mapProductToLegacy(p, override ? override.price : undefined);
  });

  return { data: mapped, count: count ?? mapped.length };
}

// Genera el mismo tipo de id "aleatorio corto" que ProductoViewComponent.codigo() (Angular) para
// identificar items del carrito -- no necesita ser criptograficamente unico, solo no colisionar
// dentro del mismo carrito.
export function codigoCarrito(): string {
  return (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
}

// Equivalente a ProductoService.getPrice({ where: { article, user, state: 0 } }): el price_override
// activo de este usuario para este producto, si ya lo agrego a su tienda ("revender con mi precio").
export async function fetchPriceOverride(productId: number, userId: string): Promise<{ id: number; price: number } | null> {
  const { data } = await supabase
    .from('price_overrides')
    .select('id, price')
    .eq('product_id', productId)
    .eq('profile_id', userId)
    .eq('active', true)
    .maybeSingle();
  return data ? { id: data.id, price: data.price } : null;
}

// Equivalente a ProductoService.createPrice: agrega/reactiva el producto en la tienda propia del usuario.
export async function guardarPriceOverride(productId: number, userId: string, price: number): Promise<boolean> {
  const existing = await fetchPriceOverride(productId, userId);
  if (existing) {
    const { error } = await supabase.from('price_overrides').update({ price, active: true }).eq('id', existing.id);
    return !error;
  }
  const { error } = await supabase.from('price_overrides').insert({ product_id: productId, profile_id: userId, price, active: true });
  return !error;
}

// Equivalente a ProductoService.updatePriceArticle({ id, state: 1 }): saca el producto de la tienda
// propia (soft-delete, active=false) sin borrar el registro.
export async function quitarPriceOverride(id: number): Promise<boolean> {
  const { error } = await supabase.from('price_overrides').update({ active: false }).eq('id', id);
  return !error;
}

// Resumen para el dashboard de proveedor (/articulo): total de productos activos y cuantos estan
// agotados (todas sus variantes en stock<=0), para mostrar una alerta accionable sin tener que
// entrar a "Edición Productos" a revisar uno por uno.
export async function fetchResumenInventarioProveedor(ownerProfileId: string): Promise<{ totalProductos: number; agotados: number }> {
  const { data, count } = await supabase
    .from('products')
    .select('id, product_variants(stock)', { count: 'exact' })
    .eq('owner_profile_id', ownerProfileId)
    .eq('active', true);
  if (!data) return { totalProductos: count ?? 0, agotados: 0 };
  const agotados = data.filter((p: any) => (p.product_variants || []).every((v: any) => (v.stock || 0) <= 0)).length;
  return { totalProductos: count ?? data.length, agotados };
}

// Equivalente a ProductoService.createPriceArticleFull: agrega de una vez TODOS los productos
// activos de una bodega/proveedor a la tienda propia del usuario, saltando los que ya tiene.
export async function agregarTodosLosProductosDeBodega(ownerProfileId: string, userId: string): Promise<boolean> {
  const { data: products } = await supabase.from('products').select('id, client_sale_price').eq('owner_profile_id', ownerProfileId).eq('active', true);
  if (!products || !products.length) return true;

  const { data: existing } = await supabase.from('price_overrides').select('product_id').eq('profile_id', userId).in('product_id', products.map((p) => p.id));
  const existingIds = new Set((existing || []).map((e) => e.product_id));

  const rows = products.filter((p) => !existingIds.has(p.id)).map((p) => ({ product_id: p.id, profile_id: userId, price: p.client_sale_price || 0, active: true }));
  if (rows.length) {
    const { error } = await supabase.from('price_overrides').insert(rows);
    return !error;
  }
  return true;
}
