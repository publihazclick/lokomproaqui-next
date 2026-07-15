import { CheckCircle2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { ContadorShipping } from '@/components/ContadorShipping';
import { CursoAdVideo } from '@/components/CursoAdVideo';

export const metadata = {
  title: 'LokomproAqui | Vende, compra y gana sin invertir',
  description: 'Tu socio confiable en el mundo del dropshipping. Vende, compra, publica y genera ingresos de forma rápida y segura.',
};

// Se refresca cada 60s -- aceleradorVideoGancho1/2 y el numero de WhatsApp se editan desde el
// panel admin (Angular, /config/configuracion), sin esto el cambio no aparece hasta el proximo
// deploy de este proyecto.
export const revalidate = 60;

function extraerIdYoutube(input: string | null): string | null {
  if (!input) return null;
  const match = input.trim().match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]+)/);
  return match ? match[1] : input;
}

const QUE_HACEMOS = [
  'Somos el aliado más confiable para nuestros proveedores.',
  'Somos el apoyo para aquellas personas que quieren generar ingresos reales y sin invertir.',
  'Nos encargamos de que los vendedores compartan y vendan tus productos.',
  'Nos encargamos de la logística de venta, que sería preparar tu pedido y enviarlo a su respectivo cliente.',
  'Nos encargamos de realizar los pagos rápidamente el mismo día que el cliente recibe su producto.',
];

const POR_QUE = [
  'Tienes tu dinero en 24 horas.',
  'Tenemos las mejores tarifas del mercado.',
  'Somos una plataforma amigable y fácil de usar.',
  'Creamos tu tienda virtual gratis y fácil.',
  'Capacitaciones gratis de marketing.',
];

