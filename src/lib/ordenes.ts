import { supabase } from './supabase';

// Fase 2 del plan de aislamiento proveedor<->vendedor (pedido explicito del usuario 2026-07-20, ver
// C:\Users\MOINS\.claude\plans\clever-hugging-shore.md): una guia de Mipaquete solo admite UN
// remitente/direccion de recogida, asi que un pedido no puede mezclar productos de proveedores
// distintos (antes si podia -- confirmado en pay_supplier_commissions, que reparte comisiones entre
// "TODOS los proveedores representados en el pedido"). El RPC create_order (migracion 065) ahora
// agrupa los items por el owner_profile_id real de cada producto Y crea un pedido por grupo, todo
// dentro de la misma transaccion (atomico -- si un grupo falla, ej. sin stock, Postgres deshace
// TODO, incluidos los pedidos de otros grupos ya insertados en esa misma llamada). Este helper es
// solo un wrapper delgado para no repetir el mapeo de campos en cada punto de llamada.

export interface ItemPedidoBase {
  productId: number;
  productVariantId: number | null;
  title: string;
  unitPrice: number;
  quantity: number;
  size: string | null;
  color: string | null;
  totalCost: number;
}

export interface DatosPedidoBase {
  sellerId: string;
  buyerName: string;
  buyerPhone: string;
  buyerAddress: string;
  buyerCity: string;
  buyerNeighborhood: string;
  orderType: string;
  freightPayer: string;
}

export interface ResultadoPedidosAgrupados {
  success: boolean;
  message?: string;
  orderIds: number[];
  // true si el carrito tenia productos de 2+ proveedores y se genero mas de un pedido.
  dividido: boolean;
}

export async function crearPedidosAgrupadosPorProveedor(datos: DatosPedidoBase, items: ItemPedidoBase[]): Promise<ResultadoPedidosAgrupados> {
  const { data: orderIds, error } = await supabase.rpc('create_order', {
    order_data: {
      seller_id: datos.sellerId,
      buyer_name: datos.buyerName,
      buyer_phone: datos.buyerPhone,
      buyer_address: datos.buyerAddress,
      buyer_city: datos.buyerCity,
      buyer_neighborhood: datos.buyerNeighborhood,
      order_type: datos.orderType,
      freight_payer: datos.freightPayer,
    },
    items: items.map((it) => ({
      product_id: it.productId,
      product_variant_id: it.productVariantId,
      title: it.title,
      unit_price: it.unitPrice,
      quantity: it.quantity,
      size: it.size,
      color: it.color,
      seller_cost: null,
      total_cost: it.totalCost,
    })),
  });

  if (error || !orderIds || !(orderIds as number[]).length) {
    const msg = error?.message?.includes('stock_insuficiente') ? 'Uno de los productos ya no tiene stock disponible' : 'No pudimos procesar tu pedido, intenta de nuevo';
    return { success: false, message: msg, orderIds: [], dividido: false };
  }

  const ids = orderIds as number[];
  return { success: true, orderIds: ids, dividido: ids.length > 1 };
}
