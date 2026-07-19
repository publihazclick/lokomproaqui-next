import { supabase } from './supabase';

// Fase 4 del plan de reduccion de devoluciones (pedido explicito del usuario 2026-07-19): dashboard
// admin con las causas reales de devolucion (Fase 0) y el ranking de vendedores/productos con tasa
// de devolucion alta (Fase 1) -- alimenta las decisiones de que apretar despues. Todo lee de vistas
// en vivo (migraciones 050-052), sin tabla propia que mantener.

export interface ResumenGlobal {
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
}

export async function fetchResumenGlobal(): Promise<ResumenGlobal> {
  const { count: totalOrders } = await supabase.from('orders').select('id', { count: 'exact', head: true }).in('status', ['success', 'rejected']);
  const { count: totalReturns } = await supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'rejected');
  const total = totalOrders || 0;
  const returns = totalReturns || 0;
  return { totalOrders: total, totalReturns: returns, returnRate: total > 0 ? returns / total : 0 };
}

export const MOTIVO_LABEL: Record<string, string> = {
  no_contesto: 'Cliente no contestó',
  no_encontrado: 'No lo encontraron / no estaba',
  se_arrepintio: 'Cliente se arrepintió',
  direccion_invalida: 'Dirección incorrecta',
  producto_no_esperado: 'Producto no era lo esperado',
  fraude_sospechado: 'Pedido falso / broma',
  otro: 'Otro motivo',
  sin_clasificar: 'Sin clasificar',
};

export interface MotivoDevolucionStat {
  motivo: string;
  total: number;
}

export async function fetchMotivosDevolucion(): Promise<MotivoDevolucionStat[]> {
  const { data, error } = await supabase.from('return_reason_stats').select('return_reason, total').order('total', { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => ({ motivo: r.return_reason, total: r.total }));
}

export interface RankingVendedor {
  sellerId: string;
  nombre: string;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
}

// Solo vendedores con minimo 3 pedidos resueltos -- evita mostrar arriba del ranking a alguien con
// 1 solo pedido y 1 devolucion (100% de una muestra de 1 no dice nada real).
const MINIMO_PEDIDOS_RANKING = 3;

export async function fetchRankingVendedores(limite = 10): Promise<RankingVendedor[]> {
  const { data, error } = await supabase
    .from('seller_return_stats')
    .select('seller_id, total_orders, total_returns, return_rate')
    .gte('total_orders', MINIMO_PEDIDOS_RANKING)
    .order('return_rate', { ascending: false })
    .limit(limite);
  if (error || !data || !data.length) return [];

  const ids = data.map((r: any) => r.seller_id);
  const { data: perfiles } = await supabase.from('profiles').select('id, full_name, last_name').in('id', ids);
  const nombres = new Map((perfiles || []).map((p: any) => [p.id, `${p.full_name || ''} ${p.last_name || ''}`.trim() || 'Vendedor']));

  return data.map((r: any) => ({
    sellerId: r.seller_id,
    nombre: nombres.get(r.seller_id) || 'Vendedor',
    totalOrders: r.total_orders,
    totalReturns: r.total_returns,
    returnRate: r.return_rate,
  }));
}

export interface RankingProducto {
  productId: number;
  titulo: string;
  totalOrders: number;
  totalReturns: number;
  returnRate: number;
}

export async function fetchRankingProductos(limite = 10): Promise<RankingProducto[]> {
  const { data, error } = await supabase
    .from('product_return_stats')
    .select('product_id, product_title, total_orders, total_returns, return_rate')
    .gte('total_orders', MINIMO_PEDIDOS_RANKING)
    .order('return_rate', { ascending: false })
    .limit(limite);
  if (error || !data) return [];
  return data.map((r: any) => ({
    productId: r.product_id,
    titulo: r.product_title || `Producto #${r.product_id}`,
    totalOrders: r.total_orders,
    totalReturns: r.total_returns,
    returnRate: r.return_rate,
  }));
}
