import { supabase } from './supabase';

// Mismo mapeo que ProductoService.mapProductToLegacy (Angular, src/app/servicesComponents/producto.service.ts):
// reconstruye el JSON `listColor` que las paginas de catalogo/producto todavia esperan, a partir de
// `products` + `product_variants`. Se centraliza aca porque el resto de Fase 3 (`/pedidos`, `/articulo`,
// `/listproduct`) va a necesitar el mismo shape.

const PRODUCT_SELECT = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';

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
}

export function mapProductToLegacy(product: any, computedPrice?: number): ProductoLegacy {
  const variantsByColor: Record<string, ProductoColor> = {};
  for (const v of product.product_variants || []) {
    const color = v.color || 'unico';
    if (!variantsByColor[color]) {
      const colorImages: string[] = v.images && v.images.length ? v.images : [product.image_url];
      variantsByColor[color] = {
        talla: color,
        foto: colorImages[0],
        tallaSelect: [],
        galeriaList: colorImages.map((url: string, idx: number) => ({ id: `${v.id}-${idx}`, foto: url })),
      };
    }
    variantsByColor[color].tallaSelect.push({
      id: v.id,
      tal_descripcion: v.sizes ? v.sizes.name : '',
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
  const { data, error } = await supabase.from('products').select(PRODUCT_SELECT).eq('id', id).eq('active', true).maybeSingle();
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
  q = q.range(page * limit, page * limit + limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };

  let overrides: any[] = [];
  if (opts.userId) {
    const { data: po } = await supabase.from('price_overrides').select('*').eq('profile_id', opts.userId).eq('active', true);
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
