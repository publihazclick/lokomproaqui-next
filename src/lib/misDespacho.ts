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
  talla: string | null;
  color: string | null;
  cantidad: number;
  precioVendedor: number;
  fecha: string;
  ventaEstado: number;
  numeroGuia: string | null;
  transportadora: string | null;
  telefonoCliente: string | null;
  nombreCliente: string | null;
}

async function fetchItemsPorEstado(profileId: string, statuses: string[], soloSinGuia = false): Promise<{ data: ItemDespacho[]; total: number }> {
  let q = supabase
    .from('order_items')
    .select('*, products!inner(name, owner_profile_id), orders!inner(*)')
    .eq('products.owner_profile_id', profileId);
  if (statuses.length) q = q.in('orders.status', statuses);
  if (soloSinGuia) q = q.is('orders.tracking_number', null);

  const { data, error } = await q;
  if (error || !data) return { data: [], total: 0 };

  const rows: ItemDespacho[] = data.map((item: any) => ({
    id: item.id,
    ventaId: item.orders.id,
    productoNombre: item.products.name,
    talla: item.size,
    color: item.color,
    cantidad: item.quantity,
    precioVendedor: item.total_cost || 0,
    fecha: item.orders.created_at,
    ventaEstado: STATUS_TO_LEGACY[item.orders.status] ?? 0,
    numeroGuia: item.orders.tracking_number,
    transportadora: item.orders.carrier,
    telefonoCliente: item.orders.buyer_phone,
    nombreCliente: item.orders.buyer_name,
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
export const fetchGuiasPorImprimir = (profileId: string) => fetchItemsPorEstado(profileId, ['success'], true);
export const fetchGuiasPagadas = (profileId: string) => fetchItemsPorEstado(profileId, ['success']);
export const fetchGuiasEnDevolucion = (profileId: string) => fetchItemsPorEstado(profileId, ['rejected']);
export const fetchGuiasEnPreparacion = (profileId: string) => fetchItemsPorEstado(profileId, ['preparing']);
