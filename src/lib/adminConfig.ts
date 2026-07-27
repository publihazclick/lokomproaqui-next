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
  // Pedido explicito del usuario 2026-07-19: numero de WhatsApp de la empresa al que se le avisa
  // cada vez que alguien se registra -- ver notificarRegistroWhatsapp() mas abajo.
  cdRegistro: string;
  // Pedido explicito del usuario 2026-07-19: numero de WhatsApp que recibe el aviso cada vez que
  // alguien paga el curso Acelerador -- ver notificarPagoAceleradorWhatsapp() mas abajo.
  cdAcelerador: string;
  aceleradorVideoGancho1: string;
  aceleradorVideoGancho2: string;
  tituloPrimero: string;
  urlPrimero: string;
  tituloSegundo: string;
  urlSegundo: string;
  tituloTercero: string;
  urlTercero: string;
  // Pedido explicito del usuario 2026-07-22: boton de WhatsApp en /acelerador -- numero y mensaje
  // editables desde el admin cada vez que quiera cambiarlos (ver botonWhatsappMentoria() abajo).
  whatsappMentoriaNumero: string;
  whatsappMentoriaMensaje: string;
  // Pedido explicito del usuario 2026-07-27: el admin edita aca el asunto/contenido del correo de
  // bienvenida automatico (edge function send-welcome-email), en vez de tener que pedir un cambio
  // de codigo cada vez. El HTML se guarda tal cual el admin lo escriba (misma edge function genera
  // la version texto plano a partir del HTML). Los defaults reproducen el texto original hardcodeado
  // para que el admin vea el contenido real la primera vez que entra, no un campo vacio.
  emailAsuntoVendedor: string;
  emailHtmlVendedor: string;
  emailAsuntoProveedor: string;
  emailHtmlProveedor: string;
}

const WHATSAPP_MENTORIA_NUMERO_DEFAULT = '3202241463';
const WHATSAPP_MENTORIA_MENSAJE_DEFAULT = 'Hola Harley, estoy interesad@ en tomar la mentoría con ustedes, ya estoy generando el pago en la plataforma.';

const EMAIL_ASUNTO_VENDEDOR_DEFAULT = '¡Bienvenido a LokomproAqui! Ya puedes empezar a vender';
const EMAIL_HTML_VENDEDOR_DEFAULT = `<p>Hola {{nombre}},</p>
<p>Tu cuenta de <strong>vendedor</strong> en LokomproAqui ya está activa.</p>
<p>Ahora puedes:</p>
<ul>
  <li>Explorar el catálogo de productos de nuestros proveedores</li>
  <li>Elegir los productos que quieres vender y armar tu tienda</li>
  <li>Empezar a recibir pedidos y ganar comisiones por cada venta</li>
</ul>
<p>Entra a tu catálogo aquí: <a href="https://lokomproaqui.com/articulo">https://lokomproaqui.com/articulo</a></p>
<p>Si tienes dudas, escríbenos por WhatsApp desde el sitio y con gusto te ayudamos.</p>
<p style="color: #6b7280; font-size: 12px; margin-top: 24px;">LokomproAqui · lokomproaqui.com</p>`;

const EMAIL_ASUNTO_PROVEEDOR_DEFAULT = '¡Bienvenido a LokomproAqui! Activa tu bodega en 3 pasos';
const EMAIL_HTML_PROVEEDOR_DEFAULT = `<p>Hola {{nombre}},</p>
<p>Tu cuenta de <strong>proveedor</strong> (bodega) en LokomproAqui ya está creada.</p>
<p>Para que miles de vendedores puedan encontrar y vender tus productos, te falta:</p>
<ol>
  <li>Subir mínimo <strong>3 productos</strong> a tu catálogo</li>
  <li>Enviar tu bodega a revisión</li>
  <li>Esperar la aprobación de nuestro equipo (usualmente rápida)</li>
</ol>
<p>Sube tus productos aquí: <a href="https://lokomproaqui.com/config/productos">https://lokomproaqui.com/config/productos</a></p>
<p>Si tienes dudas, escríbenos por WhatsApp desde el sitio y con gusto te ayudamos.</p>
<p style="color: #6b7280; font-size: 12px; margin-top: 24px;">LokomproAqui · lokomproaqui.com</p>`;

