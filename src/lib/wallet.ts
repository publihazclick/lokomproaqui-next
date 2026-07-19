import { supabase } from './supabase';

// Port 1:1 de WalletService (Angular, src/app/servicesComponents/wallet.service.ts) -- billetera
// prepago 'dropshipper' que cubre el flete de los pedidos de Dropshipping/Muestra.

export const SALDO_MINIMO_DROPSHIPPING = 50000;

export async function getBalanceDropshipper(profileId: string): Promise<number> {
  if (!profileId) return 0;
  const { data, error } = await supabase.from('wallet_balances').select('balance').eq('profile_id', profileId).eq('wallet_type', 'dropshipper').maybeSingle();
  if (error) return 0;
  return data?.balance || 0;
}

export async function createTopup(profileId: string, amount: number, code: string): Promise<boolean> {
  const { error } = await supabase.from('wallet_topups').insert({ profile_id: profileId, amount, code, status: 0 });
  return !error;
}

export async function getTopupStatus(code: string): Promise<{ status: number } | null> {
  const { data, error } = await supabase.from('wallet_topups').select('status').eq('code', code).maybeSingle();
  if (error || !data) return null;
  return { status: data.status };
}

// Port de RechargeService.get() -- paquetes de recarga fijos configurados por el admin.
export interface PaqueteRecarga {
  id: number;
  titulo: string;
  precio: number;
}

export async function fetchPaquetesRecarga(): Promise<PaqueteRecarga[]> {
  const { data, error } = await supabase.from('recharge_products').select('id, title, price').eq('status', 1).order('id');
  if (error || !data) return [];
  return data.map((r) => ({ id: r.id, titulo: r.title, precio: r.price }));
}

// Port de WalletService.getLedger -- historial SOLO de la billetera 'dropshipper' (fletes), nunca
// ganancias/comisiones (esas viven en 'referral'/'supplier').
export interface MovimientoLedger {
  id: number;
  kind: string | null;
  direction: number;
  amount: number;
  createdAt: string;
}

export async function fetchLedgerDropshipper(profileId: string): Promise<MovimientoLedger[]> {
  const { data, error } = await supabase
    .from('wallet_ledger')
    .select('id, kind, direction, amount, created_at')
    .eq('profile_id', profileId)
    .eq('wallet_type', 'dropshipper')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) return [];
  return data.map((m: any) => ({ id: m.id, kind: m.kind, direction: m.direction, amount: m.amount, createdAt: m.created_at }));
}
