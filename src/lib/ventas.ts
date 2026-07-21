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
  customer_prepaid_product?: boolean;
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

  // create_order (migracion 065) devuelve bigint[] (agrupa por proveedor internamente) -- aca
  // siempre hay un solo item de un solo producto, asi que siempre es un array de 1.
  const { data: orderIds, error } = await supabase.rpc('create_order', {
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

  const orderId = (orderIds as number[] | null)?.[0] ?? null;
  if (error || !orderId) return { success: false, id: null };

  const patch: Record<string, unknown> = {};
  if (data.ven_totalManual != null) patch.price_total = Number(data.ven_totalManual);
  if (data.shipping_included !== undefined) patch.shipping_included = data.shipping_included;
  if (data.insurance_active !== undefined) patch.insurance_active = data.insurance_active;
  if (data.customer_prepaid_product !== undefined) patch.customer_prepaid_product = data.customer_prepaid_product;
  if (Object.keys(patch).length) await supabase.from('orders').update(patch).eq('id', orderId as number);

  return { success: true, id: orderId as number };
}

// Persiste freight_value/carrier -- mipaquete-create-shipment los lee de la base de datos, no del
// formulario, para saber cuanto debe recaudar el mensajero. `carrier` guarda el NOMBRE legible (no
// el slug, ver BUG REAL corregido en generarGuiaEnvio) -- el slug solo vive en el estado del
// componente (CotizacionFlete.slug), orders.carrier nunca se relee como ID en ningun lado.
export async function actualizarFleteYTransportadora(orderId: number, fleteTotal: number, deliveryCompanyName: string, deliveryCompanyLogoUrl: string | null): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ freight_value: fleteTotal, carrier: deliveryCompanyName, carrier_logo_url: deliveryCompanyLogoUrl }).eq('id', orderId);
  return !error;
}

// Cobra el flete/seguro/producto de la wallet del vendedor EXACTAMENTE UNA VEZ por pedido, sin
// importar cuantas veces se llame (reintento tras un error de Mipaquete, doble-clic, o el mismo
// pedido abierto en dos pestañas). El RPC bloquea la fila del pedido y solo debita si todavia no
// se habia debitado -- si ya se cobro, es un no-op (alreadyCharged=true) y el flujo puede seguir
// directo a generar la guia sin volver a tocar la wallet. Pedido explicito del usuario 2026-07-19,
// tras encontrar un bug real: "intenta de nuevo" despues de un fallo de guia volvia a cobrar todo
// desde cero en FormVentaDetalleModal (Autorizar Despacho no tenia el mismo guard que ya existia
// en DropshippingCheckoutModal via reintentarGuia()).
export async function cobrarWalletPedidoSiNoCobrado(
  orderId: number,
  profileId: string,
  amount: number,
  kind: string,
  freightFunded: boolean
): Promise<{ success: boolean; alreadyCharged?: boolean; message?: string }> {
  const { data, error } = await supabase.rpc('charge_order_wallet_if_needed', {
    p_order_id: orderId,
    p_profile_id: profileId,
    p_amount: amount,
    p_kind: kind,
    p_freight_funded: freightFunded,
  });
  if (error) {
    const msg = error.message && error.message.includes('saldo_insuficiente')
      ? 'Saldo insuficiente en tu billetera, recarga para continuar'
      : 'No pudimos procesar el pago con tu billetera';
    return { success: false, message: msg };
  }
  return { success: true, alreadyCharged: data === false };
}

// Reembolsa un pedido cancelado antes de tener guia SOLO si de verdad se le cobro algo -- lee
// order_wallet_debited y el monto real en wallet_ledger, nunca confia en un total calculado en el
// frontend. Bug real encontrado 2026-07-19: cancelarYReembolsar() en DropshippingCheckoutModal
// devolvia `totalAPagar` de forma incondicional, incluso cuando el debito nunca habia llegado a
// pasar (ej. charge_order_wallet_if_needed fallo por saldo insuficiente en una condicion de
// carrera) -- eso permitia recibir plata gratis en la wallet con solo darle "Cancelar pedido".
export async function reembolsarWalletPedidoSiCobrado(orderId: number): Promise<boolean> {
  const { error } = await supabase.rpc('refund_order_wallet_if_charged', { p_order_id: orderId });
  return !error;
}

