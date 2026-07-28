// Tracking de conversion para la landing de producto (/p/[id]/[telefono], ver
// ProductLandingClient.tsx) -- pensada para recibir trafico de campañas pagas. Los 3 IDs se leen
// de variables de entorno publicas; mientras no esten seteadas en Vercel, cada funcion no hace
// nada (no se cargan scripts externos ni se disparan eventos) -- queda "listo para pegar" sin
// romper nada en el deploy actual. Cuando el usuario tenga los IDs reales, solo hay que agregar
// las env vars (NEXT_PUBLIC_META_PIXEL_ID / NEXT_PUBLIC_TIKTOK_PIXEL_ID / NEXT_PUBLIC_GA_MEASUREMENT_ID)
// en Vercel y hacer un redeploy -- sin tocar codigo.

export const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '';
export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (event: string, params?: Record<string, unknown>) => void };
    gtag?: (...args: unknown[]) => void;
  }
}

interface EventoProducto {
  id: number;
  nombre: string;
  precio: number;
  cantidad?: number;
}

// Un solo punto de disparo por evento -- cada plataforma tiene su propio vocabulario de eventos
// estandar de ecommerce (ViewContent/AddToCart/InitiateCheckout/Purchase), se mapean los 3 juntos
// aca para no repetir los "if (window.fbq)" sueltos en el componente de la landing.
function disparar(meta: string, tiktok: string, ga: string, producto: EventoProducto, extra?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  const value = producto.precio * (producto.cantidad || 1);

  if (META_PIXEL_ID && window.fbq) {
    window.fbq('track', meta, {
      content_ids: [String(producto.id)],
      content_name: producto.nombre,
      content_type: 'product',
      currency: 'COP',
      value,
      ...extra,
    });
  }
  if (TIKTOK_PIXEL_ID && window.ttq) {
    window.ttq.track(tiktok, {
      content_id: String(producto.id),
      content_name: producto.nombre,
      content_type: 'product',
      currency: 'COP',
      value,
      quantity: producto.cantidad || 1,
    });
  }
  if (GA_MEASUREMENT_ID && window.gtag) {
    window.gtag('event', ga, {
      currency: 'COP',
      value,
      items: [{ item_id: String(producto.id), item_name: producto.nombre, price: producto.precio, quantity: producto.cantidad || 1 }],
    });
  }
}

export function pixelViewContent(producto: EventoProducto) {
  disparar('ViewContent', 'ViewContent', 'view_item', producto);
}

export function pixelInitiateCheckout(producto: EventoProducto) {
  disparar('InitiateCheckout', 'InitiateCheckout', 'begin_checkout', producto);
}

export function pixelPurchase(producto: EventoProducto, orderId: number) {
  disparar('Purchase', 'CompletePayment', 'purchase', producto, { transaction_id: String(orderId) });
}
