import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';

// Port 1:1 de WoocommerceService (Angular) -- mismo mecanismo que Shopify (ver lib/shopify.ts),
// ya bien implementado en Supabase, sin bugs. Unica diferencia real: `orderType` se marca
// 'woocommerce' cuando `financial_status` es 'processing' o 'completed' (Shopify solo mira 'paid').

export interface WoocommerceConnection {
  store_url: string;
  connected_at: string;
}

export async function fetchWoocommerceConnection(profileId: string): Promise<WoocommerceConnection | null> {
  const { data, error } = await supabase.from('woocommerce_connections').select('*').eq('profile_id', profileId).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function conectarWoocommerce(data: { profile_id: string; store_url: string; consumer_key: string; consumer_secret: string }): Promise<{ success: boolean; message?: string }> {
  const { data: resp, error } = await supabase.functions.invoke('woocommerce-connect', { body: { action: 'connect', ...data } });
  if (error || !resp || resp.error) return { success: false, message: (resp && resp.error) || 'No se pudo conectar la tienda' };
  return { success: true };
}

export async function desconectarWoocommerce(profileId: string): Promise<boolean> {
  const { data: resp, error } = await supabase.functions.invoke('woocommerce-connect', { body: { action: 'disconnect', profile_id: profileId } });
  return !error && !(resp && resp.error);
}

export interface WoocommercePendingItem {
  title: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  product_id: number | null;
  product_variant_id: number | null;
  _productoNombre?: string;
  _variantes?: { id: number; label: string }[];
}

export interface WoocommercePendingOrder {
  id: number;
  woocommerce_order_id: string;
  woocommerce_order_number: string | null;
  financial_status: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_city: string;
  buyer_neighborhood: string;
  items: WoocommercePendingItem[];
}

export async function fetchWoocommercePendingOrders(profileId: string): Promise<WoocommercePendingOrder[]> {
  const { data, error } = await supabase
    .from('woocommerce_pending_orders')
    .select('*')
    .eq('profile_id', profileId)
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function buscarProductoParaWoocommerce(term: string): Promise<ProductoLegacy[]> {
  if (!term || term.trim().length < 2) return [];
  const { data } = await supabase
    .from('products')
    .select('*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))')
    .eq('active', true)
    .or(`name.ilike.%${term.trim()}%,code.ilike.%${term.trim()}%`)
    .limit(10);
  return (data || []).map((p) => mapProductToLegacy(p));
}

export async function resolverPedidoWoocommerce(
  pending: WoocommercePendingOrder,
  profileId: string,
  items: WoocommercePendingItem[],
): Promise<{ success: boolean; message?: string }> {
  const newMappings = items
    .filter((it) => it.sku && it.product_id)
    .map((it) => ({ profile_id: profileId, woocommerce_sku: it.sku, product_id: it.product_id, product_variant_id: it.product_variant_id || null }));
  if (newMappings.length) {
    await supabase.from('woocommerce_sku_map').upsert(newMappings, { onConflict: 'profile_id,woocommerce_sku', ignoreDuplicates: true });
  }

  const orderItems = items.map((it) => ({
    product_id: it.product_id,
    product_variant_id: it.product_variant_id || null,
    title: it.title,
    unit_price: it.unit_price,
    quantity: it.quantity,
    size: null,
    color: null,
    seller_cost: null,
    total_cost: it.unit_price * it.quantity,
  }));

  const orderType = pending.financial_status === 'processing' || pending.financial_status === 'completed' ? 'woocommerce' : 'contraentrega';

  const { data: orderId, error } = await supabase.rpc('create_order', {
    order_data: {
      seller_id: profileId,
      buyer_name: pending.buyer_name,
      buyer_phone: pending.buyer_phone,
      buyer_address: pending.buyer_address,
      buyer_city: pending.buyer_city,
      buyer_neighborhood: pending.buyer_neighborhood,
      order_type: orderType,
      freight_payer: 'tienda',
    },
    items: orderItems,
  });

  if (error || !orderId) {
    const msg = error && error.message && error.message.includes('stock_insuficiente') ? 'Uno de los productos ya no tiene stock disponible' : 'No se pudo crear el pedido, intenta de nuevo';
    return { success: false, message: msg };
  }

  await supabase.from('orders').update({ woocommerce_order_id: pending.woocommerce_order_id }).eq('id', orderId as number);
  await supabase.from('woocommerce_pending_orders').update({ resolved: true }).eq('id', pending.id);

  return { success: true };
}
