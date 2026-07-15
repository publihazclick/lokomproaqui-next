import { supabase } from './supabase';

// Port de CatalogoComponent (Angular, modulo `publico`, "/publico[/:id]") -- vista PUBLICA (sin
// login) de un catalogo armado en /config/catalago. CatalogoService.get()/getDetallado() ya
// estaban bien implementados para lo que esta pantalla necesita (sin bugs de filtro).
//
// Bug real encontrado y corregido (no replicado): "Descargar" (una foto o todas) llamaba a
// `CatalogoService.FormatoBase64(foto)`, que es un no-op (`return Promise.resolve(foto)` -- NO
// convierte nada a base64, devuelve la URL tal cual) y despues a `ToolsService.descargarFoto(url)`,
// que espera un data-URI `data:...;base64,XXXX` y hace `atob(url.split(';base64,')[1])` -- con una
// URL comun (sin ese separador) el segundo elemento es `undefined`, y `atob(undefined)` explota con
// `InvalidCharacterError`. En produccion HOY el boton "Descargar" siempre tira un error de JS y
// nunca descarga nada. Se corrige con un fetch+blob+link real (descargarImagen), que si funciona
// para imagenes publicas de Supabase Storage.
//
// La regla real de "precio minorista vs mayorista segun geolocalizacion" (rango <= 12111km de un
// punto fijo cerca de Cucuta) se replica tal cual via useDetectarRango -- es una regla real y
// activa (aunque el umbral es tan generoso que en la practica casi siempre da "dentro de rango"),
// no un bug a corregir.

export interface CatalogoPublico {
  id: number;
  titulo: string | null;
  precio: number | null;
  precioMayor: number | null;
}

export async function fetchCatalogoPublico(id: number): Promise<CatalogoPublico | null> {
  const { data, error } = await supabase.from('catalogs').select('*').eq('id', id).eq('status', 1).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, titulo: data.title, precio: data.price, precioMayor: data.wholesale_price };
}

export interface ItemGaleria {
  id: number;
  foto: string;
}

export async function fetchGaleriaCatalogo(catalogoId?: number): Promise<ItemGaleria[]> {
  let q = supabase.from('catalog_items').select('*, products(image_url)');
  if (catalogoId) q = q.eq('catalog_id', catalogoId);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map((i: any) => ({ id: i.id, foto: i.products ? i.products.image_url : i.image_url })).filter((i) => i.foto);
}

// Descarga real de una imagen (reemplaza el flujo roto FormatoBase64+atob del original).
export async function descargarImagen(url: string, nombreArchivo: string): Promise<void> {
  const res = await fetch(url);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

// Haversine, mismo radio (6378.137km) y punto fijo que ToolsService.calcularDistancia (Angular).
function distanciaKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const RADIO = 6378.137;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return RADIO * c;
}

const PUNTO_FIJO = { lat: 7.888474, lon: -72.497094 };

export function detectarRango(): Promise<boolean> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(distanciaKm(pos.coords.latitude, pos.coords.longitude, PUNTO_FIJO.lat, PUNTO_FIJO.lon) <= 12111),
      () => resolve(true),
    );
  });
}
