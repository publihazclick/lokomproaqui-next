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