// Condiciones de entrega (pedido explicito del usuario 2026-07-19, ajustado en la Fase 3 del plan
// de aislamiento proveedor<->vendedor 2026-07-20): el VENDEDOR las define y confirma -- es quien
// sabe si el cliente ya pago, el proveedor no tiene forma de saberlo. delivery_conditions_confirmed
// es el punto de corte que habilita al proveedor a ver el pedido en su panel y generar la guia (ver
// FormVentaDetalleModal) -- antes esto y "generar guia" eran el mismo click del vendedor, ahora son
// dos pasos de dos personas distintas.
export async function actualizarCondicionesEntrega(orderId: number, clientePago: boolean, envioIncluido: boolean, seguroActivo?: boolean): Promise<boolean> {
  const patch: Record<string, boolean> = { customer_prepaid_product: clientePago, shipping_included: envioIncluido, delivery_conditions_confirmed: true };
  // seguroActivo solo se toca para 'contraentrega' (ver FormVentaDetalleModal) -- dropshipping/
  // muestra ya definieron esto en su propio checkout, no hay que pisarlo aca.
  if (seguroActivo !== undefined) patch.insurance_active = seguroActivo;
  const { error } = await supabase.from('orders').update(patch).eq('id', orderId);
  return !error;
}

// reject_order: marca el pedido como devolucion/cancelado y (si tenia seguro antidevoluciones)
// devuelve el flete prepagado -- pensado para el flujo admin (marcar "Devolucion" sobre un pedido
// YA despachado, donde nadie reembolso nada todavia).
export async function cancelarPedido(orderId: number): Promise<boolean> {
  const { error } = await supabase.rpc('reject_order', { p_order_id: orderId });
  return !error;
}

// Bug real encontrado y corregido (no replicado, ver DropshippingCheckoutModal.cancelarYReembolsar):
// el original en Angular llama a WalletService.refund() (reembolso directo e incondicional del
// flete pagado) y DESPUES a VentasService.update({ven_estado:2}), que dispara reject_order -- ese
// RPC, si el pedido tenia seguro antidevoluciones activo, credita el flete OTRA VEZ (pensado para
// cuando el reembolso NO paso por otro lado, ej. el panel admin marcando una devolucion real
// post-despacho). Resultado real en produccion HOY: cancelar un pedido asegurado desde este mismo
// dialogo reembolsa el flete DOS veces. Esta funcion marca el pedido como rechazado sin ese efecto
// secundario, para usar junto al reembolso directo que ya se hizo.
export async function marcarPedidoRechazadoSinReembolso(orderId: number): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ status: 'rejected' }).eq('id', orderId);
  return !error;
}

// Fase 0 del plan de reduccion de devoluciones (pedido explicito del usuario 2026-07-19): motivo
// capturado a mano cuando el rechazo lo dispara una persona (vendedor cancelando su propio pedido
// pendiente, o admin marcando "Devolucion" desde el dropdown) en vez del tracking automatico de
// Mipaquete (que ya se auto-clasifica en mipaquete-sync-tracking/mipaquete-track). Sin esto, el
// dashboard de causas (Fase 4) queda ciego para todo rechazo manual.
export const MOTIVOS_DEVOLUCION: { value: string; label: string }[] = [
  { value: 'no_contesto', label: 'Cliente no contestó' },
  { value: 'no_encontrado', label: 'No lo encontraron / no estaba' },
  { value: 'se_arrepintio', label: 'Cliente se arrepintió' },
  { value: 'direccion_invalida', label: 'Dirección incorrecta' },
  { value: 'producto_no_esperado', label: 'Producto no era lo esperado' },
  { value: 'fraude_sospechado', label: 'Pedido falso / broma' },
  { value: 'otro', label: 'Otro motivo' },
];

