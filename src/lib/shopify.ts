import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';
import { crearPedidosAgrupadosPorProveedor } from './ordenes';

// Port 1:1 de ShopifyService (Angular) -- ya estaba bien implementado en Supabase (Edge Function
// `shopify-connect` para conectar/desconectar, tablas `shopify_connections`/`shopify_pending_orders`/
// `shopify_sku_map`, RPC `create_order` real), sin bugs que corregir.

export interface ShopifyConnection {
  shop_domain: string;
  connected_at: string;
}

export async function fetchShopifyConnection(profileId: string): Promise<ShopifyConnection | null> {
  const { data, error } = await supabase.from('shopify_connections').select('*').eq('profile_id', profileId).maybeSingle();
  if (error || !data) return null;
  return data;
}

export async function conectarShopify(data: { profile_id: string; shop_domain: string; access_token: string; api_secret: string }): Promise<{ success: boolean; message?: string }> {
  const { data: resp, error } = await supabase.functions.invoke('shopify-connect', { body: { action: 'connect', ...data } });
  if (error || !resp || resp.error) return { success: false, message: (resp && resp.error) || 'No se pudo conectar la tienda' };
  return { success: true };
}

export async function desconectarShopify(profileId: string): Promise<boolean> {
  const { data: resp, error } = await supabase.functions.invoke('shopify-connect', { body: { action: 'disconnect', profile_id: profileId } });
  return !error && !(resp && resp.error);
}

export interface ShopifyPendingItem {
  title: string;
  sku: string | null;
  quantity: number;
  unit_price: number;
  product_id: number | null;
  product_variant_id: number | null;
  _productoNombre?: string;
  _variantes?: { id: number; label: string }[];
}

export interface ShopifyPendingOrder {
  id: number;
  shopify_order_id: string;
  shopify_order_number: string | null;
  financial_status: string | null;
  buyer_name: string;
  buyer_phone: string;
  buyer_address: string;
  buyer_city: string;
  buyer_neighborhood: string;
  items: ShopifyPendingItem[];
}

export async function fetchShopifyPendingOrders(profileId: string): Promise<ShopifyPendingOrder[]> {
  const { data, error } = await supabase
    .from('shopify_pending_orders')
    .select('*')
    .eq('profile_id', profileId)
    .eq('resolved', false)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data;
}

export async function buscarProductoParaShopify(term: string): Promise<ProductoLegacy[]> {
  if (!term || term.trim().length < 2) return [];
  const { data } = await supabase
    .from('products')
    .select('*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))')
    .eq('active', true)
    .or(`name.ilike.%${term.trim()}%,code.ilike.%${term.trim()}%`)
    .limit(10);
  return (data || []).map((p) => mapProductToLegacy(p));
}

export async function resolverPedidoShopify(
  pending: ShopifyPendingOrder,
  profileId: string,
  items: ShopifyPendingItem[],
): Promise<{ success: boolean; message?: string }> {
  const newMappings = items
    .filter((it) => it.sku && it.product_id)
    .map((it) => ({ profile_id: profileId, shopify_sku: it.sku, product_id: it.product_id, product_variant_id: it.product_variant_id || null }));
  if (newMappings.length) {
    await supabase.from('shopify_sku_map').upsert(newMappings, { onConflict: 'profile_id,shopify_sku', ignoreDuplicates: true });
  }

  const orderItems = items.map((it) => ({
    // it.product_id ya viene garantizado no-nulo aca -- el boton que dispara resolverPedidoShopify
    // esta deshabilitado hasta que todoListo() confirme que TODOS los items tienen producto elegido
    // (ver shopifyPendientes/page.tsx).
    productId: it.product_id as number,
    productVariantId: it.product_variant_id || null,
    title: it.title,
    unitPrice: it.unit_price,
    quantity: it.quantity,
    size: null,
    color: null,
    totalCost: it.unit_price * it.quantity,
  }));

  const orderType = pending.financial_status === 'paid' ? 'shopify' : 'contraentrega';

  // Fase 2 del plan de aislamiento proveedor<->vendedor: si el pedido de Shopify trae productos de
  // proveedores distintos, se divide en varios pedidos internos -- ver lib/ordenes.ts.
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
    await supabase.from('orders').update({ shopify_order_id: pending.shopify_order_id }).eq('id', orderId);
  }
  await supabase.from('shopify_pending_orders').update({ resolved: true }).eq('id', pending.id);

  return { success: true };
}
