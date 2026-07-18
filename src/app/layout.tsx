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

export const metadata: Metadata = {
  title: "LokomproAqui",
  description: "Marketplace LokomproAqui",
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
