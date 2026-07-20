import { supabase } from './supabase';

// Modulo "Generacion de Guias" (pedido explicito del usuario 2026-07-20): cotizar y generar guias
// de Mipaquete SUELTAS, sin pedido de tienda detras -- tabla standalone_shipments y Edge Functions
// guide-quote/guide-create-shipment (migracion 059, repo lokomproaqui). Mismo estilo que ventas.ts,
// reusa fetchSeguroObligatorio/buscarCiudadesMipaquete/getBalanceDropshipper/createTopup de ahi.

export const COSTO_SEGURO_GUIA = 5000;

// Tamaños preestablecidos para que elegir el paquete sea un boton, no un formulario -- pedido
// explicito del usuario ("cada campo sea una guia para que les sea facil", modulo pensado para que
// cualquiera lo use sin friccion). "Personalizar" (weight/width/height/length = null) habilita los
// 4 campos exactos en el wizard.
export interface TamanoPaquete {
  id: string;
  label: string;
  descripcion: string;
  weight: number | null;
  width: number | null;
  height: number | null;
  length: number | null;
}

export const TAMANOS_PAQUETE: TamanoPaquete[] = [
  { id: 'sobre', label: '✉️ Sobre', descripcion: 'Documentos, hasta 1kg', weight: 1, width: 25, height: 2, length: 35 },
  { id: 'chica', label: '📦 Caja chica', descripcion: 'Hasta 3kg', weight: 3, width: 20, height: 20, length: 20 },
  { id: 'mediana', label: '📦 Caja mediana', descripcion: 'Hasta 8kg', weight: 8, width: 35, height: 30, length: 35 },
  { id: 'grande', label: '📦 Caja grande', descripcion: 'Hasta 15kg', weight: 15, width: 50, height: 40, length: 50 },
  { id: 'personalizar', label: '✏️ Personalizar', descripcion: 'Ingresa el peso y las medidas exactas', weight: null, width: null, height: null, length: null },
];

export interface PickupAddress {
  id: number;
  firstName: string;
  lastName: string;
  idDocument: string;
  whatsapp: string;
  address: string;
  email: string;
  cityName: string;
  cityDaneCode: string;
}

export async function fetchPickupAddress(profileId: string): Promise<PickupAddress | null> {
  const { data, error } = await supabase
    .from('pickup_addresses')
    .select('id, first_name, last_name, id_document, whatsapp, address, email, city_name, city_dane_code')
    .eq('profile_id', profileId)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    idDocument: data.id_document || '',
    whatsapp: data.whatsapp || '',
    address: data.address || '',
    email: data.email || '',
    cityName: data.city_name || '',
    cityDaneCode: data.city_dane_code || '',
  };
}

export async function guardarPickupAddress(profileId: string, datos: Omit<PickupAddress, 'id'>): Promise<boolean> {
  const { error } = await supabase.from('pickup_addresses').insert({
    profile_id: profileId,
    first_name: datos.firstName,
    last_name: datos.lastName,
    id_document: datos.idDocument,
    whatsapp: datos.whatsapp,
    address: datos.address,
    email: datos.email,
    city_name: datos.cityName,
    city_dane_code: datos.cityDaneCode,
  });
  return !error;
}

export interface DatosGuia {
  paymentType: 'contra_entrega' | 'pago_anticipado';
  collectionValue: number;
  declaredValue: number;
  contentDescription: string;
  weight: number;
  width: number;
  height: number;
  length: number;
  receiverName: string;
  receiverPhone: string;
  receiverAddress: string;
  receiverCity: string;
  receiverNeighborhood: string;
  receiverReference: string;
  destinoDaneCode: string;
}

