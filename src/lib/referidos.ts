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
  // Sistema de comisiones multinivel (pedido explicito del usuario 2026-07-21): entregas exitosas
  // de ESTE perfil como vendedor en el mes calendario en curso -- es el numero que determina si
  // su upline cobra comision por sus ventas (minimo real en referral_commission_config, mostrado
  // aca de forma informativa/transparente).
  entregasMes: number;
}

const SELECT = `
  id, full_name, last_name, phone, city, status, created_at,
  referrer:referrer_id(full_name),
  seller_tiers(name)
`;

// Batched (una sola llamada RPC, no N+1) -- ver fetch_entregas_mes, migracion 071. Necesario a la
// escala de la plataforma (10k+ vendedores), no se puede hacer una consulta por fila.
async function fetchEntregasMesPorId(ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {};
  const { data } = await supabase.rpc('fetch_entregas_mes', { p_profile_ids: ids });
  const mapa: Record<string, number> = {};
  for (const row of (data as any[]) || []) mapa[row.profile_id] = Number(row.entregas_mes) || 0;
  return mapa;
}

// Comision total acreditada este mes calendario a este perfil (suma de wallet_ledger,
// wallet_type='referral', kind del sistema de comisiones multinivel -- ver migracion 069).
export async function fetchComisionMesActual(profileId: string): Promise<number> {
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from('wallet_ledger')
    .select('amount')
    .eq('profile_id', profileId)
    .eq('wallet_type', 'referral')
    .like('kind', 'comision_nivel_%')
    .gte('created_at', inicioMes.toISOString());
  return (data || []).reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
}

// Ids COMPLETOS de un nivel (sin paginar) -- necesarios para encadenar al siguiente nivel. Si se
// usaran solo las filas ya cargadas en pantalla (paginadas), un vendedor con mas de LIMIT referidos
// directos perderia en silencio los descendientes de los que aun no se han "cargado mas".
export async function fetchIdsReferidosNivel(referrerIds: string[]): Promise<string[]> {
  if (!referrerIds.length) return [];
  const { data } = await supabase.from('profiles').select('id').in('referrer_id', referrerIds);
  return (data || []).map((p: any) => p.id);
}

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

  const entregasPorId = await fetchEntregasMesPorId(data.map((p: any) => p.id));
  const mapped: ReferidoRow[] = data.map((p: any) => ({
    id: p.id,
    nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)',
    liderNombre: p.referrer ? p.referrer.full_name : null,
    telefono: p.phone,
    ciudad: p.city,
    nivelVendedor: p.seller_tiers ? p.seller_tiers.name : null,
    fechaRegistro: p.created_at,
    activo: p.status !== 0,
    entregasMes: entregasPorId[p.id] || 0,
  }));

  return { data: mapped, count: count ?? mapped.length };
}

// Pedido explicito del usuario 2026-07-19: el rol "lider general" (vendedor normal + esta unica
// funcion extra, ver profiles.es_lider_general) necesita ver a TODOS los vendedores registrados en
// la plataforma aca, no solo su propia cadena de referidos -- es el encargado de la empresa que
// contacta a cualquier vendedor registrado (se haya registrado con su link o no) para enseñarle a
// vender. Mismo shape de fila / paginacion / busqueda que fetchReferidosNivel, pero sin filtrar por
// referrer_id -- filtra por role_id = 'vendedor' en su lugar (no tiene sentido mostrar aca
// administradores o proveedores, este es un directorio de vendedores para hacer seguimiento).
export async function fetchTodosLosVendedores(
  opts: { page: number; limit: number; search?: string },
): Promise<{ data: ReferidoRow[]; count: number }> {
  const { data: rolVendedor } = await supabase.from('roles').select('id').eq('name', 'vendedor').single();
  if (!rolVendedor) return { data: [], count: 0 };

  let q = supabase
    .from('profiles')
    .select(SELECT, { count: 'exact' })
    .eq('role_id', rolVendedor.id)
    .order('created_at', { ascending: false });

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`full_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };

  const entregasPorId = await fetchEntregasMesPorId(data.map((p: any) => p.id));
  const mapped: ReferidoRow[] = data.map((p: any) => ({
    id: p.id,
    nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)',
    liderNombre: p.referrer ? p.referrer.full_name : null,
    telefono: p.phone,
    ciudad: p.city,
    nivelVendedor: p.seller_tiers ? p.seller_tiers.name : null,
    fechaRegistro: p.created_at,
    activo: p.status !== 0,
    entregasMes: entregasPorId[p.id] || 0,
  }));

  return { data: mapped, count: count ?? mapped.length };
}
