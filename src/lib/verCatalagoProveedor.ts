import { supabase } from './supabase';
import { mapProductToLegacy, type ProductoLegacy } from './productos';

// Port de VerCatalagoProveedorComponent (Angular, "Explorar Bodegas" -- landing de descubrimiento
// con 4 secciones curadas). Bugs reales corregidos (no replicados):
// 1) 3 de las 4 secciones (Tendencia/Recomendados/Rentables) armaban su filtro con
//    `pro_usu_creacion: {'!=': 1}` -- un ID NUMERICO viejo (pre-migracion, cuando los perfiles
//    tenian ids enteros) comparado contra `owner_profile_id`, que ahora es un UUID. Ese filtro
//    nunca pudo matchear nada real ni antes ni ahora (ProductoService.get() tampoco sabe
//    interpretar el objeto `{'!=':...}` de todos modos) -- en produccion HOY las 3 secciones estan
//    siempre vacias. Como no existe ya el concepto de "excluir el id 1", se quita el filtro entero
//    (equivalente real a como quedaria "arreglado": ningun producto real tiene owner_profile_id=1).
// 2) "Proveedores Destacados" filtraba con `where.rolName:'proveedor'`, que
//    `UsuariosService.get()` nunca soporto -- mostraba usuarios de cualquier rol. Se corrige
//    filtrando de verdad por `roles.name = 'proveedor'`.

const PRODUCT_SELECT = '*, categories:categories!products_category_id_fkey(id, name), product_variants(*, sizes(name))';

async function fetchCurados(orderBy: string, ascending: boolean): Promise<ProductoLegacy[]> {
  const { data } = await supabase.from('products').select(PRODUCT_SELECT).eq('active', true).order(orderBy, { ascending }).limit(4);
  return (data || []).map((p) => mapProductToLegacy(p));
}

export const fetchTendencia = () => fetchCurados('created_at', true);
export const fetchRecomendados = () => fetchCurados('distributor_price', true);
export const fetchRentables = () => fetchCurados('created_at', false);

export interface ProveedorDestacado {
  id: string;
  foto: string | null;
}

export async function fetchProveedoresDestacados(): Promise<ProveedorDestacado[]> {
  // Mismo filtro de aprobacion que fetchTiendasProveedor (lib/bodega.ts, migracion 063) -- se habia
  // quedado sin el al construir esa migracion, un proveedor recien registrado sin revisar podia
  // aparecer destacado aca.
  const { data } = await supabase.from('profiles').select('id, avatar_url, roles!inner(name)').eq('roles.name', 'proveedor').eq('supplier_status', 'aprobado').limit(4);
  return (data || []).map((p) => ({ id: p.id, foto: p.avatar_url }));
}
