import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Fotos de producto/perfil/banners subidas al bucket publico lokomproaqui-media.
      { protocol: "https", hostname: "enajheqrfbglcpsqglnb.supabase.co", pathname: "/storage/v1/object/public/**" },
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
