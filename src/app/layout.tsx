import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { RealHeader } from "@/components/RealHeader";
import { CartProvider } from "@/lib/cartStore";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Base compartida por TODAS las paginas: cada page/layout hijo solo define su propio
// title/description y hereda de aca site name, imagen OG y tarjeta de Twitter -- antes no
// habia openGraph/twitter en ningun lado, asi que compartir un link se veia sin imagen/preview.
export const metadata: Metadata = {
  metadataBase: new URL("https://www.lokomproaqui.com"),
  title: "LokomproAqui | Dropshipping en Colombia sin Inventario",
  description: "Vende por internet sin invertir en inventario. Catálogo dropshipping con envío y pago contra entrega.",
  robots: { index: true, follow: true },
  openGraph: {
    siteName: "LokomproAqui",
    locale: "es_CO",
    type: "website",
    images: [{ url: "https://www.lokomproaqui.com/assets/logo.jpeg", width: 600, height: 600 }],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* overflow-x-hidden como respaldo global: contenido dinamico (ej. descripcion de producto
          con HTML crudo desde la base de datos) puede desbordar su contenedor en mobile si trae
          palabras/URLs largas sin espacios o elementos con ancho fijo -- esto evita que ESO
          arrastre a toda la pagina a poder scrollear de lado, aunque el elemento en si se corte. */}
      <body className="min-h-full flex flex-col overflow-x-hidden">
        <CartProvider>
          <RealHeader />
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
