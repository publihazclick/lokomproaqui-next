import { supabase } from './supabase';

// Port 1:1 de AceleradorService (Angular) -- ya estaba bien implementado en Supabase (RPC
// `acelerador_has_access`, tablas `acelerador_modules`/`acelerador_lessons`/`acelerador_payments`,
// Edge Function `acelerador-signed-url`, ya desplegadas desde el panel del mentor de Fase 2), sin
// bugs reales -- se porta directo. Los videos ya no salen de esa Edge Function: ver VIDEOS_URL.

// Precio del curso como se muestra en /info, /acelerador y el checkout (2026-11-05: pago unico,
// acceso de por vida). El monto que se cobra esta en AceleradorCheckout (PRECIO_COP).
export const PRECIO_ACELERADOR_TEXTO = '$1.600.000';

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
    supabase.from('acelerador_modules').select('id, title').order('sort_order'),
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

// Desde 2026-11-05 los videos del curso viven en Cloudflare R2, servidos por el Worker
// `lokomproaqui-videos` (repo local C:\Users\MOINS\lokomproaqui-videos): en Supabase dejaban la
// base por encima del limite gratis. El Worker hace la misma verificacion que la Edge Function
// acelerador-signed-url (suscripcion vigente o mentor) con la sesion del que llama.
export const VIDEOS_URL = 'https://lokomproaqui-videos.publihazclick-com.workers.dev';

export async function sesionParaVideos(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session ? data.session.access_token : null;
}

export async function fetchUrlFirmadaLeccion(lessonId: number): Promise<{ success: boolean; url?: string; message?: string }> {
  const sesion = await sesionParaVideos();
  if (!sesion) return { success: false, message: 'Inicia sesión para ver el video' };
  try {
    const r = await fetch(`${VIDEOS_URL}/firmar`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sesion}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lesson_id: lessonId, device_id: idAparato() }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok || !data || !data.url) return { success: false, message: (data && data.error) || 'No pudimos cargar el video' };
    return { success: true, url: data.url };
  } catch {
    return { success: false, message: 'No pudimos cargar el video' };
  }
}

// ─── Pago por transferencia (08-11-2026, curso-transferencia.sql) ─────────────────────────────
// Ya no se cobra por ePayco: el comprador transfiere a esta cuenta, sube la foto del comprobante y
// el dueño la aprueba por WhatsApp (o en Miembros Acelerador → Pagos por revisar).
export const CUENTA_PAGO_CURSO = {
  banco: 'Bancolombia',
  tipo: 'Cuenta de ahorros',
  numero: '82494071386',
  titular: 'HARLEY VERA',
  cedula: '1093767815',
};

