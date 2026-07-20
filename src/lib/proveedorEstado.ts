import { supabase } from './supabase';

// Aprobacion de la CUENTA de proveedor (pedido explicito del usuario 2026-07-20), distinta de la
// aprobacion POR PRODUCTO que ya existia (products.pending_review, ver productosAdmin.ts). Un
// proveedor recien registrado queda 'incompleto' hasta subir minimo 3 referencias de producto,
// puede entonces "enviar a revision" (enviar_proveedor_a_revision, migracion 063), y solo aparece
// en Explorar Bodegas / la galeria publica de /infoSupplier una vez el admin lo aprueba.

export const MINIMO_PRODUCTOS_PROVEEDOR = 3;

export type SupplierStatus = 'incompleto' | 'en_revision' | 'aprobado' | 'rechazado';

export interface EstadoProveedor {
  status: SupplierStatus;
  productCount: number;
  rejectionReason: string | null;
}

export async function fetchEstadoProveedor(profileId: string): Promise<EstadoProveedor | null> {
  const [{ data: profile, error }, { count }] = await Promise.all([
    supabase.from('profiles').select('supplier_status, supplier_rejection_reason').eq('id', profileId).maybeSingle(),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('owner_profile_id', profileId),
  ]);
  if (error || !profile || !profile.supplier_status) return null;
  return {
    status: profile.supplier_status,
    productCount: count ?? 0,
    rejectionReason: profile.supplier_rejection_reason,
  };
}

export async function enviarProveedorARevision(profileId: string): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.rpc('enviar_proveedor_a_revision', { p_profile_id: profileId });
  if (error) {
    const msg = error.message?.includes('minimo_3_productos')
      ? `Necesitas mínimo ${MINIMO_PRODUCTOS_PROVEEDOR} productos subidos para enviar tu cuenta a revisión`
      : 'No pudimos enviar tu cuenta a revisión, intenta de nuevo';
    return { ok: false, message: msg };
  }
  return { ok: true };
}
