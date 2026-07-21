import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';
import { crearPedidosAgrupadosPorProveedor } from './ordenes';

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
    // it.product_id ya viene garantizado no-nulo aca -- el boton que dispara
    // resolverPedidoWoocommerce esta deshabilitado hasta que todoListo() confirme que TODOS los
    // items tienen producto elegido (ver woocommercePendientes/page.tsx).
    productId: it.product_id as number,
    productVariantId: it.product_variant_id || null,
    title: it.title,
    unitPrice: it.unit_price,
    quantity: it.quantity,
    size: null,
    color: null,
    totalCost: it.unit_price * it.quantity,
  }));

  const orderType = pending.financial_status === 'processing' || pending.financial_status === 'completed' ? 'woocommerce' : 'contraentrega';

  // Fase 2 del plan de aislamiento proveedor<->vendedor: si el pedido de WooCommerce trae productos
  // de proveedores distintos, se divide en varios pedidos internos -- ver lib/ordenes.ts.
  const res = await crearPedidosAgrupadosPorProveedor(
    {
      sellerId: profileId,
      buyerName: pending.buyer_name,
      buyerPhone: pending.buyer_phone,
      buyerAddress: pending.buyer_address,
      buyerCity: pending.buyer_city,
      buyerNeighborhood: pending.buyer_neighborhood,
      orderType,
      freightPayer: 'tienda',
    },
    orderItems,
  );

  if (!res.success) return { success: false, message: res.message };

  for (const orderId of res.orderIds) {
    await supabase.from('orders').update({ woocommerce_order_id: pending.woocommerce_order_id }).eq('id', orderId);
  }
  await supabase.from('woocommerce_pending_orders').update({ resolved: true }).eq('id', pending.id);

  return { success: true };
}