export async function fetchSiteConfig(): Promise<SiteConfigForm> {
  const { data } = await supabase.from('site_config').select('info_text').limit(1).single();
  const info = (data && data.info_text) || {};
  return {
    clInformacion: info.clInformacion || '',
    cdVentas: info.cdVentas || '',
    cdRegistro: info.cdRegistro || '',
    cdAcelerador: info.cdAcelerador || '',
    aceleradorVideoGancho1: info.aceleradorVideoGancho1 || '',
    aceleradorVideoGancho2: info.aceleradorVideoGancho2 || '',
    tituloPrimero: info.tituloPrimero || '',
    urlPrimero: info.urlPrimero || '',
    tituloSegundo: info.tituloSegundo || '',
    urlSegundo: info.urlSegundo || '',
    tituloTercero: info.tituloTercero || '',
    urlTercero: info.urlTercero || '',
    whatsappMentoriaNumero: info.whatsappMentoriaNumero || WHATSAPP_MENTORIA_NUMERO_DEFAULT,
    whatsappMentoriaMensaje: info.whatsappMentoriaMensaje || WHATSAPP_MENTORIA_MENSAJE_DEFAULT,
    emailAsuntoVendedor: info.emailAsuntoVendedor || EMAIL_ASUNTO_VENDEDOR_DEFAULT,
    emailHtmlVendedor: info.emailHtmlVendedor || EMAIL_HTML_VENDEDOR_DEFAULT,
    emailAsuntoProveedor: info.emailAsuntoProveedor || EMAIL_ASUNTO_PROVEEDOR_DEFAULT,
    emailHtmlProveedor: info.emailHtmlProveedor || EMAIL_HTML_PROVEEDOR_DEFAULT,
  };
}

// Pedido explicito del usuario 2026-07-22: boton de WhatsApp visible en /acelerador -- arma el link
// wa.me con el numero y el mensaje configurados en /config/configuracion (con default de fabrica si
// el admin todavia no los toco), agregando siempre el link de esta misma pagina al final del
// mensaje para que quien reciba el WhatsApp sepa desde donde escribio el interesado.
export async function abrirWhatsappMentoria(): Promise<void> {
  const config = await fetchSiteConfig();
  const numero = (config.whatsappMentoriaNumero || WHATSAPP_MENTORIA_NUMERO_DEFAULT).replace(/\D/g, '');
  if (!numero) return;
  const mensaje = `${config.whatsappMentoriaMensaje || WHATSAPP_MENTORIA_MENSAJE_DEFAULT}\n\nhttps://lokomproaqui.com/acelerador`;
  const url = `https://wa.me/57${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

// Pedido explicito del usuario 2026-07-19: apenas alguien se registra, se le abre WhatsApp (pestaña
// nueva, sin interrumpir el redirect normal post-registro) con un mensaje pre-armado hacia el
// numero configurado desde el admin (arriba, cdRegistro) -- mismo patron "click to chat" que ya usa
// el resto de la plataforma (wa.me), no requiere ninguna API/credencial externa, funciona ya mismo.
// Si el admin no configuro un numero todavia, no hace nada (no tiene sentido abrir un chat sin
// destino).
export async function notificarRegistroWhatsapp(datos: { nombre: string; telefono: string; rol: string }): Promise<void> {
  const config = await fetchSiteConfig();
  const numero = (config.cdRegistro || '').replace(/\D/g, '');
  if (!numero) return;
  const mensaje = `Nuevo registro en LokomproAqui:\nNombre: ${datos.nombre}\nTeléfono: ${datos.telefono}\nRol: ${datos.rol}`;
  const url = `https://wa.me/57${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
}

// Correo de bienvenida automatico al registrarse, con contenido distinto para vendedor/proveedor
// (edge function `send-welcome-email`, envia via Resend). Fire-and-forget igual que
// notificarRegistroWhatsapp -- nunca bloquea el redirect post-registro. Si RESEND_API_KEY/
// RESEND_FROM todavia no estan configurados en el proyecto Supabase, la funcion responde
// ok:false sin lanzar error (mismo diseño auto-activable que whatsapp-send-confirmation).
export async function notificarRegistroEmail(datos: { email: string; nombre: string; rol: 'vendedor' | 'proveedor' }): Promise<void> {
  await supabase.functions.invoke('send-welcome-email', { body: datos }).catch(() => {});
}

// Boton "Enviar prueba" de /config/configuracion (pedido explicito del usuario 2026-07-27): dispara
// el mismo correo real que recibiria un usuario nuevo, con la plantilla YA GUARDADA en site_config
// (por eso conviene guardar antes de probar), para que el admin vea el resultado real sin tener que
// registrar una cuenta de prueba cada vez.
export async function enviarPruebaCorreoBienvenida(email: string, rol: 'vendedor' | 'proveedor'): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('send-welcome-email', { body: { email, nombre: 'Prueba', rol } });
  return !error && !!(data as { ok?: boolean } | null)?.ok;
}