// Achica la foto en el navegador (máx. 1400 px, JPEG) para que llegue rápido por WhatsApp.
export async function fotoComprobante(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise<HTMLImageElement>((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No se pudo leer la imagen'));
      i.src = url;
    });
    const escala = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    const ctx = lienzo.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
    ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function enviarComprobantePago(imagen: string): Promise<{ ok: boolean; referencia?: string; code?: string; error?: string }> {
  const { data, error } = await supabase.rpc('acelerador_enviar_comprobante', { p_imagen: imagen });
  if (error || !data) return { ok: false, error: 'No pudimos enviar el comprobante, intenta de nuevo' };
  return data.ok ? { ok: true, referencia: data.referencia, code: data.code } : { ok: false, error: data.error };
}

export interface PagoPendiente {
  referencia: string;
  creado: string;
  comprobante: string | null;
  nombre: string;
  telefono: string | null;
  ciudad: string | null;
}

export async function fetchPagosPendientes(): Promise<PagoPendiente[]> {
  const { data, error } = await supabase.rpc('acelerador_admin_pagos_pendientes');
  if (error || !data) return [];
  return data as PagoPendiente[];
}

export async function resolverPagoCurso(referencia: string, aprobar: boolean): Promise<boolean> {
  const { data, error } = await supabase.rpc('acelerador_admin_resolver_pago', { p_referencia: referencia, p_aprobar: aprobar });
  return !error && !!data && !!data.ok;
}

// ─── Que el curso no se pueda compartir (08-11-2026, curso-anticompartir.sql) ─────────────────
// Cada aparato nuevo necesita un código de 6 números que llega por WhatsApp (lo manda el panel del
// gamer) y vence en 2 minutos; máximo 2 aparatos por cuenta; un solo video a la vez.

// Identificador de este navegador (no es secreto: si se borra, el aparato cuenta como nuevo).
export function idAparato(): string {
  try {
    let id = localStorage.getItem('lk_aparato');
    if (!id || id.length < 16) {
      id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('lk_aparato', id);
    }
    return id;
  } catch {
    return 'sin-almacenamiento-' + navigator.userAgent.length;
  }
}

// Nombre que entiende el comprador al elegir cuál aparato quitar: "Celular Android", "Computador Windows"...
export function nombreAparato(): string {
  const ua = navigator.userAgent;
  const nav = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'navegador';
  const tipo = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Celular Android' : 'Tablet Android')
    : /Windows/.test(ua) ? 'Computador Windows' : /Mac OS X/.test(ua) ? 'Computador Mac' : /Linux/.test(ua) ? 'Computador Linux' : 'Aparato';
  return `${tipo} (${nav})`;
}

export interface AparatoRegistrado {
  id: number;
  nombre: string | null;
  creado: string;
  ultimo_uso: string;
}

export interface EstadoAparato {
  estado: 'ok' | 'nuevo' | 'lleno' | 'bloqueado' | 'sin_acceso' | 'error';
  telefono?: string | null;
  cambios_restantes?: number;
  aparatos?: AparatoRegistrado[];
}

export async function estadoAparato(): Promise<EstadoAparato> {
  const { data, error } = await supabase.rpc('acelerador_dispositivo_estado', { p_device: idAparato() });
  if (error || !data) return { estado: 'error' };
  return data as EstadoAparato;
}

export async function pedirCodigoAparato(reemplaza?: number): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('acelerador_pedir_codigo', { p_device: idAparato(), p_nombre: nombreAparato(), p_reemplaza: reemplaza ?? null });
  if (error || !data) return { ok: false, error: 'No pudimos pedir el código, intenta de nuevo' };
  return data.ok ? { ok: true } : { ok: false, error: data.error };
}

export async function verificarCodigoAparato(codigo: string): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('acelerador_verificar_codigo', { p_device: idAparato(), p_codigo: codigo });
  if (error || !data) return { ok: false, error: 'No pudimos revisar el código, intenta de nuevo' };
  return data.ok ? { ok: true } : { ok: false, error: data.error };
}

// Un solo video a la vez: tomar=true al dar play; los latidos responden 'otro' si otro aparato tomó la cuenta.
export async function latidoVideo(lessonId: number, tomar: boolean): Promise<'ok' | 'otro'> {
  const { data, error } = await supabase.rpc('acelerador_latido', { p_device: idAparato(), p_lesson: lessonId, p_tomar: tomar });
  if (error) return 'ok'; // si falla la red no se corta la clase
  return data === 'otro' ? 'otro' : 'ok';
}

// Panel "Miembros Acelerador": aparatos, ciudades, bloquear y reiniciar aparatos.
export interface SeguridadMiembro {
  bloqueado: boolean;
  aparatos: { nombre: string | null; creado: string; ultimo_uso: string }[];
  ciudades: { ciudad: string; ultima: string; veces: number }[];
}

export async function fetchSeguridadMiembro(profileId: string): Promise<SeguridadMiembro | null> {
  const { data, error } = await supabase.rpc('acelerador_admin_miembro', { p_profile: profileId });
  if (error || !data) return null;
  return data as SeguridadMiembro;
}

export async function bloquearMiembro(profileId: string, bloquear: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('acelerador_admin_bloquear', { p_profile: profileId, p_bloquear: bloquear });
  return !error;
}

export async function reiniciarAparatosMiembro(profileId: string): Promise<boolean> {
  const { error } = await supabase.rpc('acelerador_admin_reiniciar_aparatos', { p_profile: profileId });
  return !error;
}

// Pedido explicito del usuario 2026-07-19: el rol "lider general" necesita un apartado que solo
// muestre a quienes YA pagaron el curso Acelerador (activos y vencidos) para hacerles seguimiento
// personalizado -- distinto de "Referidos", que muestra vendedores en general sin importar si
// pagaron el curso o no.
//
// Hasta 2026-11-05 el pago ($37 USD) era una RENOVACION de 30 dias; desde ahi es un pago unico de
// $1.600.000 COP que da 100 años (de por vida) por la misma via -- ver
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