export async function guardarMotivoDevolucion(orderId: number, motivo: string): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ return_reason: motivo }).eq('id', orderId);
  return !error;
}

export interface RiesgoComprador {
  totalOrders: number;
  totalReturns: number;
}

// Fase 1 del plan de reduccion de devoluciones: consulta el historial CROSS-SELLER del comprador
// (ver customer_risk_profile, migracion 049) por telefono normalizado -- el mismo comprador que ya
// devolvio pedidos con OTRO vendedor de la plataforma tambien aparece aca. Puramente informativo,
// no bloquea nada -- el vendedor decide si autoriza o no con esta info.
export async function fetchRiesgoComprador(telefono: string | null): Promise<RiesgoComprador | null> {
  const normalizado = (telefono || '').replace(/\D/g, '').slice(-10);
  if (normalizado.length < 10) return null;
  const { data, error } = await supabase.from('customer_risk_profile').select('total_orders, total_returns').eq('phone_normalized', normalizado).maybeSingle();
  if (error || !data) return null;
  return { totalOrders: data.total_orders, totalReturns: data.total_returns };
}

// Fase 1 del plan de reduccion de devoluciones: umbral para considerar "alto riesgo" un vendedor o
// producto -- exige minimo 5 pedidos ya resueltos (evita juzgar con una muestra minuscula, ej. el
// primer pedido rechazado de un vendedor nuevo) y 30%+ de tasa de devolucion real.
const MINIMO_PEDIDOS_RIESGO = 5;
const TASA_DEVOLUCION_ALTO_RIESGO = 0.3;

// Consulta seller_return_stats/product_return_stats (migracion 050, vistas en vivo sobre
// orders/order_items -- no hace falta tabla mantenida aparte) para decidir si el seguro
// antidevolucion debe quedar obligatorio (no se puede desactivar) en este pedido. "Te protege a ti
// como plataforma" -- pedido explicito del usuario 2026-07-19.
export async function fetchSeguroObligatorio(sellerId: string | null, productIds: (number | null)[]): Promise<boolean> {
  const consultas: PromiseLike<{ total_orders: number; return_rate: number } | null>[] = [];
  if (sellerId) {
    consultas.push(
      supabase.from('seller_return_stats').select('total_orders, return_rate').eq('seller_id', sellerId).maybeSingle().then((r) => r.data as any),
    );
  }
  for (const productId of productIds) {
    if (!productId) continue;
    consultas.push(
      supabase.from('product_return_stats').select('total_orders, return_rate').eq('product_id', productId).maybeSingle().then((r) => r.data as any),
    );
  }
  const resultados = await Promise.all(consultas);
  return resultados.some((r) => r && r.total_orders >= MINIMO_PEDIDOS_RIESGO && r.return_rate >= TASA_DEVOLUCION_ALTO_RIESGO);
}

export async function marcarPedidoEnPreparacion(orderId: number): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ status: 'preparing' }).eq('id', orderId);
  return !error;
}

// approve_order: paga las comisiones multinivel de referidos y proveedores -- equivalente al caso
// ven_estado===1 de VentasService.update() (Angular).
export async function aprobarPedido(orderId: number): Promise<boolean> {
  const { error } = await supabase.rpc('approve_order', { p_order_id: orderId });
  return !error;
}

// Cambia el estado de una venta desde el dialogo de detalle (0 Pendiente, 6 Preparacion,
// 3 Despachado, 1 Venta exitosa -> approve_order, 2 Devolucion -> reject_order). Mismo mapeo que
// VentasService.update() en Angular.
export async function cambiarEstadoVenta(orderId: number, estadoLegacy: number): Promise<boolean> {
  if (estadoLegacy === 1) return aprobarPedido(orderId);
  if (estadoLegacy === 2) return cancelarPedido(orderId);
  const { error } = await supabase.from('orders').update({ status: LEGACY_TO_STATUS[estadoLegacy] || 'pending' }).eq('id', orderId);
  return !error;
}

