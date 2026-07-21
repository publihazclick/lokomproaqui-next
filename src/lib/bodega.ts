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
  nombre: string; // "Bodega #N" (proveedor_numero) -- NUNCA el nombre real, ver nota abajo.
  ciudad: string | null;
  foto: string | null;
}

// Busqueda directa por proveedor_numero (el "id de bodega" publico, ej. "Bodega #12"), UNICA forma
// de llegar a una bodega en todo el sitio (pedido explicito del usuario 2026-07-21 -- se borro el
// directorio "Explorar Bodegas" que permitia listar/buscar por ciudad). Mismo criterio de anonimato
// proveedor<->vendedor ya establecido antes (si el vendedor identifica y contacta al proveedor,
// terminan negociando por fuera de la plataforma): nunca se expone telefono/nombre real/uuid, solo
// el numero que ya es publico en toda la UI ("Bodega #N").
export async function fetchTiendaProveedorPorNumero(numero: number): Promise<TiendaProveedor | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, city, avatar_url, proveedor_numero, roles!inner(name)')
    .eq('roles.name', 'proveedor')
    .eq('supplier_status', 'aprobado')
    .eq('proveedor_numero', numero)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, nombre: `Bodega #${data.proveedor_numero}`, ciudad: data.city, foto: data.avatar_url };
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
