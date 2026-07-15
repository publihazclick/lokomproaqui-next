import { supabase } from './supabase';

// Port de BancosService + SupplierAccountantService (Angular) -- billetera/retiros de
// proveedores-bodega ("/config/bank/*"). BancosService ya estaba bien implementado (cuentas
// bancarias). SupplierAccountantService (pagos/retiros) tenia un hueco real de negocio: nunca
// descontaba wallet_balances tipo 'supplier' -- corregido con el RPC `process_supplier_payout`
// (migracion 034), que aprueba el pago Y descuenta la billetera de forma atomica.
//
// Alcance recortado y documentado: `ProductoService.getVentaCompleteEarningBuy` (Angular) es un
// no-op confirmado (`return {total:0,data:[],count:0}`, comentario del propio archivo: "concepto
// muy especifico del backend viejo sin dato equivalente todavia") -- se omite esa tarjeta
// ("Ganancia por flete de compra") en vez de mostrar un $0 fijo sin sentido.
// `ProductoService.getVentaComplete` (usado para el monto total disponible) YA fue simplificado en
// el propio Angular a devolver solo `total` (el saldo real de wallet_balances tipo 'supplier'), sin
// desglose de transacciones (`data` siempre vacio) -- se replica ese mismo alcance real, no se
// reconstruye un desglose que ya no existe en el backend.

export interface CuentaBancaria {
  id: number;
  banco: string;
  numeroCuenta: string;
  tipoCuenta: string;
  cedula: string;
  nombreTitular: string;
}

function mapCuenta(b: any): CuentaBancaria {
  return { id: b.id, banco: b.bank_name, numeroCuenta: b.account_number, tipoCuenta: b.account_type, cedula: b.id_number, nombreTitular: b.account_holder_name };
}

export async function fetchCuentasBancarias(userId: string): Promise<CuentaBancaria[]> {
  const { data, error } = await supabase.from('banks').select('*').eq('profile_id', userId);
  if (error || !data) return [];
  return data.map(mapCuenta);
}

export async function crearCuentaBancaria(userId: string, data: { banco: string; numeroCuenta: string; tipoCuenta: string; cedula: string; nombreTitular: string }): Promise<boolean> {
  const { error } = await supabase.from('banks').insert({
    profile_id: userId,
    bank_name: data.banco,
    account_number: data.numeroCuenta,
    account_type: data.tipoCuenta,
    id_number: data.cedula,
    account_holder_name: data.nombreTitular,
  });
  return !error;
}

export async function eliminarCuentaBancaria(id: number): Promise<boolean> {
  const { error } = await supabase.from('banks').delete().eq('id', id);
  return !error;
}

// Saldo real disponible del proveedor (wallet_balances tipo 'supplier').
export async function fetchSaldoProveedor(userId: string): Promise<number> {
  const { data } = await supabase.from('wallet_balances').select('balance').eq('profile_id', userId).eq('wallet_type', 'supplier').maybeSingle();
  return (data && data.balance) || 0;
}

export interface PagoProveedor {
  id: number;
  userId: string;
  bankId: number | null;
  monto: number;
  fechaPago: string | null;
  estado: number; // 0 pendiente, 1 pagado
  foto: string | null;
}

function mapPago(p: any): PagoProveedor {
  return { id: p.id, userId: p.profile_id, bankId: p.bank_id, monto: p.amount, fechaPago: p.paid_at, estado: p.state, foto: p.receipt_photo_url };
}

export async function fetchPagosProveedor(userId?: string, estado?: number): Promise<PagoProveedor[]> {
  let q = supabase.from('supplier_payouts').select('*').order('created_at', { ascending: false });
  if (userId) q = q.eq('profile_id', userId);
  if (estado !== undefined) q = q.eq('state', estado);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(mapPago);
}

// Crea la solicitud de retiro por el saldo actual completo (mismo criterio que Cobros: se pide
// todo el saldo disponible, no un monto parcial).
export async function solicitarRetiroProveedor(userId: string, bankId: number, monto: number): Promise<{ success: boolean; message?: string }> {
  if (!monto || monto <= 0) return { success: false, message: 'No tienes saldo disponible para retirar' };
  const { error } = await supabase.from('supplier_payouts').insert({ profile_id: userId, bank_id: bankId, amount: monto, state: 0 });
  if (error) return { success: false, message: 'No se pudo confirmar el retiro' };
  return { success: true };
}

// Items de venta ya vinculados a un pago (order_items.supplier_payout_id) -- solo tiene datos
// reales para pagos YA aprobados con este mecanismo nuevo.
export interface ItemPago {
  id: number;
  nombreProducto: string;
  talla: string | null;
  color: string | null;
  cantidad: number;
  gananciaVendedor: number;
}

export async function fetchItemsPago(payoutId: number): Promise<ItemPago[]> {
  const { data, error } = await supabase.from('order_items').select('*, products(name)').eq('supplier_payout_id', payoutId);
  if (error || !data) return [];
  return data.map((i: any) => ({
    id: i.id,
    nombreProducto: i.products ? i.products.name : i.title,
    talla: i.size,
    color: i.color,
    cantidad: i.quantity,
    gananciaVendedor: i.total_cost || 0,
  }));
}

// Aprobar un pago: sube el comprobante y llama al RPC que descuenta la billetera de verdad
// (migracion 034_process_supplier_payout.sql).
export async function aprobarPagoProveedor(payoutId: number, fotoComprobante: string): Promise<{ success: boolean; message?: string }> {
  const { error } = await supabase.rpc('process_supplier_payout', { p_payout_id: payoutId, p_receipt_photo_url: fotoComprobante });
  if (error) return { success: false, message: error.message?.includes('saldo_insuficiente') ? 'El proveedor ya no tiene saldo suficiente para este pago' : 'No se pudo aprobar el pago' };
  return { success: true };
}

// ── Vista admin (VendorPaymentsComponent, "/config/adminF/vendorpayment") ──────────────────────
// Mismos datos que fetchPagosProveedor, con el proveedor y su cuenta bancaria unidos para mostrar
// en la tabla admin. El selector de proveedor/busqueda del original (getSeller/handleSelectShop)
// es codigo muerto -- los handlers estan vacios en el Angular original (solo un console.log
// comentado), no se porta.

export interface PagoProveedorAdmin extends PagoProveedor {
  proveedorNombre: string | null;
  bancoNombre: string | null;
  bancoNumeroCuenta: string | null;
}

export async function fetchPagosProveedorAdmin(estado?: number): Promise<PagoProveedorAdmin[]> {
  let q = supabase.from('supplier_payouts').select('*, profiles(full_name), banks(bank_name, account_number)').order('created_at', { ascending: false }).limit(200);
  if (estado !== undefined) q = q.eq('state', estado);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((p: any) => ({
    ...mapPago(p),
    proveedorNombre: p.profiles ? p.profiles.full_name : null,
    bancoNombre: p.banks ? p.banks.bank_name : null,
    bancoNumeroCuenta: p.banks ? p.banks.account_number : null,
  }));
}

export async function subirComprobantePago(file: File): Promise<string | null> {
  const ext = (file.name || 'jpg').split('.').pop();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('lokomproaqui-media').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('lokomproaqui-media').getPublicUrl(path);
  return data.publicUrl;
}
