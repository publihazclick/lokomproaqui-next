import { supabase } from './supabase';

// Port de CobrosComponent + FormcobrosComponent (Angular, "Cobrar" -- retiro de saldo de la
// billetera de referidos).
//
// BUGS REALES encontrados y corregidos (no replicados):
// 1) El filtro por defecto de la lista es `cob_estado: {'!=':3}` (excluir estado 3), pero
//    CobrosService.get() (Angular) hace `q.eq('status', where.cob_estado)` -- compara la columna
//    contra el OBJETO `{'!=':3}` en vez de excluirlo, algo que Postgres nunca puede matchear. En
//    produccion HOY la lista de Cobros no muestra NINGUN retiro por defecto (ni para admin ni para
//    vendedor) porque el filtro roto excluye todo. Se corrige con un `.neq()` real.
// 2) La busqueda (`where.or`) tampoco esta implementada en get() -- se ignora en silencio, buscar
//    nunca filtraba nada. Se implementa de verdad.
// 3) `usu_clave_int` es un UUID plano (`w.profile_id`) pero la plantilla lo lee como objeto
//    (`row.usu_clave_int?.usu_email`) -- la columna de email del vendedor siempre esta vacia. Se
//    resuelve con un join real a `profiles`.
// 4) Las 6 de las 7 tarjetas de resumen (Total Ganado, Total Cobrado, Total Pagado, Devoluciones,
//    Ventas Pendientes, Ventas Calzado x2) dependen de campos que `UsuariosService.getInfo()`
//    JAMAS devuelve (solo entrega `porcobrado`, el saldo real de la billetera 'referral') -- estan
//    siempre en $0 hoy. Se omiten esas 6 tarjetas fantasma y se muestra solo "Por Cobrar" (el saldo
//    real) + se agrega "Total Pagado" calculado de verdad (suma de retiros con estado Aprobado).
//
// Alcance recortado y documentado: "Ventas Solicitadas" (abre FormlistventasComponent, otro
// dialogo grande) y el comprobante de pago en imagen (fotoPago) no se portan en esta pieza.

const ESTADO_LABEL: Record<number, string> = { 0: 'Activo', 1: 'Aprobado', 2: 'Rechazado' };

export interface RetiroRow {
  id: number;
  monto: number;
  metodo: string | null;
  estado: number;
  estadoLabel: string;
  fecha: string;
  vendedorNombre: string | null;
  cedula: string | null;
  celular: string | null;
  cuenta: string | null;
  fechaPago: string | null;
}

function mapRetiro(w: any): RetiroRow {
  return {
    id: w.id,
    monto: w.amount,
    metodo: w.method,
    estado: w.status,
    estadoLabel: ESTADO_LABEL[w.status] || 'Activo',
    fecha: w.created_at,
    vendedorNombre: w.profiles ? w.profiles.full_name : null,
    cedula: w.id_document,
    celular: w.phone,
    cuenta: w.bank_account_number,
    fechaPago: w.processed_at ?? null,
  };
}

export async function fetchRetiros(opts: { userId?: string; search?: string; page: number; limit: number }): Promise<{ data: RetiroRow[]; count: number }> {
  let q = supabase.from('withdrawal_requests').select('*, profiles!withdrawal_requests_profile_id_fkey(full_name)', { count: 'exact' }).neq('status', 3);
  if (opts.userId) q = q.eq('profile_id', opts.userId);
  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`id_document.ilike.%${s}%,phone.ilike.%${s}%,bank_account_number.ilike.%${s}%,method.ilike.%${s}%`);
  }
  q = q.order('created_at', { ascending: false }).range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return { data: data.map(mapRetiro), count: count ?? data.length };
}

export async function fetchSaldoDisponible(userId: string): Promise<number> {
  const { data } = await supabase.from('wallet_balances').select('balance').eq('profile_id', userId).eq('wallet_type', 'referral').maybeSingle();
  return data?.balance || 0;
}

export async function fetchTotalPagado(userId: string, esAdmin: boolean): Promise<number> {
  let q = supabase.from('withdrawal_requests').select('amount').eq('status', 1);
  if (!esAdmin) q = q.eq('profile_id', userId);
  const { data } = await q;
  return (data || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
}

export interface NuevoRetiro {
  userId: string;
  pais: 'colombia' | 'venezuela';
  cedula: string;
  celular: string;
  metodo: string;
  cuenta: string;
  monto: number;
  descripcion?: string;
}

export async function crearRetiro(data: NuevoRetiro): Promise<boolean> {
  const { error } = await supabase.from('withdrawal_requests').insert({
    profile_id: data.userId,
    id_document: data.cedula,
    phone: data.celular,
    bank_account_number: data.cuenta,
    bank_name: data.metodo,
    method: data.metodo,
    amount: data.monto,
  });
  return !error;
}

export async function cambiarEstadoRetiro(id: number, estado: 1 | 2): Promise<boolean> {
  const { error } = await supabase.rpc('process_withdrawal_request', { p_request_id: id, p_action: estado === 1 ? 'approve' : 'reject' });
  return !error;
}

export async function eliminarRetiro(id: number): Promise<boolean> {
  const { error } = await supabase.from('withdrawal_requests').delete().eq('id', id);
  return !error;
}