// Fase 3 del plan de aislamiento proveedor<->vendedor: el vendedor confirma la ciudad destino SIN
// cotizar (cotizar ahora es trabajo del proveedor, que recien puede hacerlo una vez el vendedor
// confirma las condiciones de entrega) -- guarda destino_dane_code directo, sin llamar a Mipaquete.
export async function actualizarDestinoPedido(orderId: number, destinoDaneCode: string): Promise<boolean> {
  const { error } = await supabase.from('orders').update({ destino_dane_code: destinoDaneCode }).eq('id', orderId);
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

// BUG REAL CORREGIDO 2026-07-20: nunca se mandaba delivery_company_name/logo -- mipaquete-create-shipment
// ya sabia guardar el nombre legible (`carrier: body.delivery_company_name || deliveryCompanyId`) pero
// como el frontend solo mandaba el slug, el fallback al slug se activaba SIEMPRE. orders.carrier
// quedaba con algo como "5fceb46c8229797cb139a7aa" en vez de "SERVIENTREGA" en cada pedido generado.
export async function generarGuiaEnvio(orderId: number, transportadoraSelect: string, deliveryCompanyName: string, deliveryCompanyLogoUrl: string | null): Promise<{ ok: boolean; guia?: string; message?: string }> {
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-create-shipment', {
    body: { order_id: orderId, delivery_company_id: transportadoraSelect, delivery_company_name: deliveryCompanyName, delivery_company_logo_url: deliveryCompanyLogoUrl },
  });
  if (error || !resp || resp.error) return { ok: false, message: (resp && resp.error) || 'No se pudo generar la guia' };
  return { ok: true, guia: resp.guia || resp.sending_id || '' };
}

export async function buscarCiudadesMipaquete(q: string): Promise<CiudadMipaquete[]> {
  if (q.trim().length < 2) return [];
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-locations', { body: { q } });
  if (error || !resp || !resp.success) return [];
  return (resp.data || []).map((c: any) => ({ name: c.name, code: c.code }));
}

// ── Listado de ventas (VentasComponent, "/config/ventas") ──────────────────────────────────────
//
// BUGS REALES encontrados y corregidos aca (no replicados, mismo criterio que perfil/referidos):
// 1) VentasComponent arma su filtro por defecto como `ven_estado: { '!=': [4, 2] }` (excluir
//    estados) pero VentasService.get() (Angular) solo reconoce `where.ven_estado` cuando es un
//    NUMERO plano (`typeof where.ven_estado === 'number'`) -- un objeto `{'!=':[...]}` no matchea
//    esa condicion y el filtro se ignora COMPLETO. En produccion HOY la pantalla de Ventas no
//    excluye nada por defecto (ni eliminados, ni facturados) a pesar de que el codigo intenta
//    hacerlo. Mismo problema con `ven_sw_eliminado`, `ven_retiro` y el rango de fechas
//    (`createdAt >=/<=`): ninguno de los tres esta implementado en get(), se ignoran en silencio.
// 2) `mapOrderToLegacy` mapea `usu_clave_int: order.seller_id` -- un UUID plano, no un objeto --
//    pero la plantilla lee `row.usu_clave_int?.usu_nombre/usu_telefono/usu_ciudad` como si fuera
//    un perfil embebido. Esas 3 columnas estan siempre vacias hoy (solo visibles para admin,
//    viendo ventas de otros vendedores). Se resuelve aca con un join real a `profiles`.
// 3) La plantilla lee `row['ven_retirado']` (con D) para la columna "Pagado", pero el campo real
//    mapeado es `ven_retiro` (sin D) -- un typo que deja esa columna siempre vacia. Se usa el campo
//    real (`orders.withdrawn`).
//
// Alcance recortado y documentado: el dialogo "Ver detalle" (FormventasComponent, abre con el
// icono de ojo en cada fila) y "Dar puntos" (FormpuntosComponent, bono manual del admin) no se
// portan en esta pieza -- son sus propios formularios grandes, quedan para una proxima pieza
// dedicada. Tambien se omite la columna "Evidencia Entrega"/"lista para cobrar": dependen de
// `ven_imagen_tiket`, un campo que nunca se mapeo desde la migracion a Supabase (no existe
// contraparte en `orders`) -- no hay ningun dato real que mostrar ahi todavia.

