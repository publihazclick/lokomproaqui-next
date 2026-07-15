import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';

// Port del modulo `portada` (Angular, "/front[/:cell]") -- vitrina publica SIN LOGIN de un
// vendedor especifico (identificado por telefono, compartible por WhatsApp/link), con su propio
// carrito, checkout y pedido rapido. A diferencia del resto del sitio (que resuelve el "dueño de
// la tienda" por `referral_code`/UUID), esta vitrina siempre lo resuelve por NUMERO DE TELEFONO
// (`profiles.phone`) -- asi funcionaba tambien en el Angular original.
//
// Bugs reales encontrados y corregidos (no replicados): `ProductoService.getStore()` (que arma el
// catalogo de un vendedor via `price_overrides`) NUNCA implemento el filtro de categoria
// (`where.pro_categoria`), la busqueda de texto (`where.or`) ni el ordenamiento (`where.sort`) que
// el componente Angular arma y le manda -- los 3 controles (chips de categoria, buscador, menu de
// "ordenar por") existen en la pantalla y no hacen nada en produccion hoy. Se implementan de verdad
// aca.
//
// Alcance recortado y documentado (no son bugs, son features vestigiales/rotas del Angular
// original que no se replican): login con Facebook (SocialAuthService, nunca conectado a una
// sesion real de Supabase en ningun punto del flujo) y el boton de pago con ePayco del menu
// (`MenuComponent.openEpayco()`, confirmado roto -- referencia una variable `URL` que no existe en
// ese archivo, y `createPago()` no persiste nada) -- el checkout real de esta vitrina es
// unicamente el de "pagar contra entrega" (`ChecktComponent`/`ChecktDialogComponent`, ambos
// conectados de verdad al RPC `create_order`). Las reseñas fijas ficticias y el popup de "compras
// recientes" (nombres inventados, JS que simula actividad) tampoco se replican -- quedan pendientes
// de una decision explicita del usuario, no es algo que se deba decidir en silencio.

export interface TiendaFront {
  id: string;
  nombre: string | null;
  telefono: string | null;
  color: string | null;
}

export async function resolverTiendaPorTelefono(telefono: string): Promise<TiendaFront | null> {
  const { data, error } = await supabase.from('profiles').select('id, full_name, phone, store_color').eq('phone', telefono).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: data.full_name, telefono: data.phone, color: data.store_color };
}

export interface CategoriaFront {
  id: number;
  nombre: string;
}

export async function fetchCategoriasFront(): Promise<CategoriaFront[]> {
  const { data } = await supabase.from('categories').select('id, name').is('parent_id', null).eq('active', true).order('sort_order');
  return (data || []).map((c) => ({ id: c.id, nombre: c.name }));
}

const PRODUCT_SELECT = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';

export async function fetchProductosTienda(opts: {
  sellerId: string;
  categoriaId?: number;
  search?: string;
  orden?: 'nombre' | 'menor_a_mayor' | 'mayor_a_menor' | 'fecha';
  page: number;
  limit: number;
}): Promise<{ data: ProductoLegacy[]; count: number }> {
  let q = supabase.from('price_overrides').select(`price, products!inner(${PRODUCT_SELECT})`, { count: 'exact' }).eq('profile_id', opts.sellerId).eq('active', true);

  if (opts.categoriaId) q = q.eq('products.category_id', opts.categoriaId);
  if (opts.search && opts.search.trim()) q = q.or(`name.ilike.%${opts.search.trim()}%,code.ilike.%${opts.search.trim()}%`, { referencedTable: 'products' });

  if (opts.orden === 'nombre') q = q.order('name', { referencedTable: 'products' });
  else if (opts.orden === 'menor_a_mayor') q = q.order('client_sale_price', { referencedTable: 'products', ascending: true });
  else if (opts.orden === 'mayor_a_menor') q = q.order('client_sale_price', { referencedTable: 'products', ascending: false });
  else q = q.order('created_at', { referencedTable: 'products', ascending: false });

  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  const mapped = data.filter((r: any) => r.products).map((r: any) => mapProductToLegacy(r.products, r.price));
  return { data: mapped, count: count ?? mapped.length };
}

interface DatosComprador {
  nombre: string;
  telefono: string;
  ciudad: string;
  barrio: string;
  direccion: string;
}

