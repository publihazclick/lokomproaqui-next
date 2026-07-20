import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';

// Port de StoreComponent + MyProductsComponent (Angular, modulo lazy "bodega" -> "/config/store/*").
// UsuariosService.getStore() y ProductoService.getPriceArticle/updatePriceArticle ya estaban bien
// implementados en Supabase, sin bugs reales -- se portan 1:1.
//
// Alcance recortado: `/config/store/product[/:idStore]` (ProductsComponent) es un wrapper vacio
// que solo embebe `<app-list-article-store>` -- EL MISMO componente ya portado en Fase 3 como
// `/listproduct[/:idStore]`. No se duplica esa pantalla bajo una URL distinta. `/config/store/index`
// (IndexComponent) es una version mas chica del ya portado `/config/verCatalagoProveedor`
// (mismas 2 secciones: bodegas destacadas + productos certificados) -- se redirige ahi en vez de
// reconstruir un duplicado casi identico.

export interface TiendaProveedor {
  id: string;
  nombre: string | null;
  telefono: string | null;
  ciudad: string | null;
  foto: string | null;
  referralCode: string | null;
}

export async function fetchTiendasProveedor(search: string, page: number, limit: number): Promise<{ data: TiendaProveedor[]; count: number }> {
  // Aprobacion de proveedores (migracion 063, pedido explicito del usuario 2026-07-20): solo
  // aparecen bodegas con supplier_status='aprobado' -- antes cualquier proveedor recien registrado
  // (sin ningun producto siquiera) ya aparecia aca de inmediato.
  let q = supabase.from('profiles').select('*, roles!inner(name)', { count: 'exact' }).eq('roles.name', 'proveedor').eq('supplier_status', 'aprobado');
  if (search.trim()) {
    const term = search.trim();
    q = q.or(`full_name.ilike.%${term}%,phone.ilike.%${term}%,city.ilike.%${term}%,referral_code.ilike.%${term}%`);
  }
  q = q.range(page * limit, page * limit + limit - 1);
  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };
  return {
    data: data.map((p: any) => ({ id: p.id, nombre: p.full_name, telefono: p.phone, ciudad: p.city, foto: p.avatar_url, referralCode: p.referral_code })),
    count: count ?? data.length,
  };
}

export interface MiProductoTienda {
  priceOverrideId: number;
  precio: number;
  producto: ProductoLegacy;
}

export async function fetchMisProductosTienda(userId: string, page: number, limit: number): Promise<{ data: MiProductoTienda[]; count: number }> {
  const PRODUCT_SELECT = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';
  const { data, error, count } = await supabase
    .from('price_overrides')
    .select(`*, products(${PRODUCT_SELECT})`, { count: 'exact' })
    .eq('profile_id', userId)
    .eq('active', true)
    .range(page * limit, page * limit + limit - 1);
  if (error || !data) return { data: [], count: 0 };
  const mapped = data.filter((r: any) => r.products).map((r: any) => ({ priceOverrideId: r.id, precio: r.price, producto: mapProductToLegacy(r.products, r.price) }));
  return { data: mapped, count: count ?? mapped.length };
}

export async function eliminarProductoDeTienda(priceOverrideId: number): Promise<boolean> {
  const { error } = await supabase.from('price_overrides').update({ active: false }).eq('id', priceOverrideId);
  return !error;
}