export const VENTA_ESTADOS: { value: string; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: '0', label: 'Pendiente' },
  { value: '1', label: 'Venta exitosa' },
  { value: '2', label: 'Rechazada' },
  { value: '3', label: 'Despachado' },
  { value: 'pagado', label: 'Pagado y completado' },
];

const STATUS_TO_LEGACY: Record<string, number> = { pending: 0, success: 1, rejected: 2, dispatched: 3, invoiced: 4, deleted: 5, preparing: 6 };
const LEGACY_TO_STATUS: Record<number, string> = { 0: 'pending', 1: 'success', 2: 'rejected', 3: 'dispatched', 4: 'invoiced', 5: 'deleted', 6: 'preparing' };
export const VENTA_ESTADO_LABEL: Record<number, string> = { 0: 'Pendiente', 1: 'Exitosa', 2: 'Rechazada', 3: 'Despachado', 4: 'Facturado', 5: 'Eliminado', 6: 'Preparación' };

export interface VentaRow {
  id: number;
  estado: number;
  numeroGuia: string | null;
  transportadora: string | null;
  transportadoraLogo: string | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  fecha: string;
  trackingStatus: string | null;
  trackingSyncedAt: string | null;
  retirado: boolean;
  motivoRechazo: string | null;
  vendedorNombre: string | null;
  vendedorTelefono: string | null;
  vendedorCiudad: string | null;
}

function mapVentaRow(o: any): VentaRow {
  return {
    id: o.id,
    estado: STATUS_TO_LEGACY[o.status] ?? 0,
    numeroGuia: o.tracking_number,
    transportadora: o.carrier,
    transportadoraLogo: o.carrier_logo_url,
    nombreCliente: o.buyer_name,
    telefonoCliente: o.buyer_phone,
    fecha: o.created_at,
    trackingStatus: o.tracking_status,
    trackingSyncedAt: o.tracking_synced_at,
    retirado: !!o.withdrawn,
    motivoRechazo: o.rejection_reason ?? null,
    vendedorNombre: o.profiles ? o.profiles.full_name : null,
    vendedorTelefono: o.profiles ? o.profiles.phone : null,
    vendedorCiudad: o.profiles ? o.profiles.city : null,
  };
}

