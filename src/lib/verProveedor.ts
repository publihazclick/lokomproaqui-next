import { supabase } from './supabase';

export interface PerfilProveedor {
  id: string;
  nombre: string; // "Bodega #N" (proveedor_numero) -- nunca referral_code/nombre real, ver bodega.ts.
  foto: string | null;
  ciudad: string | null;
}

// ── Vitrina de una tienda por referral_code (ListArticleStoreComponent, "storeProductActivated/:idStore")
// A diferencia de VerProveedorComponent (arriba, busca por id/UUID), esta pantalla identifica la
// tienda por `usu_usuario` -- que en el esquema nuevo es `profiles.referral_code`, no un id. Aca SI
// se implementa el filtro de categoria (real, `products.category_id`) -- el bug de binding roto
// era especifico de VerProveedorComponent, este componente no lo tiene.

export async function fetchPerfilProveedorPorReferralCode(referralCode: string): Promise<PerfilProveedor | null> {
  const { data, error } = await supabase.from('profiles').select('id, avatar_url, city, proveedor_numero').eq('referral_code', referralCode).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: `Bodega #${data.proveedor_numero}`, foto: data.avatar_url, ciudad: data.city };
}

// Equivalente a ProductoService.createPriceArticleFull: agrega TODOS los productos activos de esta
// tienda al catalogo propio del usuario (price_overrides), sin duplicar los que ya tenia.
export async function agregarTodosLosProductos(userId: string, storeOwnerId: string): Promise<{ success: boolean; message: string }> {
  const { data: products } = await supabase.from('products').select('id, client_sale_price').eq('owner_profile_id', storeOwnerId).eq('active', true);
  if (!products || !products.length) return { success: true, message: 'Creado exitoso' };

  const { data: existing } = await supabase.from('price_overrides').select('product_id').eq('profile_id', userId).in('product_id', products.map((p) => p.id));
  const existingIds = new Set((existing || []).map((e: any) => e.product_id));

  const rows = products.filter((p) => !existingIds.has(p.id)).map((p) => ({ product_id: p.id, profile_id: userId, price: p.client_sale_price || 0, active: true }));
  if (rows.length) await supabase.from('price_overrides').insert(rows);

  return { success: true, message: 'Se agregaron todos los productos de esta bodega' };
}
