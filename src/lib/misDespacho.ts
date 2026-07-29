import { supabase } from './supabase';

// Port de MisDespachoComponent + ListDispatchComponent (Angular, panel de proveedor "Mis
// Despacho") -- 6 categorias de items de pedido segun su estado de despacho. Los 6 metodos de
// ProductoService que respaldan esto (getVentaCompleteEarring/Pendients/Complete/Devolution,
// getTransactionsPreparacion, getVentaComplete) YA estaban bien conectados desde la migracion a
// Supabase -- se portan 1:1 sin bugs que corregir.
//
// Alcance recortado y documentado: "Crear Guía"/"Imprimir Guía" (handleCreateGuide/handlePrintGuide
// en el original) dependen del mismo sistema VIEJO de cotizacion por transportadora (Coordinadora/
// ENVIA/TCC/INTERRAPIDISIMO) que ya se encontro 100% roto al portar FormventasComponent -- las
// funciones de VentasService que usan (getFletesInter/imprimirFlete/imprimirEvidencia) son no-ops
// documentados a proposito. En vez de portar esa funcionalidad muerta, cada fila linkea al mismo
// dialogo real de detalle/generacion de guia (FormVentaDetalleModal, Mipaquete real) ya construido
// para /config/ventas.

const STATUS_TO_LEGACY: Record<string, number> = { pending: 0, success: 1, rejected: 2, dispatched: 3, invoiced: 4, deleted: 5, preparing: 6 };

export interface ItemDespacho {
  id: number;
  ventaId: number;
  productoNombre: string;
  productoCodigo: string | null;
  talla: string | null;
  color: string | null;
  cantidad: number;
  precioVendedor: number;
  fecha: string;
  ventaEstado: number;
  numeroGuia: string | null;
  transportadora: string | null;
  transportadoraLogo: string | null;
  telefonoCliente: string | null;
  nombreCliente: string | null;
  vendedorNombre: string | null;
  vendedorTelefono: string | null;
}

// Pedido explicito del usuario 2026-07-29 (captura de referencia del panel viejo "Mis Despachos"):
// se agregan products.code (para el filtro "Ref Producto") y el nombre/telefono del vendedor via
// join a profiles (para la columna "Numero del vendedor" con icono de WhatsApp) -- ninguno de los
// 2 se traia antes, solo era necesario para el flujo de generacion de guia del proveedor.
async function fetchItemsPorEstado(profileId: string, statuses: string[], soloSinGuia = false): Promise<{ data: ItemDespacho[]; total: number }> {
  let q = supabase
    .from('order_items')
    .select('*, products!inner(name, code, owner_profile_id), orders!inner(*, profiles!orders_seller_id_fkey(full_name, phone))')
    .eq('products.owner_profile_id', profileId);
  if (statuses.length) q = q.in('orders.status', statuses);
  if (soloSinGuia) q = q.is('orders.tracking_number', null);

  const { data, error } = await q;
  if (error || !data) return { data: [], total: 0 };

  const rows: ItemDespacho[] = data.map((item: any) => ({
    id: item.id,
    ventaId: item.orders.id,
    productoNombre: item.products.name,
    productoCodigo: item.products.code,
    talla: item.size,
    color: item.color,
    cantidad: item.quantity,
    precioVendedor: item.total_cost || 0,
    fecha: item.orders.created_at,
    ventaEstado: STATUS_TO_LEGACY[item.orders.status] ?? 0,
    numeroGuia: item.orders.tracking_number,
    transportadora: item.orders.carrier,
    transportadoraLogo: item.orders.carrier_logo_url,
    telefonoCliente: item.orders.buyer_phone,
    nombreCliente: item.orders.buyer_name,
    vendedorNombre: item.orders.profiles ? item.orders.profiles.full_name : null,
    vendedorTelefono: item.orders.profiles ? item.orders.profiles.phone : null,
  }));
  const total = rows.reduce((sum, r) => sum + r.precioVendedor, 0);
  return { data: rows, total };
}

// "Reacaudo pendiente para pagar": saldo de billetera tipo 'supplier' -- nunca tuvo filas propias,
// solo el total (mismo comportamiento que el original).
export async function fetchReacaudoPendiente(profileId: string): Promise<number> {
  const { data } = await supabase.from('wallet_balances').select('balance').eq('profile_id', profileId).eq('wallet_type', 'supplier').maybeSingle();
  return data?.balance || 0;
}

export const fetchGuiasDespachadas = (profileId: string) => fetchItemsPorEstado(profileId, ['dispatched']);
// Bug real corregido 2026-07-29 (pedido explicito del usuario): esto filtraba status='success' +
// sin numero de guia -- una combinacion que NUNCA puede pasar de verdad en el flujo actual (un
// pedido "success"/entregado siempre tiene guia, la genera el vendedor al autorizar ANTES de que
// el pedido pueda avanzar). Por eso los pedidos recien autorizados (status='preparing', guia ya
// generada) nunca aparecian aca -- caian en "En preparacion" en su lugar, sin que el proveedor
// tuviera una pestaña clara de "esto ya esta listo, hay que imprimir/despachar". Ahora es la
// pestaña de pedidos recien autorizados por el vendedor.
export const fetchGuiasPorImprimir = (profileId: string) => fetchItemsPorEstado(profileId, ['preparing']);
export const fetchGuiasPagadas = (profileId: string) => fetchItemsPorEstado(profileId, ['success']);
export const fetchGuiasEnDevolucion = (profileId: string) => fetchItemsPorEstado(profileId, ['rejected']);

// "Reacaudo pendiente" (2da estadistica de la captura de referencia): valor de los pedidos que
// todavia estan en camino (ya despachados o en preparacion, sin resolver todavia) -- distinto de
// "para pagar" (saldo YA en la billetera) porque este es dinero que el mensajero todavia va a
// recaudar contra entrega, no algo que ya se le acredito al proveedor.
export async function fetchReacaudoEnCamino(profileId: string): Promise<number> {
  const [porImprimir, despachadas] = await Promise.all([fetchGuiasPorImprimir(profileId), fetchGuiasDespachadas(profileId)]);
  return porImprimir.total + despachadas.total;
}

// "Reacaudo total pagado" (3ra estadistica): historico completo de lo que ya se le pago al
// proveedor -- mismos items que la pestaña "Guías pagadas al proveedor", solo se reusa el total ya
// calculado por fetchGuiasPagadas en vez de duplicar la consulta.
export async function fetchReacaudoTotalPagado(profileId: string): Promise<number> {
  const { total } = await fetchGuiasPagadas(profileId);
  return total;
}
