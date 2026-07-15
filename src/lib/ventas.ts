import { supabase } from './supabase';

// Port 1:1 de las partes de VentasService (Angular, src/app/servicesComponents/ventas.service.ts)
// que usa el checkout de Dropshipping/Muestra: crear pedido (RPC create_order), cotizar y generar
// guia real con Mipaquete (Edge Functions ya desplegadas, no se tocan), y actualizar
// flete/transportadora/estado del pedido.

export interface CiudadMipaquete {
  name: string;
  code: string;
}

export interface CotizacionFlete {
  slug: string; // delivery_company_id de Mipaquete -- se usa tal cual en generarGuia
  nombre: string;
  imgTrasp: string | null;
  fleteTotal: number;
  tiempoEstimado: string;
}

interface DatosPedidoDropshipping {
  usu_clave_int: string;
  pro_clave_int: number;
  ven_tallas: string | null;
  ven_observacion: string | null; // color
  ven_cantidad: number;
  ven_precio: number;
  ven_total: number;
  ven_totalManual?: number;
  shipping_included?: boolean;
  insurance_active?: boolean;
  nombreProducto: string;
  ven_nombre_cliente: string;
  ven_telefono_cliente: string;
  ven_direccion_cliente: string;
  ven_ciudad: string;
  ven_barrio: string;
  ven_tipo: 'dropshipping' | 'muestra';
}

// Resuelve la variante real (product_variants.id) del color/talla elegidos, igual que
// VentasService._buildOrderItems -- create_order la necesita para descontar stock de la fila correcta.
async function resolverVariantId(productId: number, talla: string | null, color: string | null): Promise<number | null> {
  if (talla) {
    let q = supabase.from('product_variants').select('id, sizes!inner(name)').eq('product_id', productId).eq('sizes.name', talla);
    if (color && color !== 'null') q = q.eq('color', color);
    const { data } = await q.maybeSingle();
    return data ? (data as any).id : null;
  }
  if (color && color !== 'null') {
    const { data } = await supabase.from('product_variants').select('id').eq('product_id', productId).eq('color', color).is('size_id', null).maybeSingle();
    return data ? (data as any).id : null;
  }
  return null;
}

// Equivalente a VentasService.create2: pedido de un solo articulo (Dropshipping/Muestra), decremento
// atomico de stock via RPC create_order, freight_payer 'cliente' (el flete lo cubre el vendedor via
// billetera aparte, no el cliente final -- ver totalRecaudo en el componente).
export async function crearPedidoDropshipping(data: DatosPedidoDropshipping): Promise<{ success: boolean; id: number | null }> {
  const variantId = await resolverVariantId(data.pro_clave_int, data.ven_tallas, data.ven_observacion);

  const items = [{
    product_id: data.pro_clave_int,
    product_variant_id: variantId,
    title: data.nombreProducto,
    unit_price: data.ven_precio,
    quantity: data.ven_cantidad,
    size: data.ven_tallas || null,
    color: data.ven_observacion || null,
    seller_cost: null,
    total_cost: data.ven_total,
  }];

  const { data: orderId, error } = await supabase.rpc('create_order', {
    order_data: {
      seller_id: data.usu_clave_int || null,
      buyer_name: data.ven_nombre_cliente,
      buyer_phone: data.ven_telefono_cliente,
      buyer_address: data.ven_direccion_cliente,
      buyer_city: data.ven_ciudad,
      buyer_neighborhood: data.ven_barrio,
      order_type: data.ven_tipo,
      freight_payer: 'cliente',
    },
    items,
  });

  if (error || !orderId) return { success: false, id: null };

  const patch: Record<string, unknown> = {};
  if (data.ven_totalManual != null) patch.price_total = Number(data.ven_totalManual);
  if (data.shipping_included !== undefined) patch.shipping_included = data.shipping_included;
  if (data.insurance_active !== undefined) patch.insurance_active = data.insurance_active;
  if (Object.keys(patch).length) await supabase.from('orders').update(patch).eq('id', orderId as number);

  return { success: true, id: orderId as number };
}

// Persiste freight_value/carrier -- mipaquete-create-shipment los lee de la base de datos, no del
// formulario, para saber cuanto debe recaudar el mensajero.
export async function actualizarFleteYTransportadora(orderId: number, fleteTotal: number, transportadoraSelect: string): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ freight_value: fleteTotal, carrier: transportadoraSelect }).eq('id', orderId);
  return !error;
}

// reject_order: marca el pedido como devolucion/cancelado y (si tenia seguro antidevoluciones)
// devuelve el flete prepagado -- aca se usa para "cancelar y reembolsar" antes de generar guia.
export async function cancelarPedido(orderId: number): Promise<boolean> {
  const { error } = await supabase.rpc('reject_order', { p_order_id: orderId });
  return !error;
}

export async function marcarPedidoEnPreparacion(orderId: number): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);
  return !error;
}

export async function cotizarFlete(orderId: number, codeCiudad: string): Promise<CotizacionFlete[]> {
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-quote', { body: { order_id: orderId, destino_dane_code: codeCiudad } });
  if (error || !resp || resp.error) return [];
  return (resp.cotizaciones || []).map((c: any) => ({
    slug: c.delivery_company_id,
    nombre: c.delivery_company_name || c.delivery_company_id,
    imgTrasp: c.logo_url || null,
    fleteTotal: c.flete_costo,
    tiempoEstimado: c.tiempo_min ? `${Math.round(c.tiempo_min / 1440)} dias` : '',
  }));
}

export async function generarGuiaEnvio(orderId: number, transportadoraSelect: string): Promise<{ ok: boolean; guia?: string; message?: string }> {
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-create-shipment', { body: { order_id: orderId, delivery_company_id: transportadoraSelect } });
  if (error || !resp || resp.error) return { ok: false, message: (resp && resp.error) || 'No se pudo generar la guia' };
  return { ok: true, guia: resp.guia || resp.sending_id || '' };
}

export async function buscarCiudadesMipaquete(q: string): Promise<CiudadMipaquete[]> {
  if (q.trim().length < 2) return [];
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-locations', { body: { q } });
  if (error || !resp || !resp.success) return [];
  return (resp.data || []).map((c: any) => ({ name: c.name, code: c.code }));
}
