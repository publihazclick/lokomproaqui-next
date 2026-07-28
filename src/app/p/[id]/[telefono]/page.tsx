import { cache } from 'react';
import type { Metadata } from 'next';
import { conTimeout } from '@/lib/supabase';
import { fetchProductoById, fetchGaleriaProducto, type ProductoLegacy } from '@/lib/productos';
import { resolverTiendaPorTelefono, type TiendaFront } from '@/lib/front';
import { ProductLandingClient } from '@/components/ProductLandingClient';

// Mismo criterio de formato que ToolsService.monedaChange / formatCOP (lib/cartStore.tsx) --
// version propia porque cartStore.tsx es 'use client' (Context de carrito) y generateMetadata
// corre 100% en el servidor: React Server Components no permite invocar directamente una funcion
// que vive en un modulo marcado 'use client', aunque sea pura (bug real encontrado probando esta
// pagina en local: "Attempted to call formatCOP() from the server").
function formatCOPServidor(valor: number | null | undefined): string {
  if (!valor) return '0';
  return Math.round(valor).toLocaleString('es-CO');
}

// Landing de producto de alta conversion (pedido explicito del usuario 2026-07-28), pensada para
// recibir trafico de campañas pagas (Meta/TikTok/Google Ads). Server Component a proposito, a
// diferencia del resto de paginas publicas de esta vitrina (que son 'use client' + fetch en
// useEffect, con un parpadeo de pantalla en blanco mientras carga): el HTML llega ya armado en la
// primera respuesta -- clave tanto para Core Web Vitals (afecta el Quality Score/CPM real de un
// anuncio) como para que el link se vea bien al compartirse (WhatsApp/Facebook/Instagram no
// ejecutan JS al generar la vista previa de un link, solo leen las metaetiquetas del HTML crudo).
//
// revalidate corto (mismo patron ya usado en /info tras el incidente de 2026-07-16 de consultas
// lentas a Supabase) + conTimeout como respaldo si la consulta se cuelga.
export const revalidate = 30;

interface Params {
  id: string;
  telefono: string;
}

type DatosLanding = [ProductoLegacy | null, TiendaFront | null, string[]];

// cache() de React deduplica la llamada dentro del mismo request -- generateMetadata y el
// componente de la pagina necesitan los mismos datos, sin esto se pagaria el viaje de red a
// Supabase 2 veces por cada visita.
const cargarDatos = cache(async (id: string, telefono: string) => {
  const fallback: DatosLanding = [null, null, []];
  const [producto, tienda, galeriaProducto] = await conTimeout<DatosLanding>(
    Promise.all([fetchProductoById(id), resolverTiendaPorTelefono(telefono), fetchGaleriaProducto(id)]),
    fallback,
    6000,
  );
  return { producto, tienda, galeriaProducto };
});

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id, telefono } = await params;
  const { producto } = await cargarDatos(id, telefono);
  if (!producto) return { title: 'Producto no disponible | LokomproAqui' };

  const titulo = `${producto.pro_nombre} · $${formatCOPServidor(producto.pro_uni_venta)} | LokomproAqui`;
  const descripcion = producto.pro_descripcionbreve || 'Pago contra entrega. Envío a toda Colombia en 24 horas.';
  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/p/${id}/${telefono}` },
    openGraph: { title: titulo, description: descripcion, images: [{ url: producto.foto, width: 800, height: 800 }], type: 'website' },
    twitter: { card: 'summary_large_image', title: titulo, description: descripcion, images: [producto.foto] },
  };
}

export default async function ProductLandingPage({ params }: { params: Promise<Params> }) {
  const { id, telefono } = await params;
  const { producto, tienda, galeriaProducto } = await cargarDatos(id, telefono);

  if (!producto || !tienda) {
    return <p className="py-24 text-center text-gray-500">Este producto ya no está disponible.</p>;
  }

  return <ProductLandingClient producto={producto} tienda={tienda} galeriaProducto={galeriaProducto} />;
}