// Pedido explicito del usuario 2026-07-19: mismo patron que notificarRegistroWhatsapp, pero para
// cuando alguien paga el curso Acelerador -- se llama justo cuando el polling de AceleradorCheckout
// detecta el pago confirmado (status===2), antes de que se cierre el flujo.
export async function notificarPagoAceleradorWhatsapp(datos: { nombre: string; telefono: string; email: string; montoUsd: number }): Promise<void> {
  const config = await fetchSiteConfig();
  const numero = (config.cdAcelerador || '').replace(/\D/g, '');
  if (!numero) return;
  const mensaje = `Nuevo pago del curso Acelerador en LokomproAqui:\nNombre: ${datos.nombre}\nTeléfono: ${datos.telefono}\nCorreo: ${datos.email}\nMonto: $${datos.montoUsd} USD`;
  const url = `https://wa.me/57${numero}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, '_blank');
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

// Banners de IMAGEN mostrados arriba de /articulo (pedido explicito del usuario 2026-07-22,
// migracion 074) -- reemplaza el sistema viejo de banners de solo texto (notifications type=3),
// que ademas nunca llego a mostrarse a ningun usuario real (se porto el CRUD de admin en la
// migracion a Next.js pero nunca se construyo el lado publico). Tabla dedicada `site_banners`, sin
// relacion con `notifications` (esa tabla queda intacta, sin tocar, por si algo mas la usa).
// Posiciones disponibles para el boton "Ver ahora" superpuesto (migracion 075, pedido explicito
// del usuario 2026-07-22: color y posicion se eligen POR banner, cada imagen tiene su propia
// composicion y el admin es quien ve cual queda mejor en cada una).
export type BannerButtonPosition = 'bottom-right' | 'bottom-left' | 'bottom-center' | 'top-right' | 'top-left' | 'center';

export interface BannerImagen {
  id: number;
  imageUrl: string;
  linkUrl: string | null;
  sortOrder: number;
  active: boolean;
  buttonColor: string;
  buttonPosition: BannerButtonPosition;
}

// Clases de posicionamiento absoluto para el boton "Ver ahora", compartidas entre la vista previa
// del admin (/config/configuracion) y el carrusel real (/articulo) -- una sola fuente de verdad
// para que la vista previa nunca quede desalineada con lo que ve el usuario final.
export const POSICIONES_BOTON: { value: BannerButtonPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Abajo a la derecha' },
  { value: 'bottom-left', label: 'Abajo a la izquierda' },
  { value: 'bottom-center', label: 'Abajo al centro' },
  { value: 'top-right', label: 'Arriba a la derecha' },
  { value: 'top-left', label: 'Arriba a la izquierda' },
  { value: 'center', label: 'Centrado' },
];

export function clasesPosicionBoton(pos: BannerButtonPosition): string {
  switch (pos) {
    case 'bottom-left':
      return 'absolute bottom-3 left-3';
    case 'bottom-center':
      return 'absolute bottom-3 left-1/2 -translate-x-1/2';
    case 'top-right':
      return 'absolute top-3 right-3';
    case 'top-left':
      return 'absolute top-3 left-3';
    case 'center':
      return 'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2';
    case 'bottom-right':
    default:
      return 'absolute bottom-3 right-3';
  }
}

function mapBanner(b: any): BannerImagen {
  return {
    id: b.id,
    imageUrl: b.image_url,
    linkUrl: b.link_url,
    sortOrder: b.sort_order,
    active: b.active,
    buttonColor: b.button_color || '#0d6efd',
    buttonPosition: (b.button_position || 'bottom-right') as BannerButtonPosition,
  };
}

const BANNER_SELECT = 'id, image_url, link_url, sort_order, active, button_color, button_position';

export async function fetchBannersAdmin(): Promise<BannerImagen[]> {
  const { data, error } = await supabase.from('site_banners').select(BANNER_SELECT).order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data.map(mapBanner);
}

// Consumido por /articulo (usuario final): solo banners activos, en orden.
export async function fetchBannersActivos(): Promise<BannerImagen[]> {
  const { data, error } = await supabase.from('site_banners').select(BANNER_SELECT).eq('active', true).order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data.map(mapBanner);
}

export async function subirImagenBanner(file: File): Promise<string | null> {
  const ext = (file.name || 'jpg').split('.').pop();
  const path = `uploads/banner-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from('lokomproaqui-media').upload(path, file, { upsert: true });
  if (error) return null;
  const { data } = supabase.storage.from('lokomproaqui-media').getPublicUrl(path);
  return data.publicUrl;
}

export async function crearBannerImagen(imageUrl: string, sortOrder: number): Promise<number | null> {
  const { data, error } = await supabase.from('site_banners').insert({ image_url: imageUrl, sort_order: sortOrder }).select('id').single();
  if (error || !data) return null;
  return data.id;
}

export async function actualizarBannerImagen(
  id: number,
  patch: { linkUrl?: string; sortOrder?: number; active?: boolean; buttonColor?: string; buttonPosition?: BannerButtonPosition },
): Promise<boolean> {
  const dbPatch: Record<string, unknown> = {};
  if (patch.linkUrl !== undefined) dbPatch.link_url = patch.linkUrl || null;
  if (patch.sortOrder !== undefined) dbPatch.sort_order = patch.sortOrder;
  if (patch.active !== undefined) dbPatch.active = patch.active;
  if (patch.buttonColor !== undefined) dbPatch.button_color = patch.buttonColor;
  if (patch.buttonPosition !== undefined) dbPatch.button_position = patch.buttonPosition;
  const { error } = await supabase.from('site_banners').update(dbPatch).eq('id', id);
  return !error;
}

export async function eliminarBannerImagen(id: number): Promise<boolean> {
  const { error } = await supabase.from('site_banners').delete().eq('id', id);
  return !error;
}