export default async function InfoPage() {
  const { data: config } = await supabase.from('site_config').select('info_text').limit(1).single();
  const infoText = (config?.info_text ?? {}) as Record<string, string>;
  const numeroWhatsapp = infoText.clInformacion || '3506700802';
  const video1 = extraerIdYoutube(infoText.aceleradorVideoGancho1);
  const video2 = extraerIdYoutube(infoText.aceleradorVideoGancho2);

  return (
    <div>
      {/* Anuncio del curso Acelerador de Ventas -- Fase 4 ya porto el flujo de pago real
          (ePayco + creacion de cuenta anonima, AceleradorCheckout.tsx) a /acelerador. El CTA
          lleva con ?checkout=1 para abrir el pago de una vez, mismo comportamiento que el
          Angular original (AceleradorComponent lee ese query param). */}
      {video1 && (
        <section className="relative mx-3 my-8 overflow-hidden rounded-3xl bg-gradient-to-br from-[#04628f] via-[#02a0e3] to-[#5fd0f7] p-6 text-white shadow-[0_20px_50px_-15px_rgba(2,160,227,0.55)] sm:mx-6 sm:p-10 md:mx-auto md:max-w-5xl">
          <span className="absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
            🔥 Nuevo
          </span>

          <div className={`grid gap-6 ${video2 ? 'sm:grid-cols-2' : 'sm:max-w-sm'}`}>
            <CursoAdVideo youtubeId={video1} label="Video 1 del curso Acelerador de Ventas" />
            {video2 && <CursoAdVideo youtubeId={video2} label="Video 2 del curso Acelerador de Ventas" />}
          </div>

          <div className="mt-8">
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">Acelerador de Ventas</span>
            <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Aprende a vender como un experto</h2>
            <p className="mt-2 max-w-xl text-white/90">
              Clases grabadas + acompañamiento personalizado para llevar tu negocio al siguiente nivel.
            </p>

            <ul className="mt-4 flex flex-col gap-1.5 text-sm font-medium text-white/95 sm:flex-row sm:gap-6">
              <li>🎥 Clases grabadas, a tu ritmo</li>
              <li>🤝 Acompañamiento personalizado</li>
              <li>⚡ Acceso inmediato al pagar</li>
            </ul>

            <div className="mt-6 flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold text-white/90">
                Tan solo <strong className="text-lg">$35 USD</strong> al mes
              </span>
              <a
                href="/acelerador?checkout=1"
                className="inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[#0177a8] shadow-md transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg"
              >
                Suscribirme
              </a>
            </div>
          </div>
        </section>
      )}

      {/* Hero -- fondo solido #02a0e3 (no degradado) y boton negro en pastilla, fiel a como quedo
          definitivamente en Angular (info.component.scss: .banner/.frame-33/.registrate-gratis) --
          decision explicita del usuario 2026-07-15: dejar esta pagina igual a la version Angular,
          no la reinterpretacion en degradado que se probo primero aca. */}
      <section className="bg-[#02a0e3] px-6 py-10 text-center sm:px-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 sm:flex-row sm:text-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/imagenes/BANNER%201.png" alt="LokomproAqui" className="w-full max-w-sm sm:w-1/2" />
          <div>
            <h1 className="text-3xl font-bold leading-tight text-white sm:text-4xl">
              SOMOS TU
              <br />
              <span className="font-extrabold">MEJOR ALIADO</span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white">
              Tu socio confiable en el mundo del dropshipping. ¡Maximiza tus ganancias sin preocuparte por el
              inventario! Con nosotros, encontrarás productos de alta calidad y una experiencia de compra
              excepcional.
            </p>
            <a
              href="/singUp/vendedor/3213692393"
              className="mt-6 inline-flex items-center rounded-full bg-[#1e1e1e] px-7 py-3 text-base text-white transition-transform duration-150 hover:-translate-y-0.5"
            >
              Regístrate Gratis
            </a>
          </div>
        </div>
      </section>

      <ContadorShipping />

      {/* ¿Que hacemos? -- caja blanca con sombra suave (.seccion-dos-cajas), fiel al original */}
      <section className="mx-auto my-5 grid max-w-5xl gap-8 rounded-xl bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.1)] sm:grid-cols-2 sm:items-center sm:gap-12 sm:p-8">
        <div className="flex flex-col gap-3.5 sm:flex-row">
          <div className="flex-1 rounded-2xl border border-[#dceefc] bg-[#f4faff] p-5 text-left">
            <span className="text-3xl">🛍️</span>
            <h4 className="mt-1 font-extrabold text-[#02a0e3]">Vendedor</h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Más de 85 proveedores con productos disponibles para generar ingresos.
            </p>
          </div>
          <div className="flex-1 rounded-2xl border border-[#dceefc] bg-[#f4faff] p-5 text-left">
            <span className="text-3xl">📦</span>
            <h4 className="mt-1 font-extrabold text-[#02a0e3]">Proveedor</h4>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              Publica tus productos. Nuestra comunidad de emprendedores se encarga de comercializarlos.
            </p>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">¿Qué Hacemos?</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {QUE_HACEMOS.map((texto) => (
              <li key={texto} className="flex items-start gap-2.5 text-left">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#02a0e3]" />
                <p className="text-sm leading-relaxed text-gray-700">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Por que lokomproaqui -- misma caja blanca con sombra */}
      <section className="mx-auto my-5 grid max-w-5xl gap-8 rounded-xl bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.1)] sm:grid-cols-2 sm:items-center sm:gap-12 sm:p-8">
        {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
        <img src="/assets/imagenes/porquelokomproaqui.png" alt="" className="order-2 w-full sm:order-1" />
        <div className="order-1 sm:order-2">
          <h2 className="text-2xl font-bold text-gray-900">¿Por qué lokomproaqui?</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {POR_QUE.map((texto) => (
              <li key={texto} className="flex items-start gap-2.5 text-left">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#02a0e3]" />
                <p className="text-sm leading-relaxed text-gray-700">{texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Galeria clicable -- sin hover/sombra, igual a los .card de Bootstrap del original */}
      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-3 py-4 sm:grid-cols-3">
        <a href="/singUp/proveedor/3213692393" className="overflow-hidden rounded border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/imagenes/foto1.jpeg" alt="Registrarme como proveedor" className="w-full" />
        </a>
        <a href="/singUp/vendedor/3213692393" className="overflow-hidden rounded border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/imagenes/foto2.jpeg" alt="Registrarme como vendedor" className="w-full" />
        </a>
        <a
          href={`https://wa.me/57${numeroWhatsapp}?text=Hola Servicio al cliente`}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded border border-gray-200"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
          <img src="/assets/imagenes/foto3.jpeg" alt="Contactar asesor" className="w-full" />
        </a>
      </section>

      {/* CTA final -- fondo solido #02a0e3, mismo boton negro en pastilla que el hero */}
      <section className="mx-1 my-1 bg-[#02a0e3] px-6 py-10 text-center text-white">
        <h2 className="text-2xl font-bold">
          Registrate no
          <br />
          Pierdas Más Dinero
        </h2>
        <a
          href="/singUp/vendedor/3213692393"
          className="mt-6 inline-flex items-center rounded-full bg-[#1e1e1e] px-8 py-3.5 text-lg text-white transition-transform duration-150 hover:-translate-y-0.5"
        >
          Regístrate Gratis
        </a>
      </section>

      {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
      <img src="/assets/imagenes/transportadora.png" alt="Transportadoras aliadas" className="w-full" />
    </div>
  );
}