export async function fetchVentas(opts: {
  sellerId?: string;
  estadoFiltro?: string; // 'todos' | '0'..'3' | 'pagado'
  fechaInicio?: string;
  fechaFinal?: string;
  search?: string;
  page: number;
  limit: number;
  // "Autorizar Despacho" (ventasPosibles) pedido explicito del usuario 2026-07-19: los pedidos que
  // el propio vendedor genera manualmente por "Hacer Dropshipping"/"Pedir muestra" nunca deben
  // pasar por ahi -- el vendedor ya decidio y pago el pedido el mismo, no hay nada que "autorizar".
  // Al completarse con exito ya caen solos en estado 'preparing' (marcarPedidoEnPreparacion, ver
  // DropshippingCheckoutModal), que es justo lo que /config/misDespacho -> "Guias en preparacion"
  // muestra al proveedor/bodega dueno del producto para que despache. Este filtro solo saca a esos
  // 2 tipos de pedido de ESTA cola de autorizacion -- siguen visibles en /config/ventas (listado
  // general del admin), que NO pasa este parametro.
  excludeOrderTypes?: string[];
}): Promise<{ data: VentaRow[]; count: number }> {
  let q = supabase.from('orders').select('*, profiles!orders_seller_id_fkey(full_name, phone, city)', { count: 'exact' });

  if (opts.sellerId) q = q.eq('seller_id', opts.sellerId);
  if (opts.excludeOrderTypes?.length) q = q.not('order_type', 'in', `(${opts.excludeOrderTypes.join(',')})`);

  if (!opts.estadoFiltro || opts.estadoFiltro === 'todos') {
    q = q.not('status', 'in', '(invoiced,rejected,deleted)');
  } else if (opts.estadoFiltro === 'pagado') {
    q = q.eq('withdrawn', true);
  } else {
    q = q.eq('status', LEGACY_TO_STATUS[Number(opts.estadoFiltro)] || 'pending');
  }

  if (opts.fechaInicio) q = q.gte('created_at', opts.fechaInicio);
  if (opts.fechaFinal) q = q.lte('created_at', opts.fechaFinal);

  if (opts.search && opts.search.trim()) {
    const term = opts.search.trim();
    const parts = [`buyer_phone.ilike.%${term}%`, `tracking_number.ilike.%${term}%`];
    if (/^\d+$/.test(term)) parts.push(`id.eq.${term}`);
    q = q.or(parts.join(','));
  }

  q = q.order('created_at', { ascending: false }).range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return { data: data.map(mapVentaRow), count: count ?? data.length };
}

// ── Listado "Ventas Proveedor" (VentasProveedorComponent, "/config/ventasProveedor") ───────────
//
// Casi todo el componente original (buscar, buscarEstado, validandoFecha, borrarFiltro, crear,
// darPuntos, btndelete, getValorVenta) esta comentado en el codigo fuente -- es codigo muerto que
// nunca se ejecuta. El unico metodo real que corre (ngOnInit) llama a
// `VentasService.getVentasProveedores({where:{ven_estado:0}})`, pero esa funcion (ya verificada
// arriba en este archivo, Supabase) ignora por completo el argumento `where` -- siempre devuelve
// hasta 200 pedidos no eliminados, sin filtrar por estado. Se replica ese mismo comportamiento real
// tal cual (no el filtro que el codigo aparenta tener pero nunca aplico).
export async function fetchVentasProveedor(): Promise<VentaRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, profiles!orders_seller_id_fkey(full_name, phone, city)')
    .neq('status', 'deleted')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map(mapVentaRow);
}

// ── "Posibles Ventas" (VentasClienteComponent, "/config/ventasPosibles") ───────────────────────
//
// Vista historicamente separada de VentasComponent, sobre los mismos datos (VentasService.get(),
// aca `getPossibleSales` es literalmente un alias de `get()` en el Angular original) pero con
// alcance mas chico: filtro de vendedor + estado (por defecto "Pendiente"), y una caja de "Total
// Utilidad de venta" real (getMontos, suma earnings_total del vendedor/estado filtrados). Se
// reusa fetchVentas para el listado (misma fuente, mismos bugs ya corregidos) y se agrega
// fetchMontosVenta para la caja de totales.
export async function fetchMontosVenta(sellerId: string, estadoFiltro: string): Promise<number> {
  let q = supabase.from('orders').select('earnings_total').eq('seller_id', sellerId);
  if (estadoFiltro && estadoFiltro !== 'todos' && estadoFiltro !== 'pagado') {
    q = q.eq('status', LEGACY_TO_STATUS[Number(estadoFiltro)] || 'pending');
  }
  const { data, error } = await q;
  if (error || !data) return 0;
  return data.reduce((sum, r: any) => sum + (Number(r.earnings_total) || 0), 0);
}

