import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Fotos de perfil/banners subidas al bucket publico lokomproaqui-media.
      { protocol: "https", hostname: "enajheqrfbglcpsqglnb.supabase.co", pathname: "/storage/v1/object/public/**" },
      // products.image_url / categories.image_url viven en OTRO proyecto Supabase (bucket
      // imagenes-productos) -- confirmado con datos reales de produccion, no es un typo. Sin este
      // dominio, next/image rechaza todas las fotos de producto/categoria del catalogo.
      { protocol: "https", hostname: "tisrfefpjordcpuzyiwr.supabase.co", pathname: "/storage/v1/object/public/**" },
      // Miniaturas de YouTube usadas en tutoriales/academia.
      { protocol: "https", hostname: "img.youtube.com" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/s/:code",
        destination: "https://btkdmdhzouzvzgyuzgbh.supabase.co/functions/v1/sms-link-redirect/:code",
      },
    ];
  },
};

export default nextConfig;
