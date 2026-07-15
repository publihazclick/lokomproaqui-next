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
      .map((l: any) => ({ id: l.id, moduleId: l.module_id, titulo: l.title, descripcion: l.description, ordenamiento: l.sort_order, duracionSegundos: l.duration_seconds })),
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

export function formatDuracion(segundos: number | null): string {
  if (segundos == null) return '';
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
