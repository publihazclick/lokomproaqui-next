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

export async function debitWalletDropshipper(profileId: string, amount: number, orderId: number, kind = 'flete_pedido'): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.rpc('debit_wallet', {
    p_profile_id: profileId,
    p_wallet_type: 'dropshipper',
    p_amount: amount,
    p_order_id: orderId,
    p_kind: kind,
  });
  if (error) {
    const msg = error.message && error.message.includes('saldo_insuficiente')
      ? 'Saldo insuficiente en tu billetera, recarga para continuar'
      : 'No pudimos procesar el pago con tu billetera';
    return { success: false, message: msg };
  }
  return { success: true };
}

export async function refundWalletDropshipper(profileId: string, amount: number, orderId: number, kind = 'flete_cancelado'): Promise<boolean> {
  const { error } = await supabase.rpc('credit_wallet', {
    p_profile_id: profileId,
    p_wallet_type: 'dropshipper',
    p_amount: amount,
    p_order_id: orderId,
    p_pct: null,
    p_kind: kind,
  });
  return !error;
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