// ── Tabla export completa (VentastableComponent, "/config/tablaventas") ────────────────────────
//
// Mismo `usu_clave_int` (UUID plano leido como objeto embebido) de siempre, resuelto aca con el
// join real a `profiles`. Se omiten 3 columnas del original que nunca tuvieron datos reales:
// "Cedula Cliente" (`cob_num_cedula_cliente` -- no existe campo equivalente en `orders`, el
// documento del comprador nunca se capturo), "Talla" (`ven_tallas` -- vive por item en
// `order_items`, no por pedido; esta vista es una fila por pedido) y "Email Vendedor" (el email
// vive en `auth.users`, no en `profiles`, no se puede leer desde el cliente). El resto de columnas
// (incluyendo "Porcentaje Ganancias" -> `profiles.commission_pct`) si tienen dato real.

export interface TablaVentaRow {
  id: number;
  numeroGuia: string | null;
  barrio: string | null;
  ciudad: string | null;
  direccionCliente: string | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  tipo: string | null;
  fecha: string;
  ganancias: number;
  cantidad: number;
  precio: number;
  total: number;
  vendedorNombre: string | null;
  vendedorApellido: string | null;
  vendedorCiudad: string | null;
  vendedorDireccion: string | null;
  vendedorTelefono: string | null;
  porcentaje: number | null;
}

