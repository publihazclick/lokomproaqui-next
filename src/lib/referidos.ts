import { supabase } from './supabase';

// Port de ReferidosComponent (Angular, src/app/dashboard-config/components/referidos) -- "Mis
// Referidos", arbol de 5 niveles de downline (cada pestaña = un nivel, filtrado por los ids de la
// pestaña anterior).
//
// BUG REAL DE PRODUCCION ENCONTRADO (2026-07-15, corregido aca, no replicado): UsuariosService.get()
// (Angular, ya en Supabase) NUNCA soporto el filtro `where.cabeza` (referrer_id) ni `where.or`
// (busqueda) ni paginacion -- las 3 cosas que esta pantalla necesita. En la practica, HOY en
// produccion, "Mis Referidos" ignora el filtro por completo y devuelve TODOS los perfiles de la
// plataforma sin paginar, en las 5 pestañas, para cualquier usuario logueado -- cualquier vendedor
// puede ver nombre/telefono/ciudad de TODOS los demas usuarios, no solo los suyos. Es una fuga de
// datos real, no solo un bug cosmetico -- se corrige aca en vez de portarse tal cual (mismo
// criterio que la correccion de /config/perfil: no reproducir un bug real cuando se puede evitar).
//
// Interpretaciones nuevas donde el original ya estaba roto/vacio (documentadas, no eran
// funcionales de ninguna forma antes):
// - "lider" (columna 2): antes leia `row.cabeza.usu_nombre`, pero `cabeza` era un UUID plano
//   (nunca un objeto) -- siempre vacio. Aca se resuelve con un join real al perfil del referente.
// - "Nivel" (columna 5): antes leia `row.nivel.categorias`, un campo que jamas existio en el
//   objeto mapeado -- siempre vacio. Se interpreta como la categoria/tier de vendedor
//   (`seller_tiers.name`), el dato mas cercano en espiritu ya existente en el esquema.
// - "Activo" (columna 7): antes era un ternario `pro_estado==0 ? 'Activo' : 'Activo'` -- SIEMPRE
//   mostraba "Activo" sin importar el valor real (bug de copy/paste). Se conecta a `profiles.status`
//   (0 = inactivo, resultado real de UsuariosService.delete()).
// - "Email": la version Angular ya mostraba esto siempre vacio para cualquier perfil que no fuera
//   el propio (mapProfileToLegacyUser(perfil, null) para cualquier consulta de OTRO usuario, el
//   correo vive en auth.users, no accesible desde el cliente sin service_role). Se omite la
//   columna en vez de mostrar un campo que nunca tuvo dato real.

export interface ReferidoRow {
  id: string;
  nombre: string;
  liderNombre: string | null;
  telefono: string | null;
  ciudad: string | null;
  nivelVendedor: string | null;
  fechaRegistro: string;
  activo: boolean;
}

const SELECT = `
  id, full_name, last_name, phone, city, status, created_at,
  referrer:referrer_id(full_name),
  seller_tiers(name)
`;

export async function fetchReferidosNivel(
  referrerIds: string[],
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: ReferidoRow[]; count: number }> {
  if (!referrerIds.length) return { data: [], count: 0 };

  let q = supabase
    .from('profiles')
    .select(SELECT, { count: 'exact' })
    .in('referrer_id', referrerIds)
    .order('created_at', { ascending: false });

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`full_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };

  const mapped: ReferidoRow[] = data.map((p: any) => ({
    id: p.id,
    nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)',
    liderNombre: p.referrer ? p.referrer.full_name : null,
    telefono: p.phone,
    ciudad: p.city,
    nivelVendedor: p.seller_tiers ? p.seller_tiers.name : null,
    fechaRegistro: p.created_at,
    activo: p.status !== 0,
  }));

  return { data: mapped, count: count ?? mapped.length };
}
