import { supabase } from './supabase';
import { extraerIdYoutube } from './cursos';

// Port de AdminComponent ("Configurar Introduccion") + ConfiguracionComponent ("Configuraciones")
// -- ambos leen/escriben la misma fila singleton `site_config` (AdminService.get/update, ya bien
// implementado en Supabase). Se junta todo en un solo archivo porque comparten la misma fuente de
// datos real.
//
// Bugs reales corregidos (no replicados):
// 1) AdminComponent.subirFile() hacia `form.append('file', this.file.foto1)` -- `foto1` es el
//    FileList completo del <input>, no el archivo (`foto1[0]`). ArchivosService.create espera un
//    solo File; con un FileList, FormData lo serializa como el string "[object FileList]" y
//    Supabase Storage terminaba subiendo ESE texto en vez del video/imagen real -- la subida nunca
//    funciono. Se corrige usando el primer archivo real.
// 2) ConfiguracionComponent.getComentario() llama a `NotificacionesService.get({where:{tipoDe:3}})`,
//    pero `get()` (Angular) nunca reconoce `where.tipoDe` -- ignora el filtro por completo y trae
//    TODAS las notificaciones de la plataforma (hasta 50), no solo los "banners". Se corrige
//    filtrando de verdad por `type = 3`.
// 3) `NotificacionesService.update()` (Angular) solo mapea `view`/`descripcion` -- nunca `titulo`.
//    Editar el titulo de un banner ya creado (el campo de texto de arriba de cada tarjeta) nunca se
//    guardaba, solo la descripcion. Se corrige guardando ambos campos.
//
// Alcance recortado: "Numero de celular de Pedidos" (cdPedidos) y "de Retiros" (cdRetiros) estan
// comentados en el HTML original (nunca se mostraron ni se guardaron realmente) -- se omiten.

export interface SiteConfigForm {
  clInformacion: string;
  cdVentas: string;
  aceleradorVideoGancho1: string;
  aceleradorVideoGancho2: string;
  tituloPrimero: string;
  urlPrimero: string;
  tituloSegundo: string;
  urlSegundo: string;
  tituloTercero: string;
  urlTercero: string;
}

export async function fetchSiteConfig(): Promise<SiteConfigForm> {
  const { data } = await supabase.from('site_config').select('*').limit(1).single();
  const info = (data && data.info_text) || {};
  return {
    clInformacion: info.clInformacion || '',
    cdVentas: info.cdVentas || '',
    aceleradorVideoGancho1: info.aceleradorVideoGancho1 || '',
    aceleradorVideoGancho2: info.aceleradorVideoGancho2 || '',
    tituloPrimero: info.tituloPrimero || '',
    urlPrimero: info.urlPrimero || '',
    tituloSegundo: info.tituloSegundo || '',
    urlSegundo: info.urlSegundo || '',
    tituloTercero: info.tituloTercero || '',
    urlTercero: info.urlTercero || '',
  };
}

export async function guardarSiteConfig(patch: Partial<SiteConfigForm>): Promise<boolean> {
  const { data: row } = await supabase.from('site_config').select('id, info_text').limit(1).single();
  if (!row) return false;
  const info = { ...(row.info_text || {}), ...patch };
  if (info.aceleradorVideoGancho1) info.aceleradorVideoGancho1 = extraerIdYoutube(info.aceleradorVideoGancho1);
  if (info.aceleradorVideoGancho2) info.aceleradorVideoGancho2 = extraerIdYoutube(info.aceleradorVideoGancho2);
  const { error } = await supabase.from('site_config').update({ info_text: info }).eq('id', row.id);
  return !error;
}

export async function subirVideoIntro(file: File): Promise<string | null> {
  const ext = (file.name || 'mp4').split('.').pop();
  const path = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('lokomproaqui-media').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('lokomproaqui-media').getPublicUrl(path);
  return data.publicUrl;
}

export interface BannerRow {
  id: number;
  titulo: string | null;
  descripcion: string | null;
}

export async function fetchBanners(): Promise<BannerRow[]> {
  const { data, error } = await supabase.from('notifications').select('*').eq('type', 3).order('created_at', { ascending: false }).limit(50);
  if (error || !data) return [];
  return data.map((n: any) => ({ id: n.id, titulo: n.title, descripcion: n.description }));
}

export async function crearBanner(titulo: string, descripcion: string): Promise<number | null> {
  const { data, error } = await supabase.from('notifications').insert({ title: titulo, description: descripcion, type: 3, is_admin: true }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function actualizarBanner(id: number, titulo: string, descripcion: string): Promise<boolean> {
  const { error } = await supabase.from('notifications').update({ title: titulo, description: descripcion }).eq('id', id);
  return !error;
}

export async function eliminarBanner(id: number): Promise<boolean> {
  const { error } = await supabase.from('notifications').delete().eq('id', id);
  return !error;
}
