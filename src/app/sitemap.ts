import type { MetadataRoute } from 'next';

// BUG REAL ENCONTRADO 2026-07-20: ver robots.ts -- mismo problema, /sitemap.xml devolvia el 404
// de Next.js en produccion porque el archivo real solo existia en el repo Angular, que ya no sirve
// esta ruta. Se porta 1:1 el mismo listado estatico que tenia Angular (src/sitemap.xml).
// Pendiente documentado (sin resolver aca, fuera de alcance de este fix): agregar los
// /productos/:id dinamicos desde Supabase, hoy el sitemap solo tiene paginas estaticas.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://www.lokomproaqui.com/info', changeFrequency: 'weekly', priority: 1.0 },
    { url: 'https://www.lokomproaqui.com/acelerador', changeFrequency: 'weekly', priority: 0.9 },
    { url: 'https://www.lokomproaqui.com/listproduct', changeFrequency: 'daily', priority: 0.8 },
    { url: 'https://www.lokomproaqui.com/tutoriales', changeFrequency: 'weekly', priority: 0.7 },
    { url: 'https://www.lokomproaqui.com/testimonio', changeFrequency: 'monthly', priority: 0.6 },
    { url: 'https://www.lokomproaqui.com/infoSupplier', changeFrequency: 'monthly', priority: 0.6 },
  ];
}
