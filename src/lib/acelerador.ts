import { supabase } from './supabase';

// Port 1:1 de AceleradorService (Angular) -- ya estaba bien implementado en Supabase (RPC
// `acelerador_has_access`, tablas `acelerador_modules`/`acelerador_lessons`/`acelerador_payments`,
// Edge Function `acelerador-signed-url`, ya desplegadas desde el panel del mentor de Fase 2), sin
// bugs reales -- se porta directo.

export interface Leccion {
  id: number;
  moduleId: number;
  titulo: string;
  descripcion: string | null;
  ordenamiento: number;
  duracionSegundos: number | null;
  thumbnailUrl: string | null;
  moduloTitulo?: string;
}

export interface ModuloConLecciones {
  id: number;
  titulo: string;
  lecciones: Leccion[];
}

export async function fetchModulosConLecciones(): Promise<ModuloConLecciones[]> {
  const [{ data: modules }, { data: lessons }] = await Promise.all([
    supabase.from('acelerador_modules').select('*').order('sort_order'),
    supabase.from('acelerador_lessons').select('id, module_id, title, description, sort_order, thumbnail_url, duration_seconds').order('sort_order'),
  ]);
  if (!modules) return [];
  return modules.map((m: any) => ({
    id: m.id,
    titulo: m.title,
    lecciones: (lessons || [])
      .filter((l: any) => l.module_id === m.id)
      .map((l: any) => ({
        id: l.id,
        moduleId: l.module_id,
        titulo: l.title,
        descripcion: l.description,
        ordenamiento: l.sort_order,
        duracionSegundos: l.duration_seconds,
        thumbnailUrl: l.thumbnail_url,
      })),
  }));
}

export async function tieneAccesoAcelerador(profileId: string): Promise<boolean> {
  if (!profileId) return false;
  const { data, error } = await supabase.rpc('acelerador_has_access', { p_profile_id: profileId });
  if (error) return false;
  return !!data;
}

export async function crearIntentoPago(profileId: string, amount: number, code: string): Promise<boolean> {
  const { error } = await supabase.from('acelerador_payments').insert({ profile_id: profileId, amount, code, status: 0 });
  return !error;
}

export async function fetchEstadoPago(code: string): Promise<{ status: number } | null> {
  const { data, error } = await supabase.from('acelerador_payments').select('status').eq('code', code).maybeSingle();
  if (error || !data) return null;
  return { status: data.status };
}

export async function fetchUrlFirmadaLeccion(lessonId: number): Promise<{ success: boolean; url?: string; message?: string }> {
  const { data, error } = await supabase.functions.invoke('acelerador-signed-url', { body: { lesson_id: lessonId } });
  if (error || !data || data.error) return { success: false, message: (data && data.error) || 'No pudimos cargar el video' };
  return { success: true, url: data.url };
}

// Pedido explicito del usuario 2026-07-19: el rol "lider general" necesita un apartado que solo
// muestre a quienes YA pagaron el curso Acelerador (activos y vencidos) para hacerles seguimiento
// personalizado -- distinto de "Referidos", que muestra vendedores en general sin importar si
// pagaron el curso o no.
//
// El pago de $37 USD es en realidad una RENOVACION de 30 dias (no un pago unico de por vida) -- ver
// acelerador_subscriptions.current_period_end, ya calculado por acelerador_extend_subscription()
// (llamado desde el webhook de ePayco en cada pago confirmado). No hace falta ninguna columna
// nueva, "activo" vs "vencido" ya existe: current_period_end > ahora.
//
// Se usa profiles como tabla base (no acelerador_subscriptions) con !inner para que la busqueda por
// nombre/telefono funcione igual que en referidos.ts (.or() solo filtra columnas de la tabla base
// en PostgREST) -- el !inner ya garantiza que solo aparezcan perfiles que SI tienen una fila de
// suscripcion, osea que SI pagaron el curso al menos una vez.
export interface MiembroAcelerador {
  profileId: string;
  nombre: string;
  telefono: string | null;
  ciudad: string | null;
  vencimiento: string;
  activo: boolean;
}

export async function fetchMiembrosAcelerador(
  opts: { page: number; limit: number; search?: string; soloActivos?: boolean; soloVencidos?: boolean },
): Promise<{ data: MiembroAcelerador[]; count: number }> {
  const ahora = new Date().toISOString();

  let q = supabase
    .from('profiles')
    .select('id, full_name, last_name, phone, city, acelerador_subscriptions!inner(current_period_end)', { count: 'exact' })
    .order('current_period_end', { ascending: false, referencedTable: 'acelerador_subscriptions' });

  if (opts.soloActivos) q = q.gt('acelerador_subscriptions.current_period_end', ahora);
  if (opts.soloVencidos) q = q.lte('acelerador_subscriptions.current_period_end', ahora);

  if (opts.search && opts.search.trim()) {
    const s = opts.search.trim();
    q = q.or(`full_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%`);
  }

  q = q.range(opts.page * opts.limit, opts.page * opts.limit + opts.limit - 1);

  const { data, error, count } = await q;
  if (error || !data) return { data: [], count: 0 };

  const mapped: MiembroAcelerador[] = data.map((p: any) => {
    const sub = Array.isArray(p.acelerador_subscriptions) ? p.acelerador_subscriptions[0] : p.acelerador_subscriptions;
    return {
      profileId: p.id,
      nombre: [p.full_name, p.last_name].filter(Boolean).join(' ') || '(sin nombre)',
      telefono: p.phone,
      ciudad: p.city,
      vencimiento: sub?.current_period_end || '',
      activo: !!sub?.current_period_end && sub.current_period_end > ahora,
    };
  });

  return { data: mapped, count: count ?? mapped.length };
}

export function formatDuracion(segundos: number | null): string {
  if (segundos == null) return '';
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
