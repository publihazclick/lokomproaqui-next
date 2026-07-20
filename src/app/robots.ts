import type { MetadataRoute } from 'next';

// BUG REAL ENCONTRADO 2026-07-20: /robots.txt y /sitemap.xml SI existen en el repo Angular
// (src/robots.txt, src/sitemap.xml, agregados en el SEO tecnico del 2026-07-19) pero desde el
// descubrimiento del 2026-07-16 (dominio compartido entre los 2 proyectos de Vercel, Next.js gana
// casi todas las rutas) esas 2 rutas devuelven el 404 de NEXT.JS en produccion -- Next nunca tuvo
// su propia version. Se portan aca 1:1 (mismas reglas que Angular) usando la convencion nativa de
// Next (genera /robots.txt real).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/config/',
        '/mvid8x2qz1',
        '/login',
        '/qz7f3f0888',
        '/registro',
        '/singUp',
        '/pedidos',
        '/realizarventa',
        '/portal',
        '/front',
        '/publico',
      ],
    },
    sitemap: 'https://www.lokomproaqui.com/sitemap.xml',
  };
}
