import { ContadorShipping } from '@/components/ContadorShipping';

export const metadata = {
  title: 'Portal | LokomproAqui',
};

// Port desde src/app/layout/portal (Angular) -- pagina 100% estatica, sin datos de Supabase.
const ITEMS = [
  'Dropshipping',
  'Envios Contraentrega',
  'Envios y Logistica',
  'Envios y Logistica',
  'Desembolso Rapido',
];

export default function PortalPage() {
  return (
    <div>
      <div className="bg-[#02a0e3] px-6 py-10 text-center text-white sm:px-16 sm:py-14">
        <h3 className="text-lg font-semibold">SOMOS EL MEJOR ALIADO PARA</h3>
        <h1 className="text-3xl font-extrabold sm:text-4xl">VENDER TUS PRODUCTOS</h1>
        <h2 className="text-lg font-semibold">Y GENERAR INGRESOS SIN INVERTIR</h2>
      </div>

      <ContadorShipping />

      <div className="mx-auto flex max-w-5xl flex-wrap justify-center gap-6 px-4 py-10">
        {ITEMS.map((item, i) => (
          // eslint-disable-next-line react/no-array-index-key -- lista estatica, "Envios y Logistica" se repite en el original
          <div key={i} className="w-28 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- servido por el proyecto Angular en el mismo dominio */}
            <img src="/assets/noimagen.jpg" alt="" className="mx-auto w-24" />
            <h6 className="mt-2 text-sm font-semibold">{item}</h6>
          </div>
        ))}
      </div>
    </div>
  );
}
