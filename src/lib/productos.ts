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

// Genera el mismo tipo de id "aleatorio corto" que ProductoViewComponent.codigo() (Angular) para
// identificar items del carrito -- no necesita ser criptograficamente unico, solo no colisionar
// dentro del mismo carrito.
export function codigoCarrito(): string {
  return (Date.now().toString(20).substring(2, 5) + Math.random().toString(20).substring(2, 5)).toUpperCase();
}
