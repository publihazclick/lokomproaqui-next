import { supabase } from './supabase';
import { fetchProductos, type ProductoLegacy } from './productos';

// Port de VerProveedorComponent (Angular, "Ver detalles" de un proveedor especifico -- vitrina de
// su catalogo). `UsuariosService.get({where:{id}})` y `ProductoService.get()` (filtro por
// pro_usu_creacion/busqueda) ya estaban bien conectados, se porta 1:1.
//
// El selector de categoria del original tiene un bug real (no corregido aca porque no hace falta:
// `value="item.id"` es un STRING LITERAL en vez de un binding `[value]`, asi que ese filtro nunca
// funciono ni en produccion -- se omite el select roto, se deja solo la busqueda de texto real.

export interface PerfilProveedor {
  id: string;
  nombre: string | null;
  foto: string | null;
  ciudad: string | null;
}

export async function fetchPerfilProveedor(id: string): Promise<PerfilProveedor | null> {
  const { data, error } = await supabase.from('profiles').select('id, referral_code, avatar_url, city').eq('id', id).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: data.referral_code, foto: data.avatar_url, ciudad: data.city };
}

export async function fetchCatalogoProveedor(proveedorId: string, search: string, page: number, limit: number): Promise<{ data: ProductoLegacy[]; count: number }> {
  return fetchProductos({ ownerProfileId: proveedorId, search, page, limit });
}

// ── Vitrina de una tienda por referral_code (ListArticleStoreComponent, "storeProductActivated/:idStore")
// A diferencia de VerProveedorComponent (arriba, busca por id/UUID), esta pantalla identifica la
// tienda por `usu_usuario` -- que en el esquema nuevo es `profiles.referral_code`, no un id. Aca SI
// se implementa el filtro de categoria (real, `products.category_id`) -- el bug de binding roto
// era especifico de VerProveedorComponent, este componente no lo tiene.

export async function fetchPerfilProveedorPorReferralCode(referralCode: string): Promise<PerfilProveedor | null> {
  const { data, error } = await supabase.from('profiles').select('id, referral_code, avatar_url, city').eq('referral_code', referralCode).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: data.referral_code, foto: data.avatar_url, ciudad: data.city };
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