// Crea el borrador con todo lo ya recolectado en los pasos 2-4 del wizard, justo antes de cotizar
// -- de aca en adelante el shipment_id existe y actualizarTransportadoraGuia/generarGuia lo usan.
export async function crearGuiaBorrador(profileId: string, datos: DatosGuia): Promise<number | null> {
  const { data, error } = await supabase
    .from('standalone_shipments')
    .insert({
      profile_id: profileId,
      status: 'draft',
      payment_type: datos.paymentType,
      collection_value: datos.paymentType === 'contra_entrega' ? datos.collectionValue : 0,
      declared_value: datos.declaredValue,
      content_description: datos.contentDescription,
      weight: datos.weight,
      width: datos.width,
      height: datos.height,
      length: datos.length,
      receiver_name: datos.receiverName,
      receiver_phone: datos.receiverPhone,
      receiver_address: datos.receiverAddress,
      receiver_city: datos.receiverCity,
      receiver_neighborhood: datos.receiverNeighborhood,
      receiver_reference: datos.receiverReference,
      destino_dane_code: datos.destinoDaneCode,
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return data.id;
}

export interface CotizacionGuia {
  slug: string;
  nombre: string;
  imgTrasp: string | null;
  fleteTotal: number;
  tiempoEstimado: string;
}

export async function cotizarGuia(
  profileId: string,
  destinoDaneCode: string,
  paquete: { weight: number; width: number; height: number; length: number; declaredValue: number },
): Promise<{ cotizaciones: CotizacionGuia[]; seguroObligatorio: boolean; origenCityName: string | null }> {
  const { data: resp, error } = await supabase.functions.invoke('guide-quote', {
    body: {
      profile_id: profileId,
      destino_dane_code: destinoDaneCode,
      weight: paquete.weight,
      width: paquete.width,
      height: paquete.height,
      length: paquete.length,
      declared_value: paquete.declaredValue,
    },
  });
  if (error || !resp || resp.error) return { cotizaciones: [], seguroObligatorio: false, origenCityName: null };
  return {
    origenCityName: resp.origen_city_name ?? null,
    cotizaciones: (resp.cotizaciones || []).map((c: any) => ({
      slug: c.delivery_company_id,
      nombre: c.delivery_company_name || c.delivery_company_id,
      imgTrasp: c.logo_url || null,
      fleteTotal: c.flete_costo,
      tiempoEstimado: c.tiempo_min ? `${Math.round(c.tiempo_min / 1440)} dias` : '',
    })),
    seguroObligatorio: !!resp.insurance_forced,
  };
}

export async function actualizarTransportadoraGuia(shipmentId: number, deliveryCompanyId: string, deliveryCompanyName: string, freightCost: number, logoUrl: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('standalone_shipments')
    .update({ delivery_company_id: deliveryCompanyId, delivery_company_name: deliveryCompanyName, delivery_company_logo_url: logoUrl, freight_cost: freightCost, status: 'quoted' })
    .eq('id', shipmentId);
  return !error;
}

export async function actualizarSeguroGuia(shipmentId: number, activo: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('standalone_shipments')
    .update({ insurance_active: activo, insurance_cost: activo ? COSTO_SEGURO_GUIA : 0 })
    .eq('id', shipmentId);
  return !error;
}

export async function generarGuia(shipmentId: number): Promise<{ ok: boolean; guia?: string; message?: string }> {
  const { data: resp, error } = await supabase.functions.invoke('guide-create-shipment', { body: { shipment_id: shipmentId } });
  if (error || !resp || resp.error) return { ok: false, message: (resp && resp.error) || 'No pudimos generar la guía' };
  return { ok: true, guia: resp.guia || resp.sending_id || '' };
}

export interface GuiaRow {
  id: number;
  estado: string;
  numeroGuia: string | null;
  transportadora: string | null;
  transportadoraLogo: string | null;
  destinatario: string | null;
  telefonoDestinatario: string | null;
  ciudad: string | null;
  fecha: string;
  fleteCosto: number | null;
  seguroActivo: boolean;
  paymentType: string;
  trackingStatus: string | null;
}

const ESTADO_LABEL: Record<string, string> = {
  draft: 'Sin cotizar',
  quoted: 'Cotizada',
  generated: 'Generada',
  in_transit: 'En camino',
  delivered: 'Entregada',
  returned: 'Devuelta',
  cancelled: 'Cancelada',
};

export function estadoGuiaLabel(estado: string): string {
  return ESTADO_LABEL[estado] || estado;
}

export async function fetchMisGuias(profileId: string): Promise<GuiaRow[]> {
  const { data, error } = await supabase
    .from('standalone_shipments')
    .select('*')
    .eq('profile_id', profileId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return data.map((g: any) => ({
    id: g.id,
    estado: g.status,
    numeroGuia: g.tracking_number,
    transportadora: g.delivery_company_name,
    transportadoraLogo: g.delivery_company_logo_url,
    destinatario: g.receiver_name,
    telefonoDestinatario: g.receiver_phone,
    ciudad: g.receiver_city,
    fecha: g.created_at,
    fleteCosto: g.freight_cost,
    seguroActivo: !!g.insurance_active,
    paymentType: g.payment_type,
    trackingStatus: g.tracking_status,
  }));
}

export async function marcarGuiaDevuelta(shipmentId: number): Promise<boolean> {
  const { error } = await supabase.rpc('reject_standalone_shipment', { p_shipment_id: shipmentId });
  return !error;
}

export async function marcarGuiaEntregada(shipmentId: number): Promise<boolean> {
  const { error } = await supabase.rpc('deliver_standalone_shipment', { p_shipment_id: shipmentId });
  return !error;
}

export { buscarCiudadesMipaquete, type CiudadMipaquete } from './ventas';