export async function fetchTablaVentas(sellerId?: string): Promise<TablaVentaRow[]> {
  let q = supabase
    .from('orders')
    .select('*, profiles!orders_seller_id_fkey(full_name, last_name, city, address, phone, commission_pct)')
    .not('status', 'in', '(invoiced,deleted)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (sellerId) q = q.eq('seller_id', sellerId);

  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((o: any) => ({
    id: o.id,
    numeroGuia: o.tracking_number,
    barrio: o.buyer_neighborhood,
    ciudad: o.buyer_city,
    direccionCliente: o.buyer_address,
    nombreCliente: o.buyer_name,
    telefonoCliente: o.buyer_phone,
    tipo: o.order_type,
    fecha: o.created_at,
    ganancias: Number(o.earnings_total) || 0,
    cantidad: o.quantity_total,
    precio: Number(o.price_total) || 0,
    total: Number(o.price_total) || 0,
    vendedorNombre: o.profiles ? o.profiles.full_name : null,
    vendedorApellido: o.profiles ? o.profiles.last_name : null,
    vendedorCiudad: o.profiles ? o.profiles.city : null,
    vendedorDireccion: o.profiles ? o.profiles.address : null,
    vendedorTelefono: o.profiles ? o.profiles.phone : null,
    porcentaje: o.profiles ? Number(o.profiles.commission_pct) : null,
  }));
}

export async function refreshTracking(orderId: number): Promise<{ success: boolean; message?: string; estado?: string | null }> {
  const { data: resp, error } = await supabase.functions.invoke('mipaquete-track', { body: { order_id: orderId } });
  if (error || !resp || resp.error) return { success: false, message: (resp && resp.error) || 'No pudimos actualizar el estado' };
  return { success: true, estado: resp.estado_actual || null };
}

export async function eliminarVenta(orderId: number): Promise<{ success: boolean; message?: string }> {
  const { data: existing } = await supabase.from('orders').select('status').eq('id', orderId).maybeSingle();
  if (existing && ['success', 'rejected', 'dispatched', 'invoiced'].includes(existing.status)) {
    return { success: false, message: 'Error no puedes Eliminar esta venta por tener datos de despachado' };
  }
  const { error } = await supabase.from('orders').update({ status: 'deleted' }).eq('id', orderId);
  return { success: !error };
}

// ── Detalle de una venta (FormventasComponent, version simplificada -- ver nota en el componente
// React sobre por que se dejo afuera la cotizacion vieja de Coordinadora) ──────────────────────

export interface VentaItem {
  id: number;
  productoId: number | null;
  titulo: string | null;
  cantidad: number;
  talla: string | null;
  color: string | null;
  costoTotal: number | null;
}

export interface VentaDetalle {
  id: number;
  estado: number;
  tipoPedido: string;
  sellerId: string | null;
  nombreCliente: string | null;
  telefonoCliente: string | null;
  direccionCliente: string | null;
  ciudad: string | null;
  barrio: string | null;
  numeroGuia: string | null;
  transportadora: string | null;
  transportadoraLogo: string | null;
  precioTotal: number | null;
  gananciaTotal: number | null;
  vendedorNombre: string | null;
  vendedorTelefono: string | null;
  vendedorCiudad: string | null;
  // Condiciones de entrega, pedido explicito del usuario 2026-07-19: antes solo existian para
  // dropshipping/muestra (ver DropshippingCheckoutModal) -- ahora el vendedor tambien las puede
  // definir al autorizar el despacho de una venta normal, ver actualizarCondicionesEntrega.
  clientePago: boolean;
  envioIncluido: boolean;
  // Fase 3 del plan de aislamiento proveedor<->vendedor: true cuando el VENDEDOR ya confirmo las
  // condiciones de entrega -- recien ahi el proveedor puede ver el pedido en /config/misDespacho y
  // generar la guia real.
  deliveryConditionsConfirmed: boolean;
  supplierId: string | null;
  destinoDaneCode: string | null;
  // Fase 1d del plan de reduccion de devoluciones: null = todavia no se le pidio confirmacion al
  // comprador (dropshipping/muestra, o contraentrega mientras las credenciales de Meta no existan
  // -- ver whatsapp-send-confirmation) -- en ese caso NO bloquea nada. 'pending'/'invalid_number' SI
  // bloquean autorizar despacho. 'confirmed' desbloquea. 'cancelled' ya viene con status='rejected'.
  confirmationStatus: string | null;
  // Fase 2 del plan de reduccion de devoluciones: el cliente respondio "No puedo recibir hoy" a la
  // notificacion de "va en camino" -- no se reagenda automatico con Mipaquete, el vendedor coordina
  // a mano (ver whatsapp-webhook).
  deliveryRescheduleRequested: boolean;
  items: VentaItem[];
}

export async function fetchVentaDetalle(orderId: number): Promise<VentaDetalle | null> {
  const [{ data: order, error }, { data: items }] = await Promise.all([
    supabase.from('orders').select('*, profiles!orders_seller_id_fkey(full_name, phone, city)').eq('id', orderId).maybeSingle(),
    supabase.from('order_items').select('*').eq('order_id', orderId),
  ]);
  if (error || !order) return null;

  return {
    id: order.id,
    estado: STATUS_TO_LEGACY[order.status] ?? 0,
    tipoPedido: order.order_type,
    sellerId: order.seller_id,
    nombreCliente: order.buyer_name,
    telefonoCliente: order.buyer_phone,
    direccionCliente: order.buyer_address,
    ciudad: order.buyer_city,
    barrio: order.buyer_neighborhood,
    numeroGuia: order.tracking_number,
    transportadora: order.carrier,
    transportadoraLogo: order.carrier_logo_url,
    precioTotal: order.price_total,
    gananciaTotal: order.earnings_total,
    vendedorNombre: order.profiles ? order.profiles.full_name : null,
    vendedorTelefono: order.profiles ? order.profiles.phone : null,
    vendedorCiudad: order.profiles ? order.profiles.city : null,
    clientePago: !!order.customer_prepaid_product,
    envioIncluido: order.shipping_included !== false,
    deliveryConditionsConfirmed: !!order.delivery_conditions_confirmed,
    supplierId: order.supplier_id,
    destinoDaneCode: order.destino_dane_code,
    confirmationStatus: order.confirmation_status,
    deliveryRescheduleRequested: !!order.delivery_reschedule_requested,
    items: (items || []).map((i: any) => ({
      id: i.id,
      productoId: i.product_id,
      titulo: i.title,
      cantidad: i.quantity,
      talla: i.size,
      color: i.color,
      costoTotal: i.total_cost,
    })),
  };
}