// Equivalente a VentasService.create2 (pedido rapido de un solo articulo, "whatsapp") -- ya
// resuelve la variante real (color/talla) y descuenta stock atomicamente via el RPC create_order.
async function resolverVariantId(productId: number, talla: string | null, color: string | null): Promise<number | null> {
  if (talla) {
    let q = supabase.from('product_variants').select('id, sizes!inner(name)').eq('product_id', productId).eq('sizes.name', talla);
    if (color) q = q.eq('color', color);
    const { data } = await q.maybeSingle();
    return data ? (data as any).id : null;
  }
  if (color) {
    const { data } = await supabase.from('product_variants').select('id').eq('product_id', productId).eq('color', color).is('size_id', null).maybeSingle();
    return data ? (data as any).id : null;
  }
  return null;
}

export async function crearPedidoRapido(sellerId: string, comprador: DatosComprador, item: { productId: number; nombre: string; precio: number; cantidad: number; talla: string | null; color: string | null }): Promise<{ success: boolean; message?: string; id?: number }> {
  const variantId = await resolverVariantId(item.productId, item.talla, item.color);

  const { data: orderId, error } = await supabase.rpc('create_order', {
    order_data: {
      seller_id: sellerId,
      buyer_name: comprador.nombre,
      buyer_phone: comprador.telefono,
      buyer_address: comprador.direccion,
      buyer_city: comprador.ciudad,
      buyer_neighborhood: comprador.barrio,
      order_type: 'whatsapp',
      freight_payer: 'cliente',
    },
    items: [
      {
        product_id: item.productId,
        product_variant_id: variantId,
        title: item.nombre,
        unit_price: item.precio,
        quantity: item.cantidad,
        size: item.talla,
        color: item.color,
        seller_cost: null,
        total_cost: item.precio * item.cantidad,
      },
    ],
  });

  if (error || !orderId) {
    const msg = error?.message?.includes('stock_insuficiente') ? 'Uno de los productos ya no tiene stock disponible en esa talla' : 'No pudimos procesar tu pedido, intenta de nuevo';
    return { success: false, message: msg };
  }
  return { success: true, id: orderId as number };
}

export interface ItemCarritoFront {
  id: string;
  productId: number;
  nombre: string;
  foto: string;
  precio: number;
  cantidad: number;
  talla: string | null;
  color: string | null;
}

// Equivalente a VentasService.createOrder (checkout de carrito completo, multi-item).
export async function crearPedidoCarrito(sellerId: string, comprador: DatosComprador, items: ItemCarritoFront[]): Promise<{ success: boolean; message?: string; id?: number }> {
  const orderItems = items.map((it) => ({
    product_id: it.productId,
    product_variant_id: null,
    title: it.nombre,
    unit_price: it.precio,
    quantity: it.cantidad,
    size: it.talla,
    color: it.color,
    seller_cost: null,
    total_cost: it.precio * it.cantidad,
  }));

  const { data: orderId, error } = await supabase.rpc('create_order', {
    order_data: {
      seller_id: sellerId,
      buyer_name: comprador.nombre,
      buyer_phone: comprador.telefono,
      buyer_address: comprador.direccion,
      buyer_city: comprador.ciudad,
      buyer_neighborhood: comprador.barrio,
      order_type: 'contraentrega',
      freight_payer: 'cliente',
    },
    items: orderItems,
  });

  if (error || !orderId) {
    const msg = error?.message?.includes('stock_insuficiente') ? 'Uno de los productos ya no tiene stock disponible' : 'No pudimos procesar tu pedido, intenta de nuevo';
    return { success: false, message: msg };
  }
  return { success: true, id: orderId as number };
}

// ── Carrito local (localStorage, esta vitrina no requiere sesion) ──────────────────────────────

const CART_KEY = 'front_cart';
const CART_SELLER_KEY = 'front_cart_seller';

export function leerVendedorCarritoFront(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(CART_SELLER_KEY);
}

export function fijarVendedorCarritoFront(telefono: string) {
  window.localStorage.setItem(CART_SELLER_KEY, telefono);
}

export function leerCarritoFront(): ItemCarritoFront[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(window.localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

function guardarCarritoFront(items: ItemCarritoFront[]) {
  window.localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event('front-cart-updated'));
}

export function agregarAlCarritoFront(item: Omit<ItemCarritoFront, 'id'>): ItemCarritoFront[] {
  const actual = leerCarritoFront();
  const nuevo = [...actual, { ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }];
  guardarCarritoFront(nuevo);
  return nuevo;
}

export function quitarDelCarritoFront(id: string): ItemCarritoFront[] {
  const nuevo = leerCarritoFront().filter((i) => i.id !== id);
  guardarCarritoFront(nuevo);
  return nuevo;
}

export function vaciarCarritoFront() {
  guardarCarritoFront([]);
}
